import { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, Radio } from "lucide-react";
import Markdown from "./Markdown";

export default function VideoSolutionPlayer({ scenes, title, question }) {
    const [idx, setIdx] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [revealed, setRevealed] = useState(0);
    const audioRef = useRef(null);

    const scene = scenes[idx];

    useEffect(() => {
        setRevealed(0);
        const board = scene?.board || [];
        let i = 0;
        const t = setInterval(() => {
            i += 1;
            setRevealed((r) => Math.min(board.length, r + 1));
            if (i >= board.length) clearInterval(t);
        }, 450);
        return () => clearInterval(t);
    }, [idx]); // eslint-disable-line

    useEffect(() => {
        const a = audioRef.current;
        if (!a) return;
        if (playing) { a.play().catch(() => {}); } else { a.pause(); }
    }, [playing, idx]);

    const onEnded = () => {
        if (idx < scenes.length - 1) setIdx((i) => i + 1);
        else setPlaying(false);
    };

    const restart = () => { setIdx(0); setPlaying(true); };

    return (
        <div className="rounded-xl overflow-hidden border border-border bg-card">
            {/* whiteboard / video surface */}
            <div className="relative bg-[#0A192F] text-white aspect-video p-6 overflow-hidden">
                <div className="radial-glow" />
                <div className="relative z-10 flex items-center justify-between mb-3">
                    <span className="inline-flex items-center gap-1.5 text-xs bg-destructive/80 px-2 py-0.5 rounded-full">
                        <Radio className="h-3 w-3" /> AI SOLUTION
                    </span>
                    <span className="text-xs text-slate-400">Scene {idx + 1} / {scenes.length}</span>
                </div>
                <h3 className="relative z-10 font-display font-semibold text-lg mb-4 text-blue-200">{scene?.heading}</h3>
                <div className="relative z-10 space-y-2 font-mono text-sm sm:text-base">
                    {(scene?.board || []).map((line, i) => (
                        <p key={i} className={`transition-all duration-300 ${i < revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}>
                            {line}
                        </p>
                    ))}
                </div>
                {playing && (
                    <div className="absolute bottom-4 left-6 right-6 z-10 flex items-center gap-2 text-xs text-slate-300">
                        <Volume2 className="h-3.5 w-3.5 animate-pulse" /> Narrating…
                    </div>
                )}
                {scene?.audio && (
                    <audio ref={audioRef} src={`data:audio/mp3;base64,${scene.audio}`} onEnded={onEnded} />
                )}
            </div>

            {/* controls */}
            <div className="p-4">
                <div className="flex items-center justify-center gap-2 mb-3">
                    <button data-testid="vid-prev" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"><SkipBack className="h-4 w-4" /></button>
                    <button data-testid="vid-play" onClick={() => setPlaying((p) => !p)} className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center shadow-glow hover:scale-95 transition-transform">
                        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </button>
                    <button data-testid="vid-next" onClick={() => setIdx((i) => Math.min(scenes.length - 1, i + 1))} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"><SkipForward className="h-4 w-4" /></button>
                    <button data-testid="vid-restart" onClick={restart} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"><RotateCcw className="h-4 w-4" /></button>
                </div>
                <div className="flex items-center gap-1.5">
                    {scenes.map((_, i) => (
                        <button key={i} onClick={() => setIdx(i)} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx ? "bg-primary" : "bg-secondary"}`} />
                    ))}
                </div>
                {question && <p className="text-xs text-muted-foreground mt-3 line-clamp-2"><span className="font-medium text-foreground">Question:</span> {question}</p>}
            </div>
        </div>
    );
}
