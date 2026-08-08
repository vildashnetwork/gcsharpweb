import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, CartesianGrid,
} from "recharts";
import {
    Sparkles, FlaskConical, Sigma, Zap, Trophy, PenLine, Flame, Lock, Clock, TrendingUp, Users,
} from "lucide-react";

function Milestone({ icon: Icon, title, sub, pct, locked, color }) {
    return (
        <div className="flex-1 min-w-[160px]">
            <div className="flex items-center gap-2 mb-2">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${locked ? "bg-secondary text-muted-foreground" : color}`}>
                    {locked ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <div>
                    <p className={`text-sm font-semibold ${locked ? "text-muted-foreground" : ""}`}>{title}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                </div>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                <div className={`h-full rounded-full ${locked ? "bg-muted-foreground/40" : "bg-primary"}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export default function Analytics() {
    const { user } = useAuth();
    const [attempts, setAttempts] = useState([]);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        api.get("/attempts").then((r) => setAttempts(r.data)).catch(() => {});
        api.get("/dashboard/stats").then((r) => setStats(r.data)).catch(() => {});
    }, []);

    const trend = [...attempts].reverse().map((a, i) => ({
        name: `#${i + 1}`, accuracy: a.accuracy,
    }));
    const avg = attempts.length ? Math.round(attempts.reduce((s, a) => s + a.accuracy, 0) / attempts.length) : 0;
    const growth = trend.length >= 2 ? trend[trend.length - 1].accuracy - trend[0].accuracy : 0;

    const focus = (stats?.weak_topics || []).slice(0, 3);
    const focusIcons = [FlaskConical, Sigma, Zap];
    const focusColors = ["bg-accent text-primary", "bg-success/15 text-success", "bg-primary/15 text-primary"];

    return (
        <div className="space-y-6 max-w-[1400px]">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-display font-bold">Performance Analytics</h1>
                    <p className="text-muted-foreground">Detailed academic insights across your practice.</p>
                </div>
                <div className="rounded-xl border border-border bg-card px-5 py-3 text-center">
                    <p className="text-xs text-muted-foreground">Level</p>
                    <p className="text-xl font-display font-bold text-primary">{stats?.level ?? 1} · {stats?.xp ?? 0} XP</p>
                </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-display font-semibold mb-4">Accuracy Trend</h2>
                    <div className="h-64">
                        {trend.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trend}>
                                    <CartesianGrid strokeDasharray="4 4" stroke="hsl(var(--border))" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <RTooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} />
                                    <Line type="monotone" dataKey="accuracy" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Complete practice tests to see your trend.</div>
                        )}
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
                        <div className="text-center"><p className="text-2xl font-display font-bold">{avg}%</p><p className="text-sm text-muted-foreground">Avg. Accuracy</p></div>
                        <div className="text-center"><p className="text-2xl font-display font-bold">{attempts.length}</p><p className="text-sm text-muted-foreground">Tests taken</p></div>
                        <div className="text-center"><p className={`text-2xl font-display font-bold ${growth >= 0 ? "text-success" : "text-destructive"}`}>{growth >= 0 ? "+" : ""}{growth}%</p><p className="text-sm text-muted-foreground">Growth</p></div>
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-display font-semibold mb-4 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Focus Areas</h2>
                    <div className="space-y-3">
                        {focus.length ? focus.map((t, i) => {
                            const Icon = focusIcons[i % 3];
                            return (
                                <div key={t} className="rounded-lg border border-border bg-secondary/40 p-3 flex items-start gap-3">
                                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${focusColors[i % 3]}`}><Icon className="h-4 w-4" /></div>
                                    <div><p className="font-semibold text-sm">{t}</p><p className="text-xs text-muted-foreground">Below target — review and practice.</p></div>
                                </div>
                            );
                        }) : <p className="text-sm text-muted-foreground">No weak areas detected yet. Keep practicing to unlock insights.</p>}
                    </div>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-display font-semibold">Achieved Milestones</h2>
                    <span className="text-xs px-3 py-1 rounded-full bg-success/15 text-success font-medium">Level {stats?.level ?? 1} Scholar</span>
                </div>
                <div className="flex flex-wrap gap-6">
                    <Milestone icon={Trophy} title="First Steps" sub="Complete 1 test" pct={attempts.length >= 1 ? 100 : 0} locked={attempts.length < 1} color="bg-warning/15 text-warning" />
                    <Milestone icon={PenLine} title="Dedicated" sub="5 tests done" pct={Math.min(100, attempts.length * 20)} locked={attempts.length < 5} color="bg-primary/15 text-primary" />
                    <Milestone icon={Flame} title="Sharp Shooter" sub="80%+ accuracy" pct={Math.min(100, avg)} locked={avg < 80} color="bg-destructive/15 text-destructive" />
                    <Milestone icon={Lock} title="Curriculum King" sub="Level 5 reached" pct={Math.min(100, (stats?.level ?? 1) * 20)} locked={(stats?.level ?? 1) < 5} />
                </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
                <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
                    <Clock className="h-6 w-6 text-primary" />
                    <div><p className="text-sm text-muted-foreground">Study Hours</p><p className="font-display font-bold text-lg">{stats?.study_hours ?? 0}h total</p></div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
                    <TrendingUp className="h-6 w-6 text-success" />
                    <div><p className="text-sm text-muted-foreground">Predicted Grade</p><p className="font-display font-bold text-lg">{avg >= 80 ? "A" : avg >= 65 ? "B" : avg >= 50 ? "C" : "—"}</p></div>
                </div>
                <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-3">
                    <Users className="h-6 w-6 text-primary" />
                    <div><p className="text-sm text-muted-foreground">Exam Level</p><p className="font-display font-bold text-lg">{user?.exam_level || "—"}</p></div>
                </div>
            </div>
        </div>
    );
}
