import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Phone,
    ArrowLeft,
    ArrowRight,
    Loader2,
    Mail,
    ShieldCheck,
    Sun,
    Moon,
    User,
    Lock,
    Eye,
    EyeOff,
} from "lucide-react";
import { useTheme } from "@/context/ThemeContext";
import { useAuth } from "@/context/AuthContext";
import api from "@/lib/api"; // Import the API client

const COUNTRIES = [
    { code: "+237", label: "Cameroon", flag: "🇨🇲" },
    { code: "+234", label: "Nigeria", flag: "🇳🇬" },
    { code: "+233", label: "Ghana", flag: "🇬🇭" },
    { code: "+225", label: "Côte d'Ivoire", flag: "🇨🇮" },
    { code: "+221", label: "Senegal", flag: "🇸🇳" },
];

function GoogleIcon(props) {
    return (
        <svg viewBox="0 0 24 24" width="18" height="18" {...props}>
            <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82z"
            />
            <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95H1.26v3.11A11.99 11.99 0 0 0 12 24z"
            />
            <path
                fill="#FBBC05"
                d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.6H1.26A11.99 11.99 0 0 0 0 12c0 1.94.47 3.77 1.26 5.4l4.01-3.11z"
            />
            <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0 7.31 0 3.26 2.69 1.26 6.6l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75z"
            />
        </svg>
    );
}

function ThemeToggle() {
    const { theme, toggle } = useTheme();
    return (
        <button
            type="button"
            onClick={toggle}
            aria-label="Toggle theme"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 dark:border-white/20 text-slate-600 dark:text-white/70 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
        >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
    );
}

function stepFromType(type) {
    return type === "email" ? "email" : "phone";
}

export default function PhoneSignIn() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [step, setStepState] = useState(() => stepFromType(searchParams.get("type")));

    // Auth state
    const [isLoading, setIsLoading] = useState(true);
    const [authChecked, setAuthChecked] = useState(false);

    // Form state
    const [country, setCountry] = useState(COUNTRIES[0]);
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);
    const [resendIn, setResendIn] = useState(30);
    const [otpError, setOtpError] = useState("");
    const [phoneError, setPhoneError] = useState("");
    const otpRefs = useRef([]);

    const { loginWithGoogle, signInWithEmail, signUpWithEmail } = useAuth() || {};

    const phoneDigits = phone.replace(/\D/g, "");
    const canContinue = phoneDigits.length >= 8;
    const otpComplete = otp.every((d) => d !== "");

    useEffect(() => {
        if (user) {
            window.location.href = "/dashboard";
        }
    }, [user]);

    // Set step with URL sync
    const setStep = (next) => {
        setStepState(next);
        const urlType = next === "email" ? "email" : "phone";
        setSearchParams(
            (prev) => {
                const params = new URLSearchParams(prev);
                params.set("type", urlType);
                return params;
            },
            { replace: true }
        );
    };

    // Exchange session function
    const exchangeSession = async (sessionId) => {
        try {
            const response = await api.post("/auth/exchange-session", { sessionId });
            if (response.data?.user) {
                const userData = {
                    ...response.data.user,
                    token: response.data.token || response.data.accessToken,
                };
                localStorage.setItem("user", JSON.stringify(userData));
                if (response.data.session_token) {
                    localStorage.setItem("session_token", response.data.session_token);
                }
                window.location.href = "/dashboard";
            }
        } catch (error) {
            console.error("Error exchanging session:", error);
            setAuthChecked(true);
            setIsLoading(false);
        }
    };

    // Handle Google Login
    const handleGoogleLogin = async () => {
        if (googleLoading) return;
        setGoogleLoading(true);

        try {
            if (loginWithGoogle) {
                await loginWithGoogle();
            } else {
                const redirectUrl = window.location.origin + "/dashboard";
                window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }
        } catch (error) {
            console.error("Google login error:", error);
            setGoogleLoading(false);
        }
    };

    // Auth check effect
    useEffect(() => {
        const checkAuthStatus = async () => {
            try {
                // Check for user data in localStorage
                const userData = localStorage.getItem("user");
                if (userData) {
                    try {
                        const user = JSON.parse(userData);
                        const response = await api.get("/auth/me", {
                            headers: user.token ? { Authorization: `Bearer ${user.token}` } : {},
                        });
                        if (response.status === 200) {
                            window.location.href = "/dashboard";
                            return;
                        }
                    } catch (e) {
                        console.error("Error parsing user data:", e);
                        localStorage.removeItem("user");
                    }
                }

                // Handle OAuth callback
                const params = new URLSearchParams(window.location.search);
                const sessionId = params.get("session_id");
                const hash = window.location.hash;

                if (sessionId) {
                    await exchangeSession(sessionId);
                    return;
                }

                if (hash?.includes("session_id=")) {
                    const hashSessionId = hash.split("session_id=")[1]?.split("&")[0];
                    if (hashSessionId) {
                        await exchangeSession(hashSessionId);
                        return;
                    }
                }

                // Check for session cookie
                try {
                    const sessionResponse = await api.get("/auth/session");
                    if (sessionResponse.data?.user) {
                        localStorage.setItem("user", JSON.stringify(sessionResponse.data.user));
                        if (sessionResponse.data.session_token) {
                            localStorage.setItem("session_token", sessionResponse.data.session_token);
                        }
                        window.location.href = "/dashboard";
                        return;
                    }
                } catch (e) {
                    console.log("No active session found");
                }

                setAuthChecked(true);
                setIsLoading(false);
            } catch (error) {
                console.error("Auth check error:", error);
                setAuthChecked(true);
                setIsLoading(false);
            }
        };

        checkAuthStatus();
    }, []);

    // Follow URL changes
    useEffect(() => {
        const urlStep = stepFromType(searchParams.get("type"));
        setStepState((current) => (current === "otp" ? current : urlStep));
    }, [searchParams]);

    // Timer for OTP resend
    useEffect(() => {
        if (step !== "otp" || resendIn <= 0) return;
        const t = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
        return () => clearInterval(t);
    }, [step, resendIn]);

    // Show loading state while checking auth
    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-white dark:bg-black">
                <Loader2 className="h-8 w-8 animate-spin text-slate-900 dark:text-white" />
            </div>
        );
    }

    // Handle sending OTP
    const handleSendCode = async () => {
        if (!canContinue || loading) return;
        setLoading(true);
        setPhoneError("");
        setOtpError("");

        try {
            const response = await api.post("/auth/phone/send-otp", {
                phone: phoneDigits,
                country_code: country.code,
            });

            if (response.data?.success) {
                setStep("otp");
                setResendIn(30);
                setOtp(["", "", "", "", "", ""]);
                setTimeout(() => otpRefs.current[0]?.focus(), 100);
            } else {
                setPhoneError(response.data?.message || "Failed to send OTP. Please try again.");
            }
        } catch (error) {
            console.error("Send OTP error:", error);
            setPhoneError(error.response?.data?.detail || "Failed to send OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Handle OTP verification
    const handleVerify = async () => {
        if (!otpComplete || loading) return;
        setLoading(true);
        setOtpError("");

        try {
            const otpCode = otp.join("");
            const response = await api.post("/auth/phone/verify", {
                phone: phoneDigits,
                country_code: country.code,
                otp: otpCode,
            });

            if (response.data?.success) {
                const userData = {
                    ...response.data.user,
                    token: response.data.session_token,
                };
                localStorage.setItem("user", JSON.stringify(userData));
                if (response.data.session_token) {
                    localStorage.setItem("session_token", response.data.session_token);
                }
                window.location.href = "/dashboard";
            } else {
                setOtpError(response.data?.message || "Invalid OTP. Please try again.");
            }
        } catch (error) {
            console.error("Verify OTP error:", error);
            setOtpError(error.response?.data?.detail || "Invalid OTP. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Handle email auth
    const handleEmailAuth = async ({ mode, name, email, password }) => {
        if (loading) return;
        setLoading(true);

        try {
            let response;
            if (mode === "signup") {
                response = await api.post("/auth/email/register", {
                    name,
                    email,
                    password,
                });
            } else {
                response = await api.post("/auth/email/login", {
                    email,
                    password,
                });
            }

            if (response.data?.success) {
                const userData = {
                    ...response.data.user,
                    token: response.data.session_token,
                };
                localStorage.setItem("user", JSON.stringify(userData));
                if (response.data.session_token) {
                    localStorage.setItem("session_token", response.data.session_token);
                }
                window.location.href = "/dashboard";
            }
        } catch (error) {
            console.error("Email auth error:", error);
            alert(error.response?.data?.detail || "Authentication failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleOtpChange = (i, val) => {
        const digit = val.replace(/\D/g, "").slice(-1);
        const next = [...otp];
        next[i] = digit;
        setOtp(next);
        if (digit && i < 5) otpRefs.current[i + 1]?.focus();
    };

    const handleOtpKeyDown = (i, e) => {
        if (e.key === "Backspace" && !otp[i] && i > 0) {
            otpRefs.current[i - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        e.preventDefault();
        const next = [...otp];
        text.split("").forEach((d, i) => (next[i] = d));
        setOtp(next);
        otpRefs.current[Math.min(text.length, 5)]?.focus();
    };

    const handleResendOtp = async () => {
        if (resendIn > 0) return;
        try {
            const response = await api.post("/auth/phone/send-otp", {
                phone: phoneDigits,
                country_code: country.code,
            });
            if (response.data?.success) {
                setResendIn(30);
                setOtpError("");
            }
        } catch (error) {
            console.error("Resend OTP error:", error);
            setOtpError("Failed to resend OTP. Please try again.");
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-white dark:bg-black text-slate-900 dark:text-white flex flex-col transition-colors">
            {/* Ambient glow */}
            <div
                className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-[0.08] dark:opacity-[0.15] blur-3xl"
                style={{
                    background: "radial-gradient(closest-side, rgba(0,0,0,0.5), transparent)",
                }}
            />
            <div
                className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full opacity-0 dark:opacity-[0.15] blur-3xl"
                style={{
                    background: "radial-gradient(closest-side, rgba(255,255,255,0.6), transparent)",
                }}
            />
            {/* Faint ruled-paper texture */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.04] dark:opacity-[0.05]"
                style={{
                    backgroundImage:
                        "repeating-linear-gradient(to bottom, transparent, transparent 27px, currentColor 28px)",
                }}
            />

            {/* Top bar */}
            <div className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
                <a href="/" className="text-sm font-display font-bold tracking-wide">
                    GCSHARP
                </a>
                <div className="flex items-center gap-4">
                    <a
                        href="/"
                        className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" /> Back to home
                    </a>
                    <ThemeToggle />
                </div>
            </div>

            {/* Main */}
            <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-16">
                <div className="w-full max-w-sm">
                    <div className="rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50/80 dark:bg-white/[0.04] p-7 shadow-2xl backdrop-blur-md">
                        {step === "phone" && (
                            <PhoneStep
                                country={country}
                                setCountry={setCountry}
                                phone={phone}
                                setPhone={setPhone}
                                canContinue={canContinue}
                                loading={loading}
                                onContinue={handleSendCode}
                                googleLoading={googleLoading}
                                onGoogleLogin={handleGoogleLogin}
                                onUseEmail={() => setStep("email")}
                                phoneError={phoneError}
                            />
                        )}
                        {step === "otp" && (
                            <OtpStep
                                country={country}
                                phone={phone}
                                otp={otp}
                                otpRefs={otpRefs}
                                onChange={handleOtpChange}
                                onKeyDown={handleOtpKeyDown}
                                onPaste={handleOtpPaste}
                                otpComplete={otpComplete}
                                loading={loading}
                                onVerify={handleVerify}
                                onBack={() => setStep("phone")}
                                resendIn={resendIn}
                                onResend={handleResendOtp}
                                otpError={otpError}
                            />
                        )}
                        {step === "email" && (
                            <EmailStep
                                loading={loading}
                                onSubmit={handleEmailAuth}
                                onBack={() => setStep("phone")}
                            />
                        )}
                    </div>

                    <p className="mt-6 text-center text-xs text-slate-400 dark:text-white/40">
                        By continuing, you agree to GCSHARP's{" "}
                        <a href="#" className="underline decoration-slate-300 dark:decoration-white/30 hover:text-slate-600 dark:hover:text-white/70">
                            Terms
                        </a>{" "}
                        and{" "}
                        <a href="#" className="underline decoration-slate-300 dark:decoration-white/30 hover:text-slate-600 dark:hover:text-white/70">
                            Privacy Policy
                        </a>
                        .
                    </p>
                </div>
            </div>
        </div>
    );
}

function PhoneStep({
    country,
    setCountry,
    phone,
    setPhone,
    canContinue,
    loading,
    onContinue,
    googleLoading,
    onGoogleLogin,
    onUseEmail,
    phoneError,
}) {
    const [pickerOpen, setPickerOpen] = useState(false);

    return (
        <div>
            <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/20">
                <Phone className="h-5 w-5" />
            </div>

            <h1 className="text-2xl font-display font-bold mb-2">Sign in to GCSHARP</h1>
            <p className="text-sm text-slate-500 dark:text-white/50 mb-6">
                Continue with Google, or use your phone number instead.
            </p>

            {/* Primary: Google */}
            <button
                type="button"
                onClick={onGoogleLogin}
                disabled={googleLoading}
                className="w-full h-12 rounded-full border border-slate-200 dark:border-white/15 bg-white text-slate-800 text-base font-medium flex items-center justify-center gap-2.5 hover:bg-slate-50 shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
                Continue with Google
            </button>

            <div className="my-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/15" />
                <span className="text-xs text-slate-400 dark:text-white/40 uppercase tracking-wide">or</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-white/15" />
            </div>

            <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-2">
                Phone number
            </label>
            <div className="relative flex items-stretch gap-2 mb-5">
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => setPickerOpen((o) => !o)}
                        className="h-12 flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 px-3 text-sm hover:border-slate-300 dark:hover:border-white/40 transition-colors"
                    >
                        <span className="text-base leading-none">{country.flag}</span>
                        <span>{country.code}</span>
                    </button>
                    {pickerOpen && (
                        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-48 overflow-hidden rounded-xl border border-slate-200 dark:border-white/20 bg-white dark:bg-black shadow-xl">
                            {COUNTRIES.map((c) => (
                                <button
                                    key={c.code}
                                    type="button"
                                    onClick={() => {
                                        setCountry(c);
                                        setPickerOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-slate-700 dark:text-white/80 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                                >
                                    <span className="text-base leading-none">{c.flag}</span>
                                    <span className="flex-1">{c.label}</span>
                                    <span className="text-slate-400 dark:text-white/40">{c.code}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <input
                    type="tel"
                    inputMode="numeric"
                    placeholder="6XX XXX XXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-12 flex-1 min-w-0 rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 px-4 text-base placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-slate-400 dark:focus:border-white/60 transition-colors"
                />
            </div>
            {phoneError && (
                <p className="text-xs text-red-500 mb-3">{phoneError}</p>
            )}

            <button
                type="button"
                disabled={!canContinue || loading}
                onClick={onContinue}
                className="w-full h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-base font-medium flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        Send code <ArrowRight className="h-4 w-4" />
                    </>
                )}
            </button>

            <div className="mt-5 text-center">
                <button
                    type="button"
                    onClick={onUseEmail}
                    className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                    <Mail className="h-4 w-4" />
                    Sign in with email instead
                </button>
            </div>
        </div>
    );
}

function OtpStep({
    country,
    phone,
    otp,
    otpRefs,
    onChange,
    onKeyDown,
    onPaste,
    otpComplete,
    loading,
    onVerify,
    onBack,
    resendIn,
    onResend,
    otpError,
}) {
    return (
        <div>
            <button
                type="button"
                onClick={onBack}
                className="mb-5 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Change number
            </button>

            <h1 className="text-2xl font-display font-bold mb-2">Enter the code</h1>
            <p className="text-sm text-slate-500 dark:text-white/50 mb-7">
                Sent to{" "}
                <span className="text-slate-900 dark:text-white">
                    {country.code} {phone}
                </span>
            </p>

            <div className="relative mb-2" onPaste={onPaste}>
                <div className="flex justify-between gap-2">
                    {otp.map((digit, i) => (
                        <input
                            key={i}
                            ref={(el) => (otpRefs.current[i] = el)}
                            value={digit}
                            onChange={(e) => onChange(i, e.target.value)}
                            onKeyDown={(e) => onKeyDown(i, e)}
                            inputMode="numeric"
                            maxLength={1}
                            className="h-14 w-11 rounded-lg border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 text-center font-mono text-xl focus:outline-none focus:border-slate-500 dark:focus:border-white transition-colors"
                        />
                    ))}
                </div>

                {otpComplete && (
                    <span
                        className="absolute -top-4 -right-3 rotate-[-8deg] rounded border-2 border-slate-900 dark:border-white bg-white dark:bg-black px-1.5 py-0.5 text-[10px] font-bold text-slate-900 dark:text-white"
                        style={{ fontFamily: "cursive" }}
                    >
                        ✓ verified
                    </span>
                )}
            </div>

            {otpError && (
                <p className="text-xs text-red-500 text-center mt-1 mb-2">{otpError}</p>
            )}

            <div className="mt-5 mb-6 text-center text-xs text-slate-400 dark:text-white/40">
                {resendIn > 0 ? (
                    <span>Resend code in 0:{String(resendIn).padStart(2, "0")}</span>
                ) : (
                    <button
                        type="button"
                        onClick={onResend}
                        className="text-slate-900 dark:text-white underline decoration-slate-300 dark:decoration-white/40 hover:decoration-slate-900 dark:hover:decoration-white transition-colors"
                    >
                        Resend code
                    </button>
                )}
            </div>

            <button
                type="button"
                disabled={!otpComplete || loading}
                onClick={onVerify}
                className="w-full h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-base font-medium flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
                {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                    <>
                        <ShieldCheck className="h-4 w-4" /> Verify and continue
                    </>
                )}
            </button>
        </div>
    );
}

function EmailStep({ loading, onSubmit, onBack }) {
    const [mode, setMode] = useState("signup");
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const isSignup = mode === "signup";
    const canSubmit =
        email.trim().length > 3 &&
        password.length >= 6 &&
        (!isSignup || name.trim().length > 1);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!canSubmit || loading) return;
        onSubmit({ mode, name, email, password });
    };

    return (
        <div>
            <button
                type="button"
                onClick={onBack}
                className="mb-5 inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Other sign-in options
            </button>

            <h1 className="text-2xl font-display font-bold mb-2">
                {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="text-sm text-slate-500 dark:text-white/50 mb-6">
                {isSignup
                    ? "A few details and you're in."
                    : "Sign in with your email and password."}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
                {isSignup && (
                    <div>
                        <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-2">
                            Full name
                        </label>
                        <div className="relative">
                            <User className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-white/30" />
                            <input
                                type="text"
                                placeholder="Ngu Achaleke"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="h-12 w-full rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 pl-10 pr-4 text-base placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-slate-400 dark:focus:border-white/60 transition-colors"
                            />
                        </div>
                    </div>
                )}

                <div>
                    <label className="block text-xs font-medium text-slate-500 dark:text-white/50 mb-2">
                        Email
                    </label>
                    <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-white/30" />
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-12 w-full rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 pl-10 pr-4 text-base placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-slate-400 dark:focus:border-white/60 transition-colors"
                        />
                    </div>
                </div>

                <div>
                    <div className="mb-2 flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500 dark:text-white/50">
                            Password
                        </label>
                        {!isSignup && (
                            <a href="#" className="text-xs text-slate-500 dark:text-white/50 hover:text-slate-900 dark:hover:text-white transition-colors">
                                Forgot password?
                            </a>
                        )}
                    </div>
                    <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-white/30" />
                        <input
                            type={showPassword ? "text" : "password"}
                            placeholder={isSignup ? "At least 6 characters" : "Your password"}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-12 w-full rounded-xl border border-slate-200 dark:border-white/20 bg-slate-50 dark:bg-white/5 pl-10 pr-11 text-base placeholder:text-slate-400 dark:placeholder:text-white/30 focus:outline-none focus:border-slate-400 dark:focus:border-white/60 transition-colors"
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40 hover:text-slate-700 dark:hover:text-white/80 transition-colors"
                        >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={!canSubmit || loading}
                    className="w-full h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black text-base font-medium flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-white/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <>
                            {isSignup ? "Create account" : "Sign in"} <ArrowRight className="h-4 w-4" />
                        </>
                    )}
                </button>
            </form>

            <p className="mt-5 text-center text-sm text-slate-500 dark:text-white/50">
                {isSignup ? "Already have an account?" : "New here?"}{" "}
                <button
                    type="button"
                    onClick={() => setMode(isSignup ? "signin" : "signup")}
                    className="font-medium text-slate-900 dark:text-white underline decoration-slate-300 dark:decoration-white/40 hover:decoration-slate-900 dark:hover:decoration-white transition-colors"
                >
                    {isSignup ? "Sign in" : "Create one"}
                </button>
            </p>
        </div>
    );
}