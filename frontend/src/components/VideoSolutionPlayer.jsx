// import { useEffect, useRef, useState } from "react";
// import { Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, Radio } from "lucide-react";
// import Markdown from "./Markdown";

// export default function VideoSolutionPlayer({ scenes, title, question }) {
//     const [idx, setIdx] = useState(0);
//     const [playing, setPlaying] = useState(false);
//     const [revealed, setRevealed] = useState(0);
//     const audioRef = useRef(null);

//     const scene = scenes[idx];

//     useEffect(() => {
//         setRevealed(0);
//         const board = scene?.board || [];
//         let i = 0;
//         const t = setInterval(() => {
//             i += 1;
//             setRevealed((r) => Math.min(board.length, r + 1));
//             if (i >= board.length) clearInterval(t);
//         }, 450);
//         return () => clearInterval(t);
//     }, [idx]); // eslint-disable-line

//     useEffect(() => {
//         const a = audioRef.current;
//         if (!a) return;
//         if (playing) { a.play().catch(() => {}); } else { a.pause(); }
//     }, [playing, idx]);

//     const onEnded = () => {
//         if (idx < scenes.length - 1) setIdx((i) => i + 1);
//         else setPlaying(false);
//     };

//     const restart = () => { setIdx(0); setPlaying(true); };

//     return (
//         <div className="rounded-xl overflow-hidden border border-border bg-card">
//             {/* whiteboard / video surface */}
//             <div className="relative bg-[#0A192F] text-white aspect-video p-6 overflow-hidden">
//                 <div className="radial-glow" />
//                 <div className="relative z-10 flex items-center justify-between mb-3">
//                     <span className="inline-flex items-center gap-1.5 text-xs bg-destructive/80 px-2 py-0.5 rounded-full">
//                         <Radio className="h-3 w-3" /> AI SOLUTION
//                     </span>
//                     <span className="text-xs text-slate-400">Scene {idx + 1} / {scenes.length}</span>
//                 </div>
//                 <h3 className="relative z-10 font-display font-semibold text-lg mb-4 text-blue-200">{scene?.heading}</h3>
//                 <div className="relative z-10 space-y-2 text-sm sm:text-base">
//                     {(scene?.board || []).map((line, i) => (
//                         <div key={i} className={`transition-all duration-300 [&_p]:m-0 ${i < revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`}>
//                             <Markdown className="md-body-invert">{line}</Markdown>
//                         </div>
//                     ))}
//                 </div>
//                 {playing && (
//                     <div className="absolute bottom-4 left-6 right-6 z-10 flex items-center gap-2 text-xs text-slate-300">
//                         <Volume2 className="h-3.5 w-3.5 animate-pulse" /> Narrating…
//                     </div>
//                 )}
//                 {scene?.audio && (
//                     <audio ref={audioRef} src={`data:audio/mp3;base64,${scene.audio}`} onEnded={onEnded} />
//                 )}
//             </div>

//             {/* controls */}
//             <div className="p-4">
//                 <div className="flex items-center justify-center gap-2 mb-3">
//                     <button data-testid="vid-prev" onClick={() => setIdx((i) => Math.max(0, i - 1))} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"><SkipBack className="h-4 w-4" /></button>
//                     <button data-testid="vid-play" onClick={() => setPlaying((p) => !p)} className="h-12 w-12 rounded-full bg-primary text-white flex items-center justify-center shadow-glow hover:scale-95 transition-transform">
//                         {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
//                     </button>
//                     <button data-testid="vid-next" onClick={() => setIdx((i) => Math.min(scenes.length - 1, i + 1))} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"><SkipForward className="h-4 w-4" /></button>
//                     <button data-testid="vid-restart" onClick={restart} className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"><RotateCcw className="h-4 w-4" /></button>
//                 </div>
//                 <div className="flex items-center gap-1.5">
//                     {scenes.map((_, i) => (
//                         <button key={i} onClick={() => setIdx(i)} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= idx ? "bg-primary" : "bg-secondary"}`} />
//                     ))}
//                 </div>
//                 {question && <p className="text-xs text-muted-foreground mt-3 line-clamp-2"><span className="font-medium text-foreground">Question:</span> {question}</p>}
//             </div>
//         </div>
//     );
// }





















// components/VideoSolutionPlayer.jsx
import { useEffect, useRef, useState, useCallback } from "react";
import {
    Play, Pause, SkipBack, SkipForward, RotateCcw, Volume2, Radio, VolumeX,
    Maximize, Minimize, Loader2, Gauge, Captions
} from "lucide-react";
import Markdown from "./Markdown";

const RATE_STEPS = [0.75, 1, 1.25, 1.5];

export default function VideoSolutionPlayer({ scenes, title, question }) {
    const [idx, setIdx] = useState(0);
    const [playing, setPlaying] = useState(false);
    const [revealed, setRevealed] = useState(0);
    const [progress, setProgress] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [audioError, setAudioError] = useState(false);

    // Voiceover controls
    const [rate, setRate] = useState(1);
    const [muted, setMuted] = useState(false);
    const [showCaptions, setShowCaptions] = useState(true);
    const [ttsSupported] = useState(
        () => typeof window !== "undefined" && "speechSynthesis" in window
    );
    const [voices, setVoices] = useState([]);

    const audioRef = useRef(null);
    const containerRef = useRef(null);
    const autoPlayTimerRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const advanceTimerRef = useRef(null);
    const startedKeyRef = useRef(null); // tracks which (scene, rate, muted) combo is currently narrating

    const scene = scenes?.[idx] || null;
    const totalScenes = scenes?.length || 0;

    // ------------------------------------------------------------
    // Narration source for this scene:
    //  - "file": backend supplied real base64 mp3 audio
    //  - "tts":  browser reads scene.narration aloud (the normal path
    //            today, since the backend doesn't generate audio yet)
    //  - "timer": no speech synthesis available, but there's text —
    //             fall back to a silent, word-count-based timer so
    //             scenes still advance at a sensible pace
    //  - "none": nothing to narrate
    // ------------------------------------------------------------
    const hasFileAudio = !!(scene?.audio && scene.audio.length > 50);
    const hasNarrationText = !!(scene?.narration && scene.narration.trim().length > 0);
    const audioMode = hasFileAudio ? "file" : hasNarrationText && ttsSupported ? "tts" : hasNarrationText ? "timer" : "none";

    // Reset progress / reveal / audio error whenever the scene changes
    useEffect(() => {
        setProgress(0);
        setRevealed(0);
        setAudioError(false);
    }, [idx]);

    // Reveal board lines one by one (unchanged visual pacing)
    useEffect(() => {
        if (!scene) return;
        setRevealed(0);
        setIsLoading(true);
        const board = scene?.board || [];
        let i = 0;
        const t = setInterval(() => {
            i += 1;
            setRevealed((r) => Math.min(board.length, r + 1));
            if (i >= board.length) {
                clearInterval(t);
                setIsLoading(false);
            }
        }, 400);
        return () => clearInterval(t);
    }, [idx, scene]);

    // ------------------------------------------------------------
    // Advance to next scene (or stop at the end)
    // ------------------------------------------------------------
    const advanceToNext = useCallback(() => {
        if (idx < totalScenes - 1) {
            autoPlayTimerRef.current = setTimeout(() => {
                setIdx((i) => i + 1);
                setProgress(0);
                setPlaying(true);
            }, 600);
        } else {
            setPlaying(false);
            setProgress(100);
        }
    }, [idx, totalScenes]);

    const onEndedRef = useRef(advanceToNext);
    useEffect(() => {
        onEndedRef.current = advanceToNext;
    }, [advanceToNext]);

    // ------------------------------------------------------------
    // Load available browser voices (populated asynchronously)
    // ------------------------------------------------------------
    useEffect(() => {
        if (!ttsSupported) return;
        const loadVoices = () => setVoices(window.speechSynthesis.getVoices());
        loadVoices();
        window.speechSynthesis.onvoiceschanged = loadVoices;
        return () => {
            if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null;
        };
    }, [ttsSupported]);

    const pickVoice = useCallback(() => {
        if (!voices.length) return null;
        return (
            voices.find((v) => /en-(US|GB)/i.test(v.lang) && /Google|Natural|Online/i.test(v.name)) ||
            voices.find((v) => v.lang?.toLowerCase().startsWith("en")) ||
            voices[0]
        );
    }, [voices]);

    // ------------------------------------------------------------
    // MODE: "tts" — speak scene.narration aloud with the browser voice
    // ------------------------------------------------------------
    const speakText = useCallback(
        (text) => {
            if (!ttsSupported || !text) return;
            window.speechSynthesis.cancel();

            const utter = new SpeechSynthesisUtterance(text);
            const voice = pickVoice();
            if (voice) utter.voice = voice;
            utter.rate = rate;
            utter.pitch = 1;
            utter.volume = muted ? 0 : 1;

            utter.onboundary = (e) => {
                if (text.length) setProgress(Math.min(100, (e.charIndex / text.length) * 100));
            };
            utter.onend = () => {
                setProgress(100);
                onEndedRef.current?.();
            };
            utter.onerror = () => {
                setAudioError(true);
                // fall back to advancing anyway so the lesson doesn't stall
                onEndedRef.current?.();
            };

            window.speechSynthesis.speak(utter);
        },
        [ttsSupported, rate, muted, pickVoice]
    );

    useEffect(() => {
        if (audioMode !== "tts") return;

        if (!playing) {
            if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
                window.speechSynthesis.pause();
            }
            return;
        }

        const key = `${idx}-${rate}-${muted}`;
        if (window.speechSynthesis.paused && startedKeyRef.current === key) {
            window.speechSynthesis.resume();
        } else {
            speakText(scene.narration);
            startedKeyRef.current = key;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing, idx, rate, muted, audioMode, scene, speakText]);

    // Stop any speech when leaving the component entirely
    useEffect(() => {
        return () => {
            if (ttsSupported) window.speechSynthesis.cancel();
        };
    }, [ttsSupported]);

    // ------------------------------------------------------------
    // MODE: "timer" / "none" — silent, word-count-paced auto-advance
    // for browsers without speech synthesis, or scenes with no
    // narration text at all.
    // ------------------------------------------------------------
    useEffect(() => {
        if (audioMode !== "timer" && audioMode !== "none") return;
        clearInterval(progressIntervalRef.current);
        clearTimeout(advanceTimerRef.current);
        if (!playing) return;

        const text = scene?.narration || "";
        const words = text.trim().split(/\s+/).filter(Boolean).length;
        // ~2.3 words/sec baseline reading pace, scaled by the chosen speed
        const estMs = Math.max(2500, (words / (2.3 * rate)) * 1000);
        const start = Date.now();

        progressIntervalRef.current = setInterval(() => {
            const pct = Math.min(100, ((Date.now() - start) / estMs) * 100);
            setProgress(pct);
        }, 100);

        advanceTimerRef.current = setTimeout(() => {
            clearInterval(progressIntervalRef.current);
            setProgress(100);
            advanceToNext();
        }, estMs);

        return () => {
            clearInterval(progressIntervalRef.current);
            clearTimeout(advanceTimerRef.current);
        };
    }, [playing, idx, audioMode, rate, scene, advanceToNext]);

    // ------------------------------------------------------------
    // MODE: "file" — real base64 mp3 audio, if the backend ever
    // starts supplying it. Takes priority over browser TTS.
    // ------------------------------------------------------------
    useEffect(() => {
        const a = audioRef.current;
        if (!a || audioMode !== "file" || audioError) return;
        const playAudio = async () => {
            try {
                if (playing) await a.play();
                else a.pause();
            } catch {
                setAudioError(true);
            }
        };
        playAudio();
    }, [playing, idx, audioMode, audioError]);

    useEffect(() => {
        if (playing && audioMode === "file" && !audioError) {
            progressIntervalRef.current = setInterval(() => {
                const a = audioRef.current;
                if (a && a.duration && !isNaN(a.duration)) {
                    const pct = (a.currentTime / a.duration) * 100;
                    setProgress(Math.min(pct, 100));
                }
            }, 100);
        } else if (audioMode === "file") {
            clearInterval(progressIntervalRef.current);
        }
        return () => clearInterval(progressIntervalRef.current);
    }, [playing, audioMode, audioError]);

    // Auto-play whenever a new scene loads
    useEffect(() => {
        if (scene && totalScenes > 0 && !audioError) {
            const timer = setTimeout(() => setPlaying(true), 400);
            return () => clearTimeout(timer);
        }
        return () => {
            if (autoPlayTimerRef.current) clearTimeout(autoPlayTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, scene, totalScenes, audioError]);

    const restart = () => {
        if (ttsSupported) window.speechSynthesis.cancel();
        setIdx(0);
        setPlaying(true);
        setRevealed(0);
        setProgress(0);
        setAudioError(false);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.load();
        }
    };

    const togglePlay = () => {
        if (audioError) {
            setAudioError(false);
            if (audioRef.current) audioRef.current.load();
        }
        setPlaying((p) => !p);
    };

    const goToScene = (index) => {
        if (index < 0 || index >= totalScenes) return;
        if (ttsSupported) window.speechSynthesis.cancel();
        setIdx(index);
        setProgress(0);
        setPlaying(true);
        setAudioError(false);
        if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.load();
        }
    };

    const cycleRate = () => {
        setRate((r) => {
            const i = RATE_STEPS.indexOf(r);
            return RATE_STEPS[(i + 1) % RATE_STEPS.length];
        });
    };

    const toggleMute = () => setMuted((m) => !m);

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(() => { });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handleFullscreenChange);
        return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
            if (e.key === " " || e.key === "Space") {
                e.preventDefault();
                togglePlay();
            }
            if (e.key === "ArrowRight") goToScene(Math.min(totalScenes - 1, idx + 1));
            if (e.key === "ArrowLeft") goToScene(Math.max(0, idx - 1));
            if (e.key === "f" || e.key === "F") toggleFullscreen();
            if (e.key === "m" || e.key === "M") toggleMute();
        };
        window.addEventListener("keydown", handleKeyPress);
        return () => window.removeEventListener("keydown", handleKeyPress);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [idx, totalScenes]);

    if (!scene || totalScenes === 0) {
        return (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
                <p>Loading video solution...</p>
            </div>
        );
    }

    const hasAnyAudio = audioMode === "file" || audioMode === "tts";

    return (
        <div ref={containerRef} className="rounded-xl overflow-hidden border border-border bg-card w-full">
            {/* Video surface */}
            <div className="relative bg-gradient-to-br from-[#0A192F] to-[#1a2a4a] text-white min-h-[280px] md:min-h-[320px] lg:min-h-[380px] p-5 md:p-6 overflow-hidden">
                <div className="radial-glow" />

                {/* Top bar */}
                <div className="relative z-10 flex items-center justify-between mb-2">
                    <span className="inline-flex items-center gap-1.5 text-[10px] bg-destructive/80 px-2 py-0.5 rounded-full">
                        <Radio className="h-2.5 w-2.5 animate-pulse" />
                        AI SOLUTION
                    </span>
                    <span className="text-[10px] text-slate-400">Scene {idx + 1} / {totalScenes}</span>
                </div>

                {/* Heading */}
                <h3 className="relative z-10 font-display font-semibold text-lg md:text-xl mb-3 text-blue-200">
                    {scene?.heading || `Step ${idx + 1}`}
                </h3>

                {/* Board content with reveal animation */}
                <div className="relative z-10 space-y-2 text-sm md:text-base max-h-[55%] overflow-y-auto">
                    {(scene?.board || []).map((line, i) => (
                        <div
                            key={i}
                            className={`transition-all duration-300 [&_p]:m-0 [&_p]:text-slate-200 [&_p]:text-sm md:[&_p]:text-base ${i < revealed ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                                }`}
                        >
                            <Markdown className="md-body-invert">{line}</Markdown>
                        </div>
                    ))}
                </div>

                {/* Loading indicator */}
                {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                        <Loader2 className="h-8 w-8 animate-spin text-white" />
                    </div>
                )}

                {/* Audio error indicator */}
                {audioError && audioMode === "file" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                        <div className="bg-destructive/90 text-white px-4 py-2 rounded-lg text-sm">
                            ⚠️ Audio unavailable. Playing visual only.
                        </div>
                    </div>
                )}

                {/* Captions — shows the narration text being spoken, so
                    it's obvious the voiceover is working even before
                    audio kicks in, and helps anyone reading with sound off */}
                {showCaptions && hasNarrationText && (
                    <div className="absolute bottom-20 left-4 right-4 z-10 text-center">
                        <p className="inline-block bg-black/60 text-slate-100 text-xs md:text-sm px-3 py-1.5 rounded-lg leading-snug">
                            {scene.narration}
                        </p>
                    </div>
                )}

                {/* Progress bar on video */}
                {hasAnyAudio && !audioError && (
                    <div className="absolute bottom-10 left-4 right-4 z-10 h-1 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary transition-all duration-100" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {/* Narration status line */}
                {playing && hasAnyAudio && !audioError && (
                    <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center gap-2 text-[10px] text-slate-300">
                        {muted ? <VolumeX className="h-3 w-3 text-primary" /> : <Volume2 className="h-3 w-3 animate-pulse text-primary" />}
                        <span className="animate-pulse">
                            {audioMode === "tts" ? "Narrating" : "Playing audio"} step {idx + 1}...
                        </span>
                        <span className="ml-auto text-[10px] text-slate-500">{Math.round(progress)}%</span>
                    </div>
                )}

                {playing && audioMode === "timer" && (
                    <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center gap-2 text-[10px] text-slate-300">
                        <VolumeX className="h-3 w-3 text-primary" />
                        <span>Voice narration isn't supported in this browser — reading visually.</span>
                    </div>
                )}

                {playing && audioMode === "none" && (
                    <div className="absolute bottom-3 left-4 right-4 z-10 flex items-center gap-2 text-[10px] text-slate-300">
                        <VolumeX className="h-3 w-3 text-primary" />
                        <span>Visual step {idx + 1} of {totalScenes}</span>
                    </div>
                )}

                {/* Real audio element — only used when the backend supplies actual mp3 data */}
                {hasFileAudio && (
                    <audio
                        ref={audioRef}
                        src={`data:audio/mp3;base64,${scene.audio}`}
                        onEnded={() => onEndedRef.current?.()}
                        onTimeUpdate={() => {
                            const a = audioRef.current;
                            if (a && a.duration && !isNaN(a.duration)) {
                                setProgress((a.currentTime / a.duration) * 100);
                            }
                        }}
                        muted={muted}
                        preload="auto"
                    />
                )}

                {/* Scene navigation dots on video */}
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 flex gap-1.5">
                    {scenes.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goToScene(i)}
                            className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-primary" : i < idx ? "w-2.5 bg-primary/40" : "w-2.5 bg-white/20 hover:bg-white/40"
                                }`}
                        />
                    ))}
                </div>
            </div>

            {/* Controls */}
            <div className="p-3 md:p-4">
                <div className="flex items-center justify-center gap-2 md:gap-3 mb-2 flex-wrap">
                    <button
                        onClick={() => goToScene(idx - 1)}
                        disabled={idx === 0}
                        className="h-9 w-9 md:h-10 md:w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <SkipBack className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </button>

                    <button
                        onClick={togglePlay}
                        className="h-11 w-11 md:h-12 md:w-12 rounded-full bg-primary text-white flex items-center justify-center shadow-glow hover:scale-95 transition-transform"
                    >
                        {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </button>

                    <button
                        onClick={() => goToScene(idx + 1)}
                        disabled={idx === totalScenes - 1}
                        className="h-9 w-9 md:h-10 md:w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <SkipForward className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </button>

                    <button
                        onClick={restart}
                        className="h-9 w-9 md:h-10 md:w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                        title="Restart from beginning"
                    >
                        <RotateCcw className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </button>

                    {/* Mute toggle — silences TTS/audio, keeps captions + timing */}
                    <button
                        onClick={toggleMute}
                        className={`h-9 w-9 md:h-10 md:w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors ${muted ? "text-destructive" : ""
                            }`}
                        title={muted ? "Unmute narration" : "Mute narration"}
                    >
                        {muted ? <VolumeX className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Volume2 className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                    </button>

                    {/* Speed control */}
                    <button
                        onClick={cycleRate}
                        className="h-9 md:h-10 px-2.5 rounded-lg border border-border flex items-center gap-1 hover:bg-secondary transition-colors text-xs font-medium"
                        title="Playback speed"
                    >
                        <Gauge className="h-3.5 w-3.5 md:h-4 md:w-4" />
                        {rate}x
                    </button>

                    {/* Captions toggle */}
                    <button
                        onClick={() => setShowCaptions((s) => !s)}
                        className={`h-9 w-9 md:h-10 md:w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors ${showCaptions ? "text-primary border-primary/40" : ""
                            }`}
                        title={showCaptions ? "Hide captions" : "Show captions"}
                    >
                        <Captions className="h-3.5 w-3.5 md:h-4 md:w-4" />
                    </button>

                    <button
                        onClick={toggleFullscreen}
                        className="h-9 w-9 md:h-10 md:w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                        title="Toggle fullscreen"
                    >
                        {isFullscreen ? <Minimize className="h-3.5 w-3.5 md:h-4 md:w-4" /> : <Maximize className="h-3.5 w-3.5 md:h-4 md:w-4" />}
                    </button>
                </div>

                {/* Progress bar with time (file-audio mode only, since it has real duration) */}
                {audioMode === "file" && !audioError && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-mono min-w-[30px]">
                            {formatTime(audioRef.current?.currentTime || 0)}
                        </span>
                        <div className="flex-1 h-1.5 rounded-full bg-secondary cursor-pointer group">
                            <div className="h-full bg-primary rounded-full transition-all relative" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground font-mono min-w-[30px]">
                            {formatTime(audioRef.current?.duration || 0)}
                        </span>
                    </div>
                )}

                {/* Generic progress bar for tts/timer modes, where there's no real audio duration */}
                {(audioMode === "tts" || audioMode === "timer") && (
                    <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progress}%` }} />
                    </div>
                )}

                {/* Scene labels */}
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground/50">
                    <span>Start</span>
                    <span className="text-primary/60">{idx + 1} of {totalScenes}</span>
                    <span>End</span>
                </div>

                {/* Question */}
                {question && (
                    <div className="mt-2 p-2.5 rounded-lg bg-secondary/30 border border-border">
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                            <span className="font-medium text-foreground">Q: </span>
                            {question}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper function to format time
function formatTime(seconds) {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
}