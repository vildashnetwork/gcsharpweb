// import { useEffect, useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../lib/api";
// import {
//     Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "../components/ui/select";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
// import { Button } from "../components/ui/button";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
// import { Input } from "../components/ui/input";
// import {
//     BookOpen, PlayCircle, FileText, Sparkles, Coins, FileStack, Bookmark, BookmarkCheck,
//     Filter, X, ArrowRight, Zap,
// } from "lucide-react";
// import { toast } from "sonner";

// function PaperCard({ p, onOpen, onToggle }) {
//     return (
//         <div data-testid={`paper-card-${p.paper_id}`} className="rounded-xl border border-border bg-card p-5 hover:-translate-y-0.5 transition-transform flex flex-col">
//             <div className="flex items-start justify-between gap-2 mb-3">
//                 <div className="h-10 w-10 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
//                     <FileText className="h-5 w-5" />
//                 </div>
//                 <button onClick={() => onToggle(p)} data-testid={`save-draft-${p.paper_id}`}
//                     className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${p.saved ? "text-primary bg-accent" : "text-muted-foreground hover:bg-secondary"}`}>
//                     {p.saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
//                 </button>
//             </div>
//             <p className="text-xs text-primary font-medium">{p.subject} · {p.level}</p>
//             <p className="font-semibold line-clamp-2 mt-0.5">{p.title}</p>
//             <p className="text-sm text-muted-foreground mt-1">{p.year} · Paper {p.paper_number}</p>
//             <div className="flex items-center gap-2 mt-4">
//                 <span className={`text-xs px-2 py-0.5 rounded-full ${p.paper_number === 1 ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"}`}>
//                     {p.paper_number === 1 ? "AI Q&A" : "Video Solution"}
//                 </span>
//             </div>
//             <Button onClick={() => onOpen(p)} data-testid={`open-paper-${p.paper_id}`} className="w-full mt-4 gap-2">
//                 Open Paper <ArrowRight className="h-4 w-4" />
//             </Button>
//         </div>
//     );
// }

// export default function StudyCenter() {
//     const navigate = useNavigate();
//     const [struct, setStruct] = useState(null);
//     const [level, setLevel] = useState("");
//     const [subject, setSubject] = useState("");
//     const [year, setYear] = useState("");
//     const [paper, setPaper] = useState("1");
//     const [count, setCount] = useState("10");
//     const [courses, setCourses] = useState([]);
//     const [active, setActive] = useState(null);

//     // Past papers browse + drafts
//     const [pfilters, setPfilters] = useState(null);
//     const [papers, setPapers] = useState([]);
//     const [drafts, setDrafts] = useState([]);
//     const [fLevel, setFLevel] = useState("all");
//     const [fSubject, setFSubject] = useState("all");
//     const [fYear, setFYear] = useState("all");
//     const [fPaper, setFPaper] = useState("all");
//     const [fSearch, setFSearch] = useState("");

//     const loadPapers = () => {
//         const params = {};
//         if (fLevel !== "all") params.level = fLevel;
//         if (fSubject !== "all") params.subject = fSubject;
//         if (fYear !== "all") params.year = Number(fYear);
//         if (fPaper !== "all") params.paper = Number(fPaper);
//         if (fSearch) params.q = fSearch;
//         api.get("/papers", { params }).then((r) => setPapers(r.data)).catch(() => {});
//     };
//     const loadDrafts = () => api.get("/drafts").then((r) => setDrafts(r.data)).catch(() => {});

//     useEffect(() => {
//         api.get("/exam/structure").then((r) => setStruct(r.data)).catch(() => {});
//         api.get("/courses").then((r) => setCourses(r.data)).catch(() => {});
//         api.get("/papers/filters").then((r) => setPfilters(r.data)).catch(() => {});
//         loadDrafts();
//     }, []);

//     useEffect(() => { loadPapers(); }, [fLevel, fSubject, fYear, fPaper, fSearch]); // eslint-disable-line

//     const openPaper = (p) => navigate(`/study/paper/${p.paper_id}`);

//     const toggleDraft = async (p) => {
//         try {
//             const { data } = await api.post("/drafts", { paper_id: p.paper_id });
//             setPapers((arr) => arr.map((x) => x.paper_id === p.paper_id ? { ...x, saved: data.saved } : x));
//             toast.success(data.saved ? "Saved to Drafts" : "Removed from Drafts");
//             loadDrafts();
//         } catch { toast.error("Could not update drafts"); }
//     };

//     const clearFilters = () => { setFLevel("all"); setFSubject("all"); setFYear("all"); setFPaper("all"); setFSearch(""); };

//     const subjects = struct && level ? struct.levels[level] : [];

//     const startPractice = () => {
//         if (!level || !subject || !year) { toast.error("Select level, subject and year"); return; }
//         navigate("/study/exam", { state: { level, subject, year: Number(year), paper: Number(paper), count: Number(count) } });
//     };

//     const openCourse = async (c) => {
//         setActive(c);
//         try {
//             const { data } = await api.post(`/courses/${c.course_id}/view`);
//             if (data.counted) toast.success(`View counted · ${data.rate} FCFA credited to ${c.teacher_name}`);
//         } catch {}
//     };

//     return (
//         <div className="space-y-6 max-w-[1400px]">
//             <div>
//                 <h1 className="text-3xl font-display font-bold">Study Center</h1>
//                 <p className="text-muted-foreground">Browse real GCE past papers, practice AI-marked questions, and watch lessons.</p>
//             </div>

//             <Tabs defaultValue="browse">
//                 <TabsList data-testid="study-tabs" className="flex-wrap h-auto">
//                     <TabsTrigger value="browse" data-testid="tab-browse"><FileStack className="h-4 w-4 mr-2" /> Past Papers</TabsTrigger>
//                     <TabsTrigger value="papers" data-testid="tab-papers"><Zap className="h-4 w-4 mr-2" /> Quick Practice</TabsTrigger>
//                     <TabsTrigger value="videos" data-testid="tab-videos"><PlayCircle className="h-4 w-4 mr-2" /> Video Lessons</TabsTrigger>
//                     <TabsTrigger value="drafts" data-testid="tab-drafts"><Bookmark className="h-4 w-4 mr-2" /> Drafts{drafts.length ? ` (${drafts.length})` : ""}</TabsTrigger>
//                 </TabsList>

//                 <TabsContent value="browse" className="mt-6 space-y-5">
//                     <div className="rounded-xl border border-border bg-card p-4">
//                         <div className="flex items-center gap-2 mb-3 text-sm font-medium"><Filter className="h-4 w-4 text-primary" /> Filter papers</div>
//                         <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
//                             <Select value={fLevel} onValueChange={setFLevel}>
//                                 <SelectTrigger data-testid="filter-level"><SelectValue placeholder="Level" /></SelectTrigger>
//                                 <SelectContent><SelectItem value="all">All Levels</SelectItem>{pfilters?.levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                             </Select>
//                             <Select value={fSubject} onValueChange={setFSubject}>
//                                 <SelectTrigger data-testid="filter-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
//                                 <SelectContent><SelectItem value="all">All Subjects</SelectItem>{pfilters?.subjects.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                             </Select>
//                             <Select value={fYear} onValueChange={setFYear}>
//                                 <SelectTrigger data-testid="filter-year"><SelectValue placeholder="Year" /></SelectTrigger>
//                                 <SelectContent><SelectItem value="all">All Years</SelectItem>{pfilters?.years.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}</SelectContent>
//                             </Select>
//                             <Select value={fPaper} onValueChange={setFPaper}>
//                                 <SelectTrigger data-testid="filter-paper"><SelectValue placeholder="Paper" /></SelectTrigger>
//                                 <SelectContent><SelectItem value="all">All Papers</SelectItem>{[1, 2, 3].map((l) => <SelectItem key={l} value={String(l)}>Paper {l}</SelectItem>)}</SelectContent>
//                             </Select>
//                             <div className="relative">
//                                 <Input data-testid="filter-search" value={fSearch} onChange={(e) => setFSearch(e.target.value)} placeholder="Search title…" className="h-10" />
//                             </div>
//                         </div>
//                         {(fLevel !== "all" || fSubject !== "all" || fYear !== "all" || fPaper !== "all" || fSearch) && (
//                             <button onClick={clearFilters} data-testid="clear-filters" className="mt-3 text-sm text-primary flex items-center gap-1 hover:underline"><X className="h-3.5 w-3.5" /> Clear filters</button>
//                         )}
//                     </div>

//                     <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
//                         {papers.length ? papers.map((p) => (
//                             <PaperCard key={p.paper_id} p={p} onOpen={openPaper} onToggle={toggleDraft} />
//                         )) : <p className="text-muted-foreground col-span-full py-8 text-center">No papers match your filters.</p>}
//                     </div>
//                 </TabsContent>

//                 <TabsContent value="drafts" className="mt-6">
//                     <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
//                         {drafts.length ? drafts.map((p) => (
//                             <PaperCard key={p.paper_id} p={{ ...p, saved: true }} onOpen={openPaper} onToggle={toggleDraft} />
//                         )) : (
//                             <div className="col-span-full text-center py-12">
//                                 <Bookmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
//                                 <p className="font-medium">No saved papers yet</p>
//                                 <p className="text-sm text-muted-foreground">Tap the bookmark on any paper to save it here for quick access.</p>
//                             </div>
//                         )}
//                     </div>
//                 </TabsContent>

//                 <TabsContent value="papers" className="mt-6">
//                     <div className="rounded-xl border border-border bg-card p-6 relative overflow-hidden">
//                         <div className="radial-glow" />
//                         <div className="relative z-10">
//                             <div className="flex items-center gap-2 mb-6">
//                                 <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shadow-glow">
//                                     <Sparkles className="h-5 w-5 text-white" />
//                                 </div>
//                                 <div>
//                                     <h2 className="text-lg font-display font-semibold">Paper 1 · AI Mode</h2>
//                                     <p className="text-sm text-muted-foreground">Timed MCQ with instant AI feedback & explanations.</p>
//                                 </div>
//                             </div>

//                             <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium">Level</label>
//                                     <Select value={level} onValueChange={(v) => { setLevel(v); setSubject(""); }}>
//                                         <SelectTrigger data-testid="select-level"><SelectValue placeholder="Level" /></SelectTrigger>
//                                         <SelectContent>{struct && Object.keys(struct.levels).map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium">Subject</label>
//                                     <Select value={subject} onValueChange={setSubject} disabled={!level}>
//                                         <SelectTrigger data-testid="select-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
//                                         <SelectContent>{subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium">Year</label>
//                                     <Select value={year} onValueChange={setYear}>
//                                         <SelectTrigger data-testid="select-year"><SelectValue placeholder="Year" /></SelectTrigger>
//                                         <SelectContent>{struct?.years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium">Questions</label>
//                                     <Select value={count} onValueChange={setCount}>
//                                         <SelectTrigger data-testid="select-count"><SelectValue /></SelectTrigger>
//                                         <SelectContent>{["5", "10", "15", "20"].map((y) => <SelectItem key={y} value={y}>{y} questions</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="flex items-end">
//                                     <Button onClick={startPractice} data-testid="start-exam-btn" className="w-full h-10 shadow-glow gap-2">
//                                         <BookOpen className="h-4 w-4" /> Start
//                                     </Button>
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </TabsContent>

//                 <TabsContent value="videos" className="mt-6">
//                     <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
//                         {courses.length ? courses.map((c) => (
//                             <div key={c.course_id} data-testid={`video-card-${c.course_id}`}
//                                 className="rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-0.5 transition-transform">
//                                 <button onClick={() => openCourse(c)} className="block w-full text-left group">
//                                     <div className="h-40 bg-secondary relative">
//                                         {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}
//                                         <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
//                                             <PlayCircle className="h-12 w-12 text-white" />
//                                         </div>
//                                         <span className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-0.5 rounded">{c.level}</span>
//                                     </div>
//                                 </button>
//                                 <div className="p-4">
//                                     <p className="text-xs text-primary font-medium">{c.subject}</p>
//                                     <p className="font-semibold line-clamp-1">{c.title}</p>
//                                     <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{c.description}</p>
//                                     <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
//                                         <span>{c.teacher_name}</span>
//                                         <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" /> {c.views} views</span>
//                                     </div>
//                                 </div>
//                             </div>
//                         )) : <p className="text-muted-foreground">No lesson videos yet.</p>}
//                     </div>
//                 </TabsContent>
//             </Tabs>

//             <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
//                 <DialogContent className="max-w-3xl">
//                     <DialogHeader>
//                         <DialogTitle className="font-display">{active?.title}</DialogTitle>
//                         <DialogDescription>{active?.subject} · {active?.level} · by {active?.teacher_name}</DialogDescription>
//                     </DialogHeader>
//                     {active && (
//                         <div className="space-y-4">
//                             <div className="aspect-video rounded-lg overflow-hidden bg-black">
//                                 <iframe title={active.title} src={active.video_url} className="w-full h-full"
//                                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
//                             </div>
//                             <div className="flex items-center justify-between">
//                                 <div>
//                                     <p className="font-medium">{active.teacher_name}</p>
//                                     <p className="text-sm text-muted-foreground">{active.subject} · {active.level}</p>
//                                 </div>
//                                 <span className="flex items-center gap-1.5 text-sm text-success"><Coins className="h-4 w-4" /> 90 FCFA / view</span>
//                             </div>
//                         </div>
//                     )}
//                 </DialogContent>
//             </Dialog>
//         </div>
//     );
// }






























// import { useEffect, useState, useMemo, useCallback } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../lib/api";
// import {
//     Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "../components/ui/select";
// import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
// import { Button } from "../components/ui/button";
// import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
// import { Input } from "../components/ui/input";
// import { Badge } from "../components/ui/badge";
// import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../components/ui/sheet";
// import { Slider } from "../components/ui/slider";
// import {
//     BookOpen, PlayCircle, FileText, Sparkles, Coins, FileStack, Bookmark, BookmarkCheck,
//     Filter, X, ArrowRight, Zap, Search, Grid3X3, List,
//     GraduationCap, Calendar, Clock, User, Eye, TrendingUp,
// } from "lucide-react";
// import { toast } from "sonner";

// // Shimmer Skeleton Component
// function PaperCardSkeleton({ viewMode }) {
//     return (
//         <div
//             className={`rounded-xl border border-border bg-card p-5 animate-pulse ${viewMode === "list" ? "flex items-center p-4 gap-4" : ""
//                 }`}
//         >
//             {viewMode !== "list" ? (
//                 <>
//                     <div className="flex items-start justify-between gap-2 mb-3">
//                         <div className="h-10 w-10 rounded-lg bg-secondary/60" />
//                         <div className="h-8 w-8 rounded-lg bg-secondary/60" />
//                     </div>
//                     <div className="space-y-3">
//                         <div className="h-3 w-20 bg-secondary/60 rounded" />
//                         <div className="h-5 w-3/4 bg-secondary/60 rounded" />
//                         <div className="h-4 w-1/2 bg-secondary/60 rounded" />
//                         <div className="h-6 w-16 bg-secondary/60 rounded-full" />
//                         <div className="h-10 w-full bg-secondary/60 rounded-lg mt-2" />
//                     </div>
//                 </>
//             ) : (
//                 <>
//                     <div className="h-10 w-10 rounded-lg bg-secondary/60 shrink-0" />
//                     <div className="flex-1 flex items-center gap-4 flex-wrap">
//                         <div className="flex-1 min-w-[150px] space-y-2">
//                             <div className="h-3 w-24 bg-secondary/60 rounded" />
//                             <div className="h-5 w-48 bg-secondary/60 rounded" />
//                             <div className="h-4 w-32 bg-secondary/60 rounded" />
//                             <div className="flex items-center gap-2">
//                                 <div className="h-6 w-16 bg-secondary/60 rounded-full" />
//                                 <div className="h-4 w-12 bg-secondary/60 rounded" />
//                             </div>
//                         </div>
//                         <div className="h-9 w-20 bg-secondary/60 rounded-lg" />
//                     </div>
//                 </>
//             )}
//         </div>
//     );
// }

// function VideoCardSkeleton() {
//     return (
//         <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
//             <div className="h-48 bg-secondary/60" />
//             <div className="p-4 space-y-3">
//                 <div className="h-5 w-3/4 bg-secondary/60 rounded" />
//                 <div className="h-4 w-full bg-secondary/60 rounded" />
//                 <div className="h-4 w-2/3 bg-secondary/60 rounded" />
//                 <div className="flex items-center justify-between">
//                     <div className="h-3 w-24 bg-secondary/60 rounded" />
//                     <div className="h-3 w-20 bg-secondary/60 rounded" />
//                 </div>
//             </div>
//         </div>
//     );
// }

// function PaperCard({ p, onOpen, onToggle, viewMode }) {
//     return (
//         <div
//             data-testid={`paper-card-${p.paper_id}`}
//             className={`rounded-xl border border-border bg-card hover:-translate-y-0.5 transition-all hover:shadow-lg flex flex-col ${viewMode === "list" ? "flex-row items-center p-4 gap-4" : "p-5"
//                 }`}
//         >
//             {viewMode !== "list" && (
//                 <div className="flex items-start justify-between gap-2 mb-3">
//                     <div className="h-10 w-10 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
//                         <FileText className="h-5 w-5" />
//                     </div>
//                     <button onClick={() => onToggle(p)} data-testid={`save-draft-${p.paper_id}`}
//                         className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${p.saved ? "text-primary bg-accent" : "text-muted-foreground hover:bg-secondary"
//                             }`}>
//                         {p.saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
//                     </button>
//                 </div>
//             )}

//             {viewMode === "list" && (
//                 <div className="h-10 w-10 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
//                     <FileText className="h-5 w-5" />
//                 </div>
//             )}

//             <div className={`flex-1 ${viewMode === "list" ? "flex items-center gap-4 flex-wrap" : ""}`}>
//                 <div className={viewMode === "list" ? "flex-1 min-w-[150px]" : ""}>
//                     <p className="text-xs text-primary font-medium">{p.subject} · {p.level}</p>
//                     <p className="font-semibold line-clamp-2 mt-0.5">{p.title}</p>
//                     <p className="text-sm text-muted-foreground mt-1">{p.year} · Paper {p.paper_number}</p>
//                     <div className="flex items-center gap-2 mt-2 flex-wrap">
//                         <span className={`text-xs px-2 py-0.5 rounded-full ${p.paper_number === 1 ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
//                             }`}>
//                             {p.paper_number === 1 ? "AI Q&A" : "Video Solution"}
//                         </span>
//                         {viewMode === "list" && (
//                             <button onClick={() => onToggle(p)}
//                                 className={`text-xs flex items-center gap-1 ${p.saved ? "text-primary" : "text-muted-foreground hover:text-primary"
//                                     }`}>
//                                 {p.saved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
//                                 {p.saved ? "Saved" : "Save"}
//                             </button>
//                         )}
//                     </div>
//                 </div>
//                 {viewMode === "list" && (
//                     <Button onClick={() => onOpen(p)} size="sm" className="gap-2 shrink-0">
//                         Open <ArrowRight className="h-4 w-4" />
//                     </Button>
//                 )}
//             </div>

//             {viewMode !== "list" && (
//                 <Button onClick={() => onOpen(p)} className="w-full mt-4 gap-2">
//                     Open Paper <ArrowRight className="h-4 w-4" />
//                 </Button>
//             )}
//         </div>
//     );
// }

// function FilterBadge({ label, onRemove }) {
//     return (
//         <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-xs">
//             {label}
//             <button onClick={onRemove} className="hover:text-destructive transition-colors">
//                 <X className="h-3 w-3" />
//             </button>
//         </Badge>
//     );
// }

// export default function StudyCenter() {
//     const navigate = useNavigate();
//     const [struct, setStruct] = useState(null);
//     const [level, setLevel] = useState("");
//     const [subject, setSubject] = useState("");
//     const [year, setYear] = useState("");
//     const [paper, setPaper] = useState("1");
//     const [count, setCount] = useState("10");
//     const [courses, setCourses] = useState([]);
//     const [active, setActive] = useState(null);
//     const [viewMode, setViewMode] = useState("grid");
//     const [isLoadingPapers, setIsLoadingPapers] = useState(false);
//     const [isLoadingCourses, setIsLoadingCourses] = useState(false);

//     // Past papers browse + drafts
//     const [pfilters, setPfilters] = useState(null);
//     const [papers, setPapers] = useState([]);
//     const [drafts, setDrafts] = useState([]);
//     const [fLevel, setFLevel] = useState("all");
//     const [fSubject, setFSubject] = useState("all");
//     const [fYear, setFYear] = useState("all");
//     const [fPaper, setFPaper] = useState("all");
//     const [fSearch, setFSearch] = useState("");
//     const [sortBy, setSortBy] = useState("newest");
//     const [filterSheetOpen, setFilterSheetOpen] = useState(false);
//     const [yearRange, setYearRange] = useState([2015, 2024]);

//     // Mobile responsive states
//     const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
//     const [activeTab, setActiveTab] = useState("browse");

//     useEffect(() => {
//         const handleResize = () => setIsMobile(window.innerWidth < 768);
//         window.addEventListener("resize", handleResize);
//         return () => window.removeEventListener("resize", handleResize);
//     }, []);

//     // Wrap loadPapers in useCallback to fix the dependency warning
//     const loadPapers = useCallback(() => {
//         setIsLoadingPapers(true);
//         const params = {};
//         if (fLevel !== "all") params.level = fLevel;
//         if (fSubject !== "all") params.subject = fSubject;
//         if (fYear !== "all") params.year = Number(fYear);
//         if (fPaper !== "all") params.paper = Number(fPaper);
//         if (fSearch) params.q = fSearch;
//         if (sortBy) params.sort = sortBy;
//         api.get("/papers", { params })
//             .then((r) => setPapers(r.data))
//             .catch(() => { })
//             .finally(() => setIsLoadingPapers(false));
//     }, [fLevel, fSubject, fYear, fPaper, fSearch, sortBy]);

//     const loadDrafts = useCallback(() => {
//         api.get("/drafts").then((r) => setDrafts(r.data)).catch(() => { });
//     }, []);

//     const loadCourses = useCallback(() => {
//         setIsLoadingCourses(true);
//         api.get("/courses")
//             .then((r) => setCourses(r.data))
//             .catch(() => { })
//             .finally(() => setIsLoadingCourses(false));
//     }, []);

//     useEffect(() => {
//         api.get("/exam/structure").then((r) => setStruct(r.data)).catch(() => { });
//         loadCourses();
//         api.get("/papers/filters").then((r) => setPfilters(r.data)).catch(() => { });
//         loadDrafts();
//     }, [loadCourses, loadDrafts]);

//     useEffect(() => {
//         loadPapers();
//     }, [loadPapers]);

//     const openPaper = (p) => navigate(`/study/paper/${p.paper_id}`);

//     const toggleDraft = async (p) => {
//         try {
//             const { data } = await api.post("/drafts", { paper_id: p.paper_id });
//             setPapers((arr) => arr.map((x) => x.paper_id === p.paper_id ? { ...x, saved: data.saved } : x));
//             toast.success(data.saved ? "Saved to Drafts" : "Removed from Drafts");
//             loadDrafts();
//         } catch { toast.error("Could not update drafts"); }
//     };

//     const clearFilters = () => {
//         setFLevel("all");
//         setFSubject("all");
//         setFYear("all");
//         setFPaper("all");
//         setFSearch("");
//         setSortBy("newest");
//         setYearRange([2015, 2024]);
//     };

//     const subjects = struct && level ? struct.levels[level] : [];
//     const activeFilters = useMemo(() => {
//         const filters = [];
//         if (fLevel !== "all") filters.push({ label: fLevel, onRemove: () => setFLevel("all") });
//         if (fSubject !== "all") filters.push({ label: fSubject, onRemove: () => setFSubject("all") });
//         if (fYear !== "all") filters.push({ label: fYear, onRemove: () => setFYear("all") });
//         if (fPaper !== "all") filters.push({ label: `Paper ${fPaper}`, onRemove: () => setFPaper("all") });
//         if (fSearch) filters.push({ label: `"${fSearch}"`, onRemove: () => setFSearch("") });
//         return filters;
//     }, [fLevel, fSubject, fYear, fPaper, fSearch]);

//     const startPractice = () => {
//         if (!level || !subject || !year) { toast.error("Select level, subject and year"); return; }
//         navigate("/study/exam", { state: { level, subject, year: Number(year), paper: Number(paper), count: Number(count) } });
//     };

//     const openCourse = async (c) => {
//         setActive(c);
//         try {
//             const { data } = await api.post(`/courses/${c.course_id}/view`);
//             if (data.counted) toast.success(`View counted · ${data.rate} FCFA credited to ${c.teacher_name}`);
//         } catch { }
//     };

//     const FilterContent = () => (
//         <div className="space-y-6">
//             <div>
//                 <label className="text-sm font-medium block mb-2">Level</label>
//                 <div className="flex flex-wrap gap-2">
//                     {pfilters?.levels.map((l) => (
//                         <Badge
//                             key={l}
//                             variant={fLevel === l ? "default" : "outline"}
//                             className="cursor-pointer hover:scale-105 transition-transform"
//                             onClick={() => setFLevel(fLevel === l ? "all" : l)}
//                         >
//                             {l}
//                         </Badge>
//                     ))}
//                 </div>
//             </div>

//             <div>
//                 <label className="text-sm font-medium block mb-2">Subject</label>
//                 <div className="flex flex-wrap gap-2">
//                     {pfilters?.subjects.slice(0, 8).map((s) => (
//                         <Badge
//                             key={s}
//                             variant={fSubject === s ? "default" : "outline"}
//                             className="cursor-pointer hover:scale-105 transition-transform"
//                             onClick={() => setFSubject(fSubject === s ? "all" : s)}
//                         >
//                             {s}
//                         </Badge>
//                     ))}
//                     {pfilters?.subjects.length > 8 && (
//                         <Select value={fSubject} onValueChange={setFSubject}>
//                             <SelectTrigger className="h-7 text-xs w-[130px]">
//                                 <SelectValue placeholder="More subjects" />
//                             </SelectTrigger>
//                             <SelectContent>
//                                 <SelectItem value="all">All Subjects</SelectItem>
//                                 {pfilters?.subjects.map((s) => (
//                                     <SelectItem key={s} value={s}>{s}</SelectItem>
//                                 ))}
//                             </SelectContent>
//                         </Select>
//                     )}
//                 </div>
//             </div>

//             <div>
//                 <label className="text-sm font-medium block mb-2">Year Range</label>
//                 <Slider
//                     min={2010}
//                     max={2024}
//                     step={1}
//                     value={yearRange}
//                     onValueChange={setYearRange}
//                     className="w-full"
//                 />
//                 <div className="flex justify-between text-xs text-muted-foreground mt-1">
//                     <span>{yearRange[0]}</span>
//                     <span>{yearRange[1]}</span>
//                 </div>
//             </div>

//             <div>
//                 <label className="text-sm font-medium block mb-2">Paper</label>
//                 <div className="flex gap-2">
//                     {[1, 2, 3].map((p) => (
//                         <Badge
//                             key={p}
//                             variant={fPaper === String(p) ? "default" : "outline"}
//                             className="cursor-pointer hover:scale-105 transition-transform"
//                             onClick={() => setFPaper(fPaper === String(p) ? "all" : String(p))}
//                         >
//                             Paper {p}
//                         </Badge>
//                     ))}
//                 </div>
//             </div>

//             <div>
//                 <label className="text-sm font-medium block mb-2">Sort By</label>
//                 <Select value={sortBy} onValueChange={setSortBy}>
//                     <SelectTrigger>
//                         <SelectValue />
//                     </SelectTrigger>
//                     <SelectContent>
//                         <SelectItem value="newest">Newest First</SelectItem>
//                         <SelectItem value="oldest">Oldest First</SelectItem>
//                         <SelectItem value="popular">Most Popular</SelectItem>
//                         <SelectItem value="title">Alphabetical</SelectItem>
//                     </SelectContent>
//                 </Select>
//             </div>
//         </div>
//     );

//     // Render loading skeletons for papers
//     const renderPaperSkeletons = () => {
//         const count = viewMode === "grid" ? 8 : 4;
//         return Array.from({ length: count }).map((_, i) => (
//             <PaperCardSkeleton key={`skeleton-${i}`} viewMode={viewMode} />
//         ));
//     };

//     // Render loading skeletons for videos
//     const renderVideoSkeletons = () => {
//         return Array.from({ length: 6 }).map((_, i) => (
//             <VideoCardSkeleton key={`video-skeleton-${i}`} />
//         ));
//     };

//     return (
//         <div className="space-y-4 md:space-y-6 max-w-[1400px] px-3 md:px-0">
//             {/* Header */}
//             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
//                 <div>
//                     <h1 className="text-2xl md:text-3xl font-display font-bold">Study Center</h1>
//                     <p className="text-sm text-muted-foreground mt-1">
//                         Browse real GCE past papers, practice AI-marked questions, and watch lessons.
//                     </p>
//                 </div>
//                 {!isMobile && (
//                     <div className="flex items-center gap-2">
//                         <Badge variant="outline" className="gap-1">
//                             <TrendingUp className="h-3 w-3" />
//                             {papers.length} papers available
//                         </Badge>
//                     </div>
//                 )}
//             </div>

//             {/* Tabs - Mobile optimized */}
//             <Tabs defaultValue="browse" value={activeTab} onValueChange={setActiveTab}>
//                 <div className="relative">
//                     <TabsList data-testid="study-tabs" className="flex flex-wrap h-auto gap-1 p-1 bg-transparent">
//                         <TabsTrigger value="browse" data-testid="tab-browse" className="flex-1 sm:flex-none">
//                             <FileStack className="h-4 w-4 mr-1.5" />
//                             <span className="hidden xs:inline">Past Papers</span>
//                             <span className="xs:hidden">Papers</span>
//                         </TabsTrigger>
//                         <TabsTrigger value="papers" data-testid="tab-papers" className="flex-1 sm:flex-none">
//                             <Zap className="h-4 w-4 mr-1.5" />
//                             <span className="hidden xs:inline">Quick Practice</span>
//                             <span className="xs:hidden">Practice</span>
//                         </TabsTrigger>
//                         <TabsTrigger value="videos" data-testid="tab-videos" className="flex-1 sm:flex-none">
//                             <PlayCircle className="h-4 w-4 mr-1.5" />
//                             <span className="hidden xs:inline">Video Lessons</span>
//                             <span className="xs:hidden">Videos</span>
//                         </TabsTrigger>
//                         <TabsTrigger value="drafts" data-testid="tab-drafts" className="flex-1 sm:flex-none relative">
//                             <Bookmark className="h-4 w-4 mr-1.5" />
//                             <span className="hidden xs:inline">Drafts</span>
//                             <span className="xs:hidden">Saved</span>
//                             {drafts.length > 0 && (
//                                 <Badge variant="default" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[9px] flex items-center justify-center">
//                                     {drafts.length}
//                                 </Badge>
//                             )}
//                         </TabsTrigger>
//                     </TabsList>
//                 </div>

//                 {/* Browse Tab */}
//                 <TabsContent value="browse" className="mt-4 md:mt-6 space-y-4">
//                     {/* Mobile Filter Header */}
//                     <div className="flex items-center gap-2 flex-wrap">
//                         <div className="flex-1 min-w-[150px]">
//                             <div className="relative">
//                                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                                 <Input
//                                     data-testid="filter-search"
//                                     value={fSearch}
//                                     onChange={(e) => setFSearch(e.target.value)}
//                                     placeholder="Search papers..."
//                                     className="pl-9 h-10"
//                                 />
//                             </div>
//                         </div>

//                         {isMobile ? (
//                             <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
//                                 <SheetTrigger asChild>
//                                     <Button variant="outline" size="sm" className="gap-2 h-10">
//                                         <Filter className="h-4 w-4" />
//                                         Filters
//                                         {activeFilters.length > 0 && (
//                                             <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
//                                                 {activeFilters.length}
//                                             </Badge>
//                                         )}
//                                     </Button>
//                                 </SheetTrigger>
//                                 <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
//                                     <SheetHeader className="text-left">
//                                         <SheetTitle>Filter Papers</SheetTitle>
//                                         <SheetDescription>
//                                             Refine your search by level, subject, year, and more.
//                                         </SheetDescription>
//                                     </SheetHeader>
//                                     <div className="py-6 overflow-y-auto h-[calc(100%-100px)]">
//                                         <FilterContent />
//                                     </div>
//                                     <SheetFooter className="flex-row gap-2">
//                                         <Button variant="outline" onClick={clearFilters} className="flex-1">
//                                             Clear All
//                                         </Button>
//                                         <Button onClick={() => setFilterSheetOpen(false)} className="flex-1">
//                                             Apply Filters
//                                         </Button>
//                                     </SheetFooter>
//                                 </SheetContent>
//                             </Sheet>
//                         ) : (
//                             <>
//                                 {/* Desktop filters */}
//                                 <Select value={fLevel} onValueChange={setFLevel}>
//                                     <SelectTrigger className="w-[120px] h-10" data-testid="filter-level">
//                                         <SelectValue placeholder="Level" />
//                                     </SelectTrigger>
//                                     <SelectContent>
//                                         <SelectItem value="all">All Levels</SelectItem>
//                                         {pfilters?.levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
//                                     </SelectContent>
//                                 </Select>

//                                 <Select value={fSubject} onValueChange={setFSubject}>
//                                     <SelectTrigger className="w-[130px] h-10" data-testid="filter-subject">
//                                         <SelectValue placeholder="Subject" />
//                                     </SelectTrigger>
//                                     <SelectContent>
//                                         <SelectItem value="all">All Subjects</SelectItem>
//                                         {pfilters?.subjects.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
//                                     </SelectContent>
//                                 </Select>

//                                 <Select value={fYear} onValueChange={setFYear}>
//                                     <SelectTrigger className="w-[100px] h-10" data-testid="filter-year">
//                                         <SelectValue placeholder="Year" />
//                                     </SelectTrigger>
//                                     <SelectContent>
//                                         <SelectItem value="all">All Years</SelectItem>
//                                         {pfilters?.years.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}
//                                     </SelectContent>
//                                 </Select>

//                                 <Select value={fPaper} onValueChange={setFPaper}>
//                                     <SelectTrigger className="w-[110px] h-10" data-testid="filter-paper">
//                                         <SelectValue placeholder="Paper" />
//                                     </SelectTrigger>
//                                     <SelectContent>
//                                         <SelectItem value="all">All Papers</SelectItem>
//                                         {[1, 2, 3].map((l) => <SelectItem key={l} value={String(l)}>Paper {l}</SelectItem>)}
//                                     </SelectContent>
//                                 </Select>

//                                 <Select value={sortBy} onValueChange={setSortBy}>
//                                     <SelectTrigger className="w-[120px] h-10">
//                                         <SelectValue placeholder="Sort" />
//                                     </SelectTrigger>
//                                     <SelectContent>
//                                         <SelectItem value="newest">Newest</SelectItem>
//                                         <SelectItem value="oldest">Oldest</SelectItem>
//                                         <SelectItem value="popular">Popular</SelectItem>
//                                         <SelectItem value="title">Alphabetical</SelectItem>
//                                     </SelectContent>
//                                 </Select>
//                             </>
//                         )}

//                         {/* View toggle */}
//                         <div className="flex gap-1 border rounded-lg p-1">
//                             <button
//                                 onClick={() => setViewMode("grid")}
//                                 className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "hover:bg-secondary"}`}
//                             >
//                                 <Grid3X3 className="h-4 w-4" />
//                             </button>
//                             <button
//                                 onClick={() => setViewMode("list")}
//                                 className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-primary text-white" : "hover:bg-secondary"}`}
//                             >
//                                 <List className="h-4 w-4" />
//                             </button>
//                         </div>

//                         {(fLevel !== "all" || fSubject !== "all" || fYear !== "all" || fPaper !== "all" || fSearch) && (
//                             <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-10">
//                                 <X className="h-4 w-4" /> Clear
//                             </Button>
//                         )}
//                     </div>

//                     {/* Active filters display */}
//                     {activeFilters.length > 0 && (
//                         <div className="flex flex-wrap gap-2">
//                             {activeFilters.map((filter, i) => (
//                                 <FilterBadge key={i} {...filter} />
//                             ))}
//                         </div>
//                     )}

//                     {/* Results count */}
//                     <div className="flex items-center justify-between text-sm text-muted-foreground">
//                         <span>{isLoadingPapers ? "Loading..." : `${papers.length} papers found`}</span>
//                         {!isLoadingPapers && papers.length > 0 && (
//                             <span className="hidden sm:inline">Showing {Math.min(papers.length, 12)} results</span>
//                         )}
//                     </div>

//                     {/* Papers grid with loading skeletons */}
//                     <div className={`grid gap-4 ${viewMode === "grid"
//                         ? "grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
//                         : "grid-cols-1"
//                         }`}>
//                         {isLoadingPapers ? (
//                             renderPaperSkeletons()
//                         ) : papers.length ? (
//                             papers.map((p) => (
//                                 <PaperCard key={p.paper_id} p={p} onOpen={openPaper} onToggle={toggleDraft} viewMode={viewMode} />
//                             ))
//                         ) : (
//                             <div className="col-span-full text-center py-12">
//                                 <FileStack className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
//                                 <p className="font-medium text-lg">No papers found</p>
//                                 <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
//                                 <Button variant="outline" onClick={clearFilters} className="mt-4">
//                                     Clear all filters
//                                 </Button>
//                             </div>
//                         )}
//                     </div>
//                 </TabsContent>

//                 {/* Drafts Tab */}
//                 <TabsContent value="drafts" className="mt-4 md:mt-6">
//                     <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
//                         {drafts.length ? drafts.map((p) => (
//                             <PaperCard key={p.paper_id} p={{ ...p, saved: true }} onOpen={openPaper} onToggle={toggleDraft} viewMode="grid" />
//                         )) : (
//                             <div className="col-span-full text-center py-12">
//                                 <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
//                                 <p className="font-medium text-lg">No saved papers yet</p>
//                                 <p className="text-sm text-muted-foreground max-w-md mx-auto">
//                                     Tap the bookmark icon on any paper to save it here for quick access.
//                                 </p>
//                             </div>
//                         )}
//                     </div>
//                 </TabsContent>

//                 {/* Practice Tab */}
//                 <TabsContent value="papers" className="mt-4 md:mt-6">
//                     <div className="rounded-xl border border-border bg-card p-4 md:p-6 relative overflow-hidden">
//                         <div className="radial-glow" />
//                         <div className="relative z-10">
//                             <div className="flex items-center gap-3 mb-6">
//                                 <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shadow-glow shrink-0">
//                                     <Sparkles className="h-5 w-5 text-white" />
//                                 </div>
//                                 <div>
//                                     <h2 className="text-lg font-display font-semibold">Quick Practice</h2>
//                                     <p className="text-sm text-muted-foreground">
//                                         Paper 1 · Timed MCQ with instant AI feedback
//                                     </p>
//                                 </div>
//                             </div>

//                             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium flex items-center gap-1">
//                                         <GraduationCap className="h-4 w-4" /> Level
//                                     </label>
//                                     <Select value={level} onValueChange={(v) => { setLevel(v); setSubject(""); }}>
//                                         <SelectTrigger data-testid="select-level" className="h-11">
//                                             <SelectValue placeholder="Select level" />
//                                         </SelectTrigger>
//                                         <SelectContent>
//                                             {struct && Object.keys(struct.levels).map((l) => (
//                                                 <SelectItem key={l} value={l}>{l}</SelectItem>
//                                             ))}
//                                         </SelectContent>
//                                     </Select>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium flex items-center gap-1">
//                                         <BookOpen className="h-4 w-4" /> Subject
//                                     </label>
//                                     <Select value={subject} onValueChange={setSubject} disabled={!level}>
//                                         <SelectTrigger data-testid="select-subject" className="h-11">
//                                             <SelectValue placeholder={level ? "Select subject" : "Select level first"} />
//                                         </SelectTrigger>
//                                         <SelectContent>
//                                             {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
//                                         </SelectContent>
//                                     </Select>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium flex items-center gap-1">
//                                         <Calendar className="h-4 w-4" /> Year
//                                     </label>
//                                     <Select value={year} onValueChange={setYear}>
//                                         <SelectTrigger data-testid="select-year" className="h-11">
//                                             <SelectValue placeholder="Select year" />
//                                         </SelectTrigger>
//                                         <SelectContent>
//                                             {struct?.years.map((y) => (
//                                                 <SelectItem key={y} value={String(y)}>{y}</SelectItem>
//                                             ))}
//                                         </SelectContent>
//                                     </Select>
//                                 </div>

//                                 <div className="space-y-2">
//                                     <label className="text-sm font-medium flex items-center gap-1">
//                                         <Clock className="h-4 w-4" /> Questions
//                                     </label>
//                                     <Select value={count} onValueChange={setCount}>
//                                         <SelectTrigger data-testid="select-count" className="h-11">
//                                             <SelectValue />
//                                         </SelectTrigger>
//                                         <SelectContent>
//                                             {["5", "10", "15", "20"].map((y) => (
//                                                 <SelectItem key={y} value={y}>{y} questions</SelectItem>
//                                             ))}
//                                         </SelectContent>
//                                     </Select>
//                                 </div>

//                                 <div className="flex items-end">
//                                     <Button onClick={startPractice} data-testid="start-exam-btn" className="w-full h-11 shadow-glow gap-2">
//                                         <BookOpen className="h-4 w-4" /> Start Practice
//                                     </Button>
//                                 </div>
//                             </div>

//                             {/* Quick start suggestions */}
//                             <div className="mt-6 pt-4 border-t border-border">
//                                 <p className="text-xs text-muted-foreground mb-2">Popular practice combinations:</p>
//                                 <div className="flex flex-wrap gap-2">
//                                     {[
//                                         { level: "O/L", subject: "Mathematics", year: "2023" },
//                                         { level: "A/L", subject: "Physics", year: "2024" },
//                                         { level: "O/L", subject: "English", year: "2022" },
//                                     ].map((combo, i) => (
//                                         <Badge
//                                             key={i}
//                                             variant="outline"
//                                             className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
//                                             onClick={() => {
//                                                 setLevel(combo.level);
//                                                 setSubject(combo.subject);
//                                                 setYear(combo.year);
//                                             }}
//                                         >
//                                             {combo.level} · {combo.subject} · {combo.year}
//                                         </Badge>
//                                     ))}
//                                 </div>
//                             </div>
//                         </div>
//                     </div>
//                 </TabsContent>

//                 {/* Videos Tab */}
//                 <TabsContent value="videos" className="mt-4 md:mt-6">
//                     <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
//                         {isLoadingCourses ? (
//                             renderVideoSkeletons()
//                         ) : courses.length ? (
//                             courses.map((c) => (
//                                 <div key={c.course_id} data-testid={`video-card-${c.course_id}`}
//                                     className="rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-1 transition-all hover:shadow-lg group">
//                                     <button onClick={() => openCourse(c)} className="block w-full text-left">
//                                         <div className="relative h-48 bg-secondary overflow-hidden">
//                                             {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />}
//                                             <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
//                                                 <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
//                                                     <PlayCircle className="h-8 w-8 text-white" />
//                                                 </div>
//                                             </div>
//                                             <div className="absolute top-3 left-3 flex gap-2">
//                                                 <span className="text-xs bg-black/70 text-white px-2.5 py-0.5 rounded-full backdrop-blur">{c.level}</span>
//                                                 <span className="text-xs bg-primary/80 text-white px-2.5 py-0.5 rounded-full backdrop-blur">{c.subject}</span>
//                                             </div>
//                                             <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur">
//                                                 <Eye className="h-3 w-3" />
//                                                 {c.views} views
//                                             </div>
//                                         </div>
//                                     </button>
//                                     <div className="p-4">
//                                         <p className="font-semibold line-clamp-1 text-sm md:text-base">{c.title}</p>
//                                         <p className="text-sm text-muted-foreground line-clamp-2 mt-1 text-xs md:text-sm">{c.description}</p>
//                                         <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
//                                             <span className="flex items-center gap-1">
//                                                 <User className="h-3 w-3" />
//                                                 {c.teacher_name}
//                                             </span>
//                                             <span className="flex items-center gap-1 text-success">
//                                                 <Coins className="h-3 w-3" />
//                                                 90 FCFA/view
//                                             </span>
//                                         </div>
//                                     </div>
//                                 </div>
//                             ))
//                         ) : (
//                             <div className="col-span-full text-center py-12">
//                                 <PlayCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
//                                 <p className="font-medium text-lg">No video lessons available</p>
//                                 <p className="text-sm text-muted-foreground">Check back later for new content.</p>
//                             </div>
//                         )}
//                     </div>
//                 </TabsContent>
//             </Tabs>

//             {/* Video Dialog */}
//             <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
//                 <DialogContent className="max-w-3xl p-4 md:p-6">
//                     <DialogHeader>
//                         <DialogTitle className="font-display text-lg md:text-xl">{active?.title}</DialogTitle>
//                         <DialogDescription className="flex flex-wrap items-center gap-2">
//                             <span>{active?.subject}</span>
//                             <span className="text-muted-foreground">·</span>
//                             <span>{active?.level}</span>
//                             <span className="text-muted-foreground">·</span>
//                             <span>by {active?.teacher_name}</span>
//                         </DialogDescription>
//                     </DialogHeader>
//                     {active && (
//                         <div className="space-y-4">
//                             <div className="aspect-video rounded-lg overflow-hidden bg-black">
//                                 <iframe
//                                     title={active.title}
//                                     src={active.video_url}
//                                     className="w-full h-full"
//                                     allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
//                                     allowFullScreen
//                                 />
//                             </div>
//                             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
//                                 <div>
//                                     <p className="font-medium">{active.teacher_name}</p>
//                                     <p className="text-sm text-muted-foreground">{active.subject} · {active.level}</p>
//                                 </div>
//                                 <Badge variant="secondary" className="gap-1.5 text-sm py-1.5 px-3">
//                                     <Coins className="h-4 w-4" /> 90 FCFA / view
//                                 </Badge>
//                             </div>
//                         </div>
//                     )}
//                 </DialogContent>
//             </Dialog>
//         </div>
//     );
// }

















































































import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Button } from "../components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "../components/ui/sheet";
import { Slider } from "../components/ui/slider";
import {
    BookOpen, PlayCircle, FileText, Sparkles, Coins, FileStack, Bookmark, BookmarkCheck,
    Filter, X, ArrowRight, Zap, Search, Grid3X3, List,
    GraduationCap, Calendar, Clock, User, Eye, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

// Shimmer Skeleton Component
function PaperCardSkeleton({ viewMode }) {
    return (
        <div
            className={`rounded-xl border border-border bg-card p-5 animate-pulse ${viewMode === "list" ? "flex items-center p-4 gap-4" : ""
                }`}
        >
            {viewMode !== "list" ? (
                <>
                    <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="h-10 w-10 rounded-lg bg-secondary/60" />
                        <div className="h-8 w-8 rounded-lg bg-secondary/60" />
                    </div>
                    <div className="space-y-3">
                        <div className="h-3 w-20 bg-secondary/60 rounded" />
                        <div className="h-5 w-3/4 bg-secondary/60 rounded" />
                        <div className="h-4 w-1/2 bg-secondary/60 rounded" />
                        <div className="h-6 w-16 bg-secondary/60 rounded-full" />
                        <div className="h-10 w-full bg-secondary/60 rounded-lg mt-2" />
                    </div>
                </>
            ) : (
                <>
                    <div className="h-10 w-10 rounded-lg bg-secondary/60 shrink-0" />
                    <div className="flex-1 flex items-center gap-4 flex-wrap">
                        <div className="flex-1 min-w-[150px] space-y-2">
                            <div className="h-3 w-24 bg-secondary/60 rounded" />
                            <div className="h-5 w-48 bg-secondary/60 rounded" />
                            <div className="h-4 w-32 bg-secondary/60 rounded" />
                            <div className="flex items-center gap-2">
                                <div className="h-6 w-16 bg-secondary/60 rounded-full" />
                                <div className="h-4 w-12 bg-secondary/60 rounded" />
                            </div>
                        </div>
                        <div className="h-9 w-20 bg-secondary/60 rounded-lg" />
                    </div>
                </>
            )}
        </div>
    );
}

function VideoCardSkeleton() {
    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-pulse">
            <div className="h-48 bg-secondary/60" />
            <div className="p-4 space-y-3">
                <div className="h-5 w-3/4 bg-secondary/60 rounded" />
                <div className="h-4 w-full bg-secondary/60 rounded" />
                <div className="h-4 w-2/3 bg-secondary/60 rounded" />
                <div className="flex items-center justify-between">
                    <div className="h-3 w-24 bg-secondary/60 rounded" />
                    <div className="h-3 w-20 bg-secondary/60 rounded" />
                </div>
            </div>
        </div>
    );
}

function PaperCard({ p, onOpen, onToggle, viewMode, isToggling }) {
    return (
        <div
            data-testid={`paper-card-${p.paper_id}`}
            className={`rounded-xl border border-border bg-card hover:-translate-y-0.5 transition-all hover:shadow-lg flex flex-col ${viewMode === "list" ? "flex-row items-center p-4 gap-4" : "p-5"
                }`}
        >
            {viewMode !== "list" && (
                <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="h-10 w-10 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                        <FileText className="h-5 w-5" />
                    </div>
                    <button
                        onClick={() => onToggle(p)}
                        data-testid={`save-draft-${p.paper_id}`}
                        disabled={isToggling}
                        className={`h-8 w-8 rounded-lg flex items-center justify-center transition-colors ${p.saved ? "text-primary bg-accent" : "text-muted-foreground hover:bg-secondary"
                            } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {p.saved ? <BookmarkCheck className="h-4.5 w-4.5" /> : <Bookmark className="h-4.5 w-4.5" />}
                    </button>
                </div>
            )}

            {viewMode === "list" && (
                <div className="h-10 w-10 rounded-lg bg-accent text-primary flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5" />
                </div>
            )}

            <div className={`flex-1 ${viewMode === "list" ? "flex items-center gap-4 flex-wrap" : ""}`}>
                <div className={viewMode === "list" ? "flex-1 min-w-[150px]" : ""}>
                    <p className="text-xs text-primary font-medium">{p.subject} · {p.level}</p>
                    <p className="font-semibold line-clamp-2 mt-0.5">{p.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{p.year} · Paper {p.paper_number}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${p.paper_number === 1 ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
                            }`}>
                            {p.paper_number === 1 ? "AI Q&A" : "Video Solution"}
                        </span>
                        {viewMode === "list" && (
                            <button
                                onClick={() => onToggle(p)}
                                disabled={isToggling}
                                className={`text-xs flex items-center gap-1 ${p.saved ? "text-primary" : "text-muted-foreground hover:text-primary"
                                    } ${isToggling ? "opacity-50 cursor-not-allowed" : ""}`}
                            >
                                {p.saved ? <BookmarkCheck className="h-3 w-3" /> : <Bookmark className="h-3 w-3" />}
                                {p.saved ? "Saved" : "Save"}
                            </button>
                        )}
                    </div>
                </div>
                {viewMode === "list" && (
                    <Button onClick={() => onOpen(p)} size="sm" className="gap-2 shrink-0">
                        Open <ArrowRight className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {viewMode !== "list" && (
                <Button onClick={() => onOpen(p)} className="w-full mt-4 gap-2">
                    Open Paper <ArrowRight className="h-4 w-4" />
                </Button>
            )}
        </div>
    );
}

function FilterBadge({ label, onRemove }) {
    return (
        <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-xs">
            {label}
            <button onClick={onRemove} className="hover:text-destructive transition-colors">
                <X className="h-3 w-3" />
            </button>
        </Badge>
    );
}

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
    const [viewMode, setViewMode] = useState("grid");
    const [isLoadingPapers, setIsLoadingPapers] = useState(false);
    const [isLoadingCourses, setIsLoadingCourses] = useState(false);
    const [togglingDraft, setTogglingDraft] = useState(null);

    // Past papers browse + drafts
    const [pfilters, setPfilters] = useState(null);
    const [papers, setPapers] = useState([]);
    const [drafts, setDrafts] = useState([]);
    const [fLevel, setFLevel] = useState("all");
    const [fSubject, setFSubject] = useState("all");
    const [fYear, setFYear] = useState("all");
    const [fPaper, setFPaper] = useState("all");
    const [fSearch, setFSearch] = useState("");
    const [sortBy, setSortBy] = useState("newest");
    const [filterSheetOpen, setFilterSheetOpen] = useState(false);
    const [yearRange, setYearRange] = useState([2015, 2024]);

    // Mobile responsive states
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
    const [activeTab, setActiveTab] = useState("browse");

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    const loadPapers = useCallback(() => {
        setIsLoadingPapers(true);
        const params = {};
        if (fLevel !== "all") params.level = fLevel;
        if (fSubject !== "all") params.subject = fSubject;
        if (fYear !== "all") params.year = Number(fYear);
        if (fPaper !== "all") params.paper = Number(fPaper);
        if (fSearch) params.q = fSearch;
        if (sortBy) params.sort = sortBy;
        api.get("/papers", { params })
            .then((r) => {
                // Merge with draft status from the drafts state
                const papersWithDraftStatus = r.data.map(p => ({
                    ...p,
                    saved: drafts.some(d => d.paper_id === p.paper_id)
                }));
                setPapers(papersWithDraftStatus);
            })
            .catch((error) => {
                console.error("Failed to load papers:", error);
            })
            .finally(() => setIsLoadingPapers(false));
    }, [fLevel, fSubject, fYear, fPaper, fSearch, sortBy, drafts]);

    const loadDrafts = useCallback(async () => {
        try {
            const response = await api.get("/drafts");
            const draftsData = Array.isArray(response.data) ? response.data : [];
            setDrafts(draftsData);

            // Update papers with draft status
            setPapers(prevPapers =>
                prevPapers.map(p => ({
                    ...p,
                    saved: draftsData.some(d => d.paper_id === p.paper_id)
                }))
            );

            return draftsData;
        } catch (error) {
            console.error("Failed to load drafts:", error);
            setDrafts([]);
            return [];
        }
    }, []);

    const loadCourses = useCallback(() => {
        setIsLoadingCourses(true);
        api.get("/courses")
            .then((r) => setCourses(r.data))
            .catch(() => { })
            .finally(() => setIsLoadingCourses(false));
    }, []);

    useEffect(() => {
        api.get("/exam/structure").then((r) => setStruct(r.data)).catch(() => { });
        loadCourses();
        api.get("/papers/filters").then((r) => setPfilters(r.data)).catch(() => { });
        loadDrafts();
    }, [loadCourses, loadDrafts]);

    useEffect(() => {
        loadPapers();
    }, [loadPapers]);

    const openPaper = (p) => navigate(`/study/paper/${p.paper_id}`);

    const toggleDraft = async (p) => {
        if (togglingDraft === p.paper_id) return;

        setTogglingDraft(p.paper_id);

        // Optimistic update
        const wasSaved = p.saved;
        setPapers(prevPapers =>
            prevPapers.map(paper =>
                paper.paper_id === p.paper_id
                    ? { ...paper, saved: !wasSaved }
                    : paper
            )
        );

        try {
            const response = await api.post("/drafts", { paper_id: p.paper_id });
            const { saved } = response.data;

            // Update papers with the actual server response
            setPapers(prevPapers =>
                prevPapers.map(paper =>
                    paper.paper_id === p.paper_id
                        ? { ...paper, saved: saved }
                        : paper
                )
            );

            // Reload drafts to keep in sync
            await loadDrafts();

            toast.success(saved ? "Saved to Drafts" : "Removed from Drafts");
        } catch (error) {
            console.error("Toggle draft error:", error);
            console.error("Error response:", error.response?.data);

            // Revert optimistic update on error
            setPapers(prevPapers =>
                prevPapers.map(paper =>
                    paper.paper_id === p.paper_id
                        ? { ...paper, saved: wasSaved }
                        : paper
                )
            );

            const errorMessage = error.response?.data?.detail || error.message || "Could not update drafts. Please try again.";
            toast.error(errorMessage);
        } finally {
            setTogglingDraft(null);
        }
    };

    const clearFilters = () => {
        setFLevel("all");
        setFSubject("all");
        setFYear("all");
        setFPaper("all");
        setFSearch("");
        setSortBy("newest");
        setYearRange([2015, 2024]);
    };

    const subjects = struct && level ? struct.levels[level] : [];
    const activeFilters = useMemo(() => {
        const filters = [];
        if (fLevel !== "all") filters.push({ label: fLevel, onRemove: () => setFLevel("all") });
        if (fSubject !== "all") filters.push({ label: fSubject, onRemove: () => setFSubject("all") });
        if (fYear !== "all") filters.push({ label: fYear, onRemove: () => setFYear("all") });
        if (fPaper !== "all") filters.push({ label: `Paper ${fPaper}`, onRemove: () => setFPaper("all") });
        if (fSearch) filters.push({ label: `"${fSearch}"`, onRemove: () => setFSearch("") });
        return filters;
    }, [fLevel, fSubject, fYear, fPaper, fSearch]);

    const startPractice = () => {
        if (!level || !subject || !year) { toast.error("Select level, subject and year"); return; }
        navigate("/study/exam", { state: { level, subject, year: Number(year), paper: Number(paper), count: Number(count) } });
    };

    const openCourse = async (c) => {
        setActive(c);
        try {
            const { data } = await api.post(`/courses/${c.course_id}/view`);
            if (data.counted) toast.success(`View counted · ${data.rate} FCFA credited to ${c.teacher_name}`);
        } catch { }
    };

    const FilterContent = () => (
        <div className="space-y-6">
            <div>
                <label className="text-sm font-medium block mb-2">Level</label>
                <div className="flex flex-wrap gap-2">
                    {pfilters?.levels.map((l) => (
                        <Badge
                            key={l}
                            variant={fLevel === l ? "default" : "outline"}
                            className="cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setFLevel(fLevel === l ? "all" : l)}
                        >
                            {l}
                        </Badge>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-sm font-medium block mb-2">Subject</label>
                <div className="flex flex-wrap gap-2">
                    {pfilters?.subjects.slice(0, 8).map((s) => (
                        <Badge
                            key={s}
                            variant={fSubject === s ? "default" : "outline"}
                            className="cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setFSubject(fSubject === s ? "all" : s)}
                        >
                            {s}
                        </Badge>
                    ))}
                    {pfilters?.subjects.length > 8 && (
                        <Select value={fSubject} onValueChange={setFSubject}>
                            <SelectTrigger className="h-7 text-xs w-[130px]">
                                <SelectValue placeholder="More subjects" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Subjects</SelectItem>
                                {pfilters?.subjects.map((s) => (
                                    <SelectItem key={s} value={s}>{s}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    )}
                </div>
            </div>

            <div>
                <label className="text-sm font-medium block mb-2">Year Range</label>
                <Slider
                    min={2010}
                    max={2024}
                    step={1}
                    value={yearRange}
                    onValueChange={setYearRange}
                    className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>{yearRange[0]}</span>
                    <span>{yearRange[1]}</span>
                </div>
            </div>

            <div>
                <label className="text-sm font-medium block mb-2">Paper</label>
                <div className="flex gap-2">
                    {[1, 2, 3].map((p) => (
                        <Badge
                            key={p}
                            variant={fPaper === String(p) ? "default" : "outline"}
                            className="cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setFPaper(fPaper === String(p) ? "all" : String(p))}
                        >
                            Paper {p}
                        </Badge>
                    ))}
                </div>
            </div>

            <div>
                <label className="text-sm font-medium block mb-2">Sort By</label>
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">Newest First</SelectItem>
                        <SelectItem value="oldest">Oldest First</SelectItem>
                        <SelectItem value="popular">Most Popular</SelectItem>
                        <SelectItem value="title">Alphabetical</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );

    const renderPaperSkeletons = () => {
        const count = viewMode === "grid" ? 8 : 4;
        return Array.from({ length: count }).map((_, i) => (
            <PaperCardSkeleton key={`skeleton-${i}`} viewMode={viewMode} />
        ));
    };

    const renderVideoSkeletons = () => {
        return Array.from({ length: 6 }).map((_, i) => (
            <VideoCardSkeleton key={`video-skeleton-${i}`} />
        ));
    };

    return (
        <div className="space-y-4 md:space-y-6 max-w-[1400px] px-3 md:px-0">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-display font-bold">Study Center</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Browse real GCE past papers, practice AI-marked questions, and watch lessons.
                    </p>
                </div>
                {!isMobile && (
                    <div className="flex items-center gap-2">
                        <Badge variant="outline" className="gap-1">
                            <TrendingUp className="h-3 w-3" />
                            {papers.length} papers available
                        </Badge>
                    </div>
                )}
            </div>

            {/* Tabs - Mobile optimized */}
            <Tabs defaultValue="browse" value={activeTab} onValueChange={setActiveTab}>
                <div className="relative">
                    <TabsList data-testid="study-tabs" className="flex flex-wrap h-auto gap-1 p-1 bg-transparent">
                        <TabsTrigger value="browse" data-testid="tab-browse" className="flex-1 sm:flex-none">
                            <FileStack className="h-4 w-4 mr-1.5" />
                            <span className="hidden xs:inline">Past Papers</span>
                            <span className="xs:hidden">Papers</span>
                        </TabsTrigger>
                        <TabsTrigger value="papers" data-testid="tab-papers" className="flex-1 sm:flex-none">
                            <Zap className="h-4 w-4 mr-1.5" />
                            <span className="hidden xs:inline">Quick Practice</span>
                            <span className="xs:hidden">Practice</span>
                        </TabsTrigger>
                        <TabsTrigger value="videos" data-testid="tab-videos" className="flex-1 sm:flex-none">
                            <PlayCircle className="h-4 w-4 mr-1.5" />
                            <span className="hidden xs:inline">Video Lessons</span>
                            <span className="xs:hidden">Videos</span>
                        </TabsTrigger>
                        <TabsTrigger value="drafts" data-testid="tab-drafts" className="flex-1 sm:flex-none relative">
                            <Bookmark className="h-4 w-4 mr-1.5" />
                            <span className="hidden xs:inline">Drafts</span>
                            <span className="xs:hidden">Saved</span>
                            {drafts.length > 0 && (
                                <Badge variant="default" className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[9px] flex items-center justify-center">
                                    {drafts.length}
                                </Badge>
                            )}
                        </TabsTrigger>
                    </TabsList>
                </div>

                {/* Browse Tab */}
                <TabsContent value="browse" className="mt-4 md:mt-6 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex-1 min-w-[150px]">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    data-testid="filter-search"
                                    value={fSearch}
                                    onChange={(e) => setFSearch(e.target.value)}
                                    placeholder="Search papers..."
                                    className="pl-9 h-10"
                                />
                            </div>
                        </div>

                        {isMobile ? (
                            <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
                                <SheetTrigger asChild>
                                    <Button variant="outline" size="sm" className="gap-2 h-10">
                                        <Filter className="h-4 w-4" />
                                        Filters
                                        {activeFilters.length > 0 && (
                                            <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                                                {activeFilters.length}
                                            </Badge>
                                        )}
                                    </Button>
                                </SheetTrigger>
                                <SheetContent side="bottom" className="h-[85vh] rounded-t-xl">
                                    <SheetHeader className="text-left">
                                        <SheetTitle>Filter Papers</SheetTitle>
                                        <SheetDescription>
                                            Refine your search by level, subject, year, and more.
                                        </SheetDescription>
                                    </SheetHeader>
                                    <div className="py-6 overflow-y-auto h-[calc(100%-100px)]">
                                        <FilterContent />
                                    </div>
                                    <SheetFooter className="flex-row gap-2">
                                        <Button variant="outline" onClick={clearFilters} className="flex-1">
                                            Clear All
                                        </Button>
                                        <Button onClick={() => setFilterSheetOpen(false)} className="flex-1">
                                            Apply Filters
                                        </Button>
                                    </SheetFooter>
                                </SheetContent>
                            </Sheet>
                        ) : (
                            <>
                                <Select value={fLevel} onValueChange={setFLevel}>
                                    <SelectTrigger className="w-[120px] h-10" data-testid="filter-level">
                                        <SelectValue placeholder="Level" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Levels</SelectItem>
                                        {pfilters?.levels.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={fSubject} onValueChange={setFSubject}>
                                    <SelectTrigger className="w-[130px] h-10" data-testid="filter-subject">
                                        <SelectValue placeholder="Subject" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Subjects</SelectItem>
                                        {pfilters?.subjects.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={fYear} onValueChange={setFYear}>
                                    <SelectTrigger className="w-[100px] h-10" data-testid="filter-year">
                                        <SelectValue placeholder="Year" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Years</SelectItem>
                                        {pfilters?.years.map((l) => <SelectItem key={l} value={String(l)}>{l}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={fPaper} onValueChange={setFPaper}>
                                    <SelectTrigger className="w-[110px] h-10" data-testid="filter-paper">
                                        <SelectValue placeholder="Paper" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Papers</SelectItem>
                                        {[1, 2, 3].map((l) => <SelectItem key={l} value={String(l)}>Paper {l}</SelectItem>)}
                                    </SelectContent>
                                </Select>

                                <Select value={sortBy} onValueChange={setSortBy}>
                                    <SelectTrigger className="w-[120px] h-10">
                                        <SelectValue placeholder="Sort" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="newest">Newest</SelectItem>
                                        <SelectItem value="oldest">Oldest</SelectItem>
                                        <SelectItem value="popular">Popular</SelectItem>
                                        <SelectItem value="title">Alphabetical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </>
                        )}

                        <div className="flex gap-1 border rounded-lg p-1">
                            <button
                                onClick={() => setViewMode("grid")}
                                className={`p-1.5 rounded transition-colors ${viewMode === "grid" ? "bg-primary text-white" : "hover:bg-secondary"}`}
                            >
                                <Grid3X3 className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => setViewMode("list")}
                                className={`p-1.5 rounded transition-colors ${viewMode === "list" ? "bg-primary text-white" : "hover:bg-secondary"}`}
                            >
                                <List className="h-4 w-4" />
                            </button>
                        </div>

                        {(fLevel !== "all" || fSubject !== "all" || fYear !== "all" || fPaper !== "all" || fSearch) && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1 h-10">
                                <X className="h-4 w-4" /> Clear
                            </Button>
                        )}
                    </div>

                    {activeFilters.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                            {activeFilters.map((filter, i) => (
                                <FilterBadge key={i} {...filter} />
                            ))}
                        </div>
                    )}

                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{isLoadingPapers ? "Loading..." : `${papers.length} papers found`}</span>
                        {!isLoadingPapers && papers.length > 0 && (
                            <span className="hidden sm:inline">Showing {Math.min(papers.length, 12)} results</span>
                        )}
                    </div>

                    <div className={`grid gap-4 ${viewMode === "grid"
                        ? "grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                        : "grid-cols-1"
                        }`}>
                        {isLoadingPapers ? (
                            renderPaperSkeletons()
                        ) : papers.length ? (
                            papers.map((p) => (
                                <PaperCard
                                    key={p.paper_id}
                                    p={p}
                                    onOpen={openPaper}
                                    onToggle={toggleDraft}
                                    viewMode={viewMode}
                                    isToggling={togglingDraft === p.paper_id}
                                />
                            ))
                        ) : (
                            <div className="col-span-full text-center py-12">
                                <FileStack className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                <p className="font-medium text-lg">No papers found</p>
                                <p className="text-sm text-muted-foreground">Try adjusting your filters or search terms.</p>
                                <Button variant="outline" onClick={clearFilters} className="mt-4">
                                    Clear all filters
                                </Button>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Drafts Tab */}
                <TabsContent value="drafts" className="mt-4 md:mt-6">
                    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {drafts.length > 0 ? drafts.map((p) => (
                            <PaperCard
                                key={p.paper_id}
                                p={{ ...p, saved: true }}
                                onOpen={openPaper}
                                onToggle={toggleDraft}
                                viewMode="grid"
                                isToggling={togglingDraft === p.paper_id}
                            />
                        )) : (
                            <div className="col-span-full text-center py-12">
                                <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                <p className="font-medium text-lg">No saved papers yet</p>
                                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                                    Tap the bookmark icon on any paper to save it here for quick access.
                                </p>
                            </div>
                        )}
                    </div>
                </TabsContent>

                {/* Practice Tab */}
                <TabsContent value="papers" className="mt-4 md:mt-6">
                    <div className="rounded-xl border border-border bg-card p-4 md:p-6 relative overflow-hidden">
                        <div className="radial-glow" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center shadow-glow shrink-0">
                                    <Sparkles className="h-5 w-5 text-white" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-display font-semibold">Quick Practice</h2>
                                    <p className="text-sm text-muted-foreground">
                                        Paper 1 · Timed MCQ with instant AI feedback
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1">
                                        <GraduationCap className="h-4 w-4" /> Level
                                    </label>
                                    <Select value={level} onValueChange={(v) => { setLevel(v); setSubject(""); }}>
                                        <SelectTrigger data-testid="select-level" className="h-11">
                                            <SelectValue placeholder="Select level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {struct && Object.keys(struct.levels).map((l) => (
                                                <SelectItem key={l} value={l}>{l}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1">
                                        <BookOpen className="h-4 w-4" /> Subject
                                    </label>
                                    <Select value={subject} onValueChange={setSubject} disabled={!level}>
                                        <SelectTrigger data-testid="select-subject" className="h-11">
                                            <SelectValue placeholder={level ? "Select subject" : "Select level first"} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subjects.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1">
                                        <Calendar className="h-4 w-4" /> Year
                                    </label>
                                    <Select value={year} onValueChange={setYear}>
                                        <SelectTrigger data-testid="select-year" className="h-11">
                                            <SelectValue placeholder="Select year" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {struct?.years.map((y) => (
                                                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-medium flex items-center gap-1">
                                        <Clock className="h-4 w-4" /> Questions
                                    </label>
                                    <Select value={count} onValueChange={setCount}>
                                        <SelectTrigger data-testid="select-count" className="h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {["5", "10", "15", "20"].map((y) => (
                                                <SelectItem key={y} value={y}>{y} questions</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="flex items-end">
                                    <Button onClick={startPractice} data-testid="start-exam-btn" className="w-full h-11 shadow-glow gap-2">
                                        <BookOpen className="h-4 w-4" /> Start Practice
                                    </Button>
                                </div>
                            </div>

                            <div className="mt-6 pt-4 border-t border-border">
                                <p className="text-xs text-muted-foreground mb-2">Popular practice combinations:</p>
                                <div className="flex flex-wrap gap-2">
                                    {[
                                        { level: "O/L", subject: "Mathematics", year: "2023" },
                                        { level: "A/L", subject: "Physics", year: "2024" },
                                        { level: "O/L", subject: "English", year: "2022" },
                                    ].map((combo, i) => (
                                        <Badge
                                            key={i}
                                            variant="outline"
                                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                                            onClick={() => {
                                                setLevel(combo.level);
                                                setSubject(combo.subject);
                                                setYear(combo.year);
                                            }}
                                        >
                                            {combo.level} · {combo.subject} · {combo.year}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Videos Tab */}
                <TabsContent value="videos" className="mt-4 md:mt-6">
                    <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                        {isLoadingCourses ? (
                            renderVideoSkeletons()
                        ) : courses.length ? (
                            courses.map((c) => (
                                <div key={c.course_id} data-testid={`video-card-${c.course_id}`}
                                    className="rounded-xl border border-border bg-card overflow-hidden hover:-translate-y-1 transition-all hover:shadow-lg group">
                                    <button onClick={() => openCourse(c)} className="block w-full text-left">
                                        <div className="relative h-48 bg-secondary overflow-hidden">
                                            {c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300" />}
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <div className="h-14 w-14 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                                                    <PlayCircle className="h-8 w-8 text-white" />
                                                </div>
                                            </div>
                                            <div className="absolute top-3 left-3 flex gap-2">
                                                <span className="text-xs bg-black/70 text-white px-2.5 py-0.5 rounded-full backdrop-blur">{c.level}</span>
                                                <span className="text-xs bg-primary/80 text-white px-2.5 py-0.5 rounded-full backdrop-blur">{c.subject}</span>
                                            </div>
                                            <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs bg-black/60 text-white px-2 py-0.5 rounded-full backdrop-blur">
                                                <Eye className="h-3 w-3" />
                                                {c.views} views
                                            </div>
                                        </div>
                                    </button>
                                    <div className="p-4">
                                        <p className="font-semibold line-clamp-1 text-sm md:text-base">{c.title}</p>
                                        <p className="text-sm text-muted-foreground line-clamp-2 mt-1 text-xs md:text-sm">{c.description}</p>
                                        <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" />
                                                {c.teacher_name}
                                            </span>
                                            <span className="flex items-center gap-1 text-success">
                                                <Coins className="h-3 w-3" />
                                                90 FCFA/view
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full text-center py-12">
                                <PlayCircle className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                                <p className="font-medium text-lg">No video lessons available</p>
                                <p className="text-sm text-muted-foreground">Check back later for new content.</p>
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            {/* Video Dialog */}
            <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
                <DialogContent className="max-w-3xl p-4 md:p-6">
                    <DialogHeader>
                        <DialogTitle className="font-display text-lg md:text-xl">{active?.title}</DialogTitle>
                        <DialogDescription className="flex flex-wrap items-center gap-2">
                            <span>{active?.subject}</span>
                            <span className="text-muted-foreground">·</span>
                            <span>{active?.level}</span>
                            <span className="text-muted-foreground">·</span>
                            <span>by {active?.teacher_name}</span>
                        </DialogDescription>
                    </DialogHeader>
                    {active && (
                        <div className="space-y-4">
                            <div className="aspect-video rounded-lg overflow-hidden bg-black">
                                <iframe
                                    title={active.title}
                                    src={active.video_url}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                />
                            </div>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                <div>
                                    <p className="font-medium">{active.teacher_name}</p>
                                    <p className="text-sm text-muted-foreground">{active.subject} · {active.level}</p>
                                </div>
                                <Badge variant="secondary" className="gap-1.5 text-sm py-1.5 px-3">
                                    <Coins className="h-4 w-4" /> 90 FCFA / view
                                </Badge>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}