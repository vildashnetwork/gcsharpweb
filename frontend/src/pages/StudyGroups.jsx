// pages/StudyGroups.jsx
// WhatsApp-style study group chat with paper sharing, highlights, voice notes and GC AI.
// Real-time delivery over WebSocket (TCP) - see backend/study_groups.py.
import { useCallback, useEffect, useRef, useState, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "@/lib/api";
import { groupSocketUrl, voiceNoteUrl } from "@/lib/realtime";
import { useAuth } from "@/context/AuthContext";
import { useVoiceRecorder } from "@/hooks/useVoiceRecorder";
import GroupMessage from "@/components/studygroup/GroupMessage";
import PaperPicker from "@/components/studygroup/PaperPicker";
import MembersPanel from "@/components/studygroup/MembersPanel";
import { toast } from "sonner";
import {
    ArrowLeft, Plus, Send, Paperclip, Mic, Pause, Circle,
    MessageSquare, Users, FileText, Brain, Loader2,
} from "lucide-react";



const QUICK_REACTIONS = ["\u2b50", "\ud83d\udc4d", "\ud83d\udc31", "\ud83d\udc65", "\ud83d\ude03", "\u2705"];

function LoadingScreen({ text }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{text || "Loading..."}</p>
        </div>
    );
}

function EmptyState({ onJoin }) {
    return (
        <div className="flex flex-col items-center justify-center gap-6 py-16 text-muted-foreground">
            <MessageSquare className="h-10 w-10 text-primary/30" />
            <div className="text-center">
                <h3 className="text-base font-semibold text-foreground mb-1">No group selected</h3>
                <p className="text-sm">Join a study group to chat with classmates and get AI help.</p>
            </div>
            <button

export default memo(function StudyGroups() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const mineId = user?.user_id;

    // Group + messages
    const [group, setGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const [lastSeq, setLastSeq] = useState(null);

    // AI panel
    const [aiThinking, setAiThinking] = useState(false);
    const [aiQuestion, setAiQuestion] = useState("");
    const [aiAnswer, setAiAnswer] = useState("");
    const [aiAnswerMeta, setAiAnswerMeta] = useState(null);

    const fetchGroup = useCallback(async () => {
        if (!groupId || groupId === "_none") return;
        setLoading(true);
        try {
            const res = await fetch(API + "/groups/" + groupId, { credentials: "include" });
            if (!res.ok) {
                if (res.status === 404) { toast.error("Group not found"); navigate("/groups", { replace: true }); return; }
                throw new Error("HTTP " + res.status);
            }
            const data = await res.json();
            setGroup(data);
        } catch (err) { console.error("fetch group failed:", err); toast.error("Could not load group"); }
        finally { setLoaded(true); setLoading(false); }
    }, [groupId, navigate]);

    const fetchMessages = useCallback(async (beforeSeq) => {
        if (!groupId) return;
        try {
            const url = API + "/groups/" + groupId + "/messages" + (beforeSeq != null ? "?before_seq=" + beforeSeq : "");
            const res = await fetch(url, { credentials: "include" });
            const data = await res.json();
            if (res.ok && data?.messages) {
                if (!beforeSeq) {

    const sendMessage = useCallback(async (payload) => {
        if (!groupId) return;
        setSubmitting(true);
        try {
            const res = await fetch(API + "/groups/" + groupId + "/messages", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...payload, client_id: crypto.randomUUID() }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessages((prev) => [data.message, ...prev]);
                if (data.message?.seq != null) setLastSeq(data.message.seq);
            } else {
                toast.error(data?.detail || "Could not send message");
            }
        } catch (err) { toast.error("Request failed"); }

    const sharePaper = useCallback(async (paperId) => {
        if (!groupId || !paperId) return;
        setSubmitting(true);
        try {
            const res = await fetch(API + "/groups/" + groupId + "/papers/" + paperId, {
                method: "POST",
                credentials: "include",
            });
            const data = await res.json();
            if (res.ok) {
                setMessages((prev) => [data.message, ...prev]);
                toast.success("Paper shared to the group");
            } else {
                toast.error(data?.detail || "Could not share paper");
            }
        } catch (err) { toast.error("Request failed"); }
        finally { setSubmitting(false); }
    }, [groupId]);

    const reactToMessage = useCallback(async (messageId, emoji) => {
        if (!groupId || !messageId || !emoji) return;
        try {
            const res = await fetch(API + "/groups/" + groupId + "/react", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message_id: messageId, emoji }),
            });
            if (!res.ok) {
                const d = await res.json().catch(() => ({}));
                toast.error(d?.detail || "Reaction failed");
            }
        } catch (err) { toast.error("Request failed"); }
    }, [groupId]);

    const deleteMessage = useCallback(async (messageId, forEveryone) => {
        if (!groupId || !messageId) return;
        try {
            const res = await fetch(API + "/groups/" + groupId + "/messages/delete", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message_id: messageId, for_everyone: !!forEveryone }),
            });
            const data = await res.json();
            if (res.ok) {
                setMessages((prev) => prev.map((m) => {
                    if (m.message_id !== messageId) return m;
                    if (data?.for_everyone) {
                        return { ...m, deleted_everyone: true, text: "", paper: null, highlight: null, audio: null, image: null };
                    }

    const handleSubmit = useCallback(() => {
        const text = composer.trim();
        if (!text) return;
        sendMessage({ text, type: "text" });
        setComposer("");
    }, [composer, sendMessage]);

    const handleVoiceSubmit = useCallback(() => {
        const { lastBlob, lastUrl, duration } = voice;
        if (lastBlob && lastUrl) {
            sendVoiceNote(lastBlob, lastUrl, duration);
        }
        setShowVoiceRecorder(false);
        voice.stop && voice.stop();
    }, [voice, sendVoiceNote]);

    const handleSharePaper = useCallback((paper) => {
        setSelectedPaper(paper);
        setShowPaperPicker(false);
    }, []);

    const handleConfirmShare = useCallback(() => {
        if (selectedPaper?.paper_id) {
            sharePaper(selectedPaper.paper_id);
            setSelectedPaper(null);
        }
    }, [selectedPaper, sharePaper]);

    const handleReplyTo = useCallback((message) => {
        if (!message?.message_id) return;
        setComposer((prev) => "@" + (message.sender_name || "") + " " + prev);

    const renderMessage = (m) => {
        const isMine = m?.sender_id === mineId;
        const isAI = m?.type === "ai";
        const isSystem = m?.type === "system";
        const deletedForMe = m?.deleted_for?.includes(mineId);
        return (
            <GroupMessage
                key={m.message_id}
                message={m}
                mine={isMine}
                onReply={handleReplyTo}
                onReact={handleReact}
                onDelete={handleDelete}
                onAskAI={isAI || isSystem ? null : handleAskAI}
                deletedForMe={deletedForMe}
            />
        );
    };

    // Early: no group selected
    if (!groupId || groupId === "_none") {
        return (
            <div className="flex flex-col h-full bg-background">
                <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shrink-0">
                    <h2 className="text-sm font-semibold">Study Groups</h2>
                    <button
                        onClick={() => navigate("/groups/create", { replace: true })}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <Plus className="h-3.5 w-3.5" /> New group
                    </button>
                </header>

            {/* Chat area */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0" ref={scrollRef}>
                <AIThinkingBanner active={aiThinking} question={aiQuestion} />
                <TypingIndicator names={typingUsers.map((t) => t.name).filter(Boolean)} />

                {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
                        <MessageSquare className="h-7 w-7" />
                        <p className="text-sm">No messages in this group yet.</p>
                        <p className="text-xs">Share a paper, ask a question, or send a voice note.</p>
                    </div>
                ) : (
                    messages.map(renderMessage)

            {/* Divider */}
            <div className="shrink-0 px-3 pb-0.5">
                <div className="h-px bg-border" />
            </div>

            {/* Composer */}
            <div className="flex-shrink px-3 pb-3">
                <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-2 py-1.5 shadow-sm">
                    <button
                        onClick={() => { setShowPaperPicker(!showPaperPicker); setShowVoiceRecorder(false); }}
                        className={`p-2 rounded-lg transition-colors ${showPaperPicker ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                        title="Share a paper"
                    >
                        <Paperclip className="h-4.5 w-4.5" />
                    </button>
                    <button
                        onClick={() => { setShowVoiceRecorder(!showVoiceRecorder); setShowPaperPicker(false); }}
                        className={`p-2 rounded-lg transition-colors ${showVoiceRecorder ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                        title="Voice note"
                    >
                        {voice.recording ? (
                            <button
                                onClick={() => {
                                    voice.stop && voice.stop();
                                    setShowVoiceRecorder(false);
                                    setComposer((c) => c + " \uD83C\uDFB8 Voice note");
                                }}
                                className="p-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20"
                                title="Stop recording"
                            >
                                <Pause className="h-4.5 w-4.5" />
                            </button>
                        ) : (
                            <Mic className="h-4.5 w-4.5" />
                        )}
                    </button>
                    <textarea
                        ref={composerRef}
                        value={composer}
                        onChange={(e) => setComposer(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); }
                            else if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) { e.preventDefault(); handleSubmit(); }
                        }}
                        placeholder="Type a message, or share a paper / voice note..."
                        className="w-full bg-transparent resize-none text-sm outline-none placeholder:text-muted-foreground overflow-x-hidden"
                        rows={1}
                    />
                    {composer ? (
                        <button
                            onClick={handleSubmit}
                            className="p-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                            disabled={submitting}
                            title="Send"
                        >
                            <Send className="h-4.5 w-4.5" />
                        </button>
                    ) : null}
                </div>
            </div>


                {/* Paper picker drop */}
                {showPaperPicker ? (
                    <PaperPicker
                        selectedPaper={selectedPaper}
                        onSelect={handleSharePaper}
                        onConfirmShare={handleConfirmShare}
                        onClose={() => { setShowPaperPicker(false); setSelectedPaper(null); }}
                    />
                ) : null}

                {/* Voice recorder drop */}
                {showVoiceRecorder ? (
                    <div className="mt-2 bg-secondary/30 rounded-xl border border-border p-2.5">
                        {voice.recording ? (
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                    <Circle className="h-3 w-3 text-destructive fill-destructive animate-pulse" />
                                    <span className="text-xs text-muted-foreground">Recording</span>
                                </div>
                                <span className="text-xs text-muted-foreground">{Math.round(voice.duration)}s</span>
                                <button
                                    onClick={() => {
                                        voice.stop && voice.stop();
                                        setShowVoiceRecorder(false);
                                        setComposer((c) => c + " \uD83C\uDFB8 Voice note");
                                    }}
                                    className="ml-auto rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:bg-primary/90"
                                >
                                    <Pause className="h-3.5 w-3.5 inline" /> Stop
                                </button>
                                <button
                                    onClick={() => {
                                        voice.stop && voice.stop();
                                        voice.clear && voice.clear();
                                        setShowVoiceRecorder(false);
                                    }}
                                    className="rounded-lg bg-destructive text-white text-xs font-medium px-3 py-1.5 hover:bg-destructive/90"
                                >
                                    Discard
                                </button>
                            </div>
                        ) : voice.lastUrl ? (
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-medium truncate">{user?.name || "You"} \u2014 Voice note</span>
                                <audio
                                    src={voice.lastUrl}
                                    controls
                                    className="flex-1 h-7"
                                    onLoadedMetadata={() => {}}
                                />
                                <button
                                    onClick={() => {
                                        sendVoiceNote(voice.lastBlob, voice.lastUrl, voice.duration);
                                        setShowVoiceRecorder(false);
                                    }}
                                    className="rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:bg-primary/90 disabled:opacity-50"
                                    disabled={submitting || !voice.lastBlob}
                                >
                                    <Send className="h-3.5 w-3.5 inline" /> Send
                                </button>
                                <button
                                    onClick={() => {
                                        voice.clear && voice.clear();
                                        setShowVoiceRecorder(false);
                                    }}
                                    className="rounded-lg bg-destructive text-white text-xs font-medium px-3 py-1.5 hover:bg-destructive/90"
                                >
                                    Discard
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <Mic className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Tap to record a voice note (up to 5 MB)</span>
                                <button
                                    onClick={() => voice.start()}
                                    className="ml-auto rounded-lg bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 hover:bg-primary/90"
                                >
                                    Record
                                </button>
                            </div>
                        )}
                        {voice.error && <p className="mt-1 text-xs text-destructive">{voice.error}</p>}
                    </div>
                ) : null}
            </div>

                )}
                <div ref={scrollRef} />
            </div>

                <EmptyState onJoin={() => navigate("/groups/create", { replace: true })} />
            </div>
        );
    }

    if (loading || !loaded) return LoadingScreen({ text: "Loading group..." });

    return (
        <div className="flex flex-col h-full bg-background">
            <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 shrink-0">
                <button
                    onClick={() => navigate("/groups", { replace: true })}
                    className="p-1.5 -ml-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    title="Back to groups"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-sm font-semibold truncate">{group?.name || "Study Group"}</h2>
                        {group?.archived ? (
                            <span className="h-4 flex items-center gap-1 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground font-medium">archived</span>
                        ) : null}
                        {group?.member_count != null ? (
                            <span className="text-[11px] text-muted-foreground">{group.member_count} members</span>
                        ) : null}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{group?.description || ""}</p>
                </div>
                {group?.ai_enabled !== false ? (
                    <button
                        onClick={() => setAiTabs("ask")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/10 border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-500 hover:bg-violet-500/20"
                    >
                        <Brain className="h-3.5 w-3.5" /> Ask AI
                    </button>
                ) : null}
            </header>

        composerRef.current && composerRef.current.focus();
    }, []);

    const handleReact = useCallback((message, emoji) => {
        reactToMessage(message?.message_id, emoji);
        setReactionPickerMsg(null);
    }, [reactToMessage]);

    const handleDelete = useCallback((message) => {
        if (!confirm("Delete this message?")) return;
        const forEveryone = message?.sender_id === mineId;
        deleteMessage(message?.message_id, forEveryone);
    }, [deleteMessage, mineId]);

    const handleAskAI = useCallback((message) => {
        const text = message?.text || "";
        const paper = message?.paper;
        askAI(text, { messageId: message?.message_id, paperId: paper?.paper_id });
    }, [askAI]);

                    return { ...m, deleted_for: [...(m.deleted_for || []), mineId] };
                }));
                toast.success("Message deleted");
            } else {
                const d = await res.json().catch(() => ({}));
                toast.error(d?.detail || "Delete failed");
            }
        } catch (err) { toast.error("Request failed"); }
    }, [groupId, mineId]);

    const askAI = useCallback(async (question, opts) => {
        if (!groupId || !question?.trim()) return;
        setAiThinking(true);
        setAiAnswer("");
        try {
            const res = await fetch(API + "/groups/" + groupId + "/ai", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: question.trim(),
                    message_id: opts?.messageId || undefined,
                    paper_id: opts?.paperId || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data?.message) {
                setMessages((prev) => [data.message, ...prev]);
                setAiHistory((prev) => [
                    ...prev,
                    { role: "user", content: question.trim() },
                    { role: "assistant", content: data.message?.text || "", meta: data.message?.ai },
                ]);
                setAiAnswer(data.message?.text || "");
                setAiAnswerMeta(data.message?.ai || null);
                setAiTabs("recent");
            } else {
                const d = await res.json().catch(() => ({}));
                toast.error(d?.detail || "AI could not answer");
                setAiAnswer(d?.detail || "AI could not answer");
            }
        } catch (err) { toast.error("Request failed"); }
        finally { setAiThinking(false); }
    }, [groupId]);

        finally { setSubmitting(false); }
    }, [groupId]);

    const sendVoiceNote = useCallback(async (blob, url, duration) => {
        if (!groupId || !blob) return;
        setSubmitting(true);
        const form = new FormData();
        form.append("file", blob, "voice.webm");
        form.append("duration", String(duration || 0));
        form.append("client_id", crypto.randomUUID());
        try {
            const res = await fetch(API + "/groups/" + groupId + "/voice", {
                method: "POST",
                credentials: "include",
                body: form,
            });
            const data = await res.json();
            if (res.ok) {
                setMessages((prev) => [data.message, ...prev]);
            } else {
                toast.error(data?.detail || "Could not send voice note");
            }
        } catch (err) { toast.error("Request failed"); }
        finally { setSubmitting(false); }
    }, [groupId]);

                    setMessages(data.messages);
                } else {
                    const existing = new Map(messages.map(m => [m.message_id, m]));
                    const latest = data.messages.filter(m => !existing.has(m.message_id));
                    setMessages((prev) => [...latest, ...prev]);
                }
                if (data.latest_seq != null) setLastSeq(data.latest_seq);
            }
        } catch (err) { console.error("fetch messages failed:", err); }
    }, [groupId, messages]);

    useEffect(() => {
        if (groupId && groupId !== "_none") { fetchGroup(); fetchMessages(); }
        else { setLoaded(true); }
        return () => { setGroup(null); setMessages([]); setLoaded(false); setSelectedPaper(null); setShowPaperPicker(false); setShowVoiceRecorder(false); };
    }, [groupId]);

    useEffect(() => {
        if (messages.length > 0) {
            const t = setTimeout(() => {
                if (scrollRef.current) scrollRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
            }, 50);
            return () => clearTimeout(t);
        }
    }, [messages.length]);

    const [aiTabs, setAiTabs] = useState("recent");
    const [aiHistory, setAiHistory] = useState([]);

    // Composer
    const [composer, setComposer] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [reactionPickerMsg, setReactionPickerMsg] = useState(null);

    // Panels
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [showPaperPicker, setShowPaperPicker] = useState(false);
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);

    const voice = useVoiceRecorder();
    const scrollRef = useRef(null);
    const composerRef = useRef(null);

                onClick={onJoin}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
                <Plus className="h-4 w-4" /> Join a study group
            </button>
        </div>
    );
}

function TypingIndicator({ names }) {
    if (!names?.length) return null;
    return (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground px-1 py-0.5">
            <span className="inline-flex h-4 w-4 relative items-center justify-center">
                <span className="animate-bounce absolute inline-flex h-full w-1 rounded-full bg-muted-foreground/40" style={{ animationDelay: "0ms" }} />
                <span className="animate-bounce absolute inline-flex h-full w-1 rounded-full bg-muted-foreground/40" style={{ animationDelay: "150ms" }} />
                <span className="animate-bounce absolute inline-flex h-full w-1 rounded-full bg-muted-foreground/40" style={{ animationDelay: "300ms" }} />
            </span>
            <span className="italic">{names.join(", ")}{names.length > 1 ? " are typing" : " is typing"}</span>
        </div>
    );
}

function AIThinkingBanner({ active, question }) {
    if (!active) return null;
    return (
        <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2 text-xs text-violet-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span className="truncate">GC AI is thinking about: {question}</span>
        </div>
    );
}

const QUICK_REACTIONS = ["👍", "🙏", "🔥", "😂", "😮", "✅"];

function renderMessage(m, handlers) {
    if (m.type === "system") return null;
    const isMine = m?.sender_id === handlers.mineId;
    const deletedForMe = m?.deleted_for?.includes(handlers.mineId);
    return (
        <GroupMessage
            key={m.message_id}
            message={m}
            mine={isMine}
            onReply={handlers.handleReplyTo}
            onReact={handlers.handleReact}
            onDelete={deletedForMe ? handlers.handleDelete : null}
            onAskAI={m.type === "ai" ? null : handlers.handleAskAI}
        />
    );
}

