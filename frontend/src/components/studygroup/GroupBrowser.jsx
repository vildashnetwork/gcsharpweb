// components/studygroup/GroupBrowser.jsx
// Landing screen for Study Groups: the groups you belong to, a discovery
// search so you can join classmates, and a quick create form.
// Route map (see App.js): /groups -> this browser, /groups/create -> the same
// browser with the create form open, /groups/:groupId -> the chat itself.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API } from "../../lib/api";
import { authHeaders } from "../../lib/realtime";
import { Avatar, AvatarFallback } from "../ui/avatar";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
    ArrowLeft, Check, Loader2, MessageSquare, Plus, Search, UserPlus, Users, X,
} from "lucide-react";
import { toast } from "sonner";

const EMOJI_CHOICES = ["📚", "🧮", "🧪", "📐", "🌍", "💻", "✍️", "🏆"];

const EMPTY_FORM = {
    name: "",
    subject: "",
    description: "",
    emoji: "📚",
    join_policy: "request",
    max_members: 30,
};

async function readJson(res) {
    try {
        return await res.json();
    } catch {
        return null;
    }
}

function errorDetail(data, fallback) {
    return typeof data?.detail === "string" && data.detail ? data.detail : fallback;
}

function lastPreview(message) {
    if (!message) return "No messages yet - say hello 👋";
    const kind = message.type;
    const text = (message.text || "").trim()
        || (kind === "paper" ? "Shared a paper"
            : kind === "voice" ? "Sent a voice note"
                : kind === "ai" ? "GC AI answered a question"
                    : kind === "system" ? (message.text || "") : "Sent an attachment");
    return message?.sender_name ? `${message.sender_name}: ${text}` : text;
}

export default function GroupBrowser({ createMode = false }) {
    const navigate = useNavigate();
    const [mine, setMine] = useState([]);
    const [loadingMine, setLoadingMine] = useState(true);
    const [discover, setDiscover] = useState([]);
    const [level, setLevel] = useState("");
    const [query, setQuery] = useState("");
    const [loadingDiscover, setLoadingDiscover] = useState(false);
    const [showCreate, setShowCreate] = useState(createMode);
    const [busyId, setBusyId] = useState("");
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState(EMPTY_FORM);

    // /groups/create is the same screen with the form already open.
    useEffect(() => {
        if (createMode) setShowCreate(true);
    }, [createMode]);

    const loadMine = useCallback(async () => {
        setLoadingMine(true);
        try {
            const res = await fetch(`${API}/groups`, { credentials: "include", headers: authHeaders() });
            if (res.ok) setMine((await readJson(res))?.groups || []);
        } catch (err) {
            console.error("load my groups failed:", err);
        } finally {
            setLoadingMine(false);
        }
    }, []);

    const loadDiscover = useCallback(async (search) => {
        setLoadingDiscover(true);
        try {
            const res = await fetch(
                `${API}/groups/discover?q=${encodeURIComponent(search || "")}`,
                { credentials: "include", headers: authHeaders() },
            );
            if (res.ok) {
                const data = await readJson(res);
                setDiscover(data?.groups || []);
                setLevel(data?.level || "");
            }
        } catch (err) {
            console.error("discover groups failed:", err);
        } finally {
            setLoadingDiscover(false);
        }
    }, []);

    useEffect(() => { loadMine(); }, [loadMine]);

    // Debounced so typing does not hammer the discover endpoint.
    useEffect(() => {
        const timer = setTimeout(() => loadDiscover(query.trim()), 350);
        return () => clearTimeout(timer);
    }, [query, loadDiscover]);

    const openGroup = useCallback((groupId) => {
        if (groupId) navigate(`/groups/${groupId}`);
    }, [navigate]);

    const set = useCallback((key, value) => setForm((prev) => ({ ...prev, [key]: value })), []);

    const join = useCallback(async (group) => {
        if (!group?.group_id || busyId) return;
        setBusyId(group.group_id);
        try {
            const res = await fetch(`${API}/groups/${group.group_id}/join`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({}),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(errorDetail(data, "Could not join that group"));
                return;
            }
            if (data?.joined) {
                toast.success(`Welcome to ${group.name || "the group"}`);
                openGroup(group.group_id);
                return;
            }
            toast.success("Request sent — a group admin will review it.");
            setDiscover((prev) => prev.map((g) => (g.group_id === group.group_id ? { ...g, requested: true } : g)));
        } catch (err) {
            console.error("join group failed:", err);
            toast.error("Could not reach the groups service");
        } finally {
            setBusyId("");
        }
    }, [busyId, openGroup]);

    const create = useCallback(async (event) => {
        event.preventDefault();
        const name = form.name.trim();
        if (name.length < 3) {
            toast.error("Give the group a name of at least 3 characters");
            return;
        }
        setSaving(true);
        try {
            const res = await fetch(`${API}/groups`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({
                    name,
                    subject: form.subject.trim() || "General",
                    description: form.description.trim(),
                    emoji: form.emoji,
                    join_policy: form.join_policy,
                    max_members: Number(form.max_members) || 30,
                }),
            });
            const data = await readJson(res);
            if (!res.ok) {
                toast.error(errorDetail(data, "Could not create that group"));
                return;
            }
            toast.success(`${data?.name || "Your group"} is ready`);
            setForm(EMPTY_FORM);
            setShowCreate(false);
            if (data?.group_id) openGroup(data.group_id);
            else loadMine();
        } catch (err) {
            console.error("create group failed:", err);
            toast.error("Could not reach the groups service");
        } finally {
            setSaving(false);
        }
    }, [form, loadMine, openGroup]);

    return (
        <div className="flex flex-col gap-5 pb-4">
            <header className="flex flex-wrap items-center gap-3">
                {createMode ? (
                    <button
                        onClick={() => navigate("/groups")}
                        title="Back to groups"
                        className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                ) : null}
                <div className="min-w-0">
                    <h2 className="text-base font-semibold">Study Groups</h2>
                    <p className="text-xs text-muted-foreground">
                        {level
                            ? `Groups shown are for ${level} students`
                            : "Chat with classmates, share papers and ask GC AI together."}
                    </p>
                </div>
                <Button
                    size="sm"
                    className="ml-auto gap-1.5"
                    onClick={() => setShowCreate((open) => !open)}
                    data-testid="create-group-btn"
                >
                    {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {showCreate ? "Close" : "New group"}
                </Button>
            </header>

            {showCreate ? (
                <form onSubmit={create} className="space-y-3 rounded-2xl border border-border bg-card p-4">
                    <div className="flex flex-wrap gap-2">
                        {EMOJI_CHOICES.map((emoji) => (
                            <button
                                key={emoji}
                                type="button"
                                onClick={() => set("emoji", emoji)}
                                title="Group icon"
                                className={`h-9 w-9 rounded-lg border text-base transition-colors ${form.emoji === emoji
                                    ? "border-primary bg-primary/10"
                                    : "border-border hover:bg-secondary"}`}
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                    <Input
                        value={form.name}
                        onChange={(event) => set("name", event.target.value)}
                        placeholder="Group name - e.g. A-Level Maths Paper 2"
                        maxLength={60}
                        data-testid="group-name-input"
                    />
                    <Input
                        value={form.subject}
                        onChange={(event) => set("subject", event.target.value)}
                        placeholder="Subject (optional, defaults to General)"
                        maxLength={60}
                    />
                    <Textarea
                        value={form.description}
                        onChange={(event) => set("description", event.target.value)}
                        placeholder="What is this group about? (optional)"
                        maxLength={400}
                        rows={2}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {[
                            { value: "request", label: "Ask to join" },
                            { value: "open", label: "Anyone can join" },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => set("join_policy", option.value)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${form.join_policy === option.value
                                    ? "border-primary text-primary"
                                    : "border-border text-muted-foreground hover:bg-secondary"}`}
                            >
                                {form.join_policy === option.value ? <Check className="h-3 w-3" /> : null}
                                {option.label}
                            </button>
                        ))}
                        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                            Max members
                            <Input
                                type="number"
                                min={2}
                                max={100}
                                value={form.max_members}
                                onChange={(event) => set("max_members", event.target.value)}
                                className="h-8 w-20"
                            />
                        </label>
                    </div>
                    <Button type="submit" disabled={saving} className="gap-2" data-testid="group-create-submit">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                        Create group
                    </Button>
                </form>
            ) : null}

            <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your groups</h3>
                {loadingMine ? (
                    <Hint loading>Your groups are loading...</Hint>
                ) : mine.length === 0 ? (
                    <Hint
                        icon={<MessageSquare className="h-5 w-5" />}
                        title="You are not in a study group yet"
                        text="Create one above, or join a classmate's group below."
                    />
                ) : (
                    <ul className="space-y-2">
                        {mine.map((group) => (
                            <li key={group.group_id}>
                                <GroupRow group={group} unread={group.unread || 0} onOpen={() => openGroup(group.group_id)} />
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Discover</h3>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder="Search groups by name, subject or description"
                        className="pl-9"
                        data-testid="group-search"
                    />
                </div>
                {loadingDiscover ? (
                    <Hint loading>Looking for groups...</Hint>
                ) : discover.length === 0 ? (
                    <Hint
                        icon={<Users className="h-5 w-5" />}
                        title="No groups to join right now"
                        text="Groups at your exam level appear here as soon as classmates create them."
                    />
                ) : (
                    <ul className="space-y-2">
                        {discover.map((group) => (
                            <li key={group.group_id}>
                                <GroupRow
                                    group={group}
                                    busy={busyId === group.group_id}
                                    onJoin={group.requested || group.full ? null : () => join(group)}
                                    joinLabel={group.requested
                                        ? "Requested"
                                        : group.full ? "Full" : group.join_policy === "open" ? "Join" : "Request"}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </div>
    );
}

// One group row: the button area opens the chat, discover results add a join
// action next to it.
function GroupRow({ group, unread = 0, busy = false, onJoin = null, joinLabel = "Join", onOpen = null }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:border-primary/50">
            <button
                type="button"
                onClick={onOpen}
                disabled={!onOpen}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
            >
                <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-secondary text-base">{group.emoji || "📚"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-semibold">{group.name || "Study group"}</span>
                        {unread > 0 ? (
                            <Badge className="h-5 shrink-0 bg-primary px-1.5 text-[10px] text-primary-foreground">
                                {unread > 99 ? "99+" : unread}
                            </Badge>
                        ) : null}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                        {onOpen ? lastPreview(group.last_message) : group.description || "Tap join to start chatting"}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Users className="h-3 w-3" />
                        {group.member_count || 1}{group.max_members ? `/${group.max_members}` : ""}
                        {group.subject ? ` · ${group.subject}` : ""}
                    </p>
                </div>
            </button>
            {onJoin ? (
                <Button
                    size="sm"
                    variant={joinLabel === "Join" ? "default" : "outline"}
                    disabled={busy}
                    onClick={onJoin}
                    className="shrink-0 gap-1.5"
                >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                    {joinLabel}
                </Button>
            ) : null}
        </div>
    );
}

// Small inline loading / empty notice used by both sections above.
function Hint({ loading = false, icon = null, title = "", text = "", children }) {
    return (
        <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-4 text-muted-foreground">
            {loading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : icon}
            <div className="min-w-0">
                {title ? <p className="text-sm font-medium text-foreground">{title}</p> : null}
                <p className="text-xs">{children || text}</p>
            </div>
        </div>
    );
}
