// components/AIKnowledgePanel.jsx
// The "GC AI Brain" panel: shows what GC AI knows, lets students search it,
// rate answers and teach it new facts. Everything lives in the app's own
// knowledge base (MongoDB collection gc_ai_knowledge).
import { useCallback, useEffect, useState } from "react";
import { API } from "../lib/api";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "./ui/select";
import {
    Brain, X, Search, Loader2, Trash2, ThumbsUp, ThumbsDown, BookOpen,
    Globe, Cpu, GraduationCap, Database, RefreshCw, Plus,
} from "lucide-react";

const SUBJECTS = [
    "General", "Mathematics", "Physics", "Chemistry", "Biology", "Economics",
    "English Language", "French", "Computer Science", "Geography", "History",
];

const SOURCE_META = {
    curated: { label: "Built-in", icon: BookOpen, tone: "text-emerald-500" },
    seed: { label: "Built-in", icon: BookOpen, tone: "text-emerald-500" },
    user_taught: { label: "Taught in-app", icon: GraduationCap, tone: "text-violet-500" },
    web: { label: "Learned from web", icon: Globe, tone: "text-sky-500" },
    web_reading: { label: "Read from web", icon: Globe, tone: "text-sky-500" },
    llm: { label: "Learned by reasoning", icon: Cpu, tone: "text-amber-500" },
    offline: { label: "Offline answer", icon: Brain, tone: "text-muted-foreground" },
    local: { label: "Offline tutor", icon: Brain, tone: "text-muted-foreground" },
    conversation: { label: "Learned in chat", icon: Brain, tone: "text-muted-foreground" },
};

/** Adds the session token so the panel works even when cookies are blocked. */
export function authHeaders(extra = {}) {
    const token = localStorage.getItem("session_token");
    return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function StatTile({ icon: Icon, label, value, hint }) {
    return (
        <div className="rounded-lg border border-border bg-card p-3">
            <div className="flex items-center gap-2 text-muted-foreground text-xs">
                <Icon className="h-3.5 w-3.5" />
                <span>{label}</span>
            </div>
            <p className="mt-1 text-lg font-semibold leading-tight">{value}</p>
            {hint ? <p className="text-[11px] text-muted-foreground truncate" title={hint}>{hint}</p> : null}
        </div>
    );
}

function SourceTag({ source, url }) {
    const meta = SOURCE_META[source]
        || { label: source || "Learned", icon: Brain, tone: "text-muted-foreground" };
    const Icon = meta.icon;
    const content = (
        <span className={`inline-flex items-center gap-1 text-[11px] ${meta.tone}`}>
            <Icon className="h-3 w-3" />
            {meta.label}
        </span>
    );
    if (!url) return content;
    return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {content}
        </a>
    );
}

function MemoryCard({ item, onFeedback, onForget, showScore = false }) {
    const [expanded, setExpanded] = useState(false);
    return (
        <div className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <button className="w-full text-left" onClick={() => setExpanded((v) => !v)}>
                <p className="text-sm font-medium">{item.question}</p>
                <p className={`text-xs text-muted-foreground ${expanded ? "" : "line-clamp-2"}`}>
                    {item.answer}
                </p>
            </button>
            <div className="flex items-center gap-2 flex-wrap">
                <SourceTag source={item.source} url={item.source_url} />
                <span className="text-[11px] text-muted-foreground">
                    {item.subject}{showScore && item.score != null ? ` · score ${item.score}` : ""}
                </span>
                <div className="ml-auto flex items-center gap-1">
                    <button
                        onClick={() => onFeedback?.(item.entry_id, true)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-emerald-500"
                        title="Correct and helpful"
                    >
                        <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => onFeedback?.(item.entry_id, false)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                        title="Wrong or unhelpful"
                    >
                        <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={() => onForget?.(item.entry_id)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                        title="Forget this memory"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
}

function TeachForm({ onSaved }) {
    const [open, setOpen] = useState(false);
    const [subject, setSubject] = useState("General");
    const [question, setQuestion] = useState("");
    const [answer, setAnswer] = useState("");
    const [status, setStatus] = useState("");
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        if (question.trim().length < 3 || answer.trim().length < 8) {
            setStatus("Give GC AI a question and a proper answer first.");
            return;
        }
        setSaving(true);
        setStatus("");
        try {
            const res = await fetch(`${API}/ai/brain/teach`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ question: question.trim(), answer: answer.trim(), subject }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                setStatus("Saved. GC AI will remember this permanently.");
                setQuestion("");
                setAnswer("");
                onSaved?.(data.entry);
            } else {
                setStatus(data.detail || "GC AI could not store that. Try again.");
            }
        } catch (err) {
            console.error("GC AI teach failed:", err);
            setStatus("GC AI could not store that. Check your connection.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-lg border border-border">
            <button
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-sm font-medium hover:bg-secondary rounded-lg"
            >
                <Plus className="h-4 w-4 text-primary" />
                Teach GC AI something
            </button>
            {open && (
                <div className="px-3 pb-3 space-y-2">
                    <Input
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        placeholder="Question, e.g. What is the formula for density?"
                        className="text-sm"
                    />
                    <Textarea
                        value={answer}
                        onChange={(e) => setAnswer(e.target.value)}
                        placeholder="The correct answer GC AI must remember..."
                        rows={4}
                        className="text-sm"
                    />
                    <div className="flex items-center gap-2">
                        <Select value={subject} onValueChange={setSubject}>
                            <SelectTrigger className="w-40 h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Button onClick={submit} disabled={saving} size="sm" className="ml-auto">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                        </Button>
                    </div>
                    {status ? <p className="text-[11px] text-muted-foreground">{status}</p> : null}
                </div>
            )}
        </div>
    );
}

export default function AIKnowledgePanel({ open, onClose, onTeach }) {
    const [stats, setStats] = useState(null);
    const [recent, setRecent] = useState([]);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState("");

    const loadStats = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [statsRes, recentRes] = await Promise.all([
                fetch(`${API}/ai/brain/stats`, { credentials: "include", headers: authHeaders() }),
                fetch(`${API}/ai/brain/recent?limit=15`, { credentials: "include", headers: authHeaders() }),
            ]);
            if (statsRes.ok) {
                setStats(await statsRes.json());
            } else {
                setError("GC AI diagnostics are unavailable right now.");
            }
            if (recentRes.ok) {
                const data = await recentRes.json();
                setRecent(data.recent || []);
            }
        } catch (err) {
            console.error("Failed to load GC AI brain stats:", err);
            setError("Could not reach GC AI. Check your connection and retry.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (open) loadStats();
    }, [open, loadStats]);

    const runSearch = useCallback(async (value) => {
        const q = (value ?? query).trim();
        if (!q) {
            setResults([]);
            return;
        }
        setSearching(true);
        try {
            const res = await fetch(
                `${API}/ai/brain/search?q=${encodeURIComponent(q)}&limit=12`,
                { credentials: "include", headers: authHeaders() }
            );
            if (res.ok) {
                const data = await res.json();
                setResults(data.results || []);
            }
        } catch (err) {
            console.error("GC AI brain search failed:", err);
        } finally {
            setSearching(false);
        }
    }, [query]);

    const sendFeedback = async (entryId, helpful) => {
        try {
            await fetch(`${API}/ai/brain/feedback`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ entry_id: entryId, helpful }),
            });
            await loadStats();
        } catch (err) {
            console.error("GC AI feedback failed:", err);
        }
    };

    const forget = async (entryId) => {
        try {
            await fetch(`${API}/ai/brain/${entryId}`, {
                method: "DELETE",
                credentials: "include",
                headers: authHeaders(),
            });
            setResults((prev) => prev.filter((item) => item.entry_id !== entryId));
            setRecent((prev) => prev.filter((item) => item.entry_id !== entryId));
            await loadStats();
        } catch (err) {
            console.error("GC AI forget failed:", err);
        }
    };

    if (!open) return null;

    const knowledge = stats?.knowledge || {};
    const search = stats?.search || {};
    const providers = stats?.providers || {};
    const learning = stats?.learning || {};
    const llmHint = (providers.available || []).join(", ") || "none configured";

    return (
        <>
            <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} />
            <aside className="fixed right-0 top-0 z-40 h-full w-full sm:w-[26rem] bg-background border-l border-border flex flex-col shadow-xl">
                <div className="p-4 border-b border-border flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    <div className="flex-1 min-w-0">
                        <h2 className="font-display font-bold leading-tight">GC AI Brain</h2>
                        <p className="text-[11px] text-muted-foreground truncate">
                            Everything GC AI has learned and remembers
                        </p>
                    </div>
                    <button
                        onClick={loadStats}
                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Close"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {error ? (
                        <p className="text-xs text-destructive rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                            {error}
                        </p>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2">
                        <StatTile
                            icon={Database}
                            label="Memories stored"
                            value={knowledge.memories ?? "—"}
                            hint={knowledge.storage === "mongodb" ? "saved permanently" : "in memory"}
                        />
                        <StatTile
                            icon={Search}
                            label="Recall accuracy"
                            value={knowledge.hit_rate != null ? `${Math.round(knowledge.hit_rate * 100)}%` : "—"}
                            hint={`${knowledge.retrieval_hits ?? 0} hits / ${knowledge.retrieval_misses ?? 0} misses`}
                        />
                        <StatTile
                            icon={Globe}
                            label="Learned from web"
                            value={learning.learned_from_web ?? 0}
                            hint={search.google_configured ? "Google search enabled" : "DuckDuckGo + Wikipedia"}
                        />
                        <StatTile
                            icon={Cpu}
                            label="AI providers live"
                            value={(providers.available || []).length}
                            hint={llmHint}
                        />
                    </div>

                    <TeachForm
                        onSaved={() => {
                            loadStats();
                            if (query.trim()) runSearch(query);
                        }}
                    />

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && runSearch()}
                                placeholder="Search GC AI's memory..."
                                className="text-sm"
                            />
                            <Button size="icon" variant="secondary" onClick={() => runSearch()}>
                                {searching
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Search className="h-4 w-4" />}
                            </Button>
                        </div>

                        {results.map((item) => (
                            <MemoryCard
                                key={item.entry_id}
                                item={item}
                                showScore
                                onFeedback={sendFeedback}
                                onForget={forget}
                            />
                        ))}

                        {!searching && query.trim() && results.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Nothing stored for that yet. Ask GC AI in the chat and it will
                                search the web, learn it and store it here.
                            </p>
                        ) : null}
                    </div>

                    {recent.length > 0 && (
                        <div className="space-y-2">
                            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                Recently learned
                            </h3>
                            {recent.map((item) => (
                                <MemoryCard
                                    key={item.entry_id}
                                    item={item}
                                    onFeedback={sendFeedback}
                                    onForget={forget}
                                />
                            ))}
                        </div>
                    )}

                    {knowledge.memories === 0 && !loading ? (
                        <p className="text-xs text-muted-foreground">
                            GC AI is still filling its knowledge base. Ask it something in the chat
                            and it will start learning immediately.
                        </p>
                    ) : null}
                </div>

                <div className="p-3 border-t border-border text-[11px] text-muted-foreground">
                    {knowledge.memories ?? 0} stored memories · {search.providers?.length ?? 0} web
                    search providers · {providers.configured?.length ?? 0} AI providers ·{" "}
                    {learning.web_fallbacks_used ?? 0} web fallbacks used
                </div>
            </aside>
        </>
    );
}
