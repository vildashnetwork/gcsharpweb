import { useEffect, useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    BarChart, Bar, XAxis, ResponsiveContainer, Tooltip as RTooltip, Cell,
} from "recharts";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import { BookMarked, Users, Coins, PlayCircle, Plus, Upload } from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English Language", "French", "Economics", "Computer Science", "Accounting"];

function StatCard({ icon: Icon, label, value, accent }) {
    return (
        <div className="rounded-xl border border-border bg-card p-5">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${accent}`}><Icon className="h-5 w-5" /></div>
            <p className="text-2xl font-display font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    );
}

export default function TeacherPortal() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [courses, setCourses] = useState([]);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ title: "", description: "", subject: "", level: "", video_url: "", thumbnail: "" });

    const load = () => {
        api.get("/teacher/stats").then((r) => setStats(r.data)).catch(() => {});
        api.get("/courses", { params: { mine: true } }).then((r) => setCourses(r.data)).catch(() => {});
    };
    useEffect(load, []);

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const createCourse = async () => {
        if (!form.title || !form.subject || !form.level || !form.video_url) {
            toast.error("Fill title, subject, level and video URL"); return;
        }
        setSaving(true);
        try {
            await api.post("/courses", { ...form, price: 0 });
            toast.success("Lesson published!");
            setOpen(false);
            setForm({ title: "", description: "", subject: "", level: "", video_url: "", thumbnail: "" });
            load();
        } catch {
            toast.error("Could not publish");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-6 max-w-[1400px]">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-display font-bold">Teacher Portal</h1>
                    <p className="text-muted-foreground">Publish lessons and earn 90 FCFA per qualified student view.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="shadow-glow gap-2" data-testid="new-lesson-btn"><Plus className="h-4 w-4" /> New Lesson</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Upload className="h-5 w-5" /> Publish a Lesson Video</DialogTitle><DialogDescription>Share a video lesson and earn 90 FCFA per qualified student view.</DialogDescription></DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2"><Label>Title</Label><Input data-testid="course-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chain Rule Masterclass" /></div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2"><Label>Subject</Label>
                                    <Select value={form.subject} onValueChange={(v) => set("subject", v)}>
                                        <SelectTrigger data-testid="course-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
                                        <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2"><Label>Level</Label>
                                    <Select value={form.level} onValueChange={(v) => set("level", v)}>
                                        <SelectTrigger data-testid="course-level"><SelectValue placeholder="Level" /></SelectTrigger>
                                        <SelectContent>{LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <div className="space-y-2"><Label>Video URL (YouTube embed)</Label><Input data-testid="course-video" value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://www.youtube.com/embed/…" /></div>
                            <div className="space-y-2"><Label>Thumbnail URL (optional)</Label><Input value={form.thumbnail} onChange={(e) => set("thumbnail", e.target.value)} placeholder="https://…" /></div>
                            <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What will students learn?" /></div>
                        </div>
                        <DialogFooter>
                            <Button onClick={createCourse} disabled={saving} data-testid="publish-course-btn" className="shadow-glow">{saving ? "Publishing…" : "Publish"}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={BookMarked} label="Courses" value={stats?.courses ?? 0} accent="bg-accent text-primary" />
                <StatCard icon={Users} label="Students" value={stats?.students ?? 0} accent="bg-success/15 text-success" />
                <StatCard icon={PlayCircle} label="Total Views" value={stats?.views ?? 0} accent="bg-primary/15 text-primary" />
                <StatCard icon={Coins} label="Earnings (FCFA)" value={(stats?.earnings ?? 0).toLocaleString()} accent="bg-warning/15 text-warning" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-display font-semibold mb-4">Earnings Overview</h2>
                    <div className="h-64">
                        {stats?.chart?.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chart}>
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <RTooltip cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} />
                                    <Bar dataKey="earnings" radius={[8, 8, 0, 0]}>
                                        {stats.chart.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No earnings yet. Publish lessons to start earning.</div>}
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-display font-semibold mb-4">Course Performance</h2>
                    <div className="space-y-2">
                        {stats?.course_table?.length ? stats.course_table.map((c) => (
                            <div key={c.title} className="rounded-lg bg-secondary/40 p-3">
                                <p className="font-medium text-sm line-clamp-1">{c.title}</p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                    <span>{c.students} students · {c.views} views</span>
                                    <span className="text-success font-medium">{c.earnings.toLocaleString()} FCFA</span>
                                </div>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">Your published lessons appear here.</p>}
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-display font-semibold mb-4">My Lessons</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courses.length ? courses.map((c) => (
                        <div key={c.course_id} className="rounded-xl border border-border bg-card overflow-hidden">
                            <div className="h-36 bg-secondary">{c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}</div>
                            <div className="p-4">
                                <p className="text-xs text-primary font-medium">{c.subject} · {c.level}</p>
                                <p className="font-semibold line-clamp-1">{c.title}</p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                    <span>{c.views} views</span>
                                    <span className="text-success font-medium">{(c.earnings || 0).toLocaleString()} FCFA</span>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-sm text-muted-foreground col-span-full">You haven't published any lessons yet. Click "New Lesson" to start.</p>}
                </div>
            </div>
        </div>
    );
}
