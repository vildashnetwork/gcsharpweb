import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { BookOpen, PlayCircle, FileText, Sparkles, Coins } from "lucide-react";
import { toast } from "sonner";

export default function StudyCenter() {
    const navigate = useNavigate();
    const [struct, setStruct] = useState(null);
    const [level, setLevel] = useState("");
    const [subject, setSubject] = useState("");
    const [year, setYear] = useState("");
    const [paper, setPaper] = useState("1");
    const [count, setCount] = useState("10");
    const [courses, setCourses] = useState([]);
    const [active, setActive] = useState(null);

    useEffect(() => {
        api.get("/exam/structure").then((r) => setStruct(r.data)).catch(() => {});
        api.get("/courses").then((r) => setCourses(r.data)).catch(() => {});
    }, []);

    const subjects = struct && level ? struct.levels[level] : [];

    const startPractice = () => {
        if (!level || !subject || !year) { toast.error("Select level, subject and year"); return; }
        navigate("/study/exam", { state: { level, subject, year: Number(year), paper: Number(paper), count: Number(count) } });
    };

    const openCourse = async (c) => {
        setActive(c);
        try {
            const { data } = await api.post(`/courses/${c.course_id}/view`);
            if (data.counted) toast.success(`View counted · ${data.rate} FCFA credited to ${c.teacher_name}`);
        } catch {}
    };

    return (
        <div className="space-y-6 max-w-[1400px]">
            <div>
                <h1 className="text-3xl font-display font-bold">Study Center</h1>
                <p className="text-muted-foreground">Practice AI-marked past questions or watch lesson videos.</p>
            </div>

            <Tabs defaultValue="papers">
                <TabsList data-testid="study-tabs">
                    <TabsTrigger value="papers" data-testid="tab-papers"><FileText className="h-4 w-4 mr-2" /> Past Questions</TabsTrigger>
                    <TabsTrigger value="videos" data-testid="tab-videos"><PlayCircle className="h-4 w-4 mr-2" /> Video Lessons</TabsTrigger>
                </TabsList>

                <TabsContent value="papers" className="mt-6">
                    <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden">
                        <div className="radial-glow" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-6">
                                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shadow-glow">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-display font-semibold">Paper 1 · AI Mode</h2>
                                    <p className="text-sm text-muted-foreground">Timed MCQ with instant AI feedback & explanations.</p>
                                </div>
                            </div>

                            <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Level</label>
                                    <Select value={level} onValueChange={(v) => { setLevel(v); setSubject(""); }}>
                                        <SelectTrigger data-testid="select-level"><SelectValue placeholder="Level" /></SelectTrigger>
                                        <SelectContent>{struct && Object.keys(struct.levels).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Subject</label>
                                    <Select value={subject} onValueChange={setSubject} disabled={!level}>
                                        <SelectTrigger data-testid="select-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
                                        <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Year</label>
                                    <Select value={year} onValueChange={setYear}>
                                        <SelectTrigger data-testid="select-year"><SelectValue placeholder="Year" /></SelectTrigger>
                                        <SelectContent>{struct?.years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Questions</label>
                                    <Select value={count} onValueChange={setCount}>
                                        <SelectTrigger data-testid="select-count"><SelectValue /></SelectTrigger>
                                        <SelectContent>{["5", "10", "15", "20"].map((y) => <SelectItem key={y} value={y}>{y} questions</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex items-end">
                                    <Button onClick={startPractice} data-testid="start-exam-btn" className="w-full h-10 shadow-glow gap-2">
                                        <BookOpen className="h-4 w-4" /> Start
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="videos" className="mt-6">
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                        {courses.length ? courses.map((c) => (
                            <div key={c.course_id} data-testid={`video-card-${c.course_id}`}
                                className="rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-0.5 transition-transform">
                                <button onClick={() => openCourse(c)} className="block w-full text-left group">
                                    <div className="h-40 bg-secondary relative">
                                        {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <PlayCircle className="h-12 w-12 text-white" />
                                        </div>
                                        <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">{c.level}</span>
                                    </div>
                                </button>
                                <div className="p-4">
                                    <p className="text-xs text-primary font-medium">{c.subject}</p>
                                    <p className="font-semibold line-clamp-1">{c.title}</p>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
                                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                                        <span>{c.teacher_name}</span>
                                        <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {c.views} views</span>
                                    </div>
                                </div>
                            </div>
                        )) : <p className="text-muted-foreground">No lesson videos yet.</p>}
                    </div>
                </TabsContent>
            </Tabs>

            <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle className="font-display">{active?.title}</DialogTitle>
                        <DialogDescription>{active?.subject} · {active?.level} · by {active?.teacher_name}</DialogDescription>
                    </DialogHeader>
                    {active && (
                        <div className="space-y-4">
                            <div className="aspect-video rounded-lg overflow-hidden bg-black">
                                <iframe title={active.title} src={active.video_url} className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                            </div>
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="font-medium">{active.teacher_name}</p>
                                    <p className="text-sm text-muted-foreground">{active.subject} · {active.level}</p>
                                </div>
                                <span className="flex items-center gap-1.5 text-sm text-success"><Coins className="h-4 w-4" /> 90 FCFA / view</span>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
