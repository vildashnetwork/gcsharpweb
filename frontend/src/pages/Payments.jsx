import { useEffect, useMemo, useRef, useState } from "react";
import {
    BookOpen, Check, CheckCircle2, Clock3, Loader2, RefreshCw, ShieldCheck,
    Smartphone, Sparkles, XCircle, Zap,
} from "lucide-react";
import { toast } from "sonner";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

const OPERATORS = [
    { id: "mtn_momo", label: "MTN Mobile Money", short: "MTN", dot: "bg-yellow-400", ring: "border-yellow-500/70 ring-yellow-500/20" },
    { id: "orange_money", label: "Orange Money", short: "Orange", dot: "bg-orange-500", ring: "border-orange-500/70 ring-orange-500/20" },
];
const FINAL_STATUSES = new Set(["paid", "failed", "cancelled", "expired", "refunded"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "expired"]);

function errorMessage(error, fallback) {
    return error?.response?.data?.detail || error?.message || fallback;
}

function formatPrice(amount) {
    return `${new Intl.NumberFormat().format(amount)} XAF`;
}

function Stepper({ step }) {
    const steps = ["Choose a plan", "Pay with mobile money", "Confirmation"];
    return (
        <ol className="flex items-center gap-2 text-xs sm:text-sm" aria-label="Checkout progress">
            {steps.map((label, index) => {
                const number = index + 1;
                const done = step > number;
                const current = step === number;
                return (
                    <li key={label} className="flex flex-1 items-center gap-2 last:flex-none">
                        <span
                            aria-current={current ? "step" : undefined}
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors ${done ? "border-primary bg-primary text-primary-foreground"
                                : current ? "border-primary bg-primary/10 text-primary"
                                    : "border-border text-muted-foreground"
                                }`}
                        >
                            {done ? <Check className="h-3.5 w-3.5" /> : number}
                        </span>
                        <span className={`hidden sm:inline ${current || done ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                            {label}
                        </span>
                        {number < steps.length && (
                            <span className={`h-px flex-1 transition-colors ${done ? "bg-primary" : "bg-border"}`} aria-hidden="true" />
                        )}
                    </li>
                );
            })}
        </ol>
    );
}

function PlanSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
            {[0, 1, 2, 3].map((i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5">
                    <div className="flex justify-between">
                        <div className="h-11 w-11 rounded-xl bg-muted" />
                        <div className="h-6 w-24 rounded bg-muted" />
                    </div>
                    <div className="mt-5 h-4 w-1/2 rounded bg-muted" />
                    <div className="mt-3 h-3 w-3/4 rounded bg-muted" />
                </div>
            ))}
        </div>
    );
}

function PlanCard({ plan, active, bestValue, onSelect }) {
    const offline = plan.product_type === "offline_access";
    const Icon = offline ? BookOpen : Sparkles;
    const perk = offline ? `${plan.duration_days} days offline access` : `${plan.token_quantity} AI tokens`;
    return (
        <button
            type="button"
            onClick={() => onSelect(plan)}
            aria-pressed={active}
            className={`group relative flex flex-col rounded-2xl border bg-card p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? "border-primary bg-primary/[0.03] ring-2 ring-primary/20" : "border-border"
                }`}
        >
            {bestValue && (
                <span className="absolute -top-2.5 left-5 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm">
                    <Zap className="h-3 w-3" /> Best value
                </span>
            )}
            <div className="flex items-start justify-between gap-4">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary/15"}`}>
                    <Icon className="h-5 w-5" />
                </span>
                <div className="text-right">
                    <span className="block text-xl font-bold tabular-nums leading-tight">{formatPrice(plan.amount)}</span>
                    {!offline && plan.token_quantity > 0 && (
                        <span className="text-xs text-muted-foreground">
                            ≈ {new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(plan.amount / plan.token_quantity)} XAF / token
                        </span>
                    )}
                </div>
            </div>
            <h3 className="mt-4 font-semibold">{plan.name}</h3>
            <p className="mt-1 min-h-10 text-sm text-muted-foreground">
                {plan.description || perk}
            </p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs font-medium text-primary">{perk}</span>
                <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"
                        }`}
                    aria-hidden="true"
                >
                    <Check className="h-3 w-3" />
                </span>
            </div>
        </button>
    );
}

function PlanGroup({ title, subtitle, plans, selectedPlan, bestValueId, onSelect }) {
    if (plans.length === 0) return null;
    return (
        <section aria-label={title} className="space-y-4">
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="text-sm text-muted-foreground">{subtitle}</p>
            </div>
            <div className="grid gap-4 pt-2 sm:grid-cols-2">
                {plans.map((plan) => (
                    <PlanCard
                        key={plan.id}
                        plan={plan}
                        active={selectedPlan?.id === plan.id}
                        bestValue={plan.id === bestValueId}
                        onSelect={onSelect}
                    />
                ))}
            </div>
        </section>
    );
}

function OrderStatus({ order, statusError, onRetry }) {
    const paid = order.status === "paid";
    const failed = FAILED_STATUSES.has(order.status);
    const refunded = order.status === "refunded";

    const tone = paid
        ? { box: "border-emerald-500/30 bg-emerald-500/5", icon: "bg-emerald-500/15 text-emerald-600", Icon: CheckCircle2 }
        : failed
            ? { box: "border-destructive/30 bg-destructive/5", icon: "bg-destructive/10 text-destructive", Icon: XCircle }
            : refunded
                ? { box: "border-border bg-card", icon: "bg-muted text-muted-foreground", Icon: RefreshCw }
                : { box: "border-amber-500/30 bg-amber-500/5", icon: "bg-amber-500/15 text-amber-600", Icon: Clock3 };

    const title = paid ? "Payment confirmed"
        : failed ? "Payment not completed"
            : refunded ? "Payment refunded"
                : "Waiting for payment confirmation";

    const body = paid
        ? "Your purchase has been applied to your account."
        : failed
            ? order.failure_message || "You can choose a plan and try again."
            : refunded
                ? "This payment was refunded. Contact support if you have questions."
                : "Approve the payment prompt on your phone. This page will update after the provider confirms your payment.";

    const pending = !FINAL_STATUSES.has(order.status);

    return (
        <section aria-live="polite" className={`rounded-2xl border p-5 sm:p-7 ${tone.box}`}>
            <div className="flex items-start gap-4">
                <span className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone.icon}`}>
                    {pending && <span className="absolute inset-0 animate-ping rounded-full bg-amber-500/20" aria-hidden="true" />}
                    <tone.Icon className="relative h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold">{title}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{body}</p>

                    {pending && (
                        <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-amber-500/15" aria-hidden="true">
                            <div className="h-full w-1/3 animate-pulse rounded-full bg-amber-500" />
                        </div>
                    )}

                    {statusError && (
                        <p role="status" className="mt-3 text-sm text-amber-700">
                            {statusError} We’ll keep checking.
                        </p>
                    )}

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            Order ID: <span className="font-mono">{order.order_id}</span>
                        </p>
                        {(failed || refunded) && (
                            <Button type="button" variant="outline" size="sm" onClick={onRetry} className="gap-2">
                                <RefreshCw className="h-3.5 w-3.5" /> Try again
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
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
    const checkoutRef = useRef(null);

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

    const tokenPlans = useMemo(() => plans.filter((p) => p.product_type !== "offline_access"), [plans]);
    const offlinePlans = useMemo(() => plans.filter((p) => p.product_type === "offline_access"), [plans]);

    // Lowest price per token, only meaningful when there is more than one bundle to compare.
    const bestValueId = useMemo(() => {
        const comparable = tokenPlans.filter((p) => p.token_quantity > 0);
        if (comparable.length < 2) return null;
        return comparable.reduce((best, p) =>
            (p.amount / p.token_quantity < best.amount / best.token_quantity ? p : best)).id;
    }, [tokenPlans]);

    const step = order ? 3 : selectedPlan ? 2 : 1;

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
        window.setTimeout(() => {
            checkoutRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }, 50);
    };

    const resetOrder = () => {
        setOrder(null);
        setStatusError("");
    };

    const selectedOffline = selectedPlan?.product_type === "offline_access";
    const selectedPerk = selectedPlan
        ? (selectedOffline ? `${selectedPlan.duration_days} days offline access` : `${selectedPlan.token_quantity} AI tokens`)
        : "";
    const activeOperator = OPERATORS.find((item) => item.id === operator);

    return (
        <div className="mx-auto max-w-5xl space-y-8 pb-10">
            <header className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8">
                <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
                <p className="relative text-xs font-semibold uppercase tracking-widest text-primary">Plans & payments</p>
                <h1 className="relative mt-2 text-3xl font-display font-bold sm:text-4xl">Get more from GC Sharp</h1>
                <p className="relative mt-3 max-w-2xl text-muted-foreground">
                    Buy AI tokens or extend offline access. Pay securely with MTN Mobile Money or Orange Money.
                </p>
                <ul className="relative mt-5 flex flex-wrap gap-2 text-xs font-medium">
                    <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secure payment
                    </li>
                    <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-yellow-400" /> MTN MoMo
                    </li>
                    <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5">
                        <span className="h-2 w-2 rounded-full bg-orange-500" /> Orange Money
                    </li>
                    <li className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/70 px-3 py-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" /> Applied instantly
                    </li>
                </ul>
            </header>

            <Stepper step={step} />

            {plansError && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{plansError}</span>
                </div>
            )}

            {loadingPlans ? (
                <PlanSkeleton />
            ) : plans.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
                    <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <Sparkles className="h-7 w-7" />
                    </span>
                    <h2 className="mt-4 text-lg font-semibold">No plans available yet</h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                        Token bundles and offline access plans will appear here when they are configured.
                    </p>
                </div>
            ) : (
                <div className="space-y-10">
                    <PlanGroup
                        title="AI tokens"
                        subtitle="Top up to keep using AI features. Tokens never expire."
                        plans={tokenPlans}
                        selectedPlan={selectedPlan}
                        bestValueId={bestValueId}
                        onSelect={selectPlan}
                    />
                    <PlanGroup
                        title="Offline access"
                        subtitle="Keep studying without a connection."
                        plans={offlinePlans}
                        selectedPlan={selectedPlan}
                        bestValueId={null}
                        onSelect={selectPlan}
                    />
                </div>
            )}

            {selectedPlan && (
                <div ref={checkoutRef} className="grid scroll-mt-6 gap-6 lg:grid-cols-[1fr_320px]">
                    <form onSubmit={createCheckout} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
                        <h2 className="text-xl font-semibold">Pay with mobile money</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            You’ll receive a payment prompt on your phone. Approve it to complete your purchase.
                        </p>

                        <fieldset className="mt-6">
                            <legend className="mb-3 text-sm font-medium">Choose a mobile money operator</legend>
                            <div className="grid gap-3 sm:grid-cols-2">
                                {OPERATORS.map((item) => {
                                    const on = operator === item.id;
                                    return (
                                        <button
                                            type="button"
                                            key={item.id}
                                            onClick={() => setOperator(item.id)}
                                            aria-pressed={on}
                                            className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${on ? `${item.ring} bg-primary/5 ring-2` : "border-border hover:border-primary/40"
                                                }`}
                                        >
                                            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.dot}`}>
                                                <Smartphone className="h-5 w-5 text-black/70" />
                                            </span>
                                            <span className="flex-1 font-medium">{item.label}</span>
                                            <span
                                                className={`flex h-5 w-5 items-center justify-center rounded-full border ${on ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}
                                                aria-hidden="true"
                                            >
                                                <Check className="h-3 w-3" />
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </fieldset>

                        <div className="mt-5 max-w-md space-y-2">
                            <Label htmlFor="payment-phone">Cameroon mobile number</Label>
                            <Input
                                id="payment-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel"
                                placeholder="+237 6XX XXX XXX"
                                value={phoneNumber}
                                onChange={(event) => setPhoneNumber(event.target.value)}
                                required
                                minLength={9}
                                maxLength={32}
                                className="h-11 text-base"
                            />
                            <p className="text-xs text-muted-foreground">
                                Use the number registered with {activeOperator?.short}. The prompt is sent there.
                            </p>
                        </div>

                        <Button
                            type="submit"
                            size="lg"
                            disabled={creatingOrder || !phoneNumber.trim()}
                            className="mt-6 w-full gap-2 sm:w-auto"
                        >
                            {creatingOrder ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                            {creatingOrder ? "Starting payment…" : `Pay ${formatPrice(selectedPlan.amount)}`}
                        </Button>
                    </form>

                    <aside className="h-fit rounded-2xl border border-border bg-card p-5 shadow-sm lg:sticky lg:top-6" aria-label="Order summary">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Order summary</h3>
                        <div className="mt-4 flex items-start gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                                {selectedOffline ? <BookOpen className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
                            </span>
                            <div className="min-w-0">
                                <p className="font-medium">{selectedPlan.name}</p>
                                <p className="text-sm text-muted-foreground">{selectedPerk}</p>
                            </div>
                        </div>
                        <dl className="mt-5 space-y-2 border-t border-border pt-4 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-muted-foreground">Method</dt>
                                <dd className="font-medium">{activeOperator?.label}</dd>
                            </div>
                            <div className="flex justify-between border-t border-border pt-3 text-base">
                                <dt className="font-semibold">Total</dt>
                                <dd className="font-bold tabular-nums">{formatPrice(selectedPlan.amount)}</dd>
                            </div>
                        </dl>
                        <p className="mt-4 flex items-start gap-2 text-xs text-muted-foreground">
                            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                            You only pay after approving the prompt with your mobile money PIN.
                        </p>
                    </aside>
                </div>
            )}

            {order && <OrderStatus order={order} statusError={statusError} onRetry={resetOrder} />}
        </div>
    );
}