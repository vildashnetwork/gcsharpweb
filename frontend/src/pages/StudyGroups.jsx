// pages/StudyGroups.jsx
// WhatsApp-style study group chat with paper sharing, highlights, voice notes and GC AI.
// Real-time delivery over WebSocket (TCP) - see backend/study_groups.py.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, memo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { API } from "@/lib/api";
import { authHeaders, voiceNoteUrl } from "@/lib/realtime";
import { useAuth } from "@/context/AuthContext";
import useVoiceRecorder from "@/hooks/useVoiceRecorder";
import useGroupSocket from "@/hooks/useGroupSocket";
import GroupBrowser from "@/components/studygroup/GroupBrowser";
import GroupMessage from "@/components/studygroup/GroupMessage";
import PaperPicker from "@/components/studygroup/PaperPicker";
import MembersPanel from "@/components/studygroup/MembersPanel";
import { toast } from "sonner";
import {
    ArrowLeft, Send, Paperclip, Mic, Pause, Circle,
    MessageSquare, Users, FileText, Brain, Loader2, X, ChevronUp,
} from "lucide-react";

const QUICK_REACTIONS = ["⭐", "👍", "🔥", "😂", "😮", "✅"];

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function LoadingScreen({ text }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm">{text || "Loading..."}</p>
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

function AIPanel({ open, onClose, tab, onTabChange, question, onQuestionChange, onAsk, thinking, answer, history }) {
    if (!open) return null;
    return (
        <div className="absolute top-14 right-3 z-20 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <div className="flex items-center gap-1.5 text-sm font-medium">
                    <Brain className="h-4 w-4 text-violet-500" /> GC AI
                </div>
                <button onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground">
                    <X className="h-4 w-4" />
                </button>
            </div>
            <div className="flex border-b border-border text-xs">
                <button
                    onClick={() => onTabChange("ask")}
                    className={`flex-1 py-1.5 font-medium ${tab === "ask" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                >
                    Ask
                </button>
                <button
                    onClick={() => onTabChange("recent")}
                    className={`flex-1 py-1.5 font-medium ${tab === "recent" ? "text-primary border-b-2 border-primary" : "text-muted-foreground"}`}
                >
                    Recent
                </button>
            </div>
            <div className="p-3 max-h-80 overflow-y-auto space-y-2">
                {tab === "ask" ? (
                    <>
                        <textarea
                            value={question}
                            onChange={(e) => onQuestionChange(e.target.value)}
                            placeholder="Ask the group AI something..."
                            className="w-full resize-none rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none"
                            rows={3}
                        />
                        <button
                            onClick={onAsk}
                            disabled={thinking || !question.trim()}
                            className="w-full rounded-lg bg-violet-500 text-white text-xs font-medium py-1.5 hover:bg-violet-500/90 disabled:opacity-50"
                        >
                            {thinking ? "Thinking..." : "Ask AI"}
                        </button>
                        {answer ? (
                            <div className="rounded-lg bg-secondary/40 px-2 py-1.5 text-xs whitespace-pre-wrap">{answer}</div>
                        ) : null}
                    </>
                ) : (
                    <>
                        {history.length === 0 ? (
                            <p className="text-xs text-muted-foreground">No questions asked yet.</p>
                        ) : (
                            history.map((h, i) => (
                                <div
                                    key={i}
                                    className={`text-xs rounded-lg px-2 py-1.5 ${h.role === "user" ? "bg-primary/10" : "bg-secondary/40"}`}
                                >
                                    {h.content}
                                </div>
                            ))
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default memo(function StudyGroups() {
    const { groupId } = useParams();
    const navigate = useNavigate();
    const { user } = useAuth();
    const mineId = user?.user_id;

    // Only the chat route (/groups/:groupId) has a live conversation. The browser
    // routes "/groups" and "/groups/create" must never fetch or open a socket.
    const isChat = !!groupId && groupId !== "_none" && groupId !== "create";

    // Group + messages
    const [group, setGroup] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lastSeq, setLastSeq] = useState(null);
    // History pagination. The API hands back one chronological page at a time
    // (40 messages); without these the older half of a conversation never shows.
    const [hasMoreHistory, setHasMoreHistory] = useState(false);
    const [oldestSeq, setOldestSeq] = useState(null);
    const [loadingOlder, setLoadingOlder] = useState(false);

    // AI panel
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiTabs, setAiTabs] = useState("recent");
    const [aiHistory, setAiHistory] = useState([]);
    const [aiThinking, setAiThinking] = useState(false);
    const [aiQuestion, setAiQuestion] = useState("");
    const [aiAnswer, setAiAnswer] = useState("");
    const [aiAnswerMeta, setAiAnswerMeta] = useState(null);

    // Composer
    const [composer, setComposer] = useState("");
    const [editingId, setEditingId] = useState(null);
    const [reactionPickerMsg, setReactionPickerMsg] = useState(null);

    // Panels
    const [selectedPaper, setSelectedPaper] = useState(null);
    const [showPaperPicker, setShowPaperPicker] = useState(false);
    const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
    const [showMembers, setShowMembers] = useState(false);

    const voice = useVoiceRecorder();
    const scrollRef = useRef(null);
    const composerRef = useRef(null);
    // The scrollable message list. We remember whether the reader is parked at
    // the bottom so loading older pages never yanks the view around.
    const chatBoxRef = useRef(null);
    const atBottomRef = useRef(true);
    const restoreHeightRef = useRef(null);
    const typingStopRef = useRef(null);

    // One insertion point for messages. The REST reply to our own send, the live
    // echo of that same send over the socket, and pages of history can all carry
    // the same message - so everything is de-duped on message_id and stored
    // oldest -> newest, which is the order the API already returns.
    const appendMessage = useCallback((msg) => {
        if (!msg?.message_id) return;
        setMessages((prev) => (
            prev.some((m) => m.message_id === msg.message_id)
                ? prev
                : [...prev, msg]
        ));
        if (typeof msg.seq === "number") {
            setLastSeq((prev) => Math.max(prev || 0, msg.seq));
        }
    }, []);

    // -- Data fetching --------------------------------------------------

    const fetchGroup = useCallback(async () => {
        // "create" is the browser route with the form open - there is no group
        // to load, and asking the API for it would 404 and bounce us home.
        if (!isChat) return;
        setLoading(true);
        try {
            const res = await fetch(API + "/groups/" + groupId, { credentials: "include" });
            if (!res.ok) {
                if (res.status === 404) {
                    toast.error("Group not found");
                    navigate("/groups", { replace: true });
                    return;
                }
                throw new Error("HTTP " + res.status);
            }
            const data = await res.json();
            setGroup(data);
        } catch (err) {
            console.error("fetch group failed:", err);
            toast.error("Could not load group");
        } finally {
            setLoaded(true);
            setLoading(false);
        }
    }, [groupId, isChat, navigate]);

    // History arrives oldest -> newest (the endpoint sorts by seq desc, takes the
    // page, then flips it back). We keep that order, page with before_seq, and
    // return the payload so callers can mark the room read.
    const fetchMessages = useCallback(async (beforeSeq) => {
        if (!isChat) return null;
        try {
            const url = API + "/groups/" + groupId + "/messages"
                + (beforeSeq != null ? "?before_seq=" + beforeSeq : "");
            const res = await fetch(url, { credentials: "include", headers: authHeaders() });
            const data = await res.json();
            if (!res.ok || !Array.isArray(data?.messages)) return null;

            const page = data.messages;
            setMessages((prev) => {
                const known = new Set(prev.map((m) => m.message_id));
                const fresh = page.filter((m) => m?.message_id && !known.has(m.message_id));
                if (!fresh.length) return prev;
                // Older pages belong above what is already on screen.
                return beforeSeq != null ? [...fresh, ...prev] : [...prev, ...fresh];
            });

            setHasMoreHistory(!!data.has_more);
            if (data.oldest_seq != null) setOldestSeq(data.oldest_seq);
            if (data.latest_seq != null) {
                setLastSeq((prev) => Math.max(prev || 0, data.latest_seq));
            }
            return data;
        } catch (err) {
            console.error("fetch messages failed:", err);
            return null;
        }
    }, [groupId, isChat]);

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
                appendMessage(data.message);
            } else {
                toast.error(data?.detail || "Could not send message");
            }
        } catch (err) {
            toast.error("Request failed");
        } finally {
            setSubmitting(false);
        }
    }, [appendMessage, groupId]);

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
                appendMessage(data.message);
                toast.success("Paper shared to the group");
            } else {
                toast.error(data?.detail || "Could not share paper");
            }
        } catch (err) {
            toast.error("Request failed");
        } finally {
            setSubmitting(false);
        }
    }, [appendMessage, groupId]);

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
        } catch (err) {
            toast.error("Request failed");
        }
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
                    return { ...m, deleted_for: [...(m.deleted_for || []), mineId] };
                }));
                toast.success("Message deleted");
            } else {
                const d = await res.json().catch(() => ({}));
                toast.error(d?.detail || "Delete failed");
            }
        } catch (err) {
            toast.error("Request failed");
        }
    }, [groupId, mineId]);

    const askAI = useCallback(async (question, opts) => {
        if (!groupId || !question?.trim()) return;
        setAiThinking(true);
        setAiQuestion(question.trim());
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
                appendMessage(data.message);
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
        } catch (err) {
            toast.error("Request failed");
        } finally {
            setAiThinking(false);
        }
    }, [appendMessage, groupId]);

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
                appendMessage(data.message);
            } else {
                toast.error(data?.detail || "Could not send voice note");
            }
        } catch (err) {
            toast.error("Request failed");
        } finally {
            setSubmitting(false);
        }
    }, [appendMessage, groupId]);

    // -- Live connection --------------------------------------------------
    // The room socket is what makes the chat live: messages, typing dots, who is
    // online, reactions, receipts and GC AI all arrive here. Sending stays on REST
    // (it hands back the stored message straight away), and the socket echo of our
    // own message is dropped by appendMessage's de-dupe on message_id.

    const markRead = useCallback((uptoSeq) => {
        if (!isChat || !(uptoSeq > 0)) return;
        fetch(API + "/groups/" + groupId + "/read", {
            method: "POST",
            credentials: "include",
            headers: authHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ upto_seq: uptoSeq }),
        }).catch(() => {});
    }, [groupId, isChat]);

    const socketHandlers = {
        onMessage: (msg) => {
            if (!msg?.message_id) return;
            appendMessage(msg);
            if (atBottomRef.current) markRead(msg.seq);
        },
        onReady: (data) => {
            // Freshly (re)connected: pull anything that landed while we were away.
            if (typeof data?.latest_seq === "number" && lastSeq != null && data.latest_seq > lastSeq) {
                fetchMessages();
            }
        },
        onReaction: (data) => {
            if (!data?.message_id) return;
            setMessages((prev) => prev.map((m) => (
                m.message_id === data.message_id ? { ...m, reactions: data.reactions || {} } : m
            )));
        },
        onRead: (data) => {
            if (!data?.user_id || !(data.upto_seq > 0)) return;
            setMessages((prev) => prev.map((m) => (
                m.sender_id === data.user_id
                    && (m.seq ?? 0) <= data.upto_seq
                    && !(m.read_by || []).includes(data.user_id)
                    ? { ...m, read_by: [...(m.read_by || []), data.user_id] }
                    : m
            )));
        },
        onMessageDeleted: (data) => {
            if (!data?.message_id || !data.for_everyone) return;
            setMessages((prev) => prev.map((m) => (m.message_id === data.message_id
                ? { ...m, deleted_everyone: true, text: "", paper: null, highlight: null, audio: null, image: null }
                : m)));
        },
        onMembersChanged: () => fetchGroup(),
        onGroupUpdated: (updates) => setGroup((g) => (g ? { ...g, ...(updates || {}) } : g)),
        onGroupDeleted: () => {
            toast.error("This group was deleted.");
            navigate("/groups", { replace: true });
        },
        onJoinRequest: (req) => {
            if (req?.name) toast.info(req.name + " wants to join the group");
        },
        onAIThinking: (data) => {
            setAiThinking(!!data?.state);
            if (data?.state && data?.question) setAiQuestion(data.question);
        },
        onError: (detail) => {
            setAiThinking(false);
            if (detail) toast.error(detail);
        },
    };

    const {
        connected,
        onlineUsers,
        typingUsers,
        sendTyping,
    } = useGroupSocket(isChat ? groupId : null, socketHandlers);

    const notifyTyping = useCallback(() => {
        if (!isChat) return;
        if (sendTyping(true)) {
            clearTimeout(typingStopRef.current);
            typingStopRef.current = setTimeout(() => sendTyping(false), 1600);
        }
    }, [isChat, sendTyping]);

    // -- Effects ----------------------------------------------------------

    useEffect(() => {
        if (!isChat) {
            setLoaded(true);
            return undefined;
        }
        atBottomRef.current = true;
        setHasMoreHistory(false);
        setOldestSeq(null);
        fetchGroup();
        fetchMessages().then((data) => {
            const newest = data?.latest_seq;
            if (typeof newest === "number") markRead(newest);
        });
        return () => {
            setGroup(null);
            setMessages([]);
            setLoaded(false);
            setAiThinking(false);
            setSelectedPaper(null);
            setShowPaperPicker(false);
            setShowVoiceRecorder(false);
        };
    }, [fetchGroup, fetchMessages, isChat, markRead]);

    // Walk back through the conversation one page at a time and hold the view
    // steady, so loading history never throws the reader somewhere else.
    const loadOlder = useCallback(async () => {
        if (!isChat || loadingOlder || !hasMoreHistory || oldestSeq == null) return;
        setLoadingOlder(true);
        restoreHeightRef.current = chatBoxRef.current?.scrollHeight ?? null;
        try {
            await fetchMessages(oldestSeq);
        } finally {
            setLoadingOlder(false);
        }
    }, [fetchMessages, hasMoreHistory, isChat, loadingOlder, oldestSeq]);

    const handleChatScroll = useCallback((event) => {
        const el = event.currentTarget;
        atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 140;
        if (el.scrollTop < 180) loadOlder();
    }, [loadOlder]);

    // Keep the same messages on screen after an older page lands above them.
    useLayoutEffect(() => {
        const box = chatBoxRef.current;
        if (!box || restoreHeightRef.current == null) return;
        box.scrollTop += box.scrollHeight - restoreHeightRef.current;
        restoreHeightRef.current = null;
    }, [messages.length]);

    // Follow the conversation, but only while the reader is parked at the bottom.
    useEffect(() => {
        if (!atBottomRef.current) return;
        const box = chatBoxRef.current;
        if (box) box.scrollTop = box.scrollHeight;
    }, [messages.length, typingUsers.length, aiThinking, loaded]);

    useEffect(() => () => clearTimeout(typingStopRef.current), []);

    // -- UI handlers --------------------------------------------------------

    const handleSubmit = useCallback(() => {
        const text = composer.trim();
        if (!text) return;
        clearTimeout(typingStopRef.current);
        sendTyping(false);
        sendMessage({ text, type: "text" });
        setComposer("");
    }, [composer, sendMessage, sendTyping]);

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
        setShowAIPanel(true);
        setAiTabs("ask");
    }, [askAI]);

    const handleOpenAskAI = useCallback(() => {
        setShowAIPanel(true);
        setAiTabs("ask");
    }, []);

    const handleAskFromPanel = useCallback(() => {
        if (!aiQuestion.trim()) return;
        askAI(aiQuestion);
    }, [aiQuestion, askAI]);

    const renderMessage = (m) => {
        if (m?.type === "system") return null;
        const isMine = m?.sender_id === mineId;
        const isAI = m?.type === "ai";
        const deletedForMe = m?.deleted_for?.includes(mineId);
        return (
            <GroupMessage
                key={m.message_id}
                message={m}
                mine={isMine}
                quickReactions={QUICK_REACTIONS}
                deletedForMe={deletedForMe}
                onReply={handleReplyTo}
                onReact={handleReact}
                onDelete={deletedForMe ? null : handleDelete}
                onAskAI={isAI ? null : handleAskAI}
            />
        );
    };

    // -- Early returns --------------------------------------------------

    // /groups and /groups/create are the group browser (your groups, discovery
    // and the create form). The chat itself only renders for a real group id.
    if (!groupId || groupId === "_none" || groupId === "create") {
        return <GroupBrowser createMode={groupId === "create"} />;
    }

    if (loading || !loaded) {
        return <LoadingScreen text="Loading group..." />;
    }

    // -- Main render ------------------------------------------------------

    return (
        <div className="relative flex flex-col h-full bg-background">
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
                            <button
                                onClick={() => setShowMembers(true)}
                                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                            >
                                <Users className="h-3 w-3" /> {group.member_count} members
                            </button>
                        ) : null}
                        <span
                            title={connected ? "Live - messages arrive instantly" : "Reconnecting to the room..."}
                            className={`h-1.5 w-1.5 rounded-full shrink-0 ${connected ? "bg-green-500" : "bg-amber-400 animate-pulse"}`}
                        />
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{group?.description || ""}</p>
                </div>
                {group?.ai_enabled !== false ? (
                    <button
                        onClick={handleOpenAskAI}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-500/10 border border-violet-500/30 px-3 py-1.5 text-xs font-medium text-violet-500 hover:bg-violet-500/20"
                    >
                        <Brain className="h-3.5 w-3.5" /> Ask AI
                    </button>
                ) : null}
            </header>

            <AIPanel
                open={showAIPanel}
                onClose={() => setShowAIPanel(false)}
                tab={aiTabs}
                onTabChange={setAiTabs}
                question={aiQuestion}
                onQuestionChange={setAiQuestion}
                onAsk={handleAskFromPanel}
                thinking={aiThinking}
                answer={aiAnswer}
                history={aiHistory}
            />

            {showMembers ? (
                <MembersPanel
                    group={group}
                    onlineUsers={onlineUsers}
                    onClose={() => setShowMembers(false)}
                />
            ) : null}

            {/* Chat area - messages are held oldest first, newest at the bottom */}
            <div
                ref={chatBoxRef}
                onScroll={handleChatScroll}
                className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0"
            >
                <AIThinkingBanner active={aiThinking} question={aiQuestion} />
                <TypingIndicator names={typingUsers.map((t) => t.name).filter(Boolean)} />

                {hasMoreHistory ? (
                    <div className="flex justify-center py-1">
                        <button
                            onClick={loadOlder}
                            disabled={loadingOlder}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-60"
                        >
                            {loadingOlder
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <ChevronUp className="h-3 w-3" />}
                            {loadingOlder ? "Loading older messages..." : "Load older messages"}
                        </button>
                    </div>
                ) : null}

                {messages.length === 0 && !hasMoreHistory ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-14 text-muted-foreground">
                        <MessageSquare className="h-7 w-7" />
                        <p className="text-sm">No messages in this group yet.</p>
                        <p className="text-xs">Share a paper, ask a question, or send a voice note.</p>
                    </div>
                ) : null}

                {messages.map(renderMessage)}
                <div ref={scrollRef} />
            </div>

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
                        onClick={() => {
                            if (voice.recording) {
                                voice.stop && voice.stop();
                                return;
                            }
                            setShowVoiceRecorder(!showVoiceRecorder);
                            setShowPaperPicker(false);
                        }}
                        className={`p-2 rounded-lg transition-colors ${showVoiceRecorder || voice.recording ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                        title="Voice note"
                    >
                        {voice.recording ? <Pause className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
                    </button>
                    <textarea
                        ref={composerRef}
                        value={composer}
                        onChange={(e) => { setComposer(e.target.value); notifyTyping(); }}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit();
                            }
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
                                    onClick={() => voice.stop && voice.stop()}
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
                                <span className="text-xs font-medium truncate">{user?.name || "You"} — Voice note</span>
                                <audio src={voice.lastUrl} controls className="flex-1 h-7" />
                                <button
                                    onClick={handleVoiceSubmit}
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
        </div>
    );
});