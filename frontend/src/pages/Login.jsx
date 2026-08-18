// import { GraduationCap, Sparkles, BookOpen, Bot, Trophy, ArrowRight } from "lucide-react";
// import { Button } from "../components/ui/button";
// import { useTheme } from "../context/ThemeContext";
// import { Moon, Sun } from "lucide-react";

// export default function Login() {
//     const { theme, toggle } = useTheme();

//     const handleGoogleLogin = () => {
//         // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
//         const redirectUrl = window.location.origin + "/dashboard";
//         window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
//     };

//     const features = [
//         { icon: BookOpen, title: "AI Past Questions", desc: "GCE O/A Level, HND & Concours with instant AI feedback." },
//         { icon: Bot, title: "GC AI Tutor", desc: "Step-by-step explanations for any subject, anytime." },
//         { icon: Trophy, title: "Track & Compete", desc: "XP, streaks and leaderboards to keep you sharp." },
//     ];

//     return (
//         <div className="min-h-screen grid lg:grid-cols-2 bg-background">
//             {/* Left: brand / features */}
//             <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden bg-[#0A192F] text-white">
//                 <div className="radial-glow" />
//                 <div className="relative z-10 flex items-center gap-3">
//                     <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-glow">
//                         <GraduationCap className="h-6 w-6 text-white" />
//                     </div>
//                     <div>
//                         <h1 className="text-2xl font-display font-bold leading-none">GCSHARP</h1>
//                         <p className="text-sm text-slate-400">Global Classroom Sharpening Potential</p>
//                     </div>
//                 </div>

//                 <div className="relative z-10 max-w-md">
//                     <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs mb-6">
//                         <Sparkles className="h-3.5 w-3.5 text-blue-300" /> Built for Cameroon students
//                     </div>
//                     <h2 className="text-4xl font-display font-bold leading-tight mb-4">
//                         Master your exams with an AI that actually teaches.
//                     </h2>
//                     <p className="text-slate-400 mb-8">
//                         Practice real past questions, get instant worked solutions,
//                         and learn from the best teachers — all in one premium platform.
//                     </p>
//                     <div className="space-y-4">
//                         {features.map((f) => (
//                             <div key={f.title} className="flex items-start gap-3">
//                                 <div className="h-9 w-9 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
//                                     <f.icon className="h-4.5 w-4.5 text-blue-300" />
//                                 </div>
//                                 <div>
//                                     <p className="font-semibold text-sm">{f.title}</p>
//                                     <p className="text-sm text-slate-400">{f.desc}</p>
//                                 </div>
//                             </div>
//                         ))}
//                     </div>
//                 </div>
//                 <p className="relative z-10 text-xs text-slate-500">© 2026 GCSHARP. Premium AI-powered learning.</p>
//             </div>

//             {/* Right: auth */}
//             <div className="flex flex-col items-center justify-center p-8 relative">
//                 <button
//                     onClick={toggle}
//                     data-testid="theme-toggle-login"
//                     className="absolute top-6 right-6 h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
//                 >
//                     {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
//                 </button>

//                 <div className="w-full max-w-sm fade-up">
//                     <div className="lg:hidden flex items-center gap-3 mb-8">
//                         <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
//                             <GraduationCap className="h-5 w-5 text-white" />
//                         </div>
//                         <h1 className="text-xl font-display font-bold">GCSHARP</h1>
//                     </div>

//                     <h2 className="text-3xl font-display font-bold mb-2">Welcome back</h2>
//                     <p className="text-muted-foreground mb-8">Sign in to continue your learning journey.</p>

//                     <Button
//                         onClick={handleGoogleLogin}
//                         data-testid="google-login-button"
//                         className="w-full h-12 text-base gap-3 bg-white text-slate-800 hover:bg-slate-100 border border-border shadow-sm"
//                     >
//                         <svg className="h-5 w-5" viewBox="0 0 24 24">
//                             <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
//                             <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
//                             <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
//                             <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
//                         </svg>
//                         Continue with Google
//                     </Button>

//                     <div className="mt-6 rounded-lg border border-border bg-secondary/50 p-4 text-sm text-muted-foreground">
//                         <p className="flex items-center gap-2 font-medium text-foreground mb-1">
//                             <ArrowRight className="h-4 w-4 text-primary" /> New here?
//                         </p>
//                         Just sign in with Google — we'll walk you through a quick setup to choose your role and exam level.
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }
































































import { useEffect, useState } from "react";
import {
    GraduationCap,
    Sparkles,
    BookOpen,
    Bot,
    Trophy,
    ArrowRight,
    Moon,
    Sun,
    PenLine,
    TrendingUp,
    Users,
    CheckCircle2,
    Quote,
    Phone,
    Mail,
    Shield,
    User,
    Star,
    Lock,
    Facebook,
    Twitter,
    Github,
    Linkedin,
    Apple
} from "lucide-react";
import { Button } from "../components/ui/button";
import { useTheme } from "../context/ThemeContext";
function GoogleIcon({ className = "h-5 w-5" }) {
    return (
        <svg className={className} viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
        </svg>
    );
}

function GoogleButton({ onClick, className = "", children }) {
    return (
        <button
            onClick={onClick}
            data-testid="google-login-button"
            className={`inline-flex items-center justify-center gap-3 rounded-lg font-semibold transition-colors ${className}`}
        >
            <GoogleIcon />
            {children}
        </button>
    );
}

const HERO_IMAGES = [
    "https://images.unsplash.com/photo-1473649085228-583485e6e4d7?fm=jpg&q=80&w=2400&auto=format&fit=crop",
    "https://plus.unsplash.com/premium_photo-1714265043317-b49141f2197b?q=80&w=871&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1627423896085-e3e694d88e40?q=80&w=869&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1632932693914-89b90ae3d16d?q=80&w=763&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D",
    "https://images.unsplash.com/photo-1627423893729-3a79f48ff473?q=80&w=869&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"


];

export default function Login() {
    const { theme, toggle } = useTheme();
    const [heroIndex, setHeroIndex] = useState(0);

    useEffect(() => {
        const id = setInterval(() => {
            setHeroIndex((i) => (i + 1) % HERO_IMAGES.length);
        }, 5000);
        return () => clearInterval(id);
    }, []);

    const handleGoogleLogin = () => {
        // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
        const redirectUrl = window.location.origin + "/dashboard";
        window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
    };

    const features = [
        { icon: BookOpen, title: "AI Past Questions", desc: "GCE O/A Level, HND & Concours papers, with instant AI feedback on every answer." },
        { icon: Bot, title: "GC AI Tutor", desc: "Step-by-step explanations for any subject, any time you're stuck." },
        { icon: PenLine, title: "Instant Marking", desc: "Submit an answer and get it graded out of 20, the way your teacher would mark it." },
        { icon: Trophy, title: "Track & Compete", desc: "XP, streaks and leaderboards to keep you sharp against classmates nationwide." },
    ];

    const steps = [
        { n: "01", title: "Pick your exam", desc: "Choose your board — GCE O Level, A Level, HND or Concours — and your subject." },
        { n: "02", title: "Practice for real", desc: "Work through real past questions, timed just like the exam hall." },
        { n: "03", title: "Get marked instantly", desc: "The AI marks your script, explains every mistake, and shows your score out of 20." },
    ];

    const subjects = [
        "Mathematics", "Physics", "Chemistry", "Biology", "Economics",
        "Literature in English", "Philosophie", "Computer Science",
        "Geography", "Accounting", "French", "Further Maths",
    ];

    const testimonials = [
        { name: "Aïcha N.", role: "GCE A Level candidate, Douala", quote: "I used to fail my mock timed papers. After three weeks of past questions on GCSHARP my Maths score went from 8/20 to 15/20." },
        { name: "Junior T.", role: "HND candidate, Yaoundé", quote: "The AI tutor explains things the way I wish my teacher had time to. It waits for me, doesn't rush." },
        { name: "Brenda K.", role: "Concours candidate, Bafoussam", quote: "Seeing my name on the leaderboard actually made me want to open the app every evening." },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Nav */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
                <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-glow">
                            <GraduationCap className="h-5 w-5 text-white" />
                        </div>
                        <span className="text-lg font-display font-bold">GCSHARP</span>
                    </div>

                    <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
                        <a href="#features" className="hover:text-foreground transition-colors">Features</a>
                        <a href="#how-it-works" className="hover:text-foreground transition-colors">How it works</a>
                        <a href="#subjects" className="hover:text-foreground transition-colors">Subjects</a>
                        <a href="#testimonials" className="hover:text-foreground transition-colors">Students</a>
                    </nav>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={toggle}
                            data-testid="theme-toggle-login"
                            className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                        >
                            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                        <GoogleButton
                            onClick={handleGoogleLogin}
                            className="hidden sm:inline-flex h-10 px-4 text-sm bg-white text-slate-800 hover:bg-slate-100 border border-border shadow-sm"
                        >
                            Sign in
                        </GoogleButton>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="relative overflow-hidden">
                {/* Background: sliding photo carousel with navy overlay for legibility */}
                <div className="absolute inset-0">
                    {HERO_IMAGES.map((src, i) => (
                        <img
                            key={src}
                            src={src}
                            alt=""
                            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-[1500ms] ease-in-out ${i === heroIndex ? "opacity-100" : "opacity-0"
                                }`}
                        />
                    ))}
                    <div className="absolute inset-0 bg-[#0A192F]/40" />
                    <div className="absolute inset-0 bg-gradient-to-b from-[#0A192F]/20 via-[#0A192F]/60 to-background" />
                </div>
                <div className="radial-glow opacity-50" />

                {/* Slide indicators */}
                <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
                    {HERO_IMAGES.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setHeroIndex(i)}
                            aria-label={`Show background ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all duration-300 ${i === heroIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                                }`}
                        />
                    ))}
                </div>

                <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-6 py-24 lg:grid-cols-2 lg:items-center lg:py-32">
                    <div className="fade-up">
                        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs mb-6 text-white backdrop-blur">
                            <Sparkles className="h-3.5 w-3.5 text-blue-300" /> Built for Cameroon students
                        </div>
                        <h1 className="text-4xl sm:text-5xl font-display font-bold leading-[1.1] mb-5 text-white">
                            Master your exams with an AI that actually marks your work.
                        </h1>
                        <p className="text-lg text-slate-300 mb-8 max-w-md">
                            Practice real GCE, HND and Concours past questions, get graded out of 20 in seconds,
                            and learn from an AI tutor that explains every mistake.
                        </p>
                        <div className="flex flex-wrap items-center gap-4">

                            <Button
                                className="h-11 px-5 text-sm font-normal bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 rounded-full transition-colors inline-flex items-center gap-2 w-auto"
                            >
                                <Phone className="h-4 w-4 text-slate-400" />
                                Sign in with phone number
                            </Button>

                            <Button
                                className="h-11 px-5 text-sm font-normal bg-transparent border border-slate-700 text-slate-300 hover:bg-slate-800/60 hover:border-slate-600 rounded-full transition-colors inline-flex items-center gap-2 w-auto"
                            >
                                <Mail className="h-4 w-4 text-slate-400" />
                                Sign in with email
                            </Button>

                            <GoogleButton
                                onClick={handleGoogleLogin}
                                className="h-12 px-6 text-base bg-white text-slate-800 hover:bg-slate-100 shadow-lg"
                            >
                                Continue with Google
                            </GoogleButton>
                            <a
                                href="#how-it-works"
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                            >
                                See how it works <ArrowRight className="h-4 w-4" />
                            </a>




                        </div>
                        <p className="mt-5 text-xs text-slate-400">
                            Free to start. New here? We'll walk you through picking your exam level right after sign in.
                        </p>
                    </div>

                    {/* Signature: a marked exam script, floating over the photo */}
                    <div className="relative flex justify-center lg:justify-end fade-up">
                        <div className="relative w-full max-w-sm rotate-1 rounded-2xl border border-white/15 bg-white/10 p-6 shadow-2xl backdrop-blur-md">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-xs font-mono uppercase tracking-wide text-slate-300">
                                    Economics · Paper 2 · Q4
                                </span>
                                <span
                                    className="rotate-[-6deg] rounded border-2 border-[#E8746A] px-2 py-0.5 text-sm font-bold text-[#E8746A]"
                                    style={{ fontFamily: "cursive" }}
                                >
                                    18/20
                                </span>
                            </div>
                            <p className="text-sm leading-relaxed mb-3 text-white">
                                "Explain two causes of inflation in a developing economy."
                            </p>
                            <p className="text-sm leading-relaxed text-slate-300 mb-4">
                                Demand-pull inflation occurs when
                                <span className="mx-1 underline decoration-[#E8746A] decoration-2 underline-offset-4">
                                    aggregate demand rises faster than supply
                                </span>
                                , while cost-push inflation follows a rise in production costs...
                            </p>
                            <div className="flex items-start gap-2 rounded-lg bg-[#0A192F]/60 border border-white/15 p-3">
                                <Bot className="h-4 w-4 text-blue-300 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-300">
                                    Good structure. Add a real Cameroon example (e.g. fuel subsidy removal) for full marks next time.
                                </p>
                            </div>
                            <CheckCircle2 className="absolute -top-3 -right-3 h-8 w-8 text-[#E8746A] bg-[#0A192F] rounded-full p-1 shadow" />
                        </div>
                    </div>
                </div>






            </section>

            {/* Trust strip */}
            <section className="border-y border-border bg-secondary/30">
                <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-6 py-8 sm:grid-cols-4">
                    {[
                        { stat: "3", label: "exam boards covered" },
                        { stat: "10k+", label: "past-question items" },
                        { stat: "24/7", label: "AI tutor availability" },
                        { stat: "/20", label: "marked like your teacher marks" },
                    ].map((s) => (
                        <div key={s.label} className="text-center">
                            <p className="text-2xl font-display font-bold text-primary">{s.stat}</p>
                            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            <section id="features" className="mx-auto max-w-6xl px-6 py-24">
                <div className="max-w-lg mb-12">
                    <h2 className="text-3xl font-display font-bold mb-3">Everything you need to walk into that exam hall ready.</h2>
                    <p className="text-muted-foreground">One platform for practice, tutoring and progress — built around how Cameroonian exams are actually marked.</p>
                </div>
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {features.map((f) => (
                        <div key={f.title} className="rounded-xl border border-border p-6 hover:border-primary/40 transition-colors">
                            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                                <f.icon className="h-5 w-5 text-primary" />
                            </div>
                            <p className="font-semibold mb-1.5">{f.title}</p>
                            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="bg-secondary/30 border-y border-border">
                <div className="mx-auto max-w-6xl px-6 py-24">
                    <h2 className="text-3xl font-display font-bold mb-12">Three steps to your next grade.</h2>
                    <div className="grid gap-10 sm:grid-cols-3">
                        {steps.map((s, i) => (
                            <div key={s.n} className="relative">
                                <span className="text-5xl font-display font-bold text-primary/20">{s.n}</span>
                                <p className="font-semibold text-lg mt-2 mb-2">{s.title}</p>
                                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
                                {i < steps.length - 1 && (
                                    <ArrowRight className="hidden sm:block absolute top-6 -right-8 h-5 w-5 text-muted-foreground/40" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Subjects */}
            <section id="subjects" className="mx-auto max-w-6xl px-6 py-24">
                <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Every subject, every board</span>
                </div>
                <h2 className="text-3xl font-display font-bold mb-8 max-w-lg">From Further Maths to Philosophie, we've got past questions for it.</h2>
                <div className="flex flex-wrap gap-2.5">
                    {subjects.map((s) => (
                        <span key={s} className="rounded-full border border-border bg-secondary/50 px-4 py-2 text-sm">
                            {s}
                        </span>
                    ))}
                </div>
            </section>

            {/* Testimonials */}
            <section id="testimonials" className="bg-secondary/30 border-y border-border">
                <div className="mx-auto max-w-6xl px-6 py-24">
                    <div className="flex items-center gap-2 mb-3">
                        <Users className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Students on GCSHARP</span>
                    </div>
                    <h2 className="text-3xl font-display font-bold mb-12 max-w-lg">Real students, real grade improvements.</h2>
                    <div className="grid gap-6 lg:grid-cols-3">
                        {testimonials.map((t) => (
                            <div key={t.name} className="rounded-xl border border-border bg-background p-6">
                                <Quote className="h-5 w-5 text-primary/40 mb-3" />
                                <p className="text-sm leading-relaxed mb-5">{t.quote}</p>
                                <p className="text-sm font-semibold">{t.name}</p>
                                <p className="text-xs text-muted-foreground">{t.role}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>







            <section className="relative overflow-hidden bg-[#0A192F] text-white">
                <div className="radial-glow" />

                <div className="relative z-10 mx-auto max-w-3xl px-6 py-24 text-center">
                    <h2 className="text-3xl sm:text-4xl font-display font-bold mb-4">
                        Ready to sharpen your results?
                    </h2>
                    <p className="text-slate-400 mb-10 max-w-md mx-auto">
                        Sign in with Google — we'll walk you through choosing your role and exam level next.
                    </p>

                    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                        {/* Primary CTA */}
                        <GoogleButton
                            onClick={handleGoogleLogin}
                            className="w-full h-12 px-6 text-base font-medium bg-white text-slate-900 hover:bg-slate-100 shadow-sm rounded-full transition-colors"
                        >
                            Continue with Google
                        </GoogleButton>

                        {/* Divider */}
                        <div className="flex items-center gap-3 w-full my-2">
                            <span className="h-px flex-1 bg-slate-700" />
                            <span className="text-xs text-slate-500 uppercase tracking-wide">or</span>
                            <span className="h-px flex-1 bg-slate-700" />
                        </div>

                        {/* Secondary options */}
                        <Button
                            className="w-full h-12 px-6 text-base font-normal bg-transparent border border-slate-700 text-slate-200 hover:bg-slate-800/60 hover:border-slate-600 rounded-full transition-colors flex items-center justify-center gap-2"
                        >
                            <Phone className="h-5 w-5 text-slate-400" />
                            Sign in with phone number
                        </Button>

                        <Button
                            className="w-full h-12 px-6 text-base font-normal bg-transparent border border-slate-700 text-slate-200 hover:bg-slate-800/60 hover:border-slate-600 rounded-full transition-colors flex items-center justify-center gap-2"
                        >
                            <Mail className="h-5 w-5 text-slate-400" />
                            Sign in with email
                        </Button>
                    </div>

                    <p className="mt-8 text-xs text-slate-500">© 2026 GCSHARP. Premium AI-powered learning.</p>
                </div>
            </section>



        </div>
    );
}