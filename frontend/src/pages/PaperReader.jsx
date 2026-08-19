
// import { useEffect, useRef, useState, useCallback, useMemo } from "react";
// import { useParams, useNavigate } from "react-router-dom";
// import { Document, Page, pdfjs } from "react-pdf";
// import "react-pdf/dist/Page/TextLayer.css";
// import "react-pdf/dist/Page/AnnotationLayer.css";
// import api, { API } from "../lib/api";
// import { Button } from "../components/ui/button";
// import VideoSolutionPlayer from "../components/VideoSolutionPlayer";
// import Markdown from "../components/Markdown";
// import {
//     ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, Sparkles, Bot,
//     Bookmark, BookmarkCheck, FileText, Film, ListChecks, X, Clock,
// } from "lucide-react";
// import { toast } from "sonner";

// pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// // ============================================================
// // Active reading timer
// // ============================================================
// // Starts counting the instant the screen mounts. Only accrues
// // seconds while the tab is visible AND focused, so background
// // tabs don't inflate "time on screen".
// //
// // Two things happen with the elapsed time:
// //  1. DISPLAY - a piece of state ticks up once a second so the UI
// //     can show a live mm:ss (or hh:mm:ss) counter.
// //  2. PERSISTENCE - every SAVE_INTERVAL_MS, whatever seconds have
// //     accumulated since the last save are POSTed to the backend as
// //     a delta (not an absolute timestamp), then the local buffer is
// //     zeroed. That keeps "real time" saving without hammering the
// //     API every second, and a crash/close only ever loses at most
// //     one save interval's worth of time — the rest is flushed via
// //     sendBeacon on unload/unmount.
// //
// // The hook also fetches whatever total was already saved for this
// // paper (from earlier sessions) so the on-screen counter reflects
// // cumulative time, not just this visit.
// function useActiveReadingTimer(paperId) {
//     const SAVE_INTERVAL_MS = 5000; // persist to DB every 5s = "real time" without spamming

//     const unsavedSecondsRef = useRef(0);
//     const [displaySeconds, setDisplaySeconds] = useState(0); // cumulative, shown in UI
//     const [lastSavedAt, setLastSavedAt] = useState(null);
//     const [saving, setSaving] = useState(false);

//     // Load prior cumulative time for this paper so the counter isn't reset to 0 on revisit
//     useEffect(() => {
//         if (!paperId) return;
//         let cancelled = false;
//         api.get(`/papers/${paperId}/reading-time`)
//             .then(({ data }) => { if (!cancelled) setDisplaySeconds(data?.total_seconds || 0); })
//             .catch(() => { });
//         return () => { cancelled = true; };
//     }, [paperId]);

//     useEffect(() => {
//         if (!paperId) return;

//         const isActive = () => document.visibilityState === "visible" && document.hasFocus();

//         const tick = setInterval(() => {
//             if (isActive()) {
//                 unsavedSecondsRef.current += 1;
//                 setDisplaySeconds((s) => s + 1);
//             }
//         }, 1000);

//         const save = async (useBeacon = false) => {
//             const seconds = unsavedSecondsRef.current;
//             if (seconds <= 0) return;
//             unsavedSecondsRef.current = 0;

//             const url = `${API}/papers/${paperId}/reading-time`;
//             const body = JSON.stringify({ seconds });

//             if (useBeacon && navigator.sendBeacon) {
//                 navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
//                 setLastSavedAt(Date.now());
//                 return;
//             }

//             try {
//                 setSaving(true);
//                 await api.post(`/papers/${paperId}/reading-time`, { seconds });
//                 setLastSavedAt(Date.now());
//             } catch {
//                 // put the seconds back so the next interval retries them
//                 unsavedSecondsRef.current += seconds;
//             } finally {
//                 setSaving(false);
//             }
//         };

//         const saveInterval = setInterval(() => save(false), SAVE_INTERVAL_MS);

//         const handlePageHide = () => save(true);
//         window.addEventListener("pagehide", handlePageHide);
//         window.addEventListener("beforeunload", handlePageHide);

//         return () => {
//             clearInterval(tick);
//             clearInterval(saveInterval);
//             window.removeEventListener("pagehide", handlePageHide);
//             window.removeEventListener("beforeunload", handlePageHide);
//             save(true); // flush whatever accrued since the last periodic save
//         };
//     }, [paperId]);

//     return { displaySeconds, saving, lastSavedAt };
// }

// function formatDuration(totalSeconds) {
//     const s = Math.max(0, Math.floor(totalSeconds));
//     const h = Math.floor(s / 3600);
//     const m = Math.floor((s % 3600) / 60);
//     const sec = s % 60;
//     if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
//     return `${m}:${String(sec).padStart(2, "0")}`;
// }

// export default function PaperReader() {
//     const { paperId } = useParams();
//     const navigate = useNavigate();
//     const containerRef = useRef(null);

//     // Starts the moment this screen mounts.
//     const { displaySeconds, saving } = useActiveReadingTimer(paperId);

//     const [paper, setPaper] = useState(null);
//     const [numPages, setNumPages] = useState(0);
//     const [page, setPage] = useState(1);
//     const [scale, setScale] = useState(1.1);
//     const [width, setWidth] = useState(640);

//     const [qa, setQa] = useState(null);
//     const [qaLoading, setQaLoading] = useState(false);
//     const [video, setVideo] = useState(null);
//     const [videoLoading, setVideoLoading] = useState(false);

//     const [selection, setSelection] = useState(null); // {text, x, y}
//     const [isTouch, setIsTouch] = useState(false);
//     const [askOpen, setAskOpen] = useState(false);
//     const [askText, setAskText] = useState("");
//     const [askAnswer, setAskAnswer] = useState("");
//     const [askLoading, setAskLoading] = useState(false);

//     useEffect(() => {
//         api.get(`/papers/${paperId}`).then((r) => setPaper(r.data)).catch(() => toast.error("Paper not found"));
//     }, [paperId]);

//     useEffect(() => {
//         const measure = () => {
//             if (containerRef.current) setWidth(Math.min(720, containerRef.current.offsetWidth - 32));
//         };
//         measure();
//         window.addEventListener("resize", measure);
//         return () => window.removeEventListener("resize", measure);
//     }, [paper]);

//     const isPaper1 = paper?.paper_number === 1;
//     const pdfFile = useMemo(() => ({ url: `${API}/papers/${paperId}/pdf`, withCredentials: true }), [paperId]);

//     const handleSelection = useCallback((e) => {
//         const touchEvent = e?.type === "touchend";
//         if (touchEvent) setIsTouch(true);

//         // Give the browser a beat to finalize the selection after touchend
//         const read = () => {
//             const sel = window.getSelection();
//             const text = sel?.toString().trim();
//             if (text && text.length > 3 && sel.rangeCount > 0) {
//                 const rect = sel.getRangeAt(0).getBoundingClientRect();
//                 setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 6 });
//             } else {
//                 setSelection(null);
//             }
//         };

//         if (touchEvent) {
//             setTimeout(read, 50);
//         } else {
//             read();
//         }
//     }, []);

//     const askAI = async (question) => {
//         setSelection(null);
//         setAskOpen(true);
//         setAskText(question);
//         setAskAnswer("");
//         setAskLoading(true);
//         try {
//             const { data } = await api.post("/papers/ask", { paper_id: paperId, question });
//             setAskAnswer(data.answer);
//         } catch { setAskAnswer("Sorry, I couldn't solve that. Please try again."); }
//         finally { setAskLoading(false); }
//     };

//     const genQA = async () => {
//         setQaLoading(true);
//         try {
//             const { data } = await api.post(`/papers/${paperId}/qa`);
//             setQa(data.items);
//         } catch { toast.error("AI could not solve this paper"); }
//         finally { setQaLoading(false); }
//     };

//     const genVideo = async () => {
//         setVideoLoading(true);
//         try {
//             const { data } = await api.post(`/papers/${paperId}/video`);
//             setVideo(data);
//         } catch { toast.error("AI could not build a video solution"); }
//         finally { setVideoLoading(false); }
//     };

//     const toggleDraft = async () => {
//         try {
//             const { data } = await api.post("/drafts", { paper_id: paperId });
//             setPaper((p) => ({ ...p, saved: data.saved }));
//             toast.success(data.saved ? "Saved to Drafts" : "Removed from Drafts");
//         } catch { toast.error("Could not update drafts"); }
//     };

//     if (!paper) {
//         return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
//     }

//     return (
//         <div className="max-w-[1500px] mx-auto">
//             {/* header */}
//             <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
//                 <div className="flex items-center gap-3">
//                     <Button variant="ghost" size="sm" onClick={() => navigate("/study")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
//                     <div>
//                         <h1 className="text-xl font-display font-bold leading-tight">{paper.title}</h1>
//                         <p className="text-sm text-muted-foreground">{paper.subject} · {paper.level} · {paper.year} · Paper {paper.paper_number}</p>
//                     </div>
//                 </div>

//                 <div className="flex items-center gap-2">
//                     {/* Live reading timer */}
//                     <div
//                         data-testid="reading-timer"
//                         title="Time spent actively reading this paper"
//                         className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-sm tabular-nums"
//                     >
//                         <span className="relative flex h-2 w-2">
//                             <span className={`absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${saving ? "animate-ping" : ""}`} />
//                             <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
//                         </span>
//                         <Clock className="h-3.5 w-3.5 text-muted-foreground" />
//                         <span className="font-medium">{formatDuration(displaySeconds)}</span>
//                     </div>

//                     <Button variant={paper.saved ? "default" : "outline"} onClick={toggleDraft} data-testid="reader-save-draft" className="gap-2">
//                         {paper.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
//                         {paper.saved ? "Saved" : "Save to Drafts"}
//                     </Button>
//                 </div>
//             </div>

//             <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
//                 {/* PDF viewer */}
//                 <div ref={containerRef} className="rounded-xl border border-border bg-card overflow-hidden">
//                     <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-secondary/40">
//                         <div className="flex items-center gap-1">
//                             <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
//                             <span className="text-sm px-2" data-testid="pdf-page-indicator">Page {page} / {numPages || "…"}</span>
//                             <button onClick={() => setPage((p) => Math.min(numPages, p + 1))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
//                         </div>
//                         <div className="flex items-center gap-1">
//                             <button onClick={() => setScale((s) => Math.max(0.6, s - 0.15))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ZoomOut className="h-4 w-4" /></button>
//                             <span className="text-sm px-1">{Math.round(scale * 100)}%</span>
//                             <button onClick={() => setScale((s) => Math.min(2, s + 0.15))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ZoomIn className="h-4 w-4" /></button>
//                         </div>
//                     </div>
//                     <div
//                         className="max-h-[75vh] overflow-auto p-4 flex justify-center bg-secondary/20"
//                         onMouseUp={handleSelection}
//                         onTouchEnd={handleSelection}
//                     >
//                         <Document
//                             file={pdfFile}
//                             onLoadSuccess={({ numPages }) => setNumPages(numPages)}
//                             loading={<div className="py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
//                             error={<p className="py-20 text-sm text-muted-foreground">Could not load PDF.</p>}
//                         >
//                             <Page pageNumber={page} width={width * scale} renderTextLayer renderAnnotationLayer={false}
//                                 className="shadow-lg rounded-lg overflow-hidden bg-white" />
//                         </Document>
//                     </div>
//                 </div>

//                 {/* AI panel */}
//                 <div className="space-y-5">
//                     <div className="rounded-xl border border-border glass p-5 relative overflow-hidden">
//                         <div className="radial-glow" />
//                         <div className="relative z-10">
//                             <div className="flex items-center gap-2 mb-1">
//                                 <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-glow"><Bot className="h-5 w-5 text-white" /></div>
//                                 <div>
//                                     <h2 className="font-display font-semibold">GC AI Assistant</h2>
//                                     <p className="text-xs text-muted-foreground">Highlight any question, then tap "Ask GC AI".</p>
//                                 </div>
//                             </div>

//                             {isPaper1 ? (
//                                 <Button onClick={genQA} disabled={qaLoading} data-testid="gen-qa-btn" className="w-full mt-4 gap-2 shadow-glow">
//                                     {qaLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating solutions…</> : <><ListChecks className="h-4 w-4" /> Generate Step-by-Step Q&A</>}
//                                 </Button>
//                             ) : (
//                                 <Button onClick={genVideo} disabled={videoLoading} data-testid="gen-video-btn" className="w-full mt-4 gap-2 shadow-glow">
//                                     {videoLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Building AI video…</> : <><Film className="h-4 w-4" /> Generate Video Solution</>}
//                                 </Button>
//                             )}
//                         </div>
//                     </div>

//                     {/* Highlight ask answer */}
//                     {askOpen && (
//                         <div className="rounded-xl border border-primary/30 bg-card p-5 fade-up">
//                             <div className="flex items-center justify-between mb-2">
//                                 <p className="font-semibold text-primary flex items-center gap-2"><Sparkles className="h-4 w-4" /> GC AI Answer</p>
//                                 <button onClick={() => setAskOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
//                             </div>
//                             <p className="text-xs text-muted-foreground mb-2 line-clamp-2 italic">"{askText}"</p>
//                             {askLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Solving…</div>
//                                 : <div className="max-h-[46vh] overflow-y-auto pr-1"><Markdown>{askAnswer}</Markdown></div>}
//                         </div>
//                     )}

//                     {/* Video player */}
//                     {video && (
//                         <VideoSolutionPlayer scenes={video.scenes} title={video.title} question={video.question} />
//                     )}

//                     {/* QA list */}
//                     {qa && (
//                         <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-h-[75vh] overflow-y-auto">
//                             <p className="font-display font-semibold flex items-center gap-2 sticky top-0 bg-card pb-1"><FileText className="h-4 w-4 text-primary" /> Worked Solutions</p>
//                             {qa.map((item, i) => (
//                                 <div key={i} className="rounded-lg border border-border bg-secondary/30 p-4">
//                                     <div className="font-medium text-sm mb-2 flex gap-1"><span>Q{item.number}.</span><Markdown>{item.question}</Markdown></div>
//                                     <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
//                                         {(item.steps || []).map((s, j) => <li key={j} className="[&_.md-body]:inline [&_p]:inline"><Markdown>{s}</Markdown></li>)}
//                                     </ol>
//                                     <div className="text-sm mt-2 font-semibold text-success flex gap-1 [&_.md-body]:inline [&_p]:inline"><span>Answer:</span><Markdown>{item.answer}</Markdown></div>
//                                 </div>
//                             ))}
//                         </div>
//                     )}
//                 </div>
//             </div>

//             {/* Ask GC AI — desktop: floating tooltip anchored to selection */}
//             {selection && !isTouch && (
//                 <button
//                     data-testid="ask-ai-popup"
//                     onMouseDown={(e) => { e.preventDefault(); askAI(selection.text); }}
//                     style={{
//                         position: "fixed",
//                         top: Math.max(8, selection.y - 38),
//                         left: Math.min(Math.max(80, selection.x), window.innerWidth - 80),
//                         transform: "translateX(-50%)",
//                         zIndex: 60,
//                     }}
//                     className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary text-white text-sm px-3 py-1.5 shadow-glow hover:scale-95 transition-transform"
//                 >
//                     <Sparkles className="h-3.5 w-3.5" /> Ask GC AI
//                 </button>
//             )}

//             {/* Ask GC AI — mobile/touch: fixed bottom bar, never off-screen */}
//             {selection && isTouch && (
//                 <div
//                     data-testid="ask-ai-popup-mobile"
//                     className="sm:hidden fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card px-4 py-3 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.15)] fade-up"
//                     style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
//                 >
//                     <p className="flex-1 text-xs text-muted-foreground line-clamp-2 italic">"{selection.text}"</p>
//                     <button
//                         onClick={() => askAI(selection.text)}
//                         className="shrink-0 flex items-center gap-1.5 rounded-full bg-primary text-white text-sm px-4 py-2 shadow-glow"
//                     >
//                         <Sparkles className="h-3.5 w-3.5" /> Ask GC AI
//                     </button>
//                     <button
//                         onClick={() => setSelection(null)}
//                         className="shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground"
//                         aria-label="Dismiss"
//                     >
//                         <X className="h-4 w-4" />
//                     </button>
//                 </div>
//             )}
//         </div>
//     );
// }







































import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import api, { API } from "../lib/api";
import { Button } from "../components/ui/button";
import VideoSolutionPlayer from "../components/VideoSolutionPlayer";
import Markdown from "../components/Markdown";
import {
    ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, Sparkles, Bot,
    Bookmark, BookmarkCheck, FileText, Film, ListChecks, X, Clock,
} from "lucide-react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ============================================================
// Active reading timer
// ============================================================
function useActiveReadingTimer(paperId) {
    const SAVE_INTERVAL_MS = 5000;

    const unsavedSecondsRef = useRef(0);
    const [displaySeconds, setDisplaySeconds] = useState(0);
    const [lastSavedAt, setLastSavedAt] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!paperId) return;
        let cancelled = false;
        api.get(`/papers/${paperId}/reading-time`)
            .then(({ data }) => { if (!cancelled) setDisplaySeconds(data?.total_seconds || 0); })
            .catch(() => { });
        return () => { cancelled = true; };
    }, [paperId]);

    useEffect(() => {
        if (!paperId) return;

        const isActive = () => document.visibilityState === "visible" && document.hasFocus();

        const tick = setInterval(() => {
            if (isActive()) {
                unsavedSecondsRef.current += 1;
                setDisplaySeconds((s) => s + 1);
            }
        }, 1000);

        const save = async (useBeacon = false) => {
            const seconds = unsavedSecondsRef.current;
            if (seconds <= 0) return;
            unsavedSecondsRef.current = 0;

            const url = `${API}/papers/${paperId}/reading-time`;
            const body = JSON.stringify({ seconds });

            if (useBeacon && navigator.sendBeacon) {
                navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
                setLastSavedAt(Date.now());
                return;
            }

            try {
                setSaving(true);
                await api.post(`/papers/${paperId}/reading-time`, { seconds });
                setLastSavedAt(Date.now());
            } catch {
                unsavedSecondsRef.current += seconds;
            } finally {
                setSaving(false);
            }
        };

        const saveInterval = setInterval(() => save(false), SAVE_INTERVAL_MS);

        const handlePageHide = () => save(true);
        window.addEventListener("pagehide", handlePageHide);
        window.addEventListener("beforeunload", handlePageHide);

        return () => {
            clearInterval(tick);
            clearInterval(saveInterval);
            window.removeEventListener("pagehide", handlePageHide);
            window.removeEventListener("beforeunload", handlePageHide);
            save(true);
        };
    }, [paperId]);

    return { displaySeconds, saving, lastSavedAt };
}

function formatDuration(totalSeconds) {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function PaperReader() {
    const { paperId } = useParams();
    const navigate = useNavigate();
    const containerRef = useRef(null);

    const { displaySeconds, saving } = useActiveReadingTimer(paperId);

    const [paper, setPaper] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1.1);
    const [width, setWidth] = useState(640);

    const [qa, setQa] = useState(null);
    const [qaLoading, setQaLoading] = useState(false);
    const [video, setVideo] = useState(null);
    const [videoLoading, setVideoLoading] = useState(false);

    const [selection, setSelection] = useState(null);
    const [isTouch, setIsTouch] = useState(false);
    const [askOpen, setAskOpen] = useState(false);
    const [askText, setAskText] = useState("");
    const [askAnswer, setAskAnswer] = useState("");
    const [askLoading, setAskLoading] = useState(false);
    const [showAskButton, setShowAskButton] = useState(false);

    useEffect(() => {
        api.get(`/papers/${paperId}`).then((r) => setPaper(r.data)).catch(() => toast.error("Paper not found"));
    }, [paperId]);

    useEffect(() => {
        const measure = () => {
            if (containerRef.current) setWidth(Math.min(720, containerRef.current.offsetWidth - 32));
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [paper]);

    const isPaper1 = paper?.paper_number === 1;
    const pdfFile = useMemo(() => ({ url: `${API}/papers/${paperId}/pdf`, withCredentials: true }), [paperId]);

    const handleSelection = useCallback((e) => {
        const touchEvent = e?.type === "touchend";
        if (touchEvent) setIsTouch(true);

        const read = () => {
            const sel = window.getSelection();
            const text = sel?.toString().trim();
            if (text && text.length > 3 && sel.rangeCount > 0) {
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 6 });
                setShowAskButton(true);
            } else {
                setSelection(null);
                setShowAskButton(false);
            }
        };

        if (touchEvent) {
            setTimeout(read, 50);
        } else {
            read();
        }
    }, []);

    const askAI = async (question) => {
        setSelection(null);
        setShowAskButton(false);
        setAskOpen(true);
        setAskText(question);
        setAskAnswer("");
        setAskLoading(true);
        try {
            const { data } = await api.post("/papers/ask", { paper_id: paperId, question });
            setAskAnswer(data.answer);
        } catch { setAskAnswer("Sorry, I couldn't solve that. Please try again."); }
        finally { setAskLoading(false); }
    };

    const genQA = async () => {
        setQaLoading(true);
        try {
            const { data } = await api.post(`/papers/${paperId}/qa`);
            setQa(data.items);
        } catch { toast.error("AI could not solve this paper"); }
        finally { setQaLoading(false); }
    };

    const genVideo = async () => {
        setVideoLoading(true);
        try {
            const { data } = await api.post(`/papers/${paperId}/video`);
            setVideo(data);
        } catch { toast.error("AI could not build a video solution"); }
        finally { setVideoLoading(false); }
    };

    const toggleDraft = async () => {
        try {
            const { data } = await api.post("/drafts", { paper_id: paperId });
            setPaper((p) => ({ ...p, saved: data.saved }));
            toast.success(data.saved ? "Saved to Drafts" : "Removed from Drafts");
        } catch { toast.error("Could not update drafts"); }
    };

    if (!paper) {
        return <div className="flex items-center justify-center py-24"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
    }

    return (
        <div className="max-w-[1500px] mx-auto">
            {/* header */}
            <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/study")}><ArrowLeft className="h-4 w-4 mr-1" /> Back</Button>
                    <div>
                        <h1 className="text-xl font-display font-bold leading-tight">{paper.title}</h1>
                        <p className="text-sm text-muted-foreground">{paper.subject} · {paper.level} · {paper.year} · Paper {paper.paper_number}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div
                        data-testid="reading-timer"
                        title="Time spent actively reading this paper"
                        className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-sm tabular-nums"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className={`absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${saving ? "animate-ping" : ""}`} />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">{formatDuration(displaySeconds)}</span>
                    </div>

                    <Button variant={paper.saved ? "default" : "outline"} onClick={toggleDraft} data-testid="reader-save-draft" className="gap-2">
                        {paper.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                        {paper.saved ? "Saved" : "Save to Drafts"}
                    </Button>
                </div>
            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
                {/* PDF viewer */}
                <div ref={containerRef} className="rounded-xl border border-border bg-card overflow-hidden relative">
                    <div className="flex items-center justify-between px-4 h-12 border-b border-border bg-secondary/40">
                        <div className="flex items-center gap-1">
                            <button onClick={() => setPage((p) => Math.max(1, p - 1))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ChevronLeft className="h-4 w-4" /></button>
                            <span className="text-sm px-2" data-testid="pdf-page-indicator">Page {page} / {numPages || "…"}</span>
                            <button onClick={() => setPage((p) => Math.min(numPages, p + 1))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ChevronRight className="h-4 w-4" /></button>
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={() => setScale((s) => Math.max(0.6, s - 0.15))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ZoomOut className="h-4 w-4" /></button>
                            <span className="text-sm px-1">{Math.round(scale * 100)}%</span>
                            <button onClick={() => setScale((s) => Math.min(2, s + 0.15))} className="h-8 w-8 rounded-md hover:bg-secondary flex items-center justify-center"><ZoomIn className="h-4 w-4" /></button>
                        </div>
                    </div>
                    <div
                        className="max-h-[75vh] overflow-auto p-4 flex justify-center bg-secondary/20 relative"
                        onMouseUp={handleSelection}
                        onTouchEnd={handleSelection}
                    >
                        <Document
                            file={pdfFile}
                            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                            loading={<div className="py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                            error={<p className="py-20 text-sm text-muted-foreground">Could not load PDF.</p>}
                        >
                            <Page pageNumber={page} width={width * scale} renderTextLayer renderAnnotationLayer={false}
                                className="shadow-lg rounded-lg overflow-hidden bg-white" />
                        </Document>
                    </div>

                    {/* ============================================================
                        Ask GC AI — Fixed button at top-left on mobile
                        ============================================================ */}
                    {showAskButton && selection && (
                        <div className="absolute top-4 left-4 z-50 sm:hidden">
                            <button
                                onClick={() => askAI(selection.text)}
                                className="flex items-center gap-1.5 rounded-full bg-primary text-white text-sm px-3 py-2 shadow-lg hover:scale-95 transition-transform"
                            >
                                <Sparkles className="h-4 w-4" />
                                Ask GC AI
                            </button>
                        </div>
                    )}
                </div>

                {/* AI panel */}
                <div className="space-y-5">
                    <div className="rounded-xl border border-border glass p-5 relative overflow-hidden">
                        <div className="radial-glow" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-glow"><Bot className="h-5 w-5 text-white" /></div>
                                <div>
                                    <h2 className="font-display font-semibold">GC AI Assistant</h2>
                                    <p className="text-xs text-muted-foreground">Highlight any question, then tap "Ask GC AI".</p>
                                </div>
                            </div>

                            {isPaper1 ? (
                                <Button onClick={genQA} disabled={qaLoading} data-testid="gen-qa-btn" className="w-full mt-4 gap-2 shadow-glow">
                                    {qaLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating solutions…</> : <><ListChecks className="h-4 w-4" /> Generate Step-by-Step Q&A</>}
                                </Button>
                            ) : (
                                <Button onClick={genVideo} disabled={videoLoading} data-testid="gen-video-btn" className="w-full mt-4 gap-2 shadow-glow">
                                    {videoLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Building AI video…</> : <><Film className="h-4 w-4" /> Generate Video Solution</>}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Highlight ask answer */}
                    {askOpen && (
                        <div className="rounded-xl border border-primary/30 bg-card p-5 fade-up">
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-primary flex items-center gap-2"><Sparkles className="h-4 w-4" /> GC AI Answer</p>
                                <button onClick={() => setAskOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                            </div>
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2 italic">"{askText}"</p>
                            {askLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Solving…</div>
                                : <div className="max-h-[46vh] overflow-y-auto pr-1"><Markdown>{askAnswer}</Markdown></div>}
                        </div>
                    )}

                    {/* Video player */}
                    {video && (
                        <VideoSolutionPlayer scenes={video.scenes} title={video.title} question={video.question} />
                    )}

                    {/* QA list */}
                    {qa && (
                        <div className="rounded-xl border border-border bg-card p-5 space-y-4 max-h-[75vh] overflow-y-auto">
                            <p className="font-display font-semibold flex items-center gap-2 sticky top-0 bg-card pb-1"><FileText className="h-4 w-4 text-primary" /> Worked Solutions</p>
                            {qa.map((item, i) => (
                                <div key={i} className="rounded-lg border border-border bg-secondary/30 p-4">
                                    <div className="font-medium text-sm mb-2 flex gap-1"><span>Q{item.number}.</span><Markdown>{item.question}</Markdown></div>
                                    <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
                                        {(item.steps || []).map((s, j) => <li key={j} className="[&_.md-body]:inline [&_p]:inline"><Markdown>{s}</Markdown></li>)}
                                    </ol>
                                    <div className="text-sm mt-2 font-semibold text-success flex gap-1 [&_.md-body]:inline [&_p]:inline"><span>Answer:</span><Markdown>{item.answer}</Markdown></div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Ask GC AI — desktop: floating tooltip anchored to selection */}
            {selection && !isTouch && (
                <button
                    data-testid="ask-ai-popup"
                    onMouseDown={(e) => { e.preventDefault(); askAI(selection.text); }}
                    style={{
                        position: "fixed",
                        top: Math.max(8, selection.y - 38),
                        left: Math.min(Math.max(80, selection.x), window.innerWidth - 80),
                        transform: "translateX(-50%)",
                        zIndex: 60,
                    }}
                    className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary text-white text-sm px-3 py-1.5 shadow-glow hover:scale-95 transition-transform"
                >
                    <Sparkles className="h-3.5 w-3.5" /> Ask GC AI
                </button>
            )}
        </div>
    );
}