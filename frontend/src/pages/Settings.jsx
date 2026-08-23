// import { useState } from "react";
// import api from "../lib/api";
// import { useAuth } from "../context/AuthContext";
// import { useTheme } from "../context/ThemeContext";
// import { Button } from "../components/ui/button";
// import { Input } from "../components/ui/input";
// import { Textarea } from "../components/ui/textarea";
// import { Label } from "../components/ui/label";
// import { Avatar, AvatarFallback, AvatarImage } from "../components/ui/avatar";
// import {
//     Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "../components/ui/select";
// import { Moon, Sun, LogOut } from "lucide-react";
// import { toast } from "sonner";

// const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];

// export default function Settings() {
//     const { user, setUser, logout } = useAuth();
//     const { theme, toggle } = useTheme();
//     const [form, setForm] = useState({
//         bio: user?.bio || "", institution: user?.institution || "", exam_level: user?.exam_level || "",
//     });
//     const [saving, setSaving] = useState(false);
//     const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
//     const initials = (user?.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

//     const save = async () => {
//         setSaving(true);
//         try {
//             const { data } = await api.put("/auth/profile", form);
//             setUser(data);
//             toast.success("Profile updated");
//         } catch {
//             toast.error("Could not save");
//         } finally {
//             setSaving(false);
//         }
//     };

//     return (
//         <div className="max-w-2xl mx-auto space-y-6">
//             <div>
//                 <h1 className="text-3xl font-display font-bold">Settings</h1>
//                 <p className="text-muted-foreground">Manage your profile and preferences.</p>
//             </div>

//             <div className="rounded-xl border border-border bg-card p-6">
//                 <div className="flex items-center gap-4 mb-6">
//                     <Avatar className="h-16 w-16 border border-border">
//                         <AvatarImage src={user?.picture} />
//                         <AvatarFallback className="bg-primary text-white text-lg">{initials}</AvatarFallback>
//                     </Avatar>
//                     <div>
//                         <p className="font-display font-semibold text-lg">{user?.name}</p>
//                         <p className="text-sm text-muted-foreground">{user?.email}</p>
//                         <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-accent text-primary capitalize">{user?.role}</span>
//                     </div>
//                 </div>

//                 <div className="space-y-4">
//                     {user?.role !== "teacher" && (
//                         <div className="space-y-2">
//                             <Label>Exam level</Label>
//                             <Select value={form.exam_level} onValueChange={(v) => set("exam_level", v)}>
//                                 <SelectTrigger data-testid="settings-level"><SelectValue placeholder="Level" /></SelectTrigger>
//                                 <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                             </Select>
//                         </div>
//                     )}
//                     <div className="space-y-2"><Label>Institution</Label><Input data-testid="settings-institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} /></div>
//                     <div className="space-y-2"><Label>Bio</Label><Textarea data-testid="settings-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} /></div>
//                     <Button onClick={save} disabled={saving} data-testid="save-profile-btn" className="shadow-glow">{saving ? "Saving…" : "Save Changes"}</Button>
//                 </div>
//             </div>

//             <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-between">
//                 <div>
//                     <p className="font-semibold">Appearance</p>
//                     <p className="text-sm text-muted-foreground">Switch between light and dark theme.</p>
//                 </div>
//                 <button onClick={toggle} data-testid="settings-theme-toggle"
//                     className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 hover:bg-secondary transition-colors">
//                     {theme === "dark" ? <><Sun className="h-4 w-4" /> Light</> : <><Moon className="h-4 w-4" /> Dark</>}
//                 </button>
//             </div>

//             <div className="rounded-xl border border-destructive/30 bg-card p-6 flex items-center justify-between">
//                 <div>
//                     <p className="font-semibold">Sign out</p>
//                     <p className="text-sm text-muted-foreground">End your session on this device.</p>
//                 </div>
//                 <Button variant="destructive" onClick={logout} data-testid="settings-logout" className="gap-2"><LogOut className="h-4 w-4" /> Logout</Button>
//             </div>
//         </div>
//     );
// }





















// pages/Settings.jsx
import { useState, useRef } from "react";
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
import { Moon, Sun, LogOut, Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];
const DAILY_COMMITMENTS = [
    { label: "15 mins", value: "15 mins" },
    { label: "30 mins", value: "30 mins" },
    { label: "45 mins", value: "45 mins" },
    { label: "1 hour", value: "1 hour" },
    { label: "2 hours", value: "2 hours" },
];

export default function Settings() {
    const { user, setUser, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({
        name: user?.full_name || "",
        bio: user?.bio || "",
        institution: user?.institution || "",
        exam_level: user?.exam_level || "",
        daily_commitment: user?.daily_commitment || "1 hour",
        picture: user?.picture || "",
    });
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [preview, setPreview] = useState(user?.picture || "");

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

    const initials = (form.full_name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

    // Cloudinary config (use your cloud name and unsigned preset)
    const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || "qsmemy5r";
    const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "gcsharp";

    const uploadToCloudinary = async (file) => {
        if (!file) return;
        // Validate file type
        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file.");
            return;
        }
        if (file.size > 5 * 1024 * 1024) { // 5MB
            toast.error("Image size should be less than 5MB.");
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", UPLOAD_PRESET);

        try {
            const response = await fetch(
                `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
                { method: "POST", body: formData }
            );
            const data = await response.json();
            if (data.secure_url) {
                const url = data.secure_url;
                setPreview(url);
                set("picture", url);
                toast.success("Profile picture uploaded!");
                return url;
            } else {
                throw new Error(data.error?.message || "Upload failed");
            }
        } catch (error) {
            console.error("Cloudinary upload error:", error);
            toast.error("Failed to upload image. Please try again.");
            return null;
        } finally {
            setUploading(false);
        }
    };

    const handleFileChange = async (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = await uploadToCloudinary(file);
            if (url) {
                set("picture", url);
                // Optionally save immediately after upload? We'll let user click Save.
            }
        }
        e.target.value = ""; // reset input
    };

    const save = async () => {
        setSaving(true);
        try {
            const payload = {
                name: form.full_name,
                bio: form.bio,
                institution: form.institution,
                exam_level: form.exam_level,
                daily_commitment: form.daily_commitment,
                picture: form.picture,
            };
            const { data } = await api.put("/auth/profile", payload);
            setUser(data);
            toast.success("Profile updated");
        } catch (err) {
            console.error(err);
            toast.error("Could not save changes");
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
                {/* Avatar with upload */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative group">
                        <Avatar className="h-20 w-20 border-2 border-border cursor-pointer hover:opacity-80 transition-opacity">
                            <AvatarImage src={preview || form.picture} />
                            <AvatarFallback className="bg-primary text-white text-xl">{initials}</AvatarFallback>
                        </Avatar>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 shadow-md hover:bg-primary/90 transition-colors"
                            disabled={uploading}
                            title="Change profile picture"
                        >
                            {uploading ? (
                                <Loader2 className="h-4 w-4 text-white animate-spin" />
                            ) : (
                                <Camera className="h-4 w-4 text-white" />
                            )}
                        </button>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                    </div>
                    <div>
                        <p className="font-display font-semibold text-lg">{form.full_name}</p>
                        <p className="text-sm text-muted-foreground">{user?.email}</p>
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-accent text-primary capitalize">{user?.role}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* Full Name */}
                    <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                            id="name"
                            data-testid="settings-name"
                            value={form.full_name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="Your full name"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="institution">Institution</Label>
                        <Input
                            id="institution"
                            data-testid="settings-institution"
                            value={form.institution}
                            onChange={(e) => set("institution", e.target.value)}
                            placeholder="School or university"
                        />
                    </div>

                    {user?.role !== "teacher" && (
                        <div className="space-y-2">
                            <Label>Exam Level</Label>
                            <Select value={form.exam_level} onValueChange={(v) => set("exam_level", v)}>
                                <SelectTrigger data-testid="settings-level">
                                    <SelectValue placeholder="Select your level" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Daily Study Goal</Label>
                        <Select value={form.daily_commitment} onValueChange={(v) => set("daily_commitment", v)}>
                            <SelectTrigger data-testid="settings-daily-commitment">
                                <SelectValue placeholder="Select your daily goal" />
                            </SelectTrigger>
                            <SelectContent>
                                {DAILY_COMMITMENTS.map((c) => (
                                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">This determines your daily streak target.</p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="bio">Bio</Label>
                        <Textarea
                            id="bio"
                            data-testid="settings-bio"
                            value={form.bio}
                            onChange={(e) => set("bio", e.target.value)}
                            placeholder="Tell us a bit about yourself"
                            rows={3}
                        />
                    </div>

                    <Button
                        onClick={save}
                        disabled={saving || uploading}
                        data-testid="save-profile-btn"
                        className="shadow-glow"
                    >
                        {saving ? "Saving…" : "Save Changes"}
                    </Button>
                </div>
            </div>

            {/* Appearance */}
            <div className="rounded-xl border border-border bg-card p-6 flex items-center justify-between">
                <div>
                    <p className="font-semibold">Appearance</p>
                    <p className="text-sm text-muted-foreground">Switch between light and dark theme.</p>
                </div>
                <button
                    onClick={toggle}
                    data-testid="settings-theme-toggle"
                    className="flex items-center gap-2 rounded-lg border border-border px-4 py-2 hover:bg-secondary transition-colors"
                >
                    {theme === "dark" ? <><Sun className="h-4 w-4" /> Light</> : <><Moon className="h-4 w-4" /> Dark</>}
                </button>
            </div>

            {/* Logout */}
            <div className="rounded-xl border border-destructive/30 bg-card p-6 flex items-center justify-between">
                <div>
                    <p className="font-semibold">Sign out</p>
                    <p className="text-sm text-muted-foreground">End your session on this device.</p>
                </div>
                <Button variant="destructive" onClick={logout} data-testid="settings-logout" className="gap-2">
                    <LogOut className="h-4 w-4" /> Logout
                </Button>
            </div>
        </div>
    );
}