// import { useState } from "react";
// import { useNavigate } from "react-router-dom";
// import api from "../lib/api";
// import { useAuth } from "../context/AuthContext";
// import { Button } from "../components/ui/button";
// import { Input } from "../components/ui/input";
// import { Textarea } from "../components/ui/textarea";
// import { Label } from "../components/ui/label";
// import {
//     Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
// } from "../components/ui/select";
// import { GraduationCap, BookUser, Shield, Check, ChevronRight, ChevronLeft } from "lucide-react";
// import { toast } from "sonner";

// const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];
// const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English Language", "French", "Economics", "Computer Science", "Accounting", "Literature"];
// const COMMIT = ["15 mins", "30 mins", "1 hour", "2+ hours"];
// const PROF = ["Beginner", "Intermediate", "Advanced"];
// const STYLE = ["Visual", "Auditory", "Reading", "Kinesthetic"];
// const GOALS = ["Exam preparation", "Skill improvement", "Revision", "Career advancement"];

// export default function Onboarding() {
//     const navigate = useNavigate();
//     const { user, setUser } = useAuth();
//     const [step, setStep] = useState(0);
//     const [saving, setSaving] = useState(false);
//     const [form, setForm] = useState({
//         role: "student", exam_level: "", institution: "", study_year: 1,
//         specialization: "", bio: "", subjects: [], goals: [],
//         daily_commitment: "", proficiency: "", learning_style: "",
//     });

//     const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
//     const toggleArr = (k, v) => setForm((f) => ({
//         ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
//     }));

//     const steps = form.role === "teacher"
//         ? ["Role", "Profile", "Expertise"]
//         : ["Role", "Profile", "Goals"];

//     const finish = async () => {
//         setSaving(true);
//         try {
//             const { data } = await api.put("/auth/profile", { ...form, onboarded: true });
//             setUser(data);
//             api.post("/seed").catch(() => { });
//             toast.success("You're all set!");
//             navigate(form.role === "teacher" ? "/teacher" : "/dashboard", { replace: true });
//         } catch {
//             toast.error("Could not save profile");
//         } finally {
//             setSaving(false);
//         }
//     };

//     const canNext = () => {
//         if (step === 0) return !!form.role;
//         if (step === 1) return form.role === "teacher" ? !!form.institution : !!form.exam_level;
//         return true;
//     };

//     const roleCards = [
//         { key: "student", icon: GraduationCap, title: "Student", desc: "Practice past questions, learn with AI, track progress." },
//         { key: "teacher", icon: BookUser, title: "Teacher", desc: "Post lessons, share papers, earn per student view." },
//         // { key: "admin", icon: Shield, title: "Admin", desc: "Oversee content and platform activity." },
//     ];

//     return (
//         <div className="min-h-screen bg-background flex items-center justify-center p-6">
//             <div className="w-full max-w-2xl">
//                 <div className="flex items-center gap-3 mb-8">
//                     <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
//                         <GraduationCap className="h-5 w-5 text-white" />
//                     </div>
//                     <div>
//                         <h1 className="font-display font-bold text-lg leading-none">GCSHARP</h1>
//                         <p className="text-xs text-muted-foreground">Let's set up your account</p>
//                     </div>
//                 </div>

//                 {/* stepper */}
//                 <div className="flex items-center gap-2 mb-8">
//                     {steps.map((s, i) => (
//                         <div key={s} className="flex items-center gap-2 flex-1">
//                             <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${i <= step ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
//                                 {i < step ? <Check className="h-4 w-4" /> : i + 1}
//                             </div>
//                             <span className={`text-sm ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
//                             {i < steps.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
//                         </div>
//                     ))}
//                 </div>

//                 <div className="rounded-xl border border-border bg-card p-6 sm:p-8 fade-up">
//                     {step === 0 && (
//                         <div className="space-y-4">
//                             <h2 className="text-2xl font-display font-bold">Choose your role</h2>
//                             <p className="text-muted-foreground text-sm">You can change this later in settings.</p>
//                             <div className="grid gap-3 pt-2">
//                                 {roleCards.map((r) => (
//                                     <button
//                                         key={r.key}
//                                         data-testid={`role-${r.key}`}
//                                         onClick={() => set("role", r.key)}
//                                         className={`text-left rounded-xl border p-4 flex items-start gap-4 transition-colors ${form.role === r.key ? "border-primary bg-accent" : "border-border hover:bg-secondary"}`}
//                                     >
//                                         <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${form.role === r.key ? "bg-primary text-white" : "bg-secondary"}`}>
//                                             <r.icon className="h-5 w-5" />
//                                         </div>
//                                         <div>
//                                             <p className="font-semibold">{r.title}</p>
//                                             <p className="text-sm text-muted-foreground">{r.desc}</p>
//                                         </div>
//                                     </button>
//                                 ))}
//                             </div>
//                         </div>
//                     )}

//                     {step === 1 && (
//                         <div className="space-y-5">
//                             <h2 className="text-2xl font-display font-bold">Your profile</h2>
//                             {form.role !== "teacher" && (
//                                 <div className="space-y-2">
//                                     <Label>Exam level</Label>
//                                     <Select value={form.exam_level} onValueChange={(v) => set("exam_level", v)}>
//                                         <SelectTrigger data-testid="onboard-level"><SelectValue placeholder="Select exam level" /></SelectTrigger>
//                                         <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                             )}
//                             {form.role === "teacher" && (
//                                 <div className="space-y-2">
//                                     <Label>Subject specialization</Label>
//                                     <Select value={form.specialization} onValueChange={(v) => set("specialization", v)}>
//                                         <SelectTrigger data-testid="onboard-spec"><SelectValue placeholder="Select subject" /></SelectTrigger>
//                                         <SelectContent>{SUBJECTS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                             )}
//                             <div className="space-y-2">
//                                 <Label>Institution / School</Label>
//                                 <Input data-testid="onboard-institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="e.g. Government Bilingual High School" />
//                             </div>
//                             <div className="space-y-2">
//                                 <Label>Short bio</Label>
//                                 <Textarea data-testid="onboard-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Tell us a bit about yourself" />
//                             </div>
//                         </div>
//                     )}

//                     {step === 2 && form.role !== "teacher" && (
//                         <div className="space-y-6">
//                             <h2 className="text-2xl font-display font-bold">Personalize your learning</h2>
//                             <div>
//                                 <Label className="mb-2 block">Subjects you need help with</Label>
//                                 <div className="flex flex-wrap gap-2">
//                                     {SUBJECTS.map((s) => (
//                                         <button key={s} onClick={() => toggleArr("subjects", s)}
//                                             className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.subjects.includes(s) ? "bg-primary text-white border-primary" : "border-border hover:bg-secondary"}`}>
//                                             {s}
//                                         </button>
//                                     ))}
//                                 </div>
//                             </div>
//                             <div>
//                                 <Label className="mb-2 block">Primary goal</Label>
//                                 <div className="flex flex-wrap gap-2">
//                                     {GOALS.map((s) => (
//                                         <button key={s} onClick={() => set("goals", [s])}
//                                             className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.goals.includes(s) ? "bg-primary text-white border-primary" : "border-border hover:bg-secondary"}`}>
//                                             {s}
//                                         </button>
//                                     ))}
//                                 </div>
//                             </div>
//                             <div className="grid sm:grid-cols-3 gap-4">
//                                 <div className="space-y-2">
//                                     <Label>Daily commitment</Label>
//                                     <Select value={form.daily_commitment} onValueChange={(v) => set("daily_commitment", v)}>
//                                         <SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger>
//                                         <SelectContent>{COMMIT.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <Label>Proficiency</Label>
//                                     <Select value={form.proficiency} onValueChange={(v) => set("proficiency", v)}>
//                                         <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
//                                         <SelectContent>{PROF.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                                 <div className="space-y-2">
//                                     <Label>Learning style</Label>
//                                     <Select value={form.learning_style} onValueChange={(v) => set("learning_style", v)}>
//                                         <SelectTrigger><SelectValue placeholder="Style" /></SelectTrigger>
//                                         <SelectContent>{STYLE.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
//                                     </Select>
//                                 </div>
//                             </div>
//                         </div>
//                     )}

//                     {step === 2 && form.role === "teacher" && (
//                         <div className="space-y-6">
//                             <h2 className="text-2xl font-display font-bold">Teaching expertise</h2>
//                             <div>
//                                 <Label className="mb-2 block">Subjects you teach</Label>
//                                 <div className="flex flex-wrap gap-2">
//                                     {SUBJECTS.map((s) => (
//                                         <button key={s} onClick={() => toggleArr("subjects", s)}
//                                             className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.subjects.includes(s) ? "bg-primary text-white border-primary" : "border-border hover:bg-secondary"}`}>
//                                             {s}
//                                         </button>
//                                     ))}
//                                 </div>
//                             </div>
//                             <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
//                                 As a teacher you'll earn <span className="font-semibold text-foreground">90 FCFA</span> per qualified student view on your lesson videos.
//                             </div>
//                         </div>
//                     )}

//                     <div className="flex items-center justify-between pt-8">
//                         <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)} data-testid="onboard-back">
//                             <ChevronLeft className="h-4 w-4 mr-1" /> Back
//                         </Button>
//                         {step < steps.length - 1 ? (
//                             <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)} data-testid="onboard-next">
//                                 Continue <ChevronRight className="h-4 w-4 ml-1" />
//                             </Button>
//                         ) : (
//                             <Button disabled={saving} onClick={finish} data-testid="onboard-finish" className="shadow-glow">
//                                 {saving ? "Saving…" : "Finish setup"}
//                             </Button>
//                         )}
//                     </div>
//                 </div>
//             </div>
//         </div>
//     );
// }


























































































import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { GraduationCap, BookUser, Shield, Check, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";

const LEVELS = ["GCE O Level", "GCE A Level", "HND", "Concours"];
const SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English Language", "French", "Economics", "Computer Science", "Accounting", "Literature"];
const COMMIT = ["15 mins", "30 mins", "1 hour", "2+ hours"];
const PROF = ["Beginner", "Intermediate", "Advanced"];
const STYLE = ["Visual", "Auditory", "Reading", "Kinesthetic"];
const GOALS = ["Exam preparation", "Skill improvement", "Revision", "Career advancement"];

export default function Onboarding() {
    const navigate = useNavigate();
    const { user, setUser } = useAuth();
    const [step, setStep] = useState(0);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({
        role: "student", exam_level: "", institution: "", study_year: 1,
        specialization: "", bio: "", subjects: [], goals: [],
        daily_commitment: "", proficiency: "", learning_style: "",
    });

    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    const toggleArr = (k, v) => setForm((f) => ({
        ...f, [k]: f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v],
    }));

    const steps = form.role === "teacher"
        ? ["Role", "Profile", "Expertise"]
        : ["Role", "Profile", "Goals"];

    const finish = async () => {
        setSaving(true);
        try {
            // ✅ Check if we have a token first
            const token = localStorage.getItem("session_token");
            if (!token) {
                toast.error("No session found. Please sign in again.");
                navigate("/signin");
                return;
            }

            console.log("📤 Saving profile with token:", token.substring(0, 20) + "...");
            console.log("📦 Profile data:", form);

            // ✅ Make the request with explicit headers
            const { data } = await api.put("/auth/profile",
                { ...form, onboarded: true },
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            );

            console.log("✅ Profile saved:", data);

            setUser(data);
            toast.success("You're all set!");
            navigate(form.role === "teacher" ? "/teacher" : "/dashboard", { replace: true });
        } catch (error) {
            console.error("❌ Profile save error:", error);

            // Handle specific error cases
            if (error.response?.status === 401) {
                toast.error("Session expired. Please sign in again.");
                localStorage.removeItem("user");
                localStorage.removeItem("session_token");
                setTimeout(() => {
                    navigate("/signin");
                }, 1500);
            } else {
                toast.error(error.response?.data?.message || "Could not save profile");
            }
        } finally {
            setSaving(false);
        }
    };

    const canNext = () => {
        if (step === 0) return !!form.role;
        if (step === 1) return form.role === "teacher" ? !!form.institution : !!form.exam_level;
        return true;
    };

    const roleCards = [
        { key: "student", icon: GraduationCap, title: "Student", desc: "Practice past questions, learn with AI, track progress." },
        { key: "teacher", icon: BookUser, title: "Teacher", desc: "Post lessons, share papers, earn per student view." },
    ];

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
            <div className="w-full max-w-2xl">
                <div className="flex items-center gap-3 mb-8">
                    <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center">
                        <GraduationCap className="h-5 w-5 text-white" />
                    </div>
                    <div>
                        <h1 className="font-display font-bold text-lg leading-none">GCSHARP</h1>
                        <p className="text-xs text-muted-foreground">Let's set up your account</p>
                    </div>
                </div>

                {/* stepper */}
                <div className="flex items-center gap-2 mb-8">
                    {steps.map((s, i) => (
                        <div key={s} className="flex items-center gap-2 flex-1">
                            <div className={`h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-sm font-semibold ${i <= step ? "bg-primary text-white" : "bg-secondary text-muted-foreground"}`}>
                                {i < step ? <Check className="h-4 w-4" /> : i + 1}
                            </div>
                            <span className={`text-sm ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
                            {i < steps.length - 1 && <div className={`h-px flex-1 ${i < step ? "bg-primary" : "bg-border"}`} />}
                        </div>
                    ))}
                </div>

                <div className="rounded-xl border border-border bg-card p-6 sm:p-8 fade-up">
                    {step === 0 && (
                        <div className="space-y-4">
                            <h2 className="text-2xl font-display font-bold">Choose your role</h2>
                            <p className="text-muted-foreground text-sm">You can change this later in settings.</p>
                            <div className="grid gap-3 pt-2">
                                {roleCards.map((r) => (
                                    <button
                                        key={r.key}
                                        data-testid={`role-${r.key}`}
                                        onClick={() => set("role", r.key)}
                                        className={`text-left rounded-xl border p-4 flex items-start gap-4 transition-colors ${form.role === r.key ? "border-primary bg-accent" : "border-border hover:bg-secondary"}`}
                                    >
                                        <div className={`h-11 w-11 rounded-lg flex items-center justify-center ${form.role === r.key ? "bg-primary text-white" : "bg-secondary"}`}>
                                            <r.icon className="h-5 w-5" />
                                        </div>
                                        <div>
                                            <p className="font-semibold">{r.title}</p>
                                            <p className="text-sm text-muted-foreground">{r.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {step === 1 && (
                        <div className="space-y-5">
                            <h2 className="text-2xl font-display font-bold">Your profile</h2>
                            {form.role !== "teacher" && (
                                <div className="space-y-2">
                                    <Label>Exam level</Label>
                                    <Select value={form.exam_level} onValueChange={(v) => set("exam_level", v)}>
                                        <SelectTrigger data-testid="onboard-level"><SelectValue placeholder="Select exam level" /></SelectTrigger>
                                        <SelectContent>{LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            {form.role === "teacher" && (
                                <div className="space-y-2">
                                    <Label>Subject specialization</Label>
                                    <Select value={form.specialization} onValueChange={(v) => set("specialization", v)}>
                                        <SelectTrigger data-testid="onboard-spec"><SelectValue placeholder="Select subject" /></SelectTrigger>
                                        <SelectContent>{SUBJECTS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            )}
                            <div className="space-y-2">
                                <Label>Institution / School</Label>
                                <Input data-testid="onboard-institution" value={form.institution} onChange={(e) => set("institution", e.target.value)} placeholder="e.g. Government Bilingual High School" />
                            </div>
                            <div className="space-y-2">
                                <Label>Short bio</Label>
                                <Textarea data-testid="onboard-bio" value={form.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Tell us a bit about yourself" />
                            </div>
                        </div>
                    )}

                    {step === 2 && form.role !== "teacher" && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-display font-bold">Personalize your learning</h2>
                            <div>
                                <Label className="mb-2 block">Subjects you need help with</Label>
                                <div className="flex flex-wrap gap-2">
                                    {SUBJECTS.map((s) => (
                                        <button key={s} onClick={() => toggleArr("subjects", s)}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.subjects.includes(s) ? "bg-primary text-white border-primary" : "border-border hover:bg-secondary"}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <Label className="mb-2 block">Primary goal</Label>
                                <div className="flex flex-wrap gap-2">
                                    {GOALS.map((s) => (
                                        <button key={s} onClick={() => set("goals", [s])}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.goals.includes(s) ? "bg-primary text-white border-primary" : "border-border hover:bg-secondary"}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label>Daily commitment</Label>
                                    <Select value={form.daily_commitment} onValueChange={(v) => set("daily_commitment", v)}>
                                        <SelectTrigger><SelectValue placeholder="Time" /></SelectTrigger>
                                        <SelectContent>{COMMIT.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Proficiency</Label>
                                    <Select value={form.proficiency} onValueChange={(v) => set("proficiency", v)}>
                                        <SelectTrigger><SelectValue placeholder="Level" /></SelectTrigger>
                                        <SelectContent>{PROF.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Learning style</Label>
                                    <Select value={form.learning_style} onValueChange={(v) => set("learning_style", v)}>
                                        <SelectTrigger><SelectValue placeholder="Style" /></SelectTrigger>
                                        <SelectContent>{STYLE.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && form.role === "teacher" && (
                        <div className="space-y-6">
                            <h2 className="text-2xl font-display font-bold">Teaching expertise</h2>
                            <div>
                                <Label className="mb-2 block">Subjects you teach</Label>
                                <div className="flex flex-wrap gap-2">
                                    {SUBJECTS.map((s) => (
                                        <button key={s} onClick={() => toggleArr("subjects", s)}
                                            className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${form.subjects.includes(s) ? "bg-primary text-white border-primary" : "border-border hover:bg-secondary"}`}>
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="rounded-lg border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
                                As a teacher you'll earn <span className="font-semibold text-foreground">90 FCFA</span> per qualified student view on your lesson videos.
                            </div>
                        </div>
                    )}

                    <div className="flex items-center justify-between pt-8">
                        <Button variant="ghost" disabled={step === 0} onClick={() => setStep((s) => s - 1)} data-testid="onboard-back">
                            <ChevronLeft className="h-4 w-4 mr-1" /> Back
                        </Button>
                        {step < steps.length - 1 ? (
                            <Button disabled={!canNext()} onClick={() => setStep((s) => s + 1)} data-testid="onboard-next">
                                Continue <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        ) : (
                            <Button disabled={saving} onClick={finish} data-testid="onboard-finish" className="shadow-glow">
                                {saving ? "Saving…" : "Finish setup"}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}