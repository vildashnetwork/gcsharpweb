import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import api, { API } from "../lib/api";
import { Button } from "../components/ui/button";
import VideoSolutionPlayer from "../components/VideoSolutionPlayer";
import {
    ArrowLeft, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, Sparkles, Bot,
    Bookmark, BookmarkCheck, FileText, Film, ListChecks, X,
} from "lucide-react";
import { toast } from "sonner";

pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PaperReader() {
    const { paperId } = useParams();
    const navigate = useNavigate();
    const containerRef = useRef(null);

    const [paper, setPaper] = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [page, setPage] = useState(1);
    const [scale, setScale] = useState(1.1);
    const [width, setWidth] = useState(640);

    const [qa, setQa] = useState(null);
    const [qaLoading, setQaLoading] = useState(false);
    const [video, setVideo] = useState(null);
    const [videoLoading, setVideoLoading] = useState(false);

    const [selection, setSelection] = useState(null); // {text, x, y}
    const [askOpen, setAskOpen] = useState(false);
    const [askText, setAskText] = useState("");
    const [askAnswer, setAskAnswer] = useState("");
    const [askLoading, setAskLoading] = useState(false);

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

    const handleSelection = useCallback(() => {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (text && text.length > 3) {
            const rect = sel.getRangeAt(0).getBoundingClientRect();
            setSelection({ text, x: rect.left + rect.width / 2, y: rect.top - 6 });
        } else {
            setSelection(null);
        }
    }, []);

    const askAI = async (question) => {
        setSelection(null);
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
                <Button variant={paper.saved ? "default" : "outline"} onClick={toggleDraft} data-testid="reader-save-draft" className="gap-2">
                    {paper.saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                    {paper.saved ? "Saved" : "Save to Drafts"}
                </Button>
            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
                {/* PDF viewer */}
                <div ref={containerRef} className="rounded-xl border border-border bg-card overflow-hidden">
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
                    <div className="max-h-[75vh] overflow-auto p-4 flex justify-center bg-secondary/20" onMouseUp={handleSelection}>
                        <Document
                            file={{ url: `${API}/papers/${paperId}/pdf`, withCredentials: true }}
                            onLoadSuccess={({ numPages }) => setNumPages(numPages)}
                            loading={<div className="py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
                            error={<p className="py-20 text-sm text-muted-foreground">Could not load PDF.</p>}
                        >
                            <Page pageNumber={page} width={width * scale} renderTextLayer renderAnnotationLayer={false}
                                className="shadow-lg rounded-lg overflow-hidden bg-white" />
                        </Document>
                    </div>
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
                                : <p className="text-sm whitespace-pre-wrap leading-relaxed">{askAnswer}</p>}
                        </div>
                    )}

                    {/* Video player */}
                    {video && (
                        <VideoSolutionPlayer scenes={video.scenes} title={video.title} question={video.question} />
                    )}

                    {/* QA list */}
                    {qa && (
                        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                            <p className="font-display font-semibold flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Worked Solutions</p>
                            {qa.map((item, i) => (
                                <div key={i} className="rounded-lg border border-border bg-secondary/30 p-4">
                                    <p className="font-medium text-sm mb-2">Q{item.number}. {item.question}</p>
                                    <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90">
                                        {(item.steps || []).map((s, j) => <li key={j}>{s}</li>)}
                                    </ol>
                                    <p className="text-sm mt-2 font-semibold text-success">Answer: {item.answer}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* floating Ask GC AI button */}
            {selection && (
                <button
                    data-testid="ask-ai-popup"
                    onMouseDown={(e) => { e.preventDefault(); askAI(selection.text); }}
                    style={{ position: "fixed", top: selection.y - 38, left: selection.x, transform: "translateX(-50%)", zIndex: 60 }}
                    className="flex items-center gap-1.5 rounded-full bg-primary text-white text-sm px-3 py-1.5 shadow-glow hover:scale-95 transition-transform"
                >
                    <Sparkles className="h-3.5 w-3.5" /> Ask GC AI
                </button>
            )}
        </div>
    );
}
