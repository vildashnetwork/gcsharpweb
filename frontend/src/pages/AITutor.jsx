

// pages/AITutor.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import { API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Button } from "../components/ui/button";
import {
    Bot, Send, Sparkles, Calculator, BookOpen, CalendarClock, ListChecks, Layers, FileText, User,
    Menu, X, Plus, Trash2, Clock, ChevronRight, Loader2, Pin, PinOff, Mic, MicOff,
    Brain, ThumbsUp, ThumbsDown, Globe, Cpu, Database,
} from "lucide-react";
import Markdown from "../components/Markdown";
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import AIKnowledgePanel from "../components/AIKnowledgePanel";


const SUBJECTS = ["General", "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "English Language", "French", "Computer Science"];
const QUICK = [
    { icon: Calculator, label: "Solve a math problem", prompt: "Solve this step by step: " },
    { icon: BookOpen, label: "Explain a concept", prompt: "Explain in simple terms with an example: " },
    { icon: CalendarClock, label: "Make a study plan", prompt: "Create a 7-day study plan for " },
    { icon: ListChecks, label: "Generate a quiz", prompt: "Generate a 5-question quiz on " },
    { icon: Layers, label: "Make flashcards", prompt: "Create 5 flashcards for " },
    { icon: FileText, label: "Summarize a topic", prompt: "Summarize the key points of " },
];

const STREAM_TIMEOUT_MS = 90_000;

// The backend accepts the session cookie or a bearer token. Sending both keeps
// the AI tutor working even when third-party cookies are blocked by the browser.
function authHeaders(extra = {}) {
    const token = localStorage.getItem("session_token");
    return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

// How GC AI answered, shown under each reply so students know what they trust.
const MODE_META = {
    knowledge: { label: "GC AI knowledge", icon: Database, tone: "text-emerald-500" },
    local: { label: "GC AI offline tutor", icon: Cpu, tone: "text-emerald-500" },
    reasoning: { label: "GC AI reasoning", icon: Cpu, tone: "text-amber-500" },
    web: { label: "Learned from the web", icon: Globe, tone: "text-sky-500" },
    web_reading: { label: "Read from live sources", icon: Globe, tone: "text-sky-500" },
    offline: { label: "Offline answer", icon: Brain, tone: "text-muted-foreground" },
};

export default function AITutor() {
    const { user } = useAuth();
    const [subject, setSubject] = useState("General");
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const [sessions, setSessions] = useState([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [loadingSessions, setLoadingSessions] = useState(true);
    const [isNewChat, setIsNewChat] = useState(true);
    const [titleGenerated, setTitleGenerated] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [brainOpen, setBrainOpen] = useState(false);
    const [feedbackGiven, setFeedbackGiven] = useState({});
    const scrollRef = useRef(null);
    const abortRef = useRef(null);
    const sidebarRef = useRef(null);
    const inputRef = useRef(null);

    // ============================================================
    // Speech Recognition with better error handling
    // ============================================================
    const {
        transcript,
        listening,
        resetTranscript,
        browserSupportsSpeechRecognition,
    } = useSpeechRecognition();

    // Update input when transcript changes
    useEffect(() => {
        if (transcript) {
            setInput(transcript);
        }
    }, [transcript]);

    // Check if browser supports speech recognition
    useEffect(() => {
        if (!browserSupportsSpeechRecognition) {
            console.warn("Speech recognition not supported in this browser");
        }
    }, [browserSupportsSpeechRecognition]);

    const toggleRecording = () => {
        if (!browserSupportsSpeechRecognition) {
            alert("Speech recognition is not supported in this browser. Please use Chrome or Edge.");
            return;
        }

        if (listening) {
            // Stop listening
            SpeechRecognition.stopListening();
            // Keep the final text
            if (transcript) {
                setInput(transcript);
            }
        } else {
            // Clear previous transcript and start
            resetTranscript();
            setInput("");
            SpeechRecognition.startListening({
                continuous: true,
                language: 'en-US',
                interimResults: true
            });
        }
    };

    // ============================================================
    // Load Chat Sessions
    // ============================================================
    const loadSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API}/ai/sessions`, {
                credentials: "include",
                headers: authHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                const sorted = data.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.updated_at) - new Date(a.updated_at);
                });
                setSessions(sorted);
            }
        } catch (error) {
            console.error("Failed to load sessions:", error);
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        return () => abortRef.current?.abort();
    }, []);

    // Auto-resize textarea
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = "auto";
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 200) + "px";
        }
    }, [input]);

    // ============================================================
    // Toggle Pin
    // ============================================================
    const togglePin = async (sessionId, e) => {
        e.stopPropagation();
        try {
            const session = sessions.find(s => s.session_id === sessionId);
            const newPinned = !session?.pinned;

            await fetch(`${API}/ai/sessions/${sessionId}/pin`, {
                method: "PUT",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ pinned: newPinned }),
            });

            setSessions(prev => {
                const updated = prev.map(s =>
                    s.session_id === sessionId ? { ...s, pinned: newPinned } : s
                );
                return updated.sort((a, b) => {
                    if (a.pinned && !b.pinned) return -1;
                    if (!a.pinned && b.pinned) return 1;
                    return new Date(b.updated_at) - new Date(a.updated_at);
                });
            });
        } catch (error) {
            console.error("Failed to toggle pin:", error);
        }
    };

    // ============================================================
    // Generate Title
    // ============================================================
    const generateTitle = useCallback(async (sessionId, message) => {
        try {
            const words = message.split(" ");
            let title = words.slice(0, 5).join(" ");
            if (title.length > 40) title = title.slice(0, 40) + "...";
            if (title.length < 3) title = "New Chat";

            await fetch(`${API}/ai/sessions/${sessionId}/title`, {
                method: "PUT",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ title }),
            });

            setSessions(prev => {
                const exists = prev.some(s => s.session_id === sessionId);
                if (exists) {
                    return prev.map(s =>
                        s.session_id === sessionId ? { ...s, title, updated_at: new Date().toISOString() } : s
                    );
                }
                return [
                    { session_id: sessionId, title, updated_at: new Date().toISOString(), subject: subject },
                    ...prev
                ];
            });

            return title;
        } catch (error) {
            console.error("Failed to generate title:", error);
            return message.slice(0, 30);
        }
    }, [subject]);

    const createNewChat = () => {
        setMessages([]);
        setCurrentSessionId(null);
        setIsNewChat(true);
        setTitleGenerated(false);
        setInput("");
        if (listening) {
            SpeechRecognition.stopListening();
        }
        if (window.innerWidth < 768) setSidebarOpen(false);
        inputRef.current?.focus();
    };

    const loadChat = async (sessionId) => {
        try {
            const res = await fetch(`${API}/ai/sessions/${sessionId}`, {
                credentials: "include",
                headers: authHeaders(),
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setCurrentSessionId(sessionId);
                setIsNewChat(false);
                setTitleGenerated(true);
                if (listening) {
                    SpeechRecognition.stopListening();
                }
                if (window.innerWidth < 768) setSidebarOpen(false);
            }
        } catch (error) {
            console.error("Failed to load chat:", error);
        }
    };

    const deleteChat = async (sessionId, e) => {
        e.stopPropagation();
        try {
            await fetch(`${API}/ai/sessions/${sessionId}`, {
                method: "DELETE",
                credentials: "include",
                headers: authHeaders(),
            });
            setSessions(prev => prev.filter(s => s.session_id !== sessionId));
            if (currentSessionId === sessionId) {
                createNewChat();
            }
        } catch (error) {
            console.error("Failed to delete chat:", error);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return "Just now";
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
        return date.toLocaleDateString();
    };

    const setLastAssistantMessage = (content) => {
        setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { ...copy[copy.length - 1], role: "assistant", content };
            return copy;
        });
    };

    const appendToLastAssistantMessage = (delta) => {
        setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, role: "assistant", content: last.content + delta };
            return copy;
        });
    };

    /** Attach GC AI metadata (mode, sources, learned) to the last reply. */
    const setLastAssistantMeta = (meta) => {
        setMessages((m) => {
            const copy = [...m];
            const last = copy[copy.length - 1];
            copy[copy.length - 1] = { ...last, meta };
            return copy;
        });
    };

    const rateAnswer = async (entryId, helpful) => {
        if (!entryId) return;
        setFeedbackGiven((prev) => ({ ...prev, [entryId]: helpful }));
        try {
            await fetch(`${API}/ai/brain/feedback`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ entry_id: entryId, helpful }),
            });
        } catch (err) {
            console.error("Failed to send GC AI feedback:", err);
        }
    };

    const send = async (text) => {
        const msg = text ?? input;
        if (!msg.trim() || streaming) return;

        // If recording is active, stop it
        if (listening) {
            SpeechRecognition.stopListening();
        }

        const messageToSend = msg;
        setInput("");

        setMessages((m) => [...m, { role: "user", content: messageToSend }, { role: "assistant", content: "" }]);
        setStreaming(true);
        setStatusText("Thinking...");

        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ message: messageToSend, subject, session_id: currentSessionId }),
                signal: controller.signal,
            });

            if (!res.ok) {
                if (res.status === 401) {
                    setLastAssistantMessage("Your session has expired. Please sign in again to keep chatting.");
                } else {
                    let detail = "";
                    try {
                        const errBody = await res.json();
                        detail = errBody?.detail || "";
                    } catch { }
                    setLastAssistantMessage(
                        detail || `I could not start that answer (${res.status}). Please try again - `
                        + "I retry every AI provider, then the web, then my own knowledge base."
                    );
                }
                return;
            }

            if (!res.body) {
                setLastAssistantMessage(
                    "I could not open a response stream. Please try again in a moment."
                );
                return;
            }

            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let receivedAnything = false;
            let newSessionId = null;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop();
                for (const p of parts) {
                    const line = p.replace(/^data: /, "").trim();
                    if (!line) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.status) {
                            setStatusText(data.status);
                        }
                        if (data.delta) {
                            receivedAnything = true;
                            setStatusText("");
                            appendToLastAssistantMessage(data.delta);
                        }
                        if (data.meta) {
                            setLastAssistantMeta(data.meta);
                        }
                        if (data.done && data.session_id) {
                            newSessionId = data.session_id;
                            setCurrentSessionId(data.session_id);
                            setIsNewChat(false);
                        }
                    } catch { }
                }
            }

            if (!receivedAnything) {
                setLastAssistantMessage(
                    "I did not manage to put an answer together that time. Please send it again - "
                    + "second attempts normally succeed because I retry every provider, then the web, "
                    + "then my own memory."
                );
                return;
            }

            if (isNewChat && newSessionId && !titleGenerated) {
                setTitleGenerated(true);
                await generateTitle(newSessionId, messageToSend);
            }

        } catch (err) {
            if (err?.name === "AbortError") {
                setLastAssistantMessage(
                    "That question took longer than expected. Please try again - shorter, more "
                    + "specific questions come back fastest."
                );
            } else {
                setLastAssistantMessage(
                    "I could not reach the server. Check your connection and send the question again."
                );
            }
        } finally {
            clearTimeout(timeoutId);
            abortRef.current = null;
            setStatusText("");
            setStreaming(false);
        }
    };

    // Close sidebar when clicking outside on mobile
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (window.innerWidth < 768 && sidebarOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [sidebarOpen]);

    // Visual feedback for recording - frequency visualization
    const renderFrequencyVisualization = () => {
        if (!listening) return null;

        const bars = [];
        const numBars = 30;
        for (let i = 0; i < numBars; i++) {
            const height = Math.random() * 60 + 10;
            bars.push(height);
        }

        return (
            <div className="flex items-center justify-center gap-0.5 h-8 mb-2">
                {bars.map((height, index) => (
                    <div
                        key={index}
                        className="w-1 bg-gradient-to-t from-primary/60 to-primary rounded-full transition-all duration-75"
                        style={{
                            height: `${height}%`,
                            animation: `pulse ${0.2 + Math.random() * 0.3}s ease-in-out infinite alternate`,
                            animationDelay: `${Math.random() * 0.5}s`
                        }}
                    />
                ))}
            </div>
        );
    };

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden relative">
            {/* ============================================================
                SIDEBAR
                ============================================================ */}
            <div
                ref={sidebarRef}
                className={`
                    fixed md:relative z-40 h-full w-72 bg-background border-r border-border transition-transform duration-300
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                    flex flex-col
                `}
            >
                <div className="p-4 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-primary" />
                        <span className="font-display font-bold">GC AI</span>
                    </div>
                    <button
                        onClick={createNewChat}
                        className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors"
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    <button
                        onClick={createNewChat}
                        className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2 ${isNewChat && messages.length === 0
                            ? "bg-primary/10 text-primary"
                            : "hover:bg-secondary"
                            }`}
                    >
                        <Sparkles className="h-4 w-4" />
                        <span className="text-sm font-medium">New Chat</span>
                    </button>

                    <div className="h-px bg-border my-2" />

                    {loadingSessions ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            <Bot className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p>No chats yet</p>
                            <p className="text-xs">Start a new conversation</p>
                        </div>
                    ) : (
                        sessions.map((s) => (
                            <button
                                key={s.session_id}
                                onClick={() => loadChat(s.session_id)}
                                className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group flex items-center gap-2 ${currentSessionId === s.session_id
                                    ? "bg-primary/10 text-primary"
                                    : "hover:bg-secondary"
                                    }`}
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        {s.pinned && <Pin className="h-3 w-3 text-primary shrink-0" />}
                                        <p className="text-sm font-medium truncate">
                                            {s.title || "Untitled Chat"}
                                        </p>
                                    </div>
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" />
                                        {formatDate(s.updated_at)}
                                        {s.subject && s.subject !== "General" && (
                                            <span className="ml-1 px-1.5 py-0.5 rounded bg-secondary/60 text-[10px]">
                                                {s.subject}
                                            </span>
                                        )}
                                    </p>
                                </div>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        onClick={(e) => togglePin(s.session_id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-secondary rounded transition-all"
                                    >
                                        {s.pinned ? (
                                            <PinOff className="h-3.5 w-3.5 text-primary" />
                                        ) : (
                                            <Pin className="h-3.5 w-3.5 text-muted-foreground" />
                                        )}
                                    </button>
                                    <button
                                        onClick={(e) => deleteChat(s.session_id, e)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                                    >
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                    </button>
                                </div>
                            </button>
                        ))
                    )}
                </div>

                <div className="p-4 border-t border-border">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate">{user?.name || "User"}</span>
                    </div>
                </div>
            </div>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-black/50 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* ============================================================
                MAIN CHAT AREA
                ============================================================ */}
            <div className="flex-1 flex flex-col min-w-0 bg-background">
                {/* Chat Header */}
                <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b border-border px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="md:hidden p-2 -ml-2 hover:bg-secondary rounded-lg transition-colors"
                    >
                        <Menu className="h-5 w-5" />
                    </button>

                    <div className="flex-1 min-w-0">
                        {messages.length === 0 ? (
                            <h1 className="text-lg font-display font-bold">New Chat</h1>
                        ) : (
                            <p className="text-sm font-medium truncate">
                                {sessions.find(s => s.session_id === currentSessionId)?.title || "Untitled Chat"}
                            </p>
                        )}
                        {currentSessionId && (
                            <p className="text-xs text-muted-foreground">
                                {sessions.find(s => s.session_id === currentSessionId)?.subject || subject}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setBrainOpen(true)}
                            data-testid="ai-brain-btn"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-secondary transition-colors"
                            title="See what GC AI has learned and teach it new facts"
                        >
                            <Brain className="h-3.5 w-3.5 text-primary" />
                            <span className="hidden sm:inline">GC AI Brain</span>
                        </button>
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="w-36 h-8 text-xs" data-testid="ai-subject">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* Messages */}
                <div
                    ref={scrollRef}
                    className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth"
                >
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center py-8 px-4">
                            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                <Bot className="h-8 w-8 text-primary" />
                            </div>
                            <h2 className="text-2xl font-display font-bold mb-2">
                                Hello {user?.name?.split(" ")[0] || "there"}! 👋
                            </h2>
                            <p className="text-muted-foreground max-w-md text-sm">
                                I'm GC AI, your personal exam coach. Ask me anything about your
                                subjects and I'll explain it step by step. If it is something I
                                don't know yet, I search the web, learn it and remember it for
                                next time.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-lg">
                                {QUICK.slice(0, 4).map((q) => (
                                    <button
                                        key={q.label}
                                        onClick={() => setInput(q.prompt)}
                                        className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-secondary hover:-translate-y-0.5 transition-all text-left"
                                    >
                                        <q.icon className="h-4 w-4 text-primary shrink-0" />
                                        <span className="truncate">{q.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((m, i) => (
                        <div
                            key={i}
                            className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                        >
                            <div className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center ${m.role === "user" ? "bg-secondary" : "bg-primary text-white"
                                }`}>
                                {m.role === "user" ? (
                                    <User className="h-[18px] w-[18px]" />
                                ) : (
                                    <Bot className="h-[18px] w-[18px]" />
                                )}
                            </div>
                            <div className={`max-w-[85%] md:max-w-[75%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user"
                                ? "bg-primary text-white whitespace-pre-wrap"
                                : "bg-secondary/60 border border-border"
                                }`}>
                                {m.role === "user" ? (
                                    m.content
                                ) : (
                                    <>
                                        {m.content ? (
                                            <Markdown>{m.content}</Markdown>
                                        ) : (
                                            <span className="inline-flex items-center gap-2 text-muted-foreground">
                                                <span className="inline-flex gap-1">
                                                    <span className="animate-pulse">●</span>
                                                    <span className="animate-pulse animation-delay-200">●</span>
                                                    <span className="animate-pulse animation-delay-400">●</span>
                                                </span>
                                                {streaming && i === messages.length - 1 && statusText ? (
                                                    <span className="text-xs">{statusText}</span>
                                                ) : null}
                                            </span>
                                        )}
                                        {m.content && m.meta ? (
                                            <div className="mt-3 pt-2 border-t border-border/60 flex flex-wrap items-center gap-2">
                                                <span className={`inline-flex items-center gap-1 text-[11px] ${(MODE_META[m.meta.mode] || MODE_META.offline).tone}`}>
                                                    {(() => {
                                                        const Icon = (MODE_META[m.meta.mode] || MODE_META.offline).icon;
                                                        return <Icon className="h-3 w-3" />;
                                                    })()}
                                                    {m.meta.mode_label || (MODE_META[m.meta.mode] || MODE_META.offline).label}
                                                </span>
                                                {m.meta.learned ? (
                                                    <span className="text-[11px] text-muted-foreground">
                                                        · saved to my knowledge base
                                                    </span>
                                                ) : null}
                                                {m.meta.confidence != null ? (
                                                    <span className="text-[11px] text-muted-foreground">
                                                        · confidence {Math.round((m.meta.confidence || 0) * 100)}%
                                                    </span>
                                                ) : null}
                                                {m.meta.learned_id ? (
                                                    <span className="ml-auto inline-flex items-center gap-1">
                                                        <button
                                                            onClick={() => rateAnswer(m.meta.learned_id, true)}
                                                            className={`p-1 rounded hover:bg-secondary ${feedbackGiven[m.meta.learned_id] === true
                                                                ? "text-emerald-500" : "text-muted-foreground"}`}
                                                            title="This answer was correct and helpful"
                                                        >
                                                            <ThumbsUp className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={() => rateAnswer(m.meta.learned_id, false)}
                                                            className={`p-1 rounded hover:bg-secondary ${feedbackGiven[m.meta.learned_id] === false
                                                                ? "text-destructive" : "text-muted-foreground"}`}
                                                            title="This answer was wrong or unhelpful"
                                                        >
                                                            <ThumbsDown className="h-3.5 w-3.5" />
                                                        </button>
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}

                                        {m.content && m.meta?.sources?.length ? (
                                            <div className="mt-2 flex flex-wrap gap-2">
                                                {m.meta.sources.slice(0, 4).map((src, idx) => (
                                                    <a
                                                        key={`${src.url}-${idx}`}
                                                        href={src.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[11px] rounded-full border border-border px-2 py-0.5 hover:bg-secondary max-w-[240px]"
                                                        title={src.url}
                                                    >
                                                        <Globe className="h-3 w-3 shrink-0 text-sky-500" />
                                                        <span className="truncate">{src.title || src.url}</span>
                                                    </a>
                                                ))}
                                            </div>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="sticky bottom-0 bg-background/80 backdrop-blur border-t border-border p-4">
                    <div className="max-w-4xl mx-auto flex flex-col gap-2">
                        {renderFrequencyVisualization()}

                        <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2">
                            {/* Voice Recording Button */}
                            <button
                                onClick={toggleRecording}
                                className={`p-2 rounded-lg transition-colors ${listening
                                    ? "bg-red-500/20 text-red-500 animate-pulse"
                                    : "hover:bg-secondary text-muted-foreground hover:text-foreground"
                                    }`}
                                title={listening ? "Stop recording" : "Start voice recording"}
                            >
                                {listening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </button>

                            {/* Text Input */}
                            <textarea
                                ref={inputRef}
                                data-testid="ai-input"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                                placeholder={listening ? "Listening..." : "Ask GC AI anything about your subjects…"}
                                className="flex-1 bg-transparent px-2 py-2 text-sm focus:outline-none resize-none min-h-[40px] max-h-[200px]"
                                rows={1}
                            />

                            {/* Send Button */}
                            <Button
                                onClick={() => send()}
                                disabled={streaming || (!input.trim() && !listening)}
                                data-testid="ai-send-btn"
                                size="icon"
                                className="shadow-glow shrink-0"
                            >
                                {streaming ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Send className="h-4 w-4" />
                                )}
                            </Button>
                        </div>

                        {listening && (
                            <div className="flex items-center justify-between text-xs text-red-500 animate-pulse">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full bg-red-500" />
                                    Recording... Speak now
                                </div>
                                <div className="text-muted-foreground text-[10px]">
                                    {input.length > 0 ? `${input.length} chars` : 'Listening...'}
                                </div>
                            </div>
                        )}

                        {!browserSupportsSpeechRecognition && (
                            <div className="text-xs text-yellow-500 text-center">
                                Speech recognition not supported. Please use Chrome or Edge.
                            </div>
                        )}

                        <div className="max-w-4xl mx-auto mt-1.5 text-[10px] text-muted-foreground text-center">
                            GC AI can make mistakes. Always verify important information.
                        </div>
                    </div>
                </div>
            </div>

            {/* GC AI Brain: see what GC AI learned, and teach it new facts */}
            <AIKnowledgePanel
                open={brainOpen}
                onClose={() => setBrainOpen(false)}
            />

        </div>
    );
}