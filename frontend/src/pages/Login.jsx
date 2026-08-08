import { GraduationCap, Sparkles, BookOpen, Bot, Trophy, ArrowRight } from "lucide-react";
import { Button } from "../components/ui/button";
import { useTheme } from "../context/ThemeContext";
import { Moon, Sun } from "lucide-react";

export default function Login() {
    const { theme, toggle } = useTheme();

    const handleGoogleLogin = () => {
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        const redirectUrl = window.location.origin + "/dashboard";
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    };

    const features = [
        { icon: BookOpen, title: "AI Past Questions", desc: "GCE O/A Level, HND & Concours with instant AI feedback." },
        { icon: Bot, title: "GC AI Tutor", desc: "Step-by-step explanations for any subject, anytime." },
        { icon: Trophy, title: "Track & Compete", desc: "XP, streaks and leaderboards to keep you sharp." },
    ];

    return (
        <div className="min-h-screen grid lg:grid-cols-2 bg-background">
            {/* Left: brand / features */}
            <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-[#0A192F] text-white">
                <div className="radial-glow" />
                <div className="relative z-10 flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                        <GraduationCap className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold leading-none">GCSMART</h1>
                        <p className="text-sm text-slate-400">Educational Ecosystem</p>
                    </div>
                </div>

                <div className="relative z-10 max-w-md">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs mb-6">
                        <Sparkles className="h-3.5 w-3.5 text-blue-300" /> Built for Cameroon students
                    </div>
                    <h2 className="text-4xl font-display font-bold leading-tight mb-4">
                        Master your exams with an AI that actually teaches.
                    </h2>
                    <p className="text-slate-400 mb-8">
                        Practice real past questions, get instant worked solutions, and learn from the best teachers — all in one premium platform.
                    </p>
                    <div className="space-y-4">
                        {features.map((f) => (
                            <div key={f.title} className="flex items-start gap-3">
                                <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                                    <f.icon className="h-4.5 w-4.5 text-blue-300" />
                                </div>
                                <div>
                                    <p className="font-semibold text-sm">{f.title}</p>
                                    <p className="text-sm text-slate-400">{f.desc}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <p className="relative z-10 text-xs text-slate-500">© 2026 GCSMART. Premium AI-powered learning.</p>
            </div>

            {/* Right: auth */}
            <div className="flex flex-col items-center justify-center p-8 relative">
                <button
                    onClick={toggle}
                    data-testid="theme-toggle-login"
                    className="absolute top-6 right-6 h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                >
                    {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                </button>

                <div className="w-full max-w-sm fade-up">
                    <div className="lg:hidden flex items-center gap-3 mb-8">
                        <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                            <GraduationCap className="h-5 w-5 text-white" />
                        </div>
                        <h1 className="text-xl font-display font-bold">GCSMART</h1>
                    </div>

                    <h2 className="text-3xl font-display font-bold mb-2">Welcome back</h2>
                    <p className="text-muted-foreground mb-8">Sign in to continue your learning journey.</p>

                    <Button
                        onClick={handleGoogleLogin}
                        data-testid="google-login-button"
                        className="w-full h-12 text-base gap-3 bg-white text-slate-800 hover:bg-slate-100 border border-border shadow-sm"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24">
                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                        Continue with Google
                    </Button>

                    <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
                        <p className="flex items-center gap-2 font-medium text-foreground mb-1">
                            <ArrowRight className="h-4 w-4 text-primary" /> New here?
                        </p>
                        Just sign in with Google — we'll walk you through a quick setup to choose your role and exam level.
                    </div>
                </div>
            </div>
        </div>
    );
}
