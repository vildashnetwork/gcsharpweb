

// pages/PaperReader.jsx
import { memo, useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Viewer, Worker, SpecialZoomLevel } from '@react-pdf-viewer/core';
import { defaultLayoutPlugin } from '@react-pdf-viewer/default-layout';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import api, { API } from "../lib/api";
import { Button } from "../components/ui/button";
import VideoSolutionPlayer from "../components/VideoSolutionPlayer";
import Markdown from "../components/Markdown";
import {
    ArrowLeft, Loader2, Sparkles, Bot,
    Bookmark, BookmarkCheck,
    FileText, Film,
    ListChecks,
    X, Clock,
    ChevronDown,
    Flame, Trophy, Target,
} from "lucide-react";
import { toast } from "sonner";

// PDF worker version
const PDFJS_VERSION = "3.11.174";
const PDF_WORKER_URL = `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.js`;

const PaperPdfViewer = memo(function PaperPdfViewer({ fileUrl }) {
    const layoutPlugin = defaultLayoutPlugin({
        sidebarTabs: () => [],
    });

    return (
        <Worker workerUrl={PDF_WORKER_URL}>
            <Viewer
                fileUrl={fileUrl}
                plugins={[layoutPlugin]}
                defaultScale={SpecialZoomLevel.PageWidth}
                enableSmoothScroll={true}
            />
        </Worker>
    );
});

// ============================================================
// Smart Navigation Module
// ============================================================
const SmartNavigation = {
    _isScrolling: false,
    _scrollTimeout: null,

    scrollTo: (target, options = {}) => {
        const {
            offset = 80,
            duration = 600,
            delay = 0,
            onComplete = null,
            highlight = true,
        } = options;

        if (SmartNavigation._scrollTimeout) {
            clearTimeout(SmartNavigation._scrollTimeout);
        }

        SmartNavigation._scrollTimeout = setTimeout(() => {
            let element = target;

            if (typeof target === 'string') {
                element = document.getElementById(target);
            }

            if (target && target.current) {
                element = target.current;
            }

            if (!element) {
                console.warn('SmartNavigation: Target element not found', target);
                return;
            }

            const rect = element.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const targetPosition = rect.top + scrollTop - offset;

            window.scrollTo({
                top: targetPosition,
                behavior: 'smooth'
            });

            if (highlight) {
                SmartNavigation._highlightElement(element);
            }

            if (onComplete) {
                setTimeout(onComplete, duration);
            }

            SmartNavigation._scrollTimeout = null;
        }, delay);
    },

    _highlightElement: (element) => {
        element.classList.remove('highlight-flash');
        void element.offsetWidth;
        element.classList.add('highlight-flash');
        setTimeout(() => {
            element.classList.remove('highlight-flash');
        }, 2000);
    },

    scrollToAnswer: (answerRef, delay = 400) => {
        SmartNavigation.scrollTo(answerRef, {
            offset: 80,
            duration: 600,
            delay: delay,
            highlight: true,
            onComplete: () => {
                if (answerRef.current) {
                    answerRef.current.setAttribute('tabindex', '-1');
                    answerRef.current.focus({ preventScroll: true });
                }
            }
        });
    },

    scrollToVideo: (videoRef, delay = 500) => {
        SmartNavigation.scrollTo(videoRef, {
            offset: 80,
            duration: 600,
            delay: delay,
            highlight: true,
            onComplete: () => {
                if (videoRef.current) {
                    const videoElement = videoRef.current.querySelector('video');
                    if (videoElement) {
                        videoElement.focus();
                    }
                }
            }
        });
    },

    scrollToQA: (delay = 300) => {
        SmartNavigation.scrollTo('qa-section', {
            offset: 80,
            duration: 600,
            delay: delay,
            highlight: true,
        });
    }
};

// Add styles
const style = document.createElement('style');
style.textContent = `
    .highlight-flash {
        animation: highlightFlash 2s ease;
    }
    @keyframes highlightFlash {
        0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        10% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.5); }
        20% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0.3); }
        40% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
        60% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
    }

    /* Markdown overflow fixes */
    .markdown-body {
        word-wrap: break-word;
        overflow-wrap: break-word;
        max-width: 100%;
        min-width: 0;
    }
    .markdown-body * {
        max-width: 100%;
        min-width: 0;
    }
    .markdown-body pre,
    .markdown-body code {
        white-space: pre-wrap !important;
        word-wrap: break-word !important;
        overflow-wrap: break-word !important;
    }
    .markdown-body .katex-display {
        overflow-x: auto;
        overflow-y: hidden;
        padding: 8px 0;
        max-width: 100%;
    }
    .markdown-body .katex-display > .katex {
        max-width: 100%;
        overflow-x: auto;
        overflow-y: hidden;
    }
    .markdown-body .katex {
        font-size: 1.1em;
        max-width: 100%;
    }
    .markdown-body table {
        display: block;
        overflow-x: auto;
        max-width: 100%;
        white-space: nowrap;
    }
    .markdown-body table td,
    .markdown-body table th {
        white-space: normal;
        word-wrap: break-word;
        max-width: 300px;
    }
    .markdown-body .math-block {
        overflow-x: auto;
        padding: 8px 0;
    }
    .markdown-body .math-inline {
        overflow-x: auto;
    }
    .markdown-body ul,
    .markdown-body ol {
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    .markdown-body li {
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
    .markdown-body h1,
    .markdown-body h2,
    .markdown-body h3,
    .markdown-body h4,
    .markdown-body h5,
    .markdown-body h6 {
        word-wrap: break-word;
        overflow-wrap: break-word;
    }
`;
document.head.appendChild(style);

// ============================================================
// Helper: Preprocess AI response for better Markdown rendering
// ============================================================
function preprocessAIResponse(text) {
    if (!text) return "";

    let processed = text;

    // 1. Clean up excessive newlines
    processed = processed.replace(/\n{3,}/g, '\n\n');

    // 2. Ensure proper spacing after headings
    processed = processed.replace(/(#{1,6}\s+[^\n]+)(\S)/g, '$1\n\n$2');

    // 3. Fix typos from AI
    processed = processed.replace(/Give\s*n/gi, 'Given');
    processed = processed.replace(/Solutio\s*n/gi, 'Solution');
    processed = processed.replace(/Answe\s*r/gi, 'Answer');

    // 4. Convert LaTeX \[ \] to Markdown $$ $$
    processed = processed.replace(/\\\[/g, '$$');
    processed = processed.replace(/\\\]/g, '$$');
    processed = processed.replace(/\\\(/g, '$');
    processed = processed.replace(/\\\)/g, '$');

    // 5. Fix spacing after math delimiters
    processed = processed.replace(/\$\$([^$]+)\$\$/g, (match, content) => {
        if (!content.trim()) return match;
        return `$$${content.trim()}$$`;
    });
    processed = processed.replace(/\$([^$]+)\$/g, (match, content) => {
        if (!content.trim()) return match;
        return `$${content.trim()}$`;
    });

    // 6. Format section headings
    processed = processed.replace(/(?:^|\n+)##?\s*Given\b:?/gi, '\n\n## Given\n\n');
    processed = processed.replace(/(?:^|\n+)##?\s*Formulae?(?:\s*(?:&|and)\s*Principles?)?:?/gi, '\n\n## Formulae & Principles\n\n');
    processed = processed.replace(/(?:^|\n+)##?\s*Solution\b:?/gi, '\n\n## Solution\n\n');
    processed = processed.replace(/(?:^|\n+)##?\s*Answer\b:?/gi, '\n\n## Answer\n\n');

    // 7. Format numbered steps (prevent double "**Step X:**" if already formatted)
    processed = processed.replace(/^(\d+)\.\s+(?!\*\*Step\s+\d+:)/gm, '**Step $1:** ');

    // 8. Format sub-steps
    processed = processed.replace(/^([a-z]\)\s+)/gm, '**$1** ');

    // 9. Format "Method" headings
    processed = processed.replace(/\n*✅\s+Method\s+(\d+):/gi, '\n\n### Method $1:');

    // 10. Convert tab-separated tables to markdown tables
    const lines = processed.split('\n');
    let inTable = false;
    let tableLines = [];
    let resultLines = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.includes('|') || (line.includes('\t') && line.length > 5)) {
            if (!inTable) {
                inTable = true;
                tableLines = [];
            }
            const formattedLine = line.includes('\t')
                ? '| ' + line.split('\t').join(' | ') + ' |'
                : line;
            tableLines.push(formattedLine);
        } else {
            if (inTable && tableLines.length > 0) {
                if (tableLines.length >= 2) {
                    resultLines.push(tableLines[0]);
                    const numCols = tableLines[0].split('|').filter(s => s.trim()).length;
                    resultLines.push('|' + Array(numCols).fill('---').join('|') + '|');
                    for (let j = 1; j < tableLines.length; j++) {
                        resultLines.push(tableLines[j]);
                    }
                } else {
                    resultLines.push(tableLines[0]);
                }
                tableLines = [];
                inTable = false;
            }
            resultLines.push(line);
        }
    }
    if (inTable && tableLines.length > 0) {
        if (tableLines.length >= 2) {
            resultLines.push(tableLines[0]);
            const numCols = tableLines[0].split('|').filter(s => s.trim()).length;
            resultLines.push('|' + Array(numCols).fill('---').join('|') + '|');
            for (let j = 1; j < tableLines.length; j++) {
                resultLines.push(tableLines[j]);
            }
        } else {
            resultLines.push(tableLines[0]);
        }
    }
    processed = resultLines.join('\n');

    // 11. Clean up extra spaces
    processed = processed.replace(/  +/g, ' ');
    processed = processed.replace(/\n\s*\n/g, '\n\n');

    // 12. Add horizontal rules
    processed = processed.replace(/\n\s*---\s*\n/g, '\n\n---\n\n');

    // 13. Ensure proper line breaks after headings
    processed = processed.replace(/(#{1,6}\s+[^\n]+)\n/g, '$1\n\n');

    // 14. Fix markdown bold
    processed = processed.replace(/\*\*([^*]+)\*\*/g, (match, content) => {
        if (content.trim()) {
            return `**${content.trim()}**`;
        }
        return content;
    });

    // 15. Fix bold followed by punctuation
    processed = processed.replace(/\*\*([^*]+)\*\*([,.;:!?])/g, '**$1**$2');

    return processed.trim();
}

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

// ============================================================
// Streak & Level Badge Component
// ============================================================
function StreakBadge({ streak, level, progress }) {
    const progressPercent = Math.min(100, progress);

    return (
        <div className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1.5 text-xs sm:px-3 sm:py-1.5 sm:text-sm tabular-nums">
            {/* Streak */}
            <div className="flex items-center gap-1 sm:gap-1.5">
                <Flame className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${streak > 0 ? 'text-orange-500' : 'text-muted-foreground'}`} />
                <span className="font-medium">{streak}</span>
            </div>

            <div className="w-px h-4 bg-border" />

            {/* Level */}
            <div className="flex items-center gap-1 sm:gap-1.5">
                <Trophy className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-yellow-500" />
                <span className="font-medium">{level}</span>
            </div>

            <div className="w-px h-4 bg-border" />

            {/* Progress bar – hidden on extra‑small, shown from xs up */}
            <div className="hidden xs:flex items-center gap-1 sm:gap-1.5 min-w-[45px] sm:min-w-[60px]">
                <Target className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                <div className="w-8 sm:w-12 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>
                <span className="text-[8px] sm:text-[10px] text-muted-foreground">
                    {Math.round(progressPercent)}%
                </span>
            </div>
        </div>
    );
}

export default function PaperReader() {
    const { paperId } = useParams();
    const navigate = useNavigate();
    const containerRef = useRef(null);
    const answerRef = useRef(null);
    const videoRef = useRef(null);

    const { displaySeconds, saving } = useActiveReadingTimer(paperId);

    const [paper, setPaper] = useState(null);
    const [qa, setQa] = useState(null);
    const [qaLoading, setQaLoading] = useState(false);
    const [video, setVideo] = useState(null);
    const [videoLoading, setVideoLoading] = useState(false);

    const [askOpen, setAskOpen] = useState(false);
    const [askText, setAskText] = useState("");
    const [askAnswer, setAskAnswer] = useState("");
    const [askLoading, setAskLoading] = useState(false);
    const [selectedText, setSelectedText] = useState("");
    const [showAskButton, setShowAskButton] = useState(false);
    const [isMobile, setIsMobile] = useState(false);

    // Streak & level state
    const [streakData, setStreakData] = useState({
        streak: 0,
        level: 1,
        progress_percent: 0,
        today_seconds: 0,
        goal_seconds: 3600,
    });

    // PDF blob state
    const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
    const [pdfError, setPdfError] = useState(false);

    // Check if mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Fetch streak data
    const fetchStreak = useCallback(async () => {
        try {
            const res = await api.get('/user/streak');
            setStreakData(res.data);
        } catch (err) {
            // ignore
        }
    }, []);

    useEffect(() => {
        fetchStreak();
        // Refresh every minute
        const interval = setInterval(fetchStreak, 60000);
        return () => clearInterval(interval);
    }, [fetchStreak]);

    // Scroll to answer when it appears
    useEffect(() => {
        if (askOpen && askAnswer && !askLoading) {
            SmartNavigation.scrollToAnswer(answerRef, 400);
        }
    }, [askOpen, askAnswer, askLoading]);

    // Scroll to video when it's generated
    useEffect(() => {
        if (video && video.scenes && video.scenes.length > 0) {
            SmartNavigation.scrollToVideo(videoRef, 500);
        }
    }, [video]);

    // Fetch the PDF ourselves, authenticated, as a blob
    useEffect(() => {
        if (!paperId) return;
        let objectUrl;
        let cancelled = false;

        setPdfBlobUrl(null);
        setPdfError(false);

        api.get(`/papers/${paperId}/pdf`, { responseType: "blob" })
            .then((res) => {
                if (cancelled) return;
                objectUrl = URL.createObjectURL(res.data);
                setPdfBlobUrl(objectUrl);
            })
            .catch(() => {
                if (!cancelled) {
                    setPdfError(true);
                    toast.error("Could not load the PDF");
                }
            });

        return () => {
            cancelled = true;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [paperId]);

    // Ask AI
    const askAI = useCallback(async (question) => {
        if (!question || question.length < 3) return;
        setAskOpen(true);
        setAskText(question);
        setAskAnswer("");
        setAskLoading(true);
        setShowAskButton(false);
        try {
            const { data } = await api.post("/papers/ask", { paper_id: paperId, question });
            const processedAnswer = preprocessAIResponse(data.answer);
            setAskAnswer(processedAnswer);

            setTimeout(() => {
                SmartNavigation.scrollToAnswer(answerRef, 300);
            }, 500);
        } catch (error) {
            console.error("Ask AI error:", error);
            setAskAnswer("Sorry, I couldn't solve that. Please try again.");
        }
        finally { setAskLoading(false); }
    }, [paperId]);

    // Generate Video from highlighted text
    const generateHighlightVideo = useCallback(async (highlightedText) => {
        if (!highlightedText || highlightedText.length < 10) {
            toast.error("Please select more text to generate a video");
            return;
        }

        setVideoLoading(true);
        try {
            const { data } = await api.post(`/papers/${paperId}/video/highlight`, {
                text: highlightedText,
                context: paper?.subject || "General"
            });
            setVideo(data);
            toast.success(`Generated ${data.scenes?.length || 0} video scenes for your selection`);

            setTimeout(() => {
                SmartNavigation.scrollToVideo(videoRef, 300);
            }, 600);
        } catch (error) {
            console.error("Highlight video generation error:", error);
            toast.error(error.response?.data?.detail || "AI could not build a video for your selection");
        } finally {
            setVideoLoading(false);
        }
    }, [paperId, paper]);

    // Custom text selection handler
    const handleTextSelection = useCallback(() => {
        const selection = window.getSelection();
        const text = selection?.toString().trim();

        if (text && text.length > 3) {
            setSelectedText(text);
            setShowAskButton(true);
        } else {
            setSelectedText("");
            setShowAskButton(false);
        }
    }, []);

    // Listen for selection changes
    useEffect(() => {
        const onSelectionChange = () => {
            clearTimeout(window._selectionTimeout);
            window._selectionTimeout = setTimeout(handleTextSelection, 100);
        };

        document.addEventListener('selectionchange', onSelectionChange);
        return () => {
            document.removeEventListener('selectionchange', onSelectionChange);
            clearTimeout(window._selectionTimeout);
        };
    }, [handleTextSelection]);

    const handleAskClick = () => {
        if (selectedText) {
            SmartNavigation.scrollToAnswer(answerRef, 100);
            askAI(selectedText);
            setShowAskButton(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    const handleGenerateVideoClick = () => {
        if (selectedText) {
            SmartNavigation.scrollToVideo(videoRef, 100);
            generateHighlightVideo(selectedText);
            setShowAskButton(false);
            window.getSelection()?.removeAllRanges();
        }
    };

    useEffect(() => {
        api.get(`/papers/${paperId}`).then((r) => setPaper(r.data)).catch(() => toast.error("Paper not found"));
    }, [paperId]);

    const isPaper1 = paper?.paper_number === 1;

    const genQA = async () => {
        setQaLoading(true);
        try {
            const { data } = await api.post(`/papers/${paperId}/qa`);
            setQa(data.items);
            SmartNavigation.scrollToQA(300);
        } catch { toast.error("AI could not solve this paper"); }
        finally { setQaLoading(false); }
    };

    const genVideo = async () => {
        setVideoLoading(true);
        try {
            const { data } = await api.post(`/papers/${paperId}/video`);
            setVideo(data);
            SmartNavigation.scrollToVideo(videoRef, 500);
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
                    <Button variant="ghost" size="sm" onClick={() => navigate("/study")}>
                        <ArrowLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <div>
                        <h1 className="text-xl font-display font-bold leading-tight">{paper.title}</h1>
                        <p className="text-sm text-muted-foreground">{paper.subject} · {paper.level} · {paper.year} · Paper {paper.paper_number}</p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
                    {/* Reading timer */}
                    <div
                        data-testid="reading-timer"
                        title="Time spent actively reading this paper"
                        className="flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1.5 text-xs sm:text-sm tabular-nums"
                    >
                        <span className="relative flex h-2 w-2">
                            <span className={`absolute inline-flex h-full w-full rounded-full bg-primary opacity-75 ${saving ? "animate-ping" : ""}`} />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                        </span>
                        <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground" />
                        <span className="font-medium">{formatDuration(displaySeconds)}</span>
                    </div>

                    {/* Streak badge – responsive */}
                    <StreakBadge
                        streak={streakData.streak}
                        level={streakData.level}
                        progress={streakData.progress_percent}
                        goalSeconds={streakData.goal_seconds}
                        todaySeconds={streakData.today_seconds}
                        className="text-xs sm:text-sm"
                    />

                    {/* Save button */}
                    <Button
                        variant={paper.saved ? "default" : "outline"}
                        onClick={toggleDraft}
                        data-testid="reader-save-draft"
                        className="gap-1.5 px-2.5 py-1.5 text-xs sm:text-sm sm:gap-2 sm:px-4"
                    >
                        {paper.saved ? <BookmarkCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Bookmark className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                        <span className="hidden xs:inline">{paper.saved ? "Saved" : "Save to Drafts"}</span>
                        <span className="xs:hidden">{paper.saved ? "Saved" : "Save"}</span>
                    </Button>
                </div>

            </div>

            <div className="grid lg:grid-cols-[1.4fr_1fr] gap-6">
                {/* PDF viewer */}
                <div ref={containerRef} className="rounded-xl border border-border bg-card overflow-hidden relative">
                    <div className="h-[80vh] min-h-[480px] overflow-auto bg-secondary/20">
                        {pdfError ? (
                            <div className="py-20 text-center text-sm text-muted-foreground">
                                Could not load this PDF. Try refreshing the page.
                            </div>
                        ) : pdfBlobUrl ? (
                            <PaperPdfViewer fileUrl={pdfBlobUrl} />
                        ) : (
                            <div className="py-20 flex justify-center">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        )}
                    </div>
                </div>

                {/* AI panel */}
                <div className="space-y-5">
                    <div className="rounded-xl border border-border glass p-5 relative overflow-hidden">
                        <div className="radial-glow" />
                        <div className="relative z-10">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-glow">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
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
                        <div
                            ref={answerRef}
                            id="answer-section"
                            className="rounded-xl border border-primary/30 bg-card p-5 fade-up scroll-mt-20 overflow-hidden"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <p className="font-semibold text-primary flex items-center gap-2">
                                    <Sparkles className="h-4 w-4" />
                                    GC AI Answer
                                </p>
                                <button
                                    onClick={() => setAskOpen(false)}
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="text-xs text-muted-foreground mb-3 p-2 bg-secondary/30 rounded-lg border border-border break-words">
                                <span className="font-medium">Question:</span>
                                <p className="mt-1 line-clamp-3 italic break-words">"{askText}"</p>
                            </div>
                            {askLoading ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Solving…
                                </div>
                            ) : (
                                <div className="max-h-[50vh] overflow-y-auto pr-1 w-full relative">
                                    <div className="w-full min-w-0">
                                        <Markdown className="prose prose-sm dark:prose-invert max-w-none w-full break-words [&_*]:max-w-full [&_pre]:whitespace-pre-wrap [&_code]:break-words [&_table]:block [&_table]:overflow-x-auto">
                                            {askAnswer}
                                        </Markdown>
                                    </div>
                                </div>
                            )}
                            <div className="mt-3 pt-3 border-t border-border flex justify-end">
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <ChevronDown className="h-3 w-3" />
                                    Scroll for full answer
                                </span>
                            </div>
                        </div>
                    )}

                    {/* Video player */}
                    <div ref={videoRef} id="video-solution">
                        {video && (
                            <VideoSolutionPlayer
                                scenes={video.scenes}
                                title={video.title}
                                question={video.question}
                            />
                        )}
                    </div>

                    {/* QA list */}
                    {qa && (
                        <div id="qa-section" className="rounded-xl border border-border bg-card p-5 space-y-4 max-h-[75vh] overflow-y-auto w-full overflow-x-hidden">
                            <p className="font-display font-semibold flex items-center gap-2 sticky top-0 bg-card pb-1">
                                <FileText className="h-4 w-4 text-primary" /> Worked Solutions
                            </p>
                            {qa.map((item, i) => (
                                <div key={i} className="rounded-lg border border-border bg-secondary/30 p-4 w-full overflow-hidden">
                                    <div className="font-medium text-sm mb-2 flex gap-1 flex-wrap">
                                        <span>Q{item.number}.</span>
                                        <div className="flex-1 min-w-0">
                                            <Markdown className="prose prose-sm dark:prose-invert max-w-none break-words">
                                                {item.question}
                                            </Markdown>
                                        </div>
                                    </div>
                                    <ol className="list-decimal list-inside space-y-1 text-sm text-foreground/90 break-words">
                                        {(item.steps || []).map((s, j) => (
                                            <li key={j} className="[&_.md-body]:inline [&_p]:inline break-words">
                                                <Markdown className="prose prose-sm dark:prose-invert max-w-none inline">
                                                    {s}
                                                </Markdown>
                                            </li>
                                        ))}
                                    </ol>
                                    <div className="text-sm mt-2 font-semibold text-success flex gap-1 flex-wrap [&_.md-body]:inline [&_p]:inline">
                                        <span>Answer:</span>
                                        <Markdown className="prose prose-sm dark:prose-invert max-w-none inline">
                                            {item.answer}
                                        </Markdown>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Ask GC AI — Fixed button */}
            {showAskButton && selectedText && (
                <div
                    className={`fixed z-[9999] pointer-events-none ${isMobile
                        ? "top-4 right-4"
                        : "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
                        }`}
                >
                    <div className={`pointer-events-auto flex
                          gap-2 bg-card rounded-xl shadow-2xl flex-col border border-border p-2 min-w-[160px]`}>
                        <button
                            onClick={handleAskClick}
                            className="flex items-center gap-2 rounded-lg bg-primary text-white text-sm px-4 py-2.5 hover:bg-primary/90 transition-all active:scale-95 w-full"
                        >
                            <Sparkles className="h-4 w-4" />
                            Ask AI
                            {isMobile && (
                                <span className="text-[10px] opacity-70 ml-auto">
                                    {selectedText.length} chars
                                </span>
                            )}
                        </button>

                        <button
                            onClick={handleGenerateVideoClick}
                            disabled={videoLoading}
                            className="flex items-center gap-2 rounded-lg bg-secondary text-foreground text-sm px-4 py-2.5 hover:bg-secondary/80 transition-all active:scale-95 border border-border w-full disabled:opacity-50"
                        >
                            {videoLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Film className="h-4 w-4 text-primary" />
                            )}
                            {videoLoading ? 'Generating...' : 'Generate Video'}
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile selection indicator */}
            {showAskButton && selectedText && isMobile && (
                <div className="fixed bottom-4 left-4 right-4 z-[9998] bg-black/80 text-white text-xs p-2 rounded-lg pointer-events-none text-center">
                    <span className="opacity-70">Selected: </span>
                    <span className="font-medium">{selectedText.slice(0, 50)}...</span>
                </div>
            )}
        </div>
    );
}