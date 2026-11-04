// components/studygroup/GroupMessage.jsx
// A single WhatsApp-style bubble: text, voice note, shared paper, highlighted
// passage, question and GC AI answers - with ticks, reactions and actions.
import { useMemo, useRef, useState } from "react";
import {
    Check, CheckCheck, FileText, Highlighter, Mic, Pause, Play, Reply,
    Sparkles, Smile, Trash2, Bot, HelpCircle, ExternalLink,
} from "lucide-react";
import Markdown from "../Markdown";
import { voiceNoteUrl } from "../../lib/realtime";

const QUICK_REACTIONS = ["👍", "🙏", "🔥", "😂", "😮", "✅"];

function formatSeconds(value) {
    const total = Math.max(0, Math.round(value || 0));
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}

function formatTime(iso) {
    if (!iso) return "";
    try {
        return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
        return "";
    }
}

function VoiceNote({ audio, mine }) {
    const ref = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [progress, setProgress] = useState(0);

    const toggle = () => {
        const el = ref.current;
        if (!el) return;
        if (playing) {
            el.pause();
            setPlaying(false);
        } else {
            el.play()
                .then(() => setPlaying(true))
                .catch((err) => console.error("voice playback failed:", err));
        }
    };

    return (
        <div className="flex items-center gap-3 min-w-[190px]">
            <button
                onClick={toggle}
                className={`h-9 w-9 shrink-0 rounded-full flex items-center justify-center ${
                    mine ? "bg-white/20 text-white" : "bg-primary text-white"
                }`}
                title={playing ? "Pause" : "Play voice note"}
            >
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <div className="flex-1">
                <div className="flex items-end gap-[3px] h-7">
                    {Array.from({ length: 26 }).map((_, index) => {
                        const played = progress * 26 >= index;
                        return (
                            <span
                                key={index}
                                className={`w-[3px] rounded-full ${
                                    mine ? "bg-white/70" : "bg-primary/60"
                                } ${played ? "opacity-100" : "opacity-40"}`}
                                style={{ height: `${8 + ((index * 7) % 18)}px` }}
                            />
                        );
                    })}
                </div>
                <div className={`flex justify-between text-[10px] mt-0.5 ${mine ? "text-white/80" : "text-muted-foreground"}`}>
                    <span className="flex items-center gap-1"><Mic className="h-3 w-3" /> voice note</span>
                    <span>{formatSeconds(audio?.duration)}</span>
                </div>
            </div>
            <audio
                ref={ref}
                src={voiceNoteUrl(audio?.audio_id)}
                onEnded={() => { setPlaying(false); setProgress(0); }}
                onTimeUpdate={(event) => {
                    const el = event.currentTarget;
                    if (el.duration) setProgress(el.currentTime / el.duration);
                }}
                preload="metadata"
            />
        </div>
    );
}

export default function GroupMessage({
    message,
    mine,
    onReply,
    onReact,
    onDelete,
    onAskAI,
}) {
    const [showReactions, setShowReactions] = useState(false);
    const isAI = message.type === "ai";
    const isSystem = message.type === "system";
    const deleted = message.deleted_everyone;

    const readCount = useMemo(
        () => (message.read_by || []).filter((id) => id !== message.sender_id).length,
        [message.read_by, message.sender_id]
    );

    const reactions = Object.entries(message.reactions || {}).filter(
        ([, users]) => (users || []).length > 0
    );

    if (isSystem) {
        return (
            <div className="flex justify-center my-2">
                <span className="text-[11px] text-muted-foreground bg-secondary/60 rounded-full px-3 py-1 text-center max-w-[85%]">
                    {message.text}
                </span>
            </div>
        );
    }

    const bubbleTone = mine
        ? "bg-primary text-white rounded-br-sm"
        : isAI
            ? "bg-violet-500/10 border border-violet-500/30 rounded-bl-sm"
            : "bg-card border border-border rounded-bl-sm";

    return (
        <div className={`flex gap-2 ${mine ? "flex-row-reverse" : ""}`}>
            {!mine && (
                <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                    isAI ? "bg-violet-500 text-white" : "bg-secondary text-foreground"
                }`}>
                    {isAI
                        ? <Bot className="h-4 w-4" />
                        : (message.sender_name || "S").charAt(0).toUpperCase()}
                </div>
            )}

            <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${mine ? "items-end" : "items-start"}`}>
                {!mine && (
                    <span className={`text-[11px] mb-0.5 ${
                        isAI ? "text-violet-500 font-medium" : "text-muted-foreground"
                    }`}>
                        {message.sender_name}{isAI ? " · AI tutor" : ""}
                    </span>
                )}

                <div className={`relative rounded-xl px-3 py-2 text-sm ${bubbleTone}`}>
                    {message.reply_to && message.reply_preview ? (
                        <div className={`mb-1.5 pl-2 border-l-2 text-[11px] ${
                            mine ? "border-white/50 text-white/80" : "border-primary/50 text-muted-foreground"
                        }`}>
                            <p className="font-medium truncate">{message.reply_preview.sender_name}</p>
                            <p className="truncate">{message.reply_preview.text}</p>
                        </div>
                    ) : null}

                    {deleted ? (
                        <p className={`italic text-xs ${mine ? "text-white/70" : "text-muted-foreground"}`}>
                            This message was deleted
                        </p>
                    ) : (
                        <>
                            {message.type === "voice" && message.audio ? (
                                <VoiceNote audio={message.audio} mine={mine} />
                            ) : null}

                            {message.type === "image" && message.image?.url ? (
                                <img
                                    src={message.image.url}
                                    alt={message.image.name || "shared"}
                                    className="rounded-lg max-h-64 mb-1"
                                />
                            ) : null}

                            {message.text ? (
                                message.type === "ai" ? (
                                    <Markdown>{message.text}</Markdown>
                                ) : (
                                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                                )
                            ) : null}

                            {message.highlight ? (
                                <div className={`mt-1.5 rounded-lg p-2 text-[12px] ${
                                    mine ? "bg-white/15" : "bg-amber-500/10 border border-amber-500/30"
                                }`}>
                                    <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-80">
                                        <Highlighter className="h-3 w-3" /> highlighted from
                                        {message.highlight.title ? ` ${message.highlight.title}` : " a past paper"}
                                    </span>
                                    <p className="mt-1 line-clamp-4 italic">“{message.highlight.text}”</p>
                                    {message.highlight.paper_id ? (
                                        <a
                                            href={`/study/paper/${message.highlight.paper_id}`}
                                            className="mt-1 inline-flex items-center gap-1 text-[11px] underline"
                                        >
                                            <ExternalLink className="h-3 w-3" /> open the paper
                                        </a>
                                    ) : null}
                                </div>
                            ) : null}

                            {message.paper ? (
                                <a
                                    href={`/study/paper/${message.paper.paper_id}`}
                                    className={`mt-1 flex items-center gap-2 rounded-lg p-2 ${
                                        mine ? "bg-white/15" : "bg-secondary/70 border border-border"
                                    }`}
                                >
                                    <FileText className="h-5 w-5 shrink-0" />
                                    <span className="min-w-0">
                                        <span className="block text-[12px] font-medium truncate">
                                            {message.paper.title}
                                        </span>
                                        <span className="block text-[10px] opacity-80">
                                            {[message.paper.level, message.paper.subject, message.paper.year]
                                                .filter(Boolean)
                                                .join(" · ")}
                                        </span>
                                    </span>
                                    <ExternalLink className="h-3.5 w-3.5 ml-auto shrink-0" />
                                </a>
                            ) : null}

                            {message.type === "ai" && message.ai?.sources?.length ? (
                                <div className="mt-1.5 flex flex-wrap gap-1">
                                    {message.ai.sources.slice(0, 3).map((src, index) => (
                                        <a
                                            key={`${src.url}-${index}`}
                                            href={src.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-[10px] rounded-full border border-violet-500/40 px-2 py-0.5 hover:bg-violet-500/10 max-w-[180px] truncate"
                                        >
                                            {src.title || src.url}
                                        </a>
                                    ))}
                                </div>
                            ) : null}

                            <div className={`mt-1 flex items-center gap-1 text-[10px] ${
                                mine ? "text-white/75 justify-end" : "text-muted-foreground"
                            }`}>
                                {message.type === "question" ? <HelpCircle className="h-3 w-3" /> : null}
                                {isAI && message.ai?.mode_label
                                    ? <span>{message.ai.mode_label} · </span>
                                    : null}
                                <span>{formatTime(message.created_at)}</span>
                                {mine ? (
                                    readCount > 0
                                        ? <CheckCheck className="h-3.5 w-3.5 text-sky-300" title={`Read by ${readCount}`} />
                                        : <Check className="h-3.5 w-3.5" title="Sent" />
                                ) : null}
                            </div>

                            {reactions.length ? (
                                <div className={`flex flex-wrap gap-1 mt-1 ${mine ? "justify-end" : ""}`}>
                                    {reactions.map(([emoji, users]) => (
                                        <button
                                            key={emoji}
                                            onClick={() => onReact?.(message, emoji)}
                                            className="text-[11px] rounded-full border border-border bg-background/90 px-1.5 py-0.5"
                                            title={`${users.length} reaction${users.length > 1 ? "s" : ""}`}
                                        >
                                            {emoji} {users.length}
                                        </button>
                                    ))}
                                </div>
                            ) : null}

                            {showReactions ? (
                                <div className={`absolute z-20 -top-9 ${
                                    mine ? "right-0" : "left-0"
                                } flex gap-1 rounded-full border border-border bg-background shadow-lg px-2 py-1`}>
                                    {QUICK_REACTIONS.map((emoji) => (
                                        <button
                                            key={emoji}
                                            onClick={() => {
                                                onReact?.(message, emoji);
                                                setShowReactions(false);
                                            }}
                                            className="text-base hover:scale-125 transition-transform"
                                        >
                                            {emoji}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </>
                    )}
                </div>

                {!deleted && (
                    <div className={`flex items-center gap-1 mt-0.5 ${mine ? "flex-row-reverse" : ""}`}>
                        <button
                            onClick={() => setShowReactions((v) => !v)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground"
                            title="React"
                        >
                            <Smile className="h-3.5 w-3.5" />
                        </button>
                        <button
                            onClick={() => onReply?.(message)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground"
                            title="Reply"
                        >
                            <Reply className="h-3.5 w-3.5" />
                        </button>
                        {onAskAI && !isAI ? (
                            <button
                                onClick={() => onAskAI(message)}
                                className="p-1 rounded hover:bg-secondary text-violet-500"
                                title="Ask GC AI about this"
                            >
                                <Sparkles className="h-3.5 w-3.5" />
                            </button>
                        ) : null}
                        <button
                            onClick={() => onDelete?.(message)}
                            className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                            title="Delete"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
