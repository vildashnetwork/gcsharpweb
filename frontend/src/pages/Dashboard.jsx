// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../lib/api";
// import { useAuth } from "../context/AuthContext";
// import {
//     BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip as RTooltip,
// } from "recharts";
// import {
//     Clock, Target, Flame, Zap, TrendingUp, Bot, BookOpen, Trophy,
//     Sparkles, ArrowRight, PlayCircle, Calendar,
// } from "lucide-react";
// import { Button } from "../components/ui/button";
// import { Skeleton } from "../components/ui/skeleton";

// function StatCard({ icon: Icon, label, value, accent, testid }) {
//     return (
//         <div data-testid={testid} className="rounded-xl border border-border bg-card p-5 hover:-translate-y-0.5 transition-transform">
//             <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${accent}`}>
//                 <Icon className="h-5 w-5" />
//             </div>
//             <p className="text-2xl font-display font-bold">{value}</p>
//             <p className="text-sm text-muted-foreground">{label}</p>
//         </div>
//     );
// }

// function XPRing({ xp, level, toNext }) {
//     const pct = ((500 - toNext) / 500) * 100;
//     const r = 52, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
//     return (
//         <div className="relative h-36 w-36">
//             <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
//                 <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
//                 <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
//                     strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
//                     style={{ transition: "stroke-dashoffset 0.8s ease" }} />
//             </svg>
//             <div className="absolute inset-0 flex flex-col items-center justify-center">
//                 <span className="text-xs text-muted-foreground">Level</span>
//                 <span className="text-3xl font-display font-bold">{level}</span>
//                 <span className="text-xs text-muted-foreground">{xp} XP</span>
//             </div>
//         </div>
//     );
// }

// export default function Dashboard() {
//     const navigate = useNavigate();
//     const { user } = useAuth();
//     const [stats, setStats] = useState(null);
//     const [board, setBoard] = useState(null);
//     const [courses, setCourses] = useState([]);

//     useEffect(() => {
//         api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
//         api.get("/leaderboard").then((r) => setBoard(r.data)).catch(() => {});
//         api.get("/courses").then((r) => setCourses(r.data.slice(0, 4))).catch(() => {});
//     }, []);

//     const roadmap = [
//         { tag: "GCE Advanced Level", when: "In 12 days", title: "Pure Maths P1", sub: "08:00 AM · Examination Hall B", color: "border-l-primary" },
//         { tag: "HND Mock", when: "In 4 days", title: "Software Engineering", sub: "10:30 AM · Lab 404", color: "border-l-success" },
//         { tag: "Deadline", when: "Today", title: "Physics Lab Report", sub: "Before 11:59 PM", color: "border-l-destructive" },
//     ];

//     return (
//         <div className="space-y-6 max-w-[1400px]">
//             <div className="flex items-end justify-between flex-wrap gap-3">
//                 <div>
//                     <h1 className="text-3xl font-display font-bold">Welcome back, {user?.name?.split(" ")[0] || "there"}</h1>
//                     <p className="text-muted-foreground">Here's your learning snapshot for today.</p>
//                 </div>
//                 <Button onClick={() => navigate("/study")} data-testid="start-practice-btn" className="shadow-glow gap-2">
//                     <BookOpen className="h-4 w-4" /> Start Practice
//                 </Button>
//             </div>

//             {/* stats */}
//             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//                 {stats ? (
//                     <>
//                         <StatCard testid="stat-study-hours" icon={Clock} label="Study Hours" value={`${stats.study_hours}h`} accent="bg-accent text-primary" />
//                         <StatCard testid="stat-questions" icon={Target} label="Questions Attempted" value={stats.questions_attempted} accent="bg-success/15 text-success" />
//                         <StatCard testid="stat-accuracy" icon={TrendingUp} label="Accuracy" value={`${stats.accuracy}%`} accent="bg-primary/15 text-primary" />
//                         <StatCard testid="stat-streak" icon={Flame} label="Day Streak" value={stats.streak} accent="bg-warning/15 text-warning" />
//                     </>
//                 ) : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
//             </div>

//             <div className="grid lg:grid-cols-3 gap-6">
//                 {/* consistency chart */}
//                 <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
//                     <div className="flex items-center justify-between mb-4">
//                         <div>
//                             <h2 className="text-lg font-display font-semibold">Study Consistency</h2>
//                             <p className="text-sm text-muted-foreground">Minutes studied · last 7 days</p>
//                         </div>
//                         <span className="text-sm text-success flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Keep it up</span>
//                     </div>
//                     <div className="h-64">
//                         <ResponsiveContainer width="100%" height="100%">
//                             <BarChart data={stats?.consistency || []}>
//                                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
//                                 <RTooltip cursor={{ fill: "hsl(var(--secondary))" }}
//                                     contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} />
//                                 <Bar dataKey="minutes" radius={[8, 8, 0, 0]}>
//                                     {(stats?.consistency || []).map((_, i) => (
//                                         <Cell key={i} fill={i === 6 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
//                                     ))}
//                                 </Bar>
//                             </BarChart>
//                         </ResponsiveContainer>
//                     </div>
//                 </div>

//                 {/* exam roadmap */}
//                 <div className="rounded-xl border border-border bg-card p-6">
//                     <div className="flex items-center justify-between mb-4">
//                         <h2 className="text-lg font-display font-semibold">Exam Roadmap</h2>
//                         <Calendar className="h-5 w-5 text-muted-foreground" />
//                     </div>
//                     <div className="space-y-3">
//                         {roadmap.map((r) => (
//                             <div key={r.title} className={`rounded-lg border border-border border-l-4 ${r.color} bg-secondary/40 p-3`}>
//                                 <div className="flex items-center justify-between">
//                                     <span className="text-xs font-medium">{r.tag}</span>
//                                     <span className="text-xs text-muted-foreground">{r.when}</span>
//                                 </div>
//                                 <p className="font-semibold text-sm mt-1">{r.title}</p>
//                                 <p className="text-xs text-muted-foreground">{r.sub}</p>
//                             </div>
//                         ))}
//                     </div>
//                 </div>
//             </div>

//             <div className="grid lg:grid-cols-3 gap-6">
//                 {/* AI recommendations */}
//                 <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 relative overflow-hidden">
//                     <div className="radial-glow" />
//                     <div className="relative z-10">
//                         <div className="flex items-center gap-2 mb-4">
//                             <Sparkles className="h-5 w-5 text-primary" />
//                             <h2 className="text-lg font-display font-semibold">AI Recommendations</h2>
//                         </div>
//                         {stats?.weak_topics?.length ? (
//                             <>
//                                 <p className="text-sm text-muted-foreground mb-3">Based on your attempts, focus on these weak topics:</p>
//                                 <div className="flex flex-wrap gap-2 mb-4">
//                                     {stats.weak_topics.map((t) => (
//                                         <span key={t} className="px-3 py-1.5 rounded-full text-sm bg-destructive/10 text-destructive border border-destructive/20">{t}</span>
//                                     ))}
//                                 </div>
//                             </>
//                         ) : (
//                             <p className="text-sm text-muted-foreground mb-4">Complete a practice test and GC AI will pinpoint your weak topics automatically.</p>
//                         )}
//                         <div className="flex flex-wrap gap-3">
//                             <Button variant="outline" onClick={() => navigate("/ai")} data-testid="ask-ai-btn" className="gap-2">
//                                 <Bot className="h-4 w-4" /> Ask GC AI Tutor
//                             </Button>
//                             <Button variant="outline" onClick={() => navigate("/study")} className="gap-2">
//                                 <Target className="h-4 w-4" /> Practice weak topics
//                             </Button>
//                         </div>
//                     </div>
//                 </div>

//                 {/* XP ring */}
//                 <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center">
//                     <h2 className="text-lg font-display font-semibold mb-4 self-start flex items-center gap-2"><Zap className="h-5 w-5 text-warning" /> Level Progress</h2>
//                     {stats && <XPRing xp={stats.xp} level={stats.level} toNext={stats.xp_to_next} />}
//                     <p className="text-sm text-muted-foreground mt-3">{stats?.xp_to_next} XP to next level</p>
//                 </div>
//             </div>

//             {/* Active courses / video lessons */}
//             <div>
//                 <div className="flex items-center justify-between mb-4">
//                     <h2 className="text-lg font-display font-semibold">Lesson Videos for You</h2>
//                     <button onClick={() => navigate("/study")} className="text-sm text-primary flex items-center gap-1 hover:underline">
//                         View all <ArrowRight className="h-4 w-4" />
//                     </button>
//                 </div>
//                 <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
//                     {courses.length ? courses.map((c) => (
//                         <button key={c.course_id} onClick={() => navigate("/study")} data-testid={`course-card-${c.course_id}`}
//                             className="text-left rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-0.5 transition-transform group">
//                             <div className="h-28 bg-secondary relative">
//                                 {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}
//                                 <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
//                                     <PlayCircle className="h-10 w-10 text-white" />
//                                 </div>
//                             </div>
//                             <div className="p-4">
//                                 <p className="text-xs text-primary font-medium">{c.subject}</p>
//                                 <p className="font-semibold text-sm line-clamp-1">{c.title}</p>
//                                 <p className="text-xs text-muted-foreground mt-1">{c.teacher_name}</p>
//                             </div>
//                         </button>
//                     )) : <p className="text-sm text-muted-foreground col-span-full">No lessons yet. Check back soon.</p>}
//                 </div>
//             </div>

//             {/* leaderboard preview */}
//             <div className="rounded-xl border border-border bg-card p-6">
//                 <div className="flex items-center justify-between mb-4">
//                     <h2 className="text-lg font-display font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Leaderboard</h2>
//                     {board?.my_rank && <span className="text-sm text-muted-foreground">Your rank: <span className="font-semibold text-foreground">#{board.my_rank.rank}</span></span>}
//                 </div>
//                 <div className="space-y-2">
//                     {(board?.top || []).slice(0, 5).map((e) => (
//                         <div key={e.rank} className={`flex items-center gap-3 rounded-lg p-3 ${e.is_me ? "bg-accent border border-primary/30" : "bg-secondary/40"}`}>
//                             <span className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${e.rank <= 3 ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}`}>{e.rank}</span>
//                             <span className="flex-1 font-medium text-sm">{e.name} {e.is_me && <span className="text-primary text-xs">(You)</span>}</span>
//                             <span className="text-sm text-muted-foreground">Lvl {e.level}</span>
//                             <span className="text-sm font-semibold">{e.xp} XP</span>
//                         </div>
//                     ))}
//                     {!board?.top?.length && <p className="text-sm text-muted-foreground">Be the first on the leaderboard — start practicing!</p>}
//                 </div>
//             </div>
//         </div>
//     );
// }



































import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    BarChart, Bar, XAxis, ResponsiveContainer, Cell, Tooltip as RTooltip,
} from "recharts";
import {
    Clock, Target, Flame, Zap, TrendingUp, Bot, BookOpen, Trophy,
    Sparkles, ArrowRight, PlayCircle, Calendar,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Skeleton } from "../components/ui/skeleton";

function StatCard({ icon: Icon, label, value, accent, testid }) {
    return (
        <div data-testid={testid} className="rounded-xl border border-border bg-card p-5 hover:-translate-y-0.5 transition-transform">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${accent}`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-display font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    );
}

function XPRing({ xp, level, toNext }) {
    const pct = ((500 - toNext) / 500) * 100;
    const r = 52, c = 2 * Math.PI * r, off = c - (pct / 100) * c;
    return (
        <div className="relative h-36 w-36">
            <svg className="h-36 w-36 -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="10" />
                <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--primary))" strokeWidth="10"
                    strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off}
                    style={{ transition: "stroke-dashoffset 0.8s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Level</span>
                <span className="text-3xl font-display font-bold">{level}</span>
                <span className="text-xs text-muted-foreground">{xp} XP</span>
            </div>
        </div>
    );
}

// Formats accumulated study time for display. Under an hour, shows
// whole minutes (e.g. "14m") instead of a misleading "0.0h" — a
// single decimal of *hours* can't represent a couple minutes of
// reading. Once past an hour, switches to a one-decimal hour figure.
function formatStudyTime(totalSeconds) {
    const seconds = Math.max(0, totalSeconds || 0);
    if (seconds < 3600) {
        const minutes = Math.round(seconds / 60);
        return minutes > 0 ? `${minutes}m` : "0m";
    }
    const hours = seconds / 3600;
    return `${hours.toFixed(1)}h`;
}

export default function Dashboard() {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [board, setBoard] = useState(null);
    const [courses, setCourses] = useState([]);

    useEffect(() => {
        const loadStats = () => api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => { });

        loadStats();
        api.get("/leaderboard").then((r) => setBoard(r.data)).catch(() => { });
        api.get("/courses").then((r) => setCourses(r.data.slice(0, 4))).catch(() => { });

        // Study time accrues elsewhere (e.g. the paper reader) via
        // frequent small saves, so refresh stats periodically while
        // this tab is visible, and again whenever the window regains
        // focus — e.g. after switching back from reading a paper.
        const interval = setInterval(() => {
            if (document.visibilityState === "visible") loadStats();
        }, 30000);

        const onFocus = () => loadStats();
        window.addEventListener("focus", onFocus);

        return () => {
            clearInterval(interval);
            window.removeEventListener("focus", onFocus);
        };
    }, []);

    const roadmap = [
        { tag: "GCE Advanced Level", when: "In 12 days", title: "Pure Maths P1", sub: "08:00 AM · Examination Hall B", color: "border-l-primary" },
        { tag: "HND Mock", when: "In 4 days", title: "Software Engineering", sub: "10:30 AM · Lab 404", color: "border-l-success" },
        { tag: "Deadline", when: "Today", title: "Physics Lab Report", sub: "Before 11:59 PM", color: "border-l-destructive" },
    ];

    return (
        <div className="space-y-6 max-w-[1400px]">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-display font-bold">Welcome back, {user?.name?.split(" ")[0] || "there"}</h1>
                    <p className="text-muted-foreground">Here's your learning snapshot for today.</p>
                </div>
                <Button onClick={() => navigate("/study")} data-testid="start-practice-btn" className="shadow-glow gap-2">
                    <BookOpen className="h-4 w-4" /> Start Practice
                </Button>
            </div>

            {/* stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats ? (
                    <>
                        <StatCard testid="stat-study-hours" icon={Clock} label="Study Time" value={formatStudyTime(stats.study_seconds)} accent="bg-accent text-primary" />
                        <StatCard testid="stat-questions" icon={Target} label="Questions Attempted" value={stats.total_papers_viewed} accent="bg-success/15 text-success" />
                        <StatCard testid="stat-accuracy" icon={TrendingUp} label="Accuracy" value={`${stats.accuracy}%`} accent="bg-primary/15 text-primary" />
                        <StatCard testid="stat-streak" icon={Flame} label="Day Streak" value={stats.streak} accent="bg-warning/15 text-warning" />
                    </>
                ) : Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* consistency chart */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-lg font-display font-semibold">Study Consistency</h2>
                            <p className="text-sm text-muted-foreground">Minutes studied · last 7 days</p>
                        </div>
                        <span className="text-sm text-success flex items-center gap-1"><TrendingUp className="h-4 w-4" /> Keep it up</span>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats?.consistency || []}>
                                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                <RTooltip cursor={{ fill: "hsl(var(--secondary))" }}
                                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} />
                                <Bar dataKey="minutes" radius={[8, 8, 0, 0]}>
                                    {(stats?.consistency || []).map((_, i) => (
                                        <Cell key={i} fill={i === 6 ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.4)"} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* exam roadmap */}
                <div className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-display font-semibold">Exam Roadmap</h2>
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-3">
                        {roadmap.map((r) => (
                            <div key={r.title} className={`rounded-lg border border-border border-l-4 ${r.color} bg-secondary/40 p-3`}>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">{r.tag}</span>
                                    <span className="text-xs text-muted-foreground">{r.when}</span>
                                </div>
                                <p className="font-semibold text-sm mt-1">{r.title}</p>
                                <p className="text-xs text-muted-foreground">{r.sub}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* AI recommendations */}
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6 relative overflow-hidden">
                    <div className="radial-glow" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-display font-semibold">AI Recommendations</h2>
                        </div>
                        {stats?.weak_topics?.length ? (
                            <>
                                <p className="text-sm text-muted-foreground mb-3">Based on your attempts, focus on these weak topics:</p>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    {stats.weak_topics.map((t) => (
                                        <span key={t} className="px-3 py-1.5 rounded-full text-sm bg-destructive/10 text-destructive border border-destructive/20">{t}</span>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-muted-foreground mb-4">Complete a practice test and GC AI will pinpoint your weak topics automatically.</p>
                        )}
                        <div className="flex flex-wrap gap-3">
                            <Button variant="outline" onClick={() => navigate("/ai")} data-testid="ask-ai-btn" className="gap-2">
                                <Bot className="h-4 w-4" /> Ask GC AI Tutor
                            </Button>
                            <Button variant="outline" onClick={() => navigate("/study")} className="gap-2">
                                <Target className="h-4 w-4" /> Practice weak topics
                            </Button>
                        </div>
                    </div>
                </div>

                {/* XP ring */}
                <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center">
                    <h2 className="text-lg font-display font-semibold mb-4 self-start flex items-center gap-2"><Zap className="h-5 w-5 text-warning" /> Level Progress</h2>
                    {stats && <XPRing xp={stats.xp} level={stats.level} toNext={stats.xp_to_next} />}
                    <p className="text-sm text-muted-foreground mt-3">{stats?.xp_to_next} XP to next level</p>
                </div>
            </div>

            {/* Active courses / video lessons */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-semibold">Lesson Videos for You</h2>
                    <button onClick={() => navigate("/videos")} className="text-sm text-primary flex items-center gap-1 hover:underline">
                        View all <ArrowRight className="h-4 w-4" />
                    </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {courses.length ? courses.map((c) => (
                        <button key={c.course_id} onClick={() => navigate(`/videos/${c.course_id}`)} data-testid={`course-card-${c.course_id}`}
                            className="text-left rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-0.5 transition-transform group">
                            <div className="h-28 bg-secondary relative">
                                {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <PlayCircle className="h-10 w-10 text-white" />
                                </div>
                            </div>
                            <div className="p-4">
                                <p className="text-xs text-primary font-medium">{c.subject}</p>
                                <p className="font-semibold text-sm line-clamp-1">{c.title}</p>
                                <p className="text-xs text-muted-foreground mt-1">{c.teacher_name}</p>
                            </div>
                        </button>
                    )) : <p className="text-sm text-muted-foreground col-span-full">No lessons yet. Check back soon.</p>}
                </div>
            </div>

            {/* leaderboard preview */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-display font-semibold flex items-center gap-2"><Trophy className="h-5 w-5 text-warning" /> Leaderboard</h2>
                    {board?.my_rank && <span className="text-sm text-muted-foreground">Your rank: <span className="font-semibold text-foreground">#{board.my_rank.rank}</span></span>}
                </div>
                <div className="space-y-2">
                    {(board?.top || []).slice(0, 5).map((e) => (
                        <div key={e.rank} className={`flex items-center gap-3 rounded-lg p-3 ${e.is_me ? "bg-accent border border-primary/30" : "bg-secondary/40"}`}>
                            <span className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-bold ${e.rank <= 3 ? "bg-warning/20 text-warning" : "bg-secondary text-muted-foreground"}`}>{e.rank}</span>
                            <span className="flex-1 font-medium text-sm">{e.name} {e.is_me && <span className="text-primary text-xs">(You)</span>}</span>
                            <span className="text-sm text-muted-foreground">Lvl {e.level}</span>
                            <span className="text-sm font-semibold">{e.xp} XP</span>
                        </div>
                    ))}
                    {!board?.top?.length && <p className="text-sm text-muted-foreground">Be the first on the leaderboard — start practicing!</p>}
                </div>
            </div>
        </div>
    );
}