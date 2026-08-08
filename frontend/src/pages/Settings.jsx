import { useState } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Moon, Sun, LogOut } from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];

export default function Settings() {
    const { user, setUser, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const [form, setForm] = useState({
        bio: user?.bio || "", institution: user?.institution || "", exam_level: user?.exam_level || "",
    });
    const [saving, setSaving] = useState(false);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const initials = (user?.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

    const save = async () => {
        setSaving(true);
        try {
            const { data } = await api.put("/auth/profile", form);
            setUser(data);
            toast.success("Profile updated");
        } catch {
            toast.error("Could not save");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-display font-bold">Settings</h1>
                <p className="text-muted-foreground">Manage your profile and preferences.</p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-4 mb-6">
                    <Avatar className="h-16 w-16 border border-border">
                        <AvatarImage src={user?.picture} />
                        <AvatarFallback className="bg-primary text-white text-lg">{initials}</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="font-display font-semibold text-lg">{user?.name}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-accent text-primary capitalize">{user?.role}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {user?.role !== "teacher" && (
                        <div className="space-y-2">
                            <Label>Exam level</Label>
                            <Select value={form.exam_level} onValueChange={(v) => set("exam_level", v)}>
                                <SelectTrigger data-testid="settings-level"><SelectValue placeholder="Level" /></SelectTrigger>
                                <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-2"><Label>Institution</Label><Input data-testid="settings-institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} /></div>
                    <div className="space-y-2"><Label>Bio</Label><Textarea data-testid="settings-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} /></div>
                    <Button onClick={save} disabled={saving} data-testid="save-profile-btn" className="shadow-glow">{saving ? "Saving…" : "Save Changes"}</Button>
                </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-between">
                <div>
                    <p className="font-semibold">Appearance</p>
                    <p className="text-sm text-muted-foreground">Switch between light and dark theme.</p>
                </div>
                <button onClick={toggle} data-testid="settings-theme-toggle"
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 hover:bg-secondary transition-colors">
                    {theme === "dark" ? <><Sun className="h-4 w-4" /> Light</> : <><Moon className="h-4 w-4" /> Dark</>}
                </button>
            </div>

            <div className="rounded-xl border border-destructive/30 bg-card p-6 flex items-center justify-between">
                <div>
                    <p className="font-semibold">Sign out</p>
                    <p className="text-sm text-muted-foreground">End your session on this device.</p>
                </div>
                <Button variant="destructive" onClick={logout} data-testid="settings-logout" className="gap-2"><LogOut className="h-4 w-4" /> Logout</Button>
            </div>
        </div>
    );
}
