// components/studygroup/PaperPicker.jsx
// Attach a past paper to the group chat. Shows what the group already shares
// plus papers that match the group's exam level and subject.
import { useCallback, useEffect, useState } from "react";
import { API } from "../../lib/api";
import { authHeaders } from "../../lib/realtime";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { FileText, Loader2, Search, Share2, X } from "lucide-react";

export default function PaperPicker({ groupId, onClose, onShared }) {
    const [tab, setTab] = useState("available");
    const [shared, setShared] = useState([]);
    const [available, setAvailable] = useState([]);
    const [query, setQuery] = useState("");
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [note, setNote] = useState("");
    const [sending, setSending] = useState(false);

    const load = useCallback(async (search = "") => {
        setLoading(true);
        try {
            const url = `${API}/groups/${groupId}/papers${search ? `?q=${encodeURIComponent(search)}` : ""}`;
            const res = await fetch(url, { credentials: "include", headers: authHeaders() });
            if (res.ok) {
                const data = await res.json();
                setShared(data.shared || []);
                setAvailable(data.available || []);
            }
        } catch (err) {
            console.error("paper shelf failed:", err);
        } finally {
            setLoading(false);
        }
    }, [groupId]);

    useEffect(() => { load(); }, [load]);

    const share = async () => {
        if (!selected) return;
        setSending(true);
        try {
            const url = `${API}/groups/${groupId}/papers/${selected.paper_id}`
                + (note.trim() ? `?note=${encodeURIComponent(note.trim())}` : "");
            const res = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: authHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) {
                onShared?.(data.message);
                onClose?.();
            }
        } catch (err) {
            console.error("paper share failed:", err);
        } finally {
            setSending(false);
        }
    };

    const list = tab === "shared" ? shared : available;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
            <div className="w-full sm:max-w-lg max-h-[85vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-border bg-background">
                <div className="flex items-center gap-2 p-4 border-b border-border">
                    <FileText className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold flex-1">Share a past paper</h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-secondary">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="px-4 pt-3 flex gap-2">
                    <button
                        onClick={() => setTab("available")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                            tab === "available" ? "bg-primary text-white" : "border border-border hover:bg-secondary"
                        }`}
                    >
                        For this group ({available.length})
                    </button>
                    <button
                        onClick={() => setTab("shared")}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                            tab === "shared" ? "bg-primary text-white" : "border border-border hover:bg-secondary"
                        }`}
                    >
                        Already shared ({shared.length})
                    </button>
                </div>

                <div className="p-4 flex gap-2">
                    <Input
                        value={query}
                        placeholder="Search papers..."
                        onChange={(event) => setQuery(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && load(query)}
                        className="text-sm"
                    />
                    <Button size="icon" variant="secondary" onClick={() => load(query)}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-2">
                    {list.length === 0 && !loading ? (
                        <p className="text-xs text-muted-foreground py-6 text-center">
                            No papers found here yet. Try another search.
                        </p>
                    ) : null}
                    {list.map((paper) => (
                        <button
                            key={paper.paper_id}
                            onClick={() => setSelected(paper)}
                            className={`w-full text-left rounded-lg border p-3 transition-colors ${
                                selected?.paper_id === paper.paper_id
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:bg-secondary"
                            }`}
                        >
                            <p className="text-sm font-medium truncate">{paper.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                                {[paper.level, paper.subject, paper.year,
                                  paper.paper_number ? `Paper ${paper.paper_number}` : ""]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                            {paper.shared_by ? (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    shared by {paper.shared_by}
                                </p>
                            ) : null}
                        </button>
                    ))}
                </div>

                {selected ? (
                    <div className="p-4 border-t border-border space-y-2">
                        <Textarea
                            value={note}
                            rows={2}
                            placeholder={`Say something about "${selected.title}" (optional)`}
                            onChange={(event) => setNote(event.target.value)}
                            className="text-sm"
                        />
                        <Button onClick={share} disabled={sending} className="w-full gap-2">
                            {sending
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <Share2 className="h-4 w-4" />}
                            Share to group
                        </Button>
                    </div>
                ) : null}

            </div>
        </div>
    );
}
