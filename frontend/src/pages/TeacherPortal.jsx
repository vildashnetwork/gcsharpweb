// import { useEffect, useState } from "react";
// import api from "../lib/api";
// import { useAuth } from "../context/AuthContext";
// import {
//     BarChart, Bar, XAxis, ResponsiveContainer, Tooltip as RTooltip, Cell,
// } from "recharts";
// import { Button } from "../components/ui/button";
// import { Input } from "../components/ui/input";
// import { Textarea } from "../components/ui/textarea";
// import { Label } from "../components/ui/label";
// import {
//     Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "../components/ui/select";
// import {
//     Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
// } from "../components/ui/dialog";
// import { BookMarked, Users, Coins, PlayCircle, Plus, Upload } from "lucide-react";
// import { toast } from "sonner";

// const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];
// const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English Language", "French", "Economics", "Computer Science", "Accounting"];

// function StatCard({ icon: Icon, label, value, accent }) {
//     return (
//         <div className="rounded-xl border border-border bg-card p-5">
//             <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${accent}`}><Icon className="h-5 w-5" /></div>
//             <p className="text-2xl font-display font-bold">{value}</p>
//             <p className="text-sm text-muted-foreground">{label}</p>
//         </div>
//     );
// }

// export default function TeacherPortal() {
//     const { user } = useAuth();
//     const [stats, setStats] = useState(null);
//     const [courses, setCourses] = useState([]);
//     const [open, setOpen] = useState(false);
//     const [saving, setSaving] = useState(false);
//     const [form, setForm] = useState({ title: "", description: "", subject: "", level: "", video_url: "", thumbnail: "" });

//     const load = () => {
//         api.get("/teacher/stats").then((r) => setStats(r.data)).catch(() => {});
//         api.get("/courses", { params: { mine: true } }).then((r) => setCourses(r.data)).catch(() => {});
//     };
//     useEffect(load, []);

//     const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

//     const createCourse = async () => {
//         if (!form.title || !form.subject || !form.level || !form.video_url) {
//             toast.error("Fill title, subject, level and video URL"); return;
//         }
//         setSaving(true);
//         try {
//             await api.post("/courses", { ...form, price: 0 });
//             toast.success("Lesson published!");
//             setOpen(false);
//             setForm({ title: "", description: "", subject: "", level: "", video_url: "", thumbnail: "" });
//             load();
//         } catch {
//             toast.error("Could not publish");
//         } finally {
//             setSaving(false);
//         }
//     };

//     return (
//         <div className="space-y-6 max-w-[1400px]">
//             <div className="flex items-end justify-between flex-wrap gap-3">
//                 <div>
//                     <h1 className="text-3xl font-display font-bold">Teacher Portal</h1>
//                     <p className="text-muted-foreground">Publish lessons and earn 90 FCFA per qualified student view.</p>
//                 </div>
//                 <Dialog open={open} onOpenChange={setOpen}>
//                     <DialogTrigger asChild>
//                         <Button className="shadow-glow gap-2" data-testid="new-lesson-btn"><Plus className="h-4 w-4" /> New Lesson</Button>
//                     </DialogTrigger>
//                     <DialogContent>
//                         <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Upload className="h-5 w-5" /> Publish a Lesson Video</DialogTitle><DialogDescription>Share a video lesson and earn 90 FCFA per qualified student view.</DialogDescription></DialogHeader>
//                         <div className="space-y-4 py-2">
//                             <div className="space-y-2"><Label>Title</Label><Input data-testid="course-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Chain Rule Masterclass" /></div>
//                             <div className="grid grid-cols-2 gap-4">
//                                 <div className="space-y-2"><Label>Subject</Label>
//                                     <Select value={form.subject} onValueChange={(v) => set("subject", v)}>
//                                         <SelectTrigger data-testid="course-subject"><SelectValue placeholder="Subject" /></SelectTrigger>
//                                         <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="space-y-2"><Label>Level</Label>
//                                     <Select value={form.level} onValueChange={(v) => set("level", v)}>
//                                         <SelectTrigger data-testid="course-level"><SelectValue placeholder="Level" /></SelectTrigger>
//                                         <SelectContent>{LEVELS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                             </div>
//                             <div className="space-y-2"><Label>Video URL (YouTube embed)</Label><Input data-testid="course-video" value={form.video_url} onChange={(e) => set("video_url", e.target.value)} placeholder="https://www.youtube.com/embed/…" /></div>
//                             <div className="space-y-2"><Label>Thumbnail URL (optional)</Label><Input value={form.thumbnail} onChange={(e) => set("thumbnail", e.target.value)} placeholder="https://…" /></div>
//                             <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What will students learn?" /></div>
//                         </div>
//                         <DialogFooter>
//                             <Button onClick={createCourse} disabled={saving} data-testid="publish-course-btn" className="shadow-glow">{saving ? "Publishing…" : "Publish"}</Button>
//                         </DialogFooter>
//                     </DialogContent>
//                 </Dialog>
//             </div>

//             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//                 <StatCard icon={BookMarked} label="Courses" value={stats?.courses ?? 0} accent="bg-accent text-primary" />
//                 <StatCard icon={Users} label="Students" value={stats?.students ?? 0} accent="bg-success/15 text-success" />
//                 <StatCard icon={PlayCircle} label="Total Views" value={stats?.views ?? 0} accent="bg-primary/15 text-primary" />
//                 <StatCard icon={Coins} label="Earnings (FCFA)" value={(stats?.earnings ?? 0).toLocaleString()} accent="bg-warning/15 text-warning" />
//             </div>

//             <div className="grid lg:grid-cols-3 gap-6">
//                 <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
//                     <h2 className="text-lg font-display font-semibold mb-4">Earnings Overview</h2>
//                     <div className="h-64">
//                         {stats?.chart?.length ? (
//                             <ResponsiveContainer width="100%" height="100%">
//                                 <BarChart data={stats.chart}>
//                                     <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
//                                     <RTooltip cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} />
//                                     <Bar dataKey="earnings" radius={[8, 8, 0, 0]}>
//                                         {stats.chart.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
//                                     </Bar>
//                                 </BarChart>
//                             </ResponsiveContainer>
//                         ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No earnings yet. Publish lessons to start earning.</div>}
//                     </div>
//                 </div>

//                 <div className="rounded-xl border border-border bg-card p-6">
//                     <h2 className="text-lg font-display font-semibold mb-4">Course Performance</h2>
//                     <div className="space-y-2">
//                         {stats?.course_table?.length ? stats.course_table.map((c) => (
//                             <div key={c.title} className="rounded-lg bg-secondary/40 p-3">
//                                 <p className="font-medium text-sm line-clamp-1">{c.title}</p>
//                                 <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
//                                     <span>{c.students} students · {c.views} views</span>
//                                     <span className="text-success font-medium">{c.earnings.toLocaleString()} FCFA</span>
//                                 </div>
//                             </div>
//                         )) : <p className="text-sm text-muted-foreground">Your published lessons appear here.</p>}
//                     </div>
//                 </div>
//             </div>

//             <div>
//                 <h2 className="text-lg font-display font-semibold mb-4">My Lessons</h2>
//                 <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
//                     {courses.length ? courses.map((c) => (
//                         <div key={c.course_id} className="rounded-xl border border-border bg-card overflow-hidden">
//                             <div className="h-36 bg-secondary">{c.thumbnail && <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />}</div>
//                             <div className="p-4">
//                                 <p className="text-xs text-primary font-medium">{c.subject} · {c.level}</p>
//                                 <p className="font-semibold line-clamp-1">{c.title}</p>
//                                 <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
//                                     <span>{c.views} views</span>
//                                     <span className="text-success font-medium">{(c.earnings || 0).toLocaleString()} FCFA</span>
//                                 </div>
//                             </div>
//                         </div>
//                     )) : <p className="text-sm text-muted-foreground col-span-full">You haven't published any lessons yet. Click "New Lesson" to start.</p>}
//                 </div>
//             </div>
//         </div>
//     );
// }









































































// frontend/src/pages/TeacherPortal.jsx
import { useEffect, useState, useCallback, useRef } from "react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    BarChart, Bar, XAxis, ResponsiveContainer, Tooltip as RTooltip, Cell,
} from "recharts";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription,
} from "../components/ui/dialog";
import {
    BookMarked, Users, Coins, PlayCircle, Plus, Upload,
    FileVideo, Image, X, CheckCircle, AlertCircle,
    Cloud, Wifi, Zap, Clock, Link as LinkIcon, ToggleLeft, ToggleRight
} from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English Language", "French", "Economics", "Computer Science", "Accounting"];
const MAX_VIDEO_SIZE = 100 * 1024 * 1024; // 100MB
const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

// Cloudinary configuration
const CLOUDINARY_CLOUD_NAME = 'qsmemy5r';
const CLOUDINARY_UPLOAD_PRESET = 'gcsharp';

function StatCard({ icon: Icon, label, value, accent }) {
    return (
        <div className="rounded-xl border border-border bg-card p-5">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center mb-3 ${accent}`}>
                <Icon className="h-5 w-5" />
            </div>
            <p className="text-2xl font-display font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
        </div>
    );
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatSpeed(bytesPerSecond) {
    if (bytesPerSecond === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytesPerSecond) / Math.log(k));
    return parseFloat((bytesPerSecond / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function UploadDropzone({
    onUpload,
    accept,
    maxSize,
    label,
    icon: Icon,
    fileType,
    existingUrl,
    onRemove
}) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [speed, setSpeed] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [fileName, setFileName] = useState('');
    const [fileSize, setFileSize] = useState(0);
    const [error, setError] = useState(null);
    const startTimeRef = useRef(null);
    const lastBytesRef = useRef(0);
    const speedIntervalRef = useRef(null);
    const fileInputRef = useRef(null);

    const uploadToCloudinary = useCallback(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable) {
                    const percent = Math.round((event.loaded / event.total) * 100);
                    setProgress(percent);

                    const now = Date.now();
                    if (startTimeRef.current) {
                        const elapsed = (now - startTimeRef.current) / 1000;
                        const bytesSinceLast = event.loaded - lastBytesRef.current;
                        const currentSpeed = bytesSinceLast / elapsed;
                        setSpeed(currentSpeed);
                        const remainingBytes = event.total - event.loaded;
                        setRemaining(remainingBytes / currentSpeed);
                    }
                    lastBytesRef.current = event.loaded;
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const response = JSON.parse(xhr.responseText);
                        resolve({
                            success: true,
                            url: response.secure_url,
                            public_id: response.public_id,
                            duration: response.duration,
                            format: response.format,
                        });
                    } catch (e) {
                        reject(new Error('Invalid response from Cloudinary'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.error?.message || 'Upload failed'));
                    } catch (e) {
                        reject(new Error('Upload failed with status: ' + xhr.status));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Network error occurred during upload'));
            });

            const resourceType = fileType === 'video' ? 'video' : 'image';
            xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`);
            xhr.send(formData);
        });
    }, [fileType]);

    const handleFile = useCallback(async (file) => {
        if (file.size > maxSize) {
            setError(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
            toast.error(`File too large. Maximum size: ${formatFileSize(maxSize)}`);
            return;
        }

        const validExtensions = accept.split(',').map(ext => ext.trim().replace('*', ''));
        if (!validExtensions.some(ext => file.name.toLowerCase().endsWith(ext.replace('.', '')))) {
            setError(`Invalid file type. Accepted: ${accept}`);
            toast.error(`Invalid file type. Accepted: ${accept}`);
            return;
        }

        setError(null);
        setFileName(file.name);
        setFileSize(file.size);
        setUploading(true);
        setProgress(0);
        setSpeed(0);
        setRemaining(0);
        startTimeRef.current = Date.now();
        lastBytesRef.current = 0;

        try {
            const result = await uploadToCloudinary(file);
            if (result.success) {
                toast.success(`${fileType.charAt(0).toUpperCase() + fileType.slice(1)} uploaded successfully!`);
                onUpload(result.url, result.public_id);
                setProgress(100);
            }
        } catch (err) {
            setError(err.message);
            toast.error(err.message);
        } finally {
            setUploading(false);
            if (speedIntervalRef.current) {
                clearInterval(speedIntervalRef.current);
            }
        }
    }, [maxSize, accept, uploadToCloudinary, fileType, onUpload]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
    }, [handleFile]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleFileInput = useCallback((e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleFile(files[0]);
        }
        e.target.value = '';
    }, [handleFile]);

    const handleRemove = useCallback(() => {
        if (onRemove) onRemove();
        setFileName('');
        setFileSize(0);
        setProgress(0);
        setSpeed(0);
        setRemaining(0);
        setError(null);
        setUploading(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }, [onRemove, fileInputRef]);

    useEffect(() => {
        if (uploading) {
            speedIntervalRef.current = setInterval(() => { }, 500);
        }
        return () => {
            if (speedIntervalRef.current) {
                clearInterval(speedIntervalRef.current);
            }
        };
    }, [uploading]);

    const getStatusColor = () => {
        if (error) return 'text-destructive border-destructive';
        if (uploading) return 'text-primary border-primary';
        if (existingUrl) return 'text-success border-success';
        return 'text-muted-foreground border-muted';
    };

    return (
        <div className="space-y-2">
            <div
                className={`relative border-2 border-dashed rounded-lg p-6 transition-all ${isDragging ? 'border-primary bg-primary/5' : getStatusColor()}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
            >
                {uploading ? (
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Cloud className="h-5 w-5 text-primary animate-pulse" />
                                <span className="font-medium">Uploading {fileName}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{progress}%</span>
                        </div>

                        <div className="h-2 bg-secondary rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <div className="flex items-center gap-4">
                                <span className="flex items-center gap-1">
                                    <Zap className="h-3 w-3" />
                                    {formatSpeed(speed)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {remaining > 0 && remaining < 3600 ?
                                        `${Math.ceil(remaining)}s remaining` :
                                        'Calculating...'
                                    }
                                </span>
                            </div>
                            <span>{formatFileSize(fileSize)}</span>
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex items-center gap-3 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <span>{error}</span>
                        <button
                            onClick={() => setError(null)}
                            className="text-sm underline hover:no-underline"
                        >
                            Dismiss
                        </button>
                    </div>
                ) : existingUrl ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-success">
                            <CheckCircle className="h-5 w-5" />
                            <span>File uploaded successfully</span>
                        </div>
                        <button
                            onClick={handleRemove}
                            className="text-destructive hover:text-destructive/80 p-1 rounded hover:bg-destructive/10"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <div
                        className="flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Icon className="h-8 w-8" />
                        <div className="text-center">
                            <p className="font-medium">{label}</p>
                            <p className="text-xs">Drag & drop or click to browse</p>
                            <p className="text-xs mt-1 text-muted-foreground/70">
                                Max size: {formatFileSize(maxSize)} • {accept}
                            </p>
                        </div>
                    </div>
                )}

                <input
                    ref={fileInputRef}
                    type="file"
                    accept={accept}
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={uploading}
                />
            </div>
        </div>
    );
}

// Toggle Switch Component
function ToggleSwitch({ enabled, onToggle, label, icon: Icon }) {
    return (
        <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-2 text-sm hover:opacity-80 transition-opacity"
        >
            {enabled ? (
                <ToggleRight className="h-6 w-6 text-primary" />
            ) : (
                <ToggleLeft className="h-6 w-6 text-muted-foreground" />
            )}
            <span className={enabled ? "text-foreground" : "text-muted-foreground"}>
                {Icon && <Icon className="h-4 w-4 inline mr-1" />}
                {label}
            </span>
        </button>
    );
}

export default function TeacherPortal() {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [courses, setCourses] = useState([]);
    const [open, setOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [useFileUpload, setUseFileUpload] = useState(true);
    const [form, setForm] = useState({
        title: "",
        description: "",
        subject: "",
        level: "",
        video_url: "",
        thumbnail: "",
        video_public_id: "",
        thumbnail_public_id: "",
    });

    const load = useCallback(() => {
        api.get("/teacher/stats").then((r) => setStats(r.data)).catch(() => { });
        api.get("/courses", { params: { mine: true } }).then((r) => setCourses(r.data)).catch(() => { });
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const setFormField = useCallback((k, v) => setForm((f) => ({ ...f, [k]: v })), []);

    const handleVideoUpload = useCallback((url, publicId) => {
        setFormField("video_url", url);
        setFormField("video_public_id", publicId);
    }, [setFormField]);

    const handleThumbnailUpload = useCallback((url, publicId) => {
        setFormField("thumbnail", url);
        setFormField("thumbnail_public_id", publicId);
    }, [setFormField]);

    const handleRemoveVideo = useCallback(() => {
        setFormField("video_url", "");
        setFormField("video_public_id", "");
    }, [setFormField]);

    const handleRemoveThumbnail = useCallback(() => {
        setFormField("thumbnail", "");
        setFormField("thumbnail_public_id", "");
    }, [setFormField]);

    const createCourse = useCallback(async () => {
        if (!form.title || !form.subject || !form.level || !form.video_url) {
            toast.error("Fill title, subject, level and video URL");
            return;
        }
        setSaving(true);
        try {
            await api.post("/courses", {
                ...form,
                price: 0,
                video_url: form.video_url,
                thumbnail: form.thumbnail || "",
            });
            toast.success("Lesson published!");
            setOpen(false);
            setForm({
                title: "",
                description: "",
                subject: "",
                level: "",
                video_url: "",
                thumbnail: "",
                video_public_id: "",
                thumbnail_public_id: "",
            });
            load();
        } catch (error) {
            toast.error(error.response?.data?.detail || "Could not publish");
        } finally {
            setSaving(false);
        }
    }, [form, load]);

    const toggleUploadMethod = useCallback(() => {
        setUseFileUpload((prev) => !prev);
        setFormField("video_url", "");
        setFormField("video_public_id", "");
    }, [setFormField]);

    return (
        <div className="space-y-6 max-w-[1400px]">
            <div className="flex items-end justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-display font-bold">Teacher Portal</h1>
                    <p className="text-muted-foreground">Publish lessons and earn 90 FCFA per qualified student view.</p>
                </div>
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button className="shadow-glow gap-2" data-testid="new-lesson-btn">
                            <Plus className="h-4 w-4" /> New Lesson
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="font-display flex items-center gap-2">
                                <Upload className="h-5 w-5" /> Publish a Lesson Video
                            </DialogTitle>
                            <DialogDescription>
                                Upload your video or paste a video link. Earn 90 FCFA per qualified view.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Title</Label>
                                <Input
                                    data-testid="course-title"
                                    value={form.title}
                                    onChange={(e) => setFormField("title", e.target.value)}
                                    placeholder="e.g. Chain Rule Masterclass"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Subject</Label>
                                    <Select value={form.subject} onValueChange={(v) => setFormField("subject", v)}>
                                        <SelectTrigger data-testid="course-subject">
                                            <SelectValue placeholder="Subject" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {SUBJECTS.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Level</Label>
                                    <Select value={form.level} onValueChange={(v) => setFormField("level", v)}>
                                        <SelectTrigger data-testid="course-level">
                                            <SelectValue placeholder="Level" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {LEVELS.map((s) => (
                                                <SelectItem key={s} value={s}>{s}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label>Video Source</Label>
                                    <ToggleSwitch
                                        enabled={useFileUpload}
                                        onToggle={toggleUploadMethod}
                                        label={useFileUpload ? "Click To Insert A Link" : "Click Here To Upload A Video"}
                                        icon={useFileUpload ? FileVideo : LinkIcon}
                                    />
                                </div>

                                {useFileUpload ? (
                                    <UploadDropzone
                                        onUpload={handleVideoUpload}
                                        onRemove={handleRemoveVideo}
                                        accept=".mp4,.mov,.avi,.mkv,.webm,.m4v"
                                        maxSize={MAX_VIDEO_SIZE}
                                        label="Upload Video File"
                                        icon={FileVideo}
                                        fileType="video"
                                        existingUrl={form.video_url}
                                    />
                                ) : (
                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <LinkIcon className="h-4 w-4 text-muted-foreground" />
                                            <Input
                                                data-testid="course-video-link"
                                                value={form.video_url}
                                                onChange={(e) => setFormField("video_url", e.target.value)}
                                                placeholder="https://www.youtube.com/embed/... or https://vimeo.com/..."
                                                className="flex-1"
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Supported: YouTube embed, Vimeo, or direct video URL
                                        </p>
                                        {form.video_url && (
                                            <div className="flex items-center gap-2 text-xs text-success">
                                                <CheckCircle className="h-3 w-3" />
                                                Link added: {form.video_url.length > 40 ? form.video_url.substring(0, 40) + '...' : form.video_url}
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                                    <Wifi className="h-3 w-3" />
                                    {useFileUpload ? 'Please Upload a Video File' : 'Paste any video URL (YouTube, Vimeo, etc.)'}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Thumbnail Image</Label>
                                <UploadDropzone
                                    onUpload={handleThumbnailUpload}
                                    onRemove={handleRemoveThumbnail}
                                    accept=".jpg,.jpeg,.png,.gif,.webp"
                                    maxSize={MAX_IMAGE_SIZE}
                                    label="Upload Thumbnail"
                                    icon={Image}
                                    fileType="image"
                                    existingUrl={form.thumbnail}
                                />
                                {form.thumbnail && (
                                    <div className="mt-2">
                                        <img
                                            src={form.thumbnail}
                                            alt="Thumbnail preview"
                                            className="h-20 w-32 object-cover rounded border"
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Description</Label>
                                <Textarea
                                    value={form.description}
                                    onChange={(e) => setFormField("description", e.target.value)}
                                    placeholder="What will students learn?"
                                    rows={3}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                onClick={createCourse}
                                disabled={saving}
                                data-testid="publish-course-btn"
                                className="shadow-glow"
                            >
                                {saving ? "Publishing…" : "Publish"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={BookMarked} label="Courses" value={stats?.courses ?? 0} accent="bg-accent text-primary" />
                <StatCard icon={Users} label="Students" value={stats?.students ?? 0} accent="bg-success/15 text-success" />
                <StatCard icon={PlayCircle} label="Total Views" value={stats?.views ?? 0} accent="bg-primary/15 text-primary" />
                <StatCard icon={Coins} label="Earnings (FCFA)" value={(stats?.earnings ?? 0).toLocaleString()} accent="bg-warning/15 text-warning" />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-display font-semibold mb-4">Earnings Overview</h2>
                    <div className="h-64">
                        {stats?.chart?.length ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.chart}>
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                                    <RTooltip cursor={{ fill: "hsl(var(--secondary))" }} contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, color: "hsl(var(--foreground))" }} />
                                    <Bar dataKey="earnings" radius={[8, 8, 0, 0]}>
                                        {stats.chart.map((_, i) => <Cell key={i} fill="hsl(var(--primary))" />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <div className="h-full flex items-center justify-center text-muted-foreground text-sm">No earnings yet. Publish lessons to start earning.</div>}
                    </div>
                </div>

                <div className="rounded-xl border border-border bg-card p-6">
                    <h2 className="text-lg font-display font-semibold mb-4">Course Performance</h2>
                    <div className="space-y-2">
                        {stats?.course_table?.length ? stats.course_table.map((c) => (
                            <div key={c.title} className="rounded-lg bg-secondary/40 p-3">
                                <p className="font-medium text-sm line-clamp-1">{c.title}</p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                                    <span>{c.students} students · {c.views} views</span>
                                    <span className="text-success font-medium">{c.earnings.toLocaleString()} FCFA</span>
                                </div>
                            </div>
                        )) : <p className="text-sm text-muted-foreground">Your published lessons appear here.</p>}
                    </div>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-display font-semibold mb-4">My Lessons</h2>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {courses.length ? courses.map((c) => (
                        <div key={c.course_id} className="rounded-xl border border-border bg-card overflow-hidden">
                            <div className="h-36 bg-secondary relative">
                                {c.thumbnail ? (
                                    <img src={c.thumbnail} alt={c.title} className="h-full w-full object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-muted-foreground">
                                        <PlayCircle className="h-12 w-12 opacity-20" />
                                    </div>
                                )}
                            </div>
                            <div className="p-4">
                                <p className="text-xs text-primary font-medium">{c.subject} · {c.level}</p>
                                <p className="font-semibold line-clamp-1">{c.title}</p>
                                <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
                                    <span>{c.views} views</span>
                                    <span className="text-success font-medium">{(c.earnings || 0).toLocaleString()} FCFA</span>
                                </div>
                            </div>
                        </div>
                    )) : <p className="text-sm text-muted-foreground col-span-full">You haven't published any lessons yet. Click "New Lesson" to start.</p>}
                </div>
            </div>
        </div>
    );
}