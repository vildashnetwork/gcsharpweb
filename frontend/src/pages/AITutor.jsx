import { useEffect, useRef, useState } from "react";
import { API } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Button } from "../components/ui/button";
import {
    Bot, Send, Sparkles, Calculator, BookOpen, CalendarClock, ListChecks, Layers, FileText, User,
} from "lucide-react";

const SUBJECTS = ["General", "Mathematics", "Physics", "Chemistry", "Biology", "Economics", "English Language", "French", "Computer Science"];
const QUICK = [
    { icon: Calculator, label: "Solve a math problem", prompt: "Solve this step by step: " },
    { icon: BookOpen, label: "Explain a concept", prompt: "Explain in simple terms with an example: " },
    { icon: CalendarClock, label: "Make a study plan", prompt: "Create a 7-day study plan for " },
    { icon: ListChecks, label: "Generate a quiz", prompt: "Generate a 5-question quiz on " },
    { icon: Layers, label: "Make flashcards", prompt: "Create 5 flashcards for " },
    { icon: FileText, label: "Summarize a topic", prompt: "Summarize the key points of " },
];

export default function AITutor() {
    const { user } = useAuth();
    const [subject, setSubject] = useState("General");
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [streaming, setStreaming] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }, [messages]);

    const send = async (text) => {
        const msg = text ?? input;
        if (!msg.trim() || streaming) return;
        setInput("");
        setMessages((m) => [...m, { role: "user", content: msg }, { role: "assistant", content: "" }]);
        setStreaming(true);
        try {
            const res = await fetch(`${API}/ai/chat`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ message: msg, subject, session_id: sessionId }),
            });
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const parts = buffer.split("\n\n");
                buffer = parts.pop();
                for (const p of parts) {
                    const line = p.replace(/^data: /, "").trim();
                    if (!line) continue;
                    try {
                        const data = JSON.parse(line);
                        if (data.delta) {
                            setMessages((m) => {
                                const copy = [...m];
                                copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + data.delta };
                                return copy;
                            });
                        }
                        if (data.done && data.session_id) setSessionId(data.session_id);
                    } catch {}
                }
            }
        } catch {
            setMessages((m) => {
                const copy = [...m];
                copy[copy.length - 1] = { role: "assistant", content: "Sorry, I couldn't reach the AI. Please try again." };
                return copy;
            });
        } finally {
            setStreaming(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                        <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold">GC AI Tutor</h1>
                        <p className="text-sm text-muted-foreground">Your personal exam coach</p>
                    </div>
                </div>
                <Select value={subject} onValueChange={setSubject}>
                    <SelectTrigger className="w-44" data-testid="ai-subject"><SelectValue /></SelectTrigger>
                    <SelectContent>{SUBJECTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto rounded-xl border border-border bg-card p-4 sm:p-6 space-y-4">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center py-8">
                        <Sparkles className="h-10 w-10 text-primary mb-4" />
                        <p className="text-lg font-display font-semibold">Hello {user?.name?.split(" ")[0] || "there"}! Ask me anything.</p>
                        <p className="text-muted-foreground max-w-md mt-1">I explain concepts step by step, solve problems, and build study plans tailored to your exams.</p>
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                        <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center ${m.role === "user" ? "bg-secondary" : "bg-primary text-white"}`}>
                            {m.role === "user" ? <User className="h-4.5 w-4.5" /> : <Bot className="h-4.5 w-4.5" />}
                        </div>
                        <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-primary text-white" : "bg-secondary/60 border border-border"}`}>
                            {m.content || <span className="inline-flex gap-1"><span className="animate-pulse">●</span></span>}
                        </div>
                    </div>
                ))}
            </div>

            {messages.length === 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                    {QUICK.map((q) => (
                        <button key={q.label} data-testid={`quick-${q.label}`}
                            onClick={() => setInput(q.prompt)}
                            className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm hover:bg-secondary hover:-translate-y-0.5 transition-transform text-left">
                            <q.icon className="h-4 w-4 text-primary shrink-0" /> {q.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-card p-2">
                <input
                    data-testid="ai-input"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                    placeholder="Ask GC AI anything about your subjects…"
                    className="flex-1 bg-transparent px-3 py-2 text-sm focus:outline-none"
                />
                <Button onClick={() => send()} disabled={streaming || !input.trim()} data-testid="ai-send-btn" size="icon" className="shadow-glow shrink-0">
                    <Send className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}
