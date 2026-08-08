import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import {
    Loader2, Clock, Check, X, ArrowLeft, ArrowRight, Sparkles, Trophy, RotateCcw, ChevronLeft,
} from "lucide-react";
import { toast } from "sonner";

const LETTERS = ["A", "B", "C", "D"];

export default function ExamMode() {
    const location = useLocation();
    const navigate = useNavigate();
    const cfg = location.state;

    const [questions, setQuestions] = useState(null);
    const [error, setError] = useState(false);
    const [idx, setIdx] = useState(0);
    const [answers, setAnswers] = useState({});      // qid -> selected index
    const [revealed, setRevealed] = useState({});    // qid -> bool
    const [seconds, setSeconds] = useState(0);
    const [finished, setFinished] = useState(false);
    const [result, setResult] = useState(null);
    const startTime = useRef(Date.now());

    useEffect(() => {
        if (!cfg) { navigate("/study", { replace: true }); return; }
        api.post("/questions/generate", cfg)
            .then((r) => setQuestions(r.data.questions))
            .catch(() => setError(true));
    }, []); // eslint-disable-line

    useEffect(() => {
        if (finished) return;
        const t = setInterval(() => setSeconds((s) => s + 1), 1000);
        return () => clearInterval(t);
    }, [finished]);

    if (!cfg) return null;

    if (error) {
        return (
            <div className="max-w-lg mx-auto text-center py-20">
                <p className="text-lg font-semibold mb-2">Could not generate questions</p>
                <p className="text-muted-foreground mb-6">The AI examiner is busy. Please try again.</p>
                <Button onClick={() => navigate("/study")}>Back to Study Center</Button>
            </div>
        );
    }

    if (!questions) {
        return (
            <div className="max-w-lg mx-auto text-center py-24 fade-up">
                <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-5 shadow-glow">
                    <Sparkles className="h-7 w-7 text-white" />
                </div>
                <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-4" />
                <p className="text-lg font-display font-semibold">GC AI is preparing your exam…</p>
                <p className="text-muted-foreground">{cfg.subject} · {cfg.level} · {cfg.year} · Paper {cfg.paper}</p>
            </div>
        );
    }

    const q = questions[idx];
    const selected = answers[q.id];
    const isRevealed = revealed[q.id];
    const total = questions.length;
    const answeredCount = Object.keys(revealed).length;

    const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

    const select = (i) => {
        if (isRevealed) return;
        setAnswers((a) => ({ ...a, [q.id]: i }));
    };

    const submitAnswer = () => {
        if (selected === undefined) { toast.error("Select an answer first"); return; }
        setRevealed((r) => ({ ...r, [q.id]: true }));
    };

    const finish = async () => {
        const timeSpent = Math.round((Date.now() - startTime.current) / 1000);
        const answerRows = questions.map((qq) => ({
            question_id: qq.id,
            selected: answers[qq.id],
            correct: qq.correct_index,
            topic: qq.topic || "General",
        }));
        const score = answerRows.filter((a) => a.selected === a.correct).length;
        try {
            const { data } = await api.post("/attempts", {
                level: cfg.level, subject: cfg.subject, year: cfg.year, paper: cfg.paper,
                answers: answerRows, score, total, time_spent: timeSpent,
            });
            setResult({ ...data, score, total, timeSpent });
        } catch {
            setResult({ score, total, timeSpent, xp_gain: 0 });
        }
        setFinished(true);
    };

    if (finished && result) {
        const acc = Math.round((result.score / result.total) * 100);
        const topics = {};
        questions.forEach((qq) => {
            const t = qq.topic || "General";
            topics[t] = topics[t] || { c: 0, n: 0 };
            topics[t].n++;
            if (answers[qq.id] === qq.correct_index) topics[t].c++;
        });
        const weak = Object.entries(topics).filter(([, v]) => v.c / v.n < 0.5).map(([k]) => k);
        const strong = Object.entries(topics).filter(([, v]) => v.c / v.n >= 0.8).map(([k]) => k);
        return (
            <div className="max-w-2xl mx-auto py-8 fade-up">
                <div className="rounded-xl border border-border bg-card p-8 text-center relative overflow-hidden">
                    <div className="radial-glow" />
                    <div className="relative z-10">
                        <div className="h-16 w-16 rounded-2xl bg-warning/15 flex items-center justify-center mx-auto mb-4">
                            <Trophy className="h-8 w-8 text-warning" />
                        </div>
                        <h1 className="text-3xl font-display font-bold">Exam Complete!</h1>
                        <p className="text-muted-foreground mb-6">{cfg.subject} · {cfg.level} · {cfg.year}</p>
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="rounded-lg bg-secondary/50 p-4">
                                <p className="text-3xl font-display font-bold">{result.score}/{result.total}</p>
                                <p className="text-sm text-muted-foreground">Score</p>
                            </div>
                            <div className="rounded-lg bg-secondary/50 p-4">
                                <p className="text-3xl font-display font-bold text-primary">{acc}%</p>
                                <p className="text-sm text-muted-foreground">Accuracy</p>
                            </div>
                            <div className="rounded-lg bg-secondary/50 p-4">
                                <p className="text-3xl font-display font-bold text-success">+{result.xp_gain || 0}</p>
                                <p className="text-sm text-muted-foreground">XP earned</p>
                            </div>
                        </div>
                        {(weak.length > 0 || strong.length > 0) && (
                            <div className="text-left space-y-3 mb-6">
                                {strong.length > 0 && (
                                    <div><p className="text-sm font-medium mb-1.5">Strong topics</p>
                                        <div className="flex flex-wrap gap-2">{strong.map((t) => <span key={t} className="px-3 py-1 rounded-full text-sm bg-success/10 text-success border border-success/20">{t}</span>)}</div></div>
                                )}
                                {weak.length > 0 && (
                                    <div><p className="text-sm font-medium mb-1.5">Focus next on</p>
                                        <div className="flex flex-wrap gap-2">{weak.map((t) => <span key={t} className="px-3 py-1 rounded-full text-sm bg-destructive/10 text-destructive border border-destructive/20">{t}</span>)}</div></div>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3 justify-center">
                            <Button variant="outline" onClick={() => navigate("/study")} className="gap-2"><ChevronLeft className="h-4 w-4" /> Study Center</Button>
                            <Button onClick={() => window.location.reload()} data-testid="retry-btn" className="gap-2 shadow-glow"><RotateCcw className="h-4 w-4" /> Try Again</Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-5">
            {/* header */}
            <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <Button variant="ghost" size="sm" onClick={() => navigate("/study")}><ArrowLeft className="h-4 w-4 mr-1" /> Exit</Button>
                    <div>
                        <p className="font-display font-semibold">{cfg.subject} · Paper {cfg.paper}</p>
                        <p className="text-sm text-muted-foreground">{cfg.level} · {cfg.year} · Question {idx + 1} of {total}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm font-medium" data-testid="exam-timer">
                    <Clock className="h-4 w-4 text-primary" /> {fmt(seconds)}
                </div>
            </div>

            <Progress value={((idx + 1) / total) * 100} className="h-2" />

            {/* question grid */}
            <div className="flex flex-wrap gap-2">
                {questions.map((qq, i) => (
                    <button key={qq.id} onClick={() => setIdx(i)}
                        className={`h-9 w-9 rounded-lg text-sm font-medium border transition-colors ${i === idx ? "bg-primary text-white border-primary" : revealed[qq.id] ? (answers[qq.id] === qq.correct_index ? "bg-success/15 text-success border-success/30" : "bg-destructive/15 text-destructive border-destructive/30") : answers[qq.id] !== undefined ? "bg-accent border-primary/30" : "border-border hover:bg-secondary"}`}>
                        {i + 1}
                    </button>
                ))}
            </div>

            {/* question card */}
            <div className="rounded-xl border border-border bg-card p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{q.topic}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground capitalize">{q.difficulty}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-secondary text-muted-foreground">{q.marks || 1} mark(s)</span>
                </div>
                <p className="text-lg font-medium mb-5" data-testid="question-text">{q.text}</p>

                <div className="space-y-3">
                    {q.options.map((opt, i) => {
                        const isCorrect = i === q.correct_index;
                        const isSelected = selected === i;
                        let cls = "border-border hover:bg-secondary";
                        if (isRevealed) {
                            if (isCorrect) cls = "border-success bg-success/10";
                            else if (isSelected) cls = "border-destructive bg-destructive/10";
                            else cls = "border-border opacity-60";
                        } else if (isSelected) cls = "border-primary bg-accent";
                        return (
                            <button key={i} data-testid={`option-${i}`} onClick={() => select(i)}
                                className={`w-full text-left rounded-xl border p-4 flex items-center gap-3 transition-colors ${cls}`}>
                                <span className={`h-8 w-8 shrink-0 rounded-lg flex items-center justify-center text-sm font-semibold ${isSelected && !isRevealed ? "bg-primary text-white" : "bg-secondary"}`}>{LETTERS[i]}</span>
                                <span className="flex-1">{opt}</span>
                                {isRevealed && isCorrect && <Check className="h-5 w-5 text-success" />}
                                {isRevealed && isSelected && !isCorrect && <X className="h-5 w-5 text-destructive" />}
                            </button>
                        );
                    })}
                </div>

                {isRevealed && (
                    <div className="mt-5 rounded-xl border border-primary/20 bg-accent/50 p-4 fade-up">
                        <p className="flex items-center gap-2 font-semibold text-primary mb-1"><Sparkles className="h-4 w-4" /> Explanation</p>
                        <p className="text-sm text-foreground/90">{q.explanation}</p>
                    </div>
                )}

                <div className="flex items-center justify-between mt-6">
                    <Button variant="outline" disabled={idx === 0} onClick={() => setIdx((i) => i - 1)} data-testid="prev-btn"><ArrowLeft className="h-4 w-4 mr-1" /> Previous</Button>
                    {!isRevealed ? (
                        <Button onClick={submitAnswer} data-testid="submit-answer-btn" className="shadow-glow">Submit Answer</Button>
                    ) : idx < total - 1 ? (
                        <Button onClick={() => setIdx((i) => i + 1)} data-testid="next-btn">Next <ArrowRight className="h-4 w-4 ml-1" /></Button>
                    ) : (
                        <Button onClick={finish} data-testid="finish-exam-btn" className="shadow-glow gap-2"><Trophy className="h-4 w-4" /> View Results</Button>
                    )}
                </div>
            </div>

            {answeredCount === total && !finished && (
                <div className="text-center">
                    <Button onClick={finish} variant="outline" className="gap-2">Finish & see results <ArrowRight className="h-4 w-4" /></Button>
                </div>
            )}
        </div>
    );
}
