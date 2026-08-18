// import { useEffect, useRef, useState } from "react";
// import { API } from "../lib/api";
// import { useAuth } from "../context/AuthContext";
// import {
//     Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "../components/ui/select";
// import { Button } from "../components/ui/button";
// import {
//     Bot, Send, Sparkles, Calculator, BookOpen, CalendarClock, ListChecks, Layers, FileText, User,
// } from "lucide-react";
// import Markdown from "../components/Markdown";

// const SUBJECTS = ["General", "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "English Language", "French", "Computer Science"];
// const QUICK = [
//     { icon: Calculator, label: "Solve a math problem", prompt: "Solve this step by step: " },
//     { icon: BookOpen, label: "Explain a concept", prompt: "Explain in simple terms with an example: " },
//     { icon: CalendarClock, label: "Make a study plan", prompt: "Create a 7-day study plan for " },
//     { icon: ListChecks, label: "Generate a quiz", prompt: "Generate a 5-question quiz on " },
//     { icon: Layers, label: "Make flashcards", prompt: "Create 5 flashcards for " },
//     { icon: FileText, label: "Summarize a topic", prompt: "Summarize the key points of " },
// ];

// // How long to wait for the stream to produce *anything* before giving up.
// // The backend's own model-fallback chain can take a few seconds per model,
// // so this needs to be generous enough to cover a couple of retries.
// const STREAM_TIMEOUT_MS = 45_000;

// export default function AITutor() {
//     const { user } = useAuth();
//     const [subject, setSubject] = useState("General");
//     const [sessionId, setSessionId] = useState(null);
//     const [messages, setMessages] = useState([]);
//     const [input, setInput] = useState("");
//     const [streaming, setStreaming] = useState(false);
//     const scrollRef = useRef(null);
//     const abortRef = useRef(null);

//     useEffect(() => {
//         scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
//     }, [messages]);

//     // Cancel any in-flight request if the component unmounts mid-stream.
//     useEffect(() => {
//         return () => abortRef.current?.abort();
//     }, []);

//     const setLastAssistantMessage = (content) => {
//         setMessages((m) => {
//             const copy = [...m];
//             copy[copy.length - 1] = { role: "assistant", content };
//             return copy;
//         });
//     };

//     const appendToLastAssistantMessage = (delta) => {
//         setMessages((m) => {
//             const copy = [...m];
//             copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + delta };
//             return copy;
//         });
//     };

//     const send = async (text) => {
//         const msg = text ?? input;
//         if (!msg.trim() || streaming) return;
//         setInput("");
//         setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
//         setStreaming(true);

//         const controller = new AbortController();
//         abortRef.current = controller;
//         const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

//         try {
//             const res = await fetch(`${API}/ai/chat`, {
//                 method: "POST",
//                 credentials: "include",
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify({ message: msg, subject, session_id: sessionId }),
//                 signal: controller.signal,
//             });

//             // Check HTTP status BEFORE treating the body as an SSE stream.
//             // Otherwise a 401 (expired session) or 500 gets silently
//             // misreported as "couldn't reach the AI".
//             if (!res.ok) {
//                 if (res.status === 401) {
//                     setLastAssistantMessage("Your session has expired. Please sign in again to keep chatting.");
//                 } else {
//                     let detail = "";
//                     try {
//                         const errBody = await res.json();
//                         detail = errBody?.detail || "";
//                     } catch {
//                         // response wasn't JSON, ignore
//                     }
//                     setLastAssistantMessage(
//                         detail || `Something went wrong on our end (${res.status}). Please try again in a moment.`
//                     );
//                 }
//                 return;
//             }

//             if (!res.body) {
//                 setLastAssistantMessage("Sorry, I couldn't reach the AI. Please try again.");
//                 return;
//             }

//             const reader = res.body.getReader();
//             const decoder = new TextDecoder();
//             let buffer = "";
//             let receivedAnything = false;

//             while (true) {
//                 const { done, value } = await reader.read();
//                 if (done) break;
//                 buffer += decoder.decode(value, { stream: true });
//                 const parts = buffer.split("\n\n");
//                 buffer = parts.pop();
//                 for (const p of parts) {
//                     const line = p.replace(/^data: /, "").trim();
//                     if (!line) continue;
//                     try {
//                         const data = JSON.parse(line);
//                         if (data.delta) {
//                             receivedAnything = true;
//                             appendToLastAssistantMessage(data.delta);
//                         }
//                         if (data.done && data.session_id) setSessionId(data.session_id);
//                     } catch {
//                         // malformed SSE chunk, skip it rather than crashing the stream
//                     }
//                 }
//             }

//             if (!receivedAnything) {
//                 setLastAssistantMessage("I didn't get a response that time. Please try asking again.");
//             }
//         } catch (err) {
//             if (err?.name === "AbortError") {
//                 setLastAssistantMessage(
//                     "That's taking longer than expected. Please try again — shorter questions usually respond faster."
//                 );
//             } else {
//                 setLastAssistantMessage("Sorry, I couldn't reach the AI. Please check your connection and try again.");
//             }
//         } finally {
//             clearTimeout(timeoutId);
//             abortRef.current = null;
//             setStreaming(false);
//         }
//     };

//     return (
//         <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
//             <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
//                 <div className="flex items-center gap-3">
//                     <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-glow">
//                         <Bot className="h-6 w-6 text-white" />
//                     </div>
//                     <div>
//                         <h1 className="text-2xl font-display font-bold">GC AI Tutor</h1>
//                         <p className="text-sm text-muted-foreground">Your personal exam coach</p>
//                     </div>
//                 </div>
//                 <Select value={subject} onValueChange={setSubject}>
//                     <SelectTrigger className="w-44" data-testid="ai-subject"><SelectValue /></SelectTrigger>
//                     <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
//                 </Select>
//             </div>

//             <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
//                 {messages.length === 0 && (
//                     <div className="h-full flex flex-col items-center justify-center text-center py-8">
//                         <Sparkles className="h-10 w-10 text-primary mb-4" />
//                         <p className="text-lg font-display font-semibold">Hello {user?.name?.split(" ")[0] || "there"}! Ask me anything.</p>
//                         <p className="text-muted-foreground max-w-md mt-1">I explain concepts step by step, solve problems, and build study plans tailored to your exams.</p>
//                     </div>
//                 )}
//                 {messages.map((m, i) => (
//                     <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
//                         <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${m.role === "user" ? "bg-secondary" : "bg-primary text-white"}`}>
//                             {m.role === "user" ? <User className="h-[18px] w-[18px]" /> : <Bot className="h-[18px] w-[18px]" />}
//                         </div>
//                         <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary text-white whitespace-pre-wrap" : "bg-secondary/60 border border-border"}`}>
//                             {m.role === "user"
//                                 ? m.content
//                                 : (m.content ? <Markdown>{m.content}</Markdown> : <span className="inline-flex gap-1"><span className="animate-pulse">●</span></span>)}
//                         </div>
//                     </div>
//                 ))}
//             </div>

//             {messages.length === 0 && (
//                 <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
//                     {QUICK.map((q) => (
//                         <button key={q.label} data-testid={`quick-${q.label}`}
//                             onClick={() => setInput(q.prompt)}
//                             className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-secondary hover:-translate-y-0.5 transition-transform text-left">
//                             <q.icon className="h-4 w-4 text-primary shrink-0" /> {q.label}
//                         </button>
//                     ))}
//                 </div>
//             )}

//             <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
//                 <input
//                     data-testid="ai-input"
//                     value={input}
//                     onChange={(e) => setInput(e.target.value)}
//                     onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
//                     placeholder="Ask GC AI anything about your subjects…"
//                     className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
//                 />
//                 <Button onClick={() => send()} disabled={streaming || !input.trim()} data-testid="ai-send-btn" size="icon" className="shadow-glow shrink-0">
//                     <Send className="h-4 w-4" />
//                 </Button>
//             </div>
//         </div>
//     );
// }



































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
    Menu, X, Plus, Trash2, Clock, ChevronRight, Loader2,
} from "lucide-react";
import Markdown from "../components/Markdown";

const SUBJECTS = ["General", "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "English Language", "French", "Computer Science"];
const QUICK = [
    { icon: Calculator, label: "Solve a math problem", prompt: "Solve this step by step: " },
    { icon: BookOpen, label: "Explain a concept", prompt: "Explain in simple terms with an example: " },
    { icon: CalendarClock, label: "Make a study plan", prompt: "Create a 7-day study plan for " },
    { icon: ListChecks, label: "Generate a quiz", prompt: "Generate a 5-question quiz on " },
    { icon: Layers, label: "Make flashcards", prompt: "Create 5 flashcards for " },
    { icon: FileText, label: "Summarize a topic", prompt: "Summarize the key points of " },
];

const STREAM_TIMEOUT_MS = 45_000;

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
    const scrollRef = useRef(null);
    const abortRef = useRef(null);
    const sidebarRef = useRef(null);
    const inputRef = useRef(null);

    // Load chat sessions
    const loadSessions = useCallback(async () => {
        try {
            const res = await fetch(`${API}/ai/sessions`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
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

    // Auto-generate title from first message
    const generateTitle = useCallback(async (message) => {
        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: `Generate a very short title (max 5 words) for this conversation: "${message}"`,
                    subject: "General",
                    session_id: null,
                }),
            });
            if (res.ok) {
                const reader = res.body?.getReader();
                const decoder = new TextDecoder();
                let title = "";
                while (reader) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    title += decoder.decode(value, { stream: true });
                }
                return title.replace(/^data: /, "").trim() || message.slice(0, 30);
            }
            return message.slice(0, 30);
        } catch {
            return message.slice(0, 30);
        }
    }, []);

    const createNewChat = () => {
        setMessages([]);
        setCurrentSessionId(null);
        setIsNewChat(true);
        setInput("");
        if (window.innerWidth < 768) setSidebarOpen(false);
        inputRef.current?.focus();
    };

    const loadChat = async (sessionId) => {
        try {
            const res = await fetch(`${API}/ai/sessions/${sessionId}`, {
                credentials: "include",
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(data.messages || []);
                setCurrentSessionId(sessionId);
                setIsNewChat(false);
                if (window.innerWidth < 768) setSidebarOpen(false);
            }
        } catch (error) {
            console.error("Failed to load chat:", error);
        }
    };

    const deleteChat = async (sessionId, e) => {
        e.stopPropagation();
        // For now, just remove from UI since backend doesn't have delete endpoint
        setSessions(prev => prev.filter(s => s.session_id !== sessionId));
        if (currentSessionId === sessionId) {
            createNewChat();
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
            copy[copy.length - 1] = { role: "assistant", content };
            return copy;
        });
    };

    const appendToLastAssistantMessage = (delta) => {
        setMessages((m) => {
            const copy = [...m];
            copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + delta };
            return copy;
        });
    };

    const send = async (text) => {
        const msg = text ?? input;
        if (!msg.trim() || streaming) return;
        setInput("");

        // If new chat, generate title after first response
        if (isNewChat) {
            // Generate title in background after getting response
        }

        setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
        setStreaming(true);

        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), STREAM_TIMEOUT_MS);

        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg, subject, session_id: currentSessionId }),
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
                        detail || `Something went wrong on our end (${res.status}). Please try again in a moment.`
                    );
                }
                return;
            }

            if (!res.body) {
                setLastAssistantMessage("Sorry, I couldn't reach the AI. Please try again.");
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
                        if (data.delta) {
                            receivedAnything = true;
                            appendToLastAssistantMessage(data.delta);
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
                setLastAssistantMessage("I didn't get a response that time. Please try asking again.");
            }

            // Auto-generate title for new chat
            if (isNewChat && newSessionId && messages.length <= 2) {
                const title = await generateTitle(msg);
                // Update session list with new title
                setSessions(prev => [
                    { session_id: newSessionId, title: title, updated_at: new Date().toISOString(), subject: subject },
                    ...prev
                ]);
            }

            // Reload sessions to get updated list
            loadSessions();

        } catch (err) {
            if (err?.name === "AbortError") {
                setLastAssistantMessage(
                    "That's taking longer than expected. Please try again — shorter questions usually respond faster."
                );
            } else {
                setLastAssistantMessage("Sorry, I couldn't reach the AI. Please check your connection and try again.");
            }
        } finally {
            clearTimeout(timeoutId);
            abortRef.current = null;
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

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden relative">
            {/* ============================================================
                SIDEBAR - ChatGPT style
                ============================================================ */}
            <div
                ref={sidebarRef}
                className={`
                    fixed md:relative z-40 h-full w-72 bg-background border-r border-border transition-transform duration-300
                    ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
                    flex flex-col
                `}
            >
                {/* Sidebar Header */}
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

                {/* Session List */}
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
                                    <p className="text-sm font-medium truncate">
                                        {s.title || "Untitled Chat"}
                                    </p>
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
                                <button
                                    onClick={(e) => deleteChat(s.session_id, e)}
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-all"
                                >
                                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                                </button>
                            </button>
                        ))
                    )}
                </div>

                {/* Sidebar Footer */}
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

                    <Select value={subject} onValueChange={setSubject}>
                        <SelectTrigger className="w-36 h-8 text-xs" data-testid="ai-subject">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
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
                                I'm GC AI, your personal exam coach. Ask me anything about your subjects,
                                and I'll explain it step by step.
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
                                    m.content ? (
                                        <Markdown>{m.content}</Markdown>
                                    ) : (
                                        <span className="inline-flex gap-1">
                                            <span className="animate-pulse">●</span>
                                            <span className="animate-pulse animation-delay-200">●</span>
                                            <span className="animate-pulse animation-delay-400">●</span>
                                        </span>
                                    )
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input Area */}
                <div className="sticky bottom-0 bg-background/80 backdrop-blur border-t border-border p-4">
                    <div className="max-w-4xl mx-auto flex items-end gap-2 rounded-xl border border-border bg-card p-2">
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
                            placeholder="Ask GC AI anything about your subjects…"
                            className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none resize-none min-h-[40px] max-h-[200px]"
                            rows={1}
                            style={{ height: "auto" }}
                            onInput={(e) => {
                                const target = e.target;
                                target.style.height = "auto";
                                target.style.height = Math.min(target.scrollHeight, 200) + "px";
                            }}
                        />
                        <Button
                            onClick={() => send()}
                            disabled={streaming || !input.trim()}
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
                    <div className="max-w-4xl mx-auto mt-1.5 text-[10px] text-muted-foreground text-center">
                        GC AI can make mistakes. Always verify important information.
                    </div>
                </div>
            </div>
        </div>
    );
}