// components/studygroup/MembersPanel.jsx
import { useCallback, useEffect, useState } from "react";
import { API } from "../../lib/api";
import { authHeaders } from "../../lib/realtime";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import {
    UserPlus, Users, Check, X, Shield, Trash2,
} from "lucide-react";
import { toast } from "sonner";

function Initials(name) {
    return (name || "S").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function MemberRow({ member, onPromote, onMute, onRemove, me }) {
    const isMe = member?.user_id === me?.user_id;

    return (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 transition-colors hover:bg-secondary/30">
            <Avatar className="h-9 w-9">
                <AvatarImage src={member?.picture} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">{Initials(member?.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{member?.name || "Student"}</p>
                <p className="text-[11px] text-muted-foreground">{member?.role === "admin" ? "Group admin" : "Member"}</p>
            </div>
            {member?.online ? (
                <span className="flex h-2 w-2"><span className="relative flex h-full w-full"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" /><span className="relative rounded-full bg-green-500" /></span></span>
            ) : null}
            <div className="flex items-center gap-1">
                {!onPromote || member?.role === "admin" || isMe ? null : (
                    <button
                        onClick={() => onPromote(member?.user_id)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                        title="Promote to admin"
                    >
                        <Shield className="h-3.5 w-3.5" />
                    </button>
                )}
                {!onRemove || isMe ? null : (
                    <button
                        onClick={() => onRemove(member?.user_id)}
                        className="p-1.5 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                        title="Remove from group"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
export default function MembersPanel({ groupId, group, onUpdated }) {
    const [members, setMembers] = useState(group?.members || []);
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("members");
    const me = group?.members?.find(m => m.role === "admin") ?? null;

    const load = useCallback(async () => {
        if (!groupId) return;
        setLoading(true);
        try {
            const res = await fetch(`${API}/groups/${groupId}/requests`, { credentials: "include", headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setRequests(data?.requests || []);
            }
        } catch (err) {
            console.error("join requests failed:", err);
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => { load(); }, [load]);

    const handleDecide = useCallback(async (requestId, action) => {
        if (!groupId) return;
        try {
            const res = await fetch(`${API}/groups/${groupId}/requests/decide`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ request_id: requestId, action }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                toast.success(action === "accept" ? "Student joined the group" : "Request declined");
                setRequests((prev) => prev.filter(r => r.request_id !== requestId));
                onUpdated?.();
            } else {
                toast.error(data?.detail || "Decision failed");
            }
        } catch (err) {
            toast.error("Request failed");
        }
    }, [groupId, onUpdated]);

    const handlePromote = useCallback(async (userId) => {

    return (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full rounded-xl border border-border bg-card p-1.5 h-auto">
                <TabsTrigger value="members" className="flex-1 justify-center text-xs gap-1.5 px-3 py-2">
                    <Users className="h-3.5 w-3.5" /> {members.length} members
                </TabsTrigger>
                <TabsTrigger value="requests" className="flex-1 justify-center text-xs gap-1.5 px-3 py-2">
                    <UserPlus className="h-3.5 w-3.5" /> Requests ({requests.length})
                </TabsTrigger>
            </TabsList>

            <TabsContent value="members" className="mt-3 space-y-1.5">
                {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No members yet.</p>
                ) : (
                    members.map(m => <MemberRow key={m.user_id} member={m} onPromote={handlePromote} onRemove={handleRemove} me={me} />)
                )}
            </TabsContent>

            <TabsContent value="requests" className="mt-3 space-y-2">
                {requests.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-6 text-center">No pending join requests.</p>
                ) : (
                    requests.map(req => (
                        <div key={req.request_id} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-secondary/20">
                            <Avatar className="h-9 w-9 mt-0.5">
                                <AvatarImage src={req.picture} />
                                <AvatarFallback className="bg-primary/10 text-primary text-xs">{Initials(req.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium truncate">{req.name}</p>
                                    {req.level ? <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{req.level}</Badge> : null}
                                </div>
                                {req.message ? <p className="text-xs text-muted-foreground mt-0.5">{req.message}</p> : null}
                                <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(req.created_at).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <Button size="sm" variant="default" onClick={() => handleDecide(req.request_id, "accept")} className="h-8 gap-1 text-xs">
                                    <Check className="h-3 w-3" /> Accept
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handleDecide(req.request_id, "reject")} className="h-8 gap-1 text-xs text-muted-foreground">
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

        if (!groupId || userId === me?.user_id) return;
        try {
            const res = await fetch(`${API}/groups/${groupId}/members/${userId}/promote`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders(),
            });
            if (res.ok) {
                toast.success("Promoted to admin");
                setMembers((prev) => prev.map(m => m.user_id === userId ? { ...m, role: "admin" } : m));
                onUpdated?.();
            } else {
                toast.error("Could not promote that member");
            }
        } catch (err) {
            toast.error("Request failed");
        }
    }, [groupId, me, onUpdated]);

    const handleRemove = useCallback(async (userId) => {
        if (!groupId || userId === me?.user_id) return;
        if (!confirm("Remove this student from the group?")) return;
        try {
            const res = await fetch(`${API}/groups/${groupId}/members/${userId}`, {
                method: "DELETE",
                credentials: "include",
                headers: authHeaders(),
            });
            if (res.ok) {
                toast.success("Student removed from the group");
                setMembers((prev) => prev.filter(m => m.user_id !== userId));
                onUpdated?.();
            } else {
                toast.error("Could not remove that member");
            }
        } catch (err) {
            toast.error("Request failed");
        }
    }, [groupId, me, onUpdated]);

                )}
            </div>
        </div>
    );
}

