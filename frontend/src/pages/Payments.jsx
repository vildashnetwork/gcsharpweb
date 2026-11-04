import { useEffect, useState } from "react";
import {
    BookOpen, CheckCircle2, Clock3, Loader2, RefreshCw, Smartphone, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const OPERATORS = [
    { id: "mtn_momo", label: "MTN Mobile Money", color: "border-yellow-500/60" },
    { id: "orange_money", label: "Orange Money", color: "border-orange-500/60" },
];
const FINAL_STATUSES = new Set(["paid", "failed", "cancelled", "expired", "refunded"]);

function errorMessage(error, fallback) {
    return error?.response?.data?.detail || error?.message || fallback;
}

function formatPrice(amount) {
    return `${new Intl.NumberFormat().format(amount)} XAF`;
}

export default function Payments() {
    const { checkAuth } = useAuth();
    const [plans, setPlans] = useState([]);
    const [loadingPlans, setLoadingPlans] = useState(true);
    const [plansError, setPlansError] = useState("");
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [operator, setOperator] = useState("mtn_momo");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [order, setOrder] = useState(null);
    const [statusError, setStatusError] = useState("");

    useEffect(() => {
        let cancelled = false;
        api.get("/payments/plans")
            .then(({ data }) => {
                if (!cancelled) setPlans(Array.isArray(data.plans) ? data.plans : []);
            })
            .catch((error) => {
                if (!cancelled) setPlansError(errorMessage(error, "Could not load payment plans."));
            })
            .finally(() => {
                if (!cancelled) setLoadingPlans(false);
            });
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        if (!order?.order_id || FINAL_STATUSES.has(order.status)) return undefined;
        let cancelled = false;
        let timer;
        let attempts = 0;

        const checkStatus = async () => {
            try {
                const { data } = await api.get(`/payments/orders/${encodeURIComponent(order.order_id)}`);
                if (cancelled) return;
                setOrder(data);
                setStatusError("");
                if (data.status === "paid") {
                    await checkAuth();
                    toast.success("Payment confirmed. Your purchase is ready.");
                    return;
                }
            } catch (error) {
                if (cancelled) return;
                setStatusError(errorMessage(error, "Could not check payment status."));
            }

            if (!cancelled) {
                const delay = Math.min(5000 * (2 ** attempts), 30000);
                attempts += 1;
                timer = window.setTimeout(checkStatus, delay);
            }
        };

        timer = window.setTimeout(checkStatus, 3000);
        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [order?.order_id, order?.status, checkAuth]);

    const createCheckout = async (event) => {
        event.preventDefault();
        if (!selectedPlan) return;
        setCreatingOrder(true);
        setStatusError("");
        setOrder(null);
        try {
            const { data } = await api.post(
                "/payments/checkout",
                {
                    product_id: selectedPlan.id,
                    payment_method: operator,
                    phone_number: phoneNumber,
                },
                { headers: { "Idempotency-Key": window.crypto.randomUUID() } },
            );
            setOrder(data);
            toast.info(data.instructions || "Approve the payment request on your phone.");
        } catch (error) {
            toast.error(errorMessage(error, "Could not start the payment."));
        } finally {
            setCreatingOrder(false);
        }
    };

    const selectPlan = (plan) => {
        setSelectedPlan(plan);
        setOrder(null);
        setStatusError("");
    };

    return (
        <div className="mx-auto max-w-5xl space-y-8">
            <header>
                <p className="text-sm font-semibold uppercase tracking-wide text-primary">Plans & payments</p>
                <h1 className="mt-2 text-3xl font-display font-bold">Get more from GC Sharp</h1>
                <p className="mt-2 max-w-2xl text-muted-foreground">
                    Buy AI tokens or extend offline access. Pay securely with MTN Mobile Money or Orange Money.
                </p>
            </header>

            {plansError && (
                <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {plansError}
                </div>
            )}

            {loadingPlans ? (
                <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" /> Loading plans…
                </div>
            ) : plans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
                    <Sparkles className="mx-auto h-8 w-8 text-primary" />
                    <h2 className="mt-4 text-lg font-semibold">No plans available yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Token bundles and offline access plans will appear here when they are configured.
                    </p>
                </div>
            ) : (
                <section aria-label="Available plans" className="grid gap-4 sm:grid-cols-2">
                    {plans.map((plan) => {
                        const offline = plan.product_type === "offline_access";
                        const active = selectedPlan?.id === plan.id;
                        const Icon = offline ? BookOpen : Sparkles;
                        return (
                            <button
                                type="button"
                                key={plan.id}
                                onClick={() => selectPlan(plan)}
                                aria-pressed={active}
                                className={`rounded-2xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/60 hover:shadow-md ${active ? "border-primary ring-2 ring-primary/20" : "border-border"}`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                        <Icon className="h-5 w-5" />
                                    </span>
                                    <span className="text-lg font-bold">{formatPrice(plan.amount)}</span>
                                </div>
                                <h2 className="mt-4 font-semibold">{plan.name}</h2>
                                <p className="mt-1 min-h-10 text-sm text-muted-foreground">
                                    {plan.description || (offline
                                        ? `${plan.duration_days} days of offline access`
                                        : `${plan.token_quantity} AI tokens`)}
                                </p>
                                <p className="mt-3 text-xs font-medium text-primary">
                                    {offline ? `${plan.duration_days} days offline access` : `${plan.token_quantity} AI tokens`}
                                </p>
                            </button>
                        );
                    })}
                </section>
            )}

            {selectedPlan && (
                <form onSubmit={createCheckout} className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                    <h2 className="text-xl font-semibold">Pay for {selectedPlan.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        You’ll receive a payment prompt on your phone. Approve it to complete your purchase.
                    </p>

                    <fieldset className="mt-6">
                        <legend className="mb-3 text-sm font-medium">Choose a mobile money operator</legend>
                        <div className="grid gap-3 sm:grid-cols-2">
                            {OPERATORS.map((item) => (
                                <button
                                    type="button"
                                    key={item.id}
                                    onClick={() => setOperator(item.id)}
                                    aria-pressed={operator === item.id}
                                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${operator === item.id ? `${item.color} bg-primary/5 ring-1 ring-primary/20` : "border-border hover:border-primary/40"}`}
                                >
                                    <Smartphone className="h-5 w-5 text-primary" />
                                    <span className="font-medium">{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <div className="mt-5 max-w-md space-y-2">
                        <Label htmlFor="payment-phone">Cameroon mobile number</Label>
                        <Input
                            id="payment-phone"
                            type="tel"
                            autoComplete="tel"
                            placeholder="+237 6XX XXX XXX"
                            value={phoneNumber}
                            onChange={(event) => setPhoneNumber(event.target.value)}
                            required
                            minLength={9}
                            maxLength={32}
                        />
                    </div>

                    <Button type="submit" disabled={creatingOrder || !phoneNumber.trim()} className="mt-6 gap-2">
                        {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                        {creatingOrder ? "Starting payment…" : `Pay ${formatPrice(selectedPlan.amount)}`}
                    </Button>
                </form>
            )}

            {order && (
                <section aria-live="polite" className="rounded-2xl border border-border bg-card p-5 sm:p-7">
                    <div className="flex items-start gap-3">
                        {order.status === "paid"
                            ? <CheckCircle2 className="mt-0.5 h-6 w-6 text-emerald-500" />
                            : order.status === "failed" || order.status === "cancelled" || order.status === "expired"
                                ? <RefreshCw className="mt-0.5 h-6 w-6 text-destructive" />
                                : <Clock3 className="mt-0.5 h-6 w-6 text-amber-500" />}
                        <div>
                            <h2 className="font-semibold">
                                {order.status === "paid" ? "Payment confirmed"
                                    : order.status === "failed" || order.status === "cancelled" || order.status === "expired"
                                        ? "Payment not completed"
                                        : "Waiting for payment confirmation"}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {order.status === "paid"
                                    ? "Your purchase has been applied to your account."
                                    : order.status === "failed" || order.status === "cancelled" || order.status === "expired"
                                        ? order.failure_message || "You can choose a plan and try again."
                                        : "Approve the payment prompt on your phone. This page will update after the provider confirms your payment."}
                            </p>
                            {statusError && <p role="status" className="mt-2 text-sm text-amber-700">{statusError} We’ll keep checking.</p>}
                            <p className="mt-3 text-xs text-muted-foreground">Order ID: {order.order_id}</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
