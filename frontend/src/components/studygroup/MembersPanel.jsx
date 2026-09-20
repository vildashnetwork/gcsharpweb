// components/studygroup/MembersPanel.jsx - group roster + join requests
import { useCallback, useEffect, useMemo, useState } from "react";
import { API } from "../../lib/api";
import { authHeaders } from "../../lib/realtime";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { UserPlus, Users, Check, X, Shield, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

function Initials(name) {
    return (name || "S").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function MemberRow({ member, online, isMe, onPromote, onRemove }) {
    return (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/30">
            <div className="relative shrink-0">
                <Avatar className="h-9 w-9">
                    <AvatarImage src={member?.picture} alt={member?.name || "Student"} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{Initials(member?.name)}</AvatarFallback>
                </Avatar>
                {online ? (
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-card" />
                    </span>
                ) : null}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                    {member?.name || "Student"}
                    {isMe ? <span className="font-normal text-muted-foreground"> (you)</span> : null}
                </p>
                <p className="text-[11px] text-muted-foreground">
                    {member?.role === "admin" ? "Group admin" : "Member"}
                    {member?.level ? ` - ${member.level}` : ""}
                </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
                {onPromote ? (
                    <button onClick={() => onPromote(member?.user_id)} title="Promote to admin"
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground">
                        <Shield className="h-3.5 w-3.5" />
                    </button>
                ) : null}
                {onRemove ? (
                    <button onClick={() => onRemove(member?.user_id)} title={isMe ? "Leave group" : "Remove from group"}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                ) : null}
            </div>
        </div>
    );
}

export default function MembersPanel({ groupId, group, onlineUsers, onUpdated, onClose }) {
    const gid = groupId || group?.group_id || group?.id;
    const [members, setMembers] = useState(group?.members || []);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [busyId, setBusyId] = useState("");
    const [activeTab, setActiveTab] = useState("members");

    const meId = useMemo(() => {
        try {
            const me = JSON.parse(localStorage.getItem("user") || "null");
            return me?.user_id || me?.id || me?._id || "";
        } catch {
            return "";
        }
    }, []);

    const isAdmin = group?.is_admin === true || members.some((m) => m.user_id === meId && m.role === "admin");

    const onlineSet = useMemo(
        () => new Set((onlineUsers || []).map((u) => (typeof u === "string" ? u : u?.user_id)).filter(Boolean)),
        [onlineUsers]
    );

    const load = useCallback(async () => {
        if (!gid) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/groups/${gid}/requests`, { credentials: "include", headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setRequests(data?.requests || []);
            }
        } catch (err) {
            console.error("join requests failed:", err);
        } finally {
            setLoading(false);
        }
    }, [gid]);

    useEffect(() => { load(); }, [load]);

    const decide = useCallback(async (requestId, action) => {
        if (!gid || busyId) return;
        setBusyId(requestId);
        try {
            const res = await fetch(`${API}/groups/${gid}/requests/decide`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ request_id: requestId, action }),
            });
            if (res.ok) {
                setRequests((prev) => prev.filter((r) => r.request_id !== requestId));
                toast.success(action === "accept" ? "Request accepted" : "Request declined");
                onUpdated?.();
            } else {
                let detail = "Could not update that request";
                try { detail = (await res.json())?.detail || detail; } catch { /* ignore */ }
                toast.error(detail);
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setBusyId("");
        }
    }, [gid, busyId, onUpdated]);

    const promote = useCallback(async (userId) => {
        if (!gid || userId === meId || busyId) return;
        setBusyId(userId);
        try {
            const res = await fetch(`${API}/groups/${gid}/members/${userId}/promote`, {
                method: "POST", credentials: "include", headers: authHeaders(),
            });
            if (res.ok) {
                setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: "admin" } : m)));
                toast.success("Promoted to admin");
                onUpdated?.();
            } else {
                toast.error("Could not promote that member");
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setBusyId("");
        }
    }, [gid, meId, busyId, onUpdated]);

    const remove = useCallback(async (userId) => {
        if (!gid || busyId) return;
        if (!window.confirm(userId === meId ? "Leave this group?" : "Remove this student from the group?")) return;
        setBusyId(userId);
        try {
            const res = await fetch(`${API}/groups/${gid}/members/${userId}`, {
                method: "DELETE", credentials: "include", headers: authHeaders(),
            });
            if (res.ok) {
                setMembers((prev) => prev.filter((m) => m.user_id !== userId));
                toast.success(userId === meId ? "You left the group" : "Student removed");
                onUpdated?.();
            } else {
                let detail = "Could not remove that member";
                try { detail = (await res.json())?.detail || detail; } catch { /* ignore */ }
                toast.error(detail);
            }
        } catch {
            toast.error("Network error. Please try again.");
        } finally {
            setBusyId("");
        }
    }, [gid, meId, busyId, onUpdated]);

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-3">
                <TabsList className="h-9">
                    <TabsTrigger value="members" className="gap-1.5 px-3 text-xs">
                        <Users className="h-3.5 w-3.5" /> Members
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">{members.length}</Badge>
                    </TabsTrigger>
                    <TabsTrigger value="requests" className="gap-1.5 px-3 text-xs">
                        <UserPlus className="h-3.5 w-3.5" /> Requests
                        {requests.length ? <Badge className="ml-1 h-5 px-1.5 text-[10px]">{requests.length}</Badge> : null}
                    </TabsTrigger>
                </TabsList>
                {onClose ? (
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2 text-muted-foreground">
                        <X className="h-4 w-4" />
                    </Button>
                ) : null}
            </div>

            <TabsContent value="members" className="mt-0 space-y-2">
                {members.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No members yet.</p>
                ) : (
                    members.map((m) => (
                        <MemberRow
                            key={m.user_id}
                            member={m}
                            isMe={m.user_id === meId}
                            online={Boolean(m.online) || onlineSet.has(m.user_id)}
                            onPromote={isAdmin && m.role !== "admin" ? promote : null}
                            onRemove={isAdmin || m.user_id === meId ? remove : null}
                        />
                    ))
                )}
            </TabsContent>

            <TabsContent value="requests" className="mt-0 space-y-2">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" /> Loading requests...
                    </div>
                ) : requests.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">No pending join requests.</p>
                ) : (
                    requests.map((req) => (
                        <div key={req.request_id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/20">
                            <Avatar className="h-9 w-9 mt-0.5">
                                <AvatarImage src={req.picture} alt={req.name || "Student"} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">{Initials(req.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">{req.name}</p>
                                    {req.level ? <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{req.level}</Badge> : null}
                                </div>
                                {req.message ? <p className="mt-0.5 text-xs text-muted-foreground">{req.message}</p> : null}
                                <p className="mt-0.5 text-[11px] text-muted-foreground">
                                    {req.created_at ? new Date(req.created_at).toLocaleString() : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="default" disabled={busyId === req.request_id}
                                    onClick={() => decide(req.request_id, "accept")} className="h-8 gap-1 text-xs">
                                    <Check className="h-3 w-3" /> Accept
                                </Button>
                                <Button size="sm" variant="outline" disabled={busyId === req.request_id}
                                    onClick={() => decide(req.request_id, "reject")} className="h-8 gap-1 text-xs text-muted-foreground">
                                    <X className="h-3 w-3" /> Decline
                                </Button>
                            </div>
                        </div>
                    ))
                )}
            </TabsContent>
        </Tabs>
    );
}