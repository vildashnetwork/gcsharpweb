// pages/VideoLibrary.jsx
import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../lib/api";
import {
    PlayCircle,
    Clock,
    User,
    ThumbsUp,
    ThumbsDown,
    Share2,
    Bookmark,
    BookmarkCheck,
    ChevronLeft,
    ChevronRight,
    Menu,
    X,
    Home,
    TrendingUp,
    BookOpen,
    Sparkles,
    Search,
    Filter,
    Grid3x3,
    List,
    Settings,
    Plus,
    Check,
    AlertCircle,
    Loader2,
    Play,
    Pause,
    Volume2,
    Volume1,
    VolumeX,
    Maximize,
    Minimize,
    PictureInPicture2,
    RotateCcw,
    RotateCw,
    PanelRight,
    PanelBottom,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

// ============================================================
// YouTube helpers
// ============================================================
// Pulls the 11-char video ID out of any common YouTube URL shape
// (watch?v=, youtu.be/, embed/, shorts/), or accepts a bare ID.
function getYouTubeId(url) {
    if (!url) return null;
    const trimmed = url.trim();

    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

    const match = trimmed.match(
        /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
    );
    return match ? match[1] : null;
}

function getYouTubeEmbedUrl(url, { autoplay = false } = {}) {
    const id = getYouTubeId(url);
    if (!id) return null;
    const params = new URLSearchParams({
        rel: "0", // don't show related videos from other channels at the end
        modestbranding: "1",
        playsinline: "1",
        enablejsapi: "1",
        autoplay: autoplay ? "1" : "0",
        origin: typeof window !== "undefined" ? window.location.origin : "",
    });
    return `https://www.youtube.com/embed/${id}?${params.toString()}`;
}

// mm:ss, or h:mm:ss once the video passes an hour
function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// ============================================================
// Custom Video Player
// YouTube-style controls for direct video files (mp4/webm/ogg/mov...).
// YouTube links skip this entirely and use the native YouTube iframe instead —
// this component exists purely to give non-YouTube sources the same feel:
// scrub bar with buffered range, volume slider, speed menu, 10s skip,
// picture-in-picture, fullscreen, keyboard shortcuts, auto-hiding controls.
// ============================================================
const SPEED_OPTIONS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

function CustomVideoPlayer({ src, sources, poster, title, className = "" }) {
    const containerRef = useRef(null);
    const videoElRef = useRef(null);
    const hideTimerRef = useRef(null);

    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [buffered, setBuffered] = useState(0);
    const [volume, setVolume] = useState(1);
    const [muted, setMuted] = useState(false);
    const [rate, setRate] = useState(1);
    const [fullscreen, setFullscreen] = useState(false);
    const [showControls, setShowControls] = useState(true);
    const [showSpeedMenu, setShowSpeedMenu] = useState(false);
    const [scrubbing, setScrubbing] = useState(false);
    const [pipActive, setPipActive] = useState(false);

    const activeSources = sources && sources.length > 0 ? sources : [{ src, label: "Auto" }];
    const [activeSourceIdx, setActiveSourceIdx] = useState(0);
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    // Reset player state whenever the video itself changes
    useEffect(() => {
        setPlaying(false);
        setLoading(true);
        setCurrentTime(0);
        setDuration(0);
        setBuffered(0);
        setActiveSourceIdx(0);
    }, [src]);

    // Wire up native <video> events
    useEffect(() => {
        const el = videoElRef.current;
        if (!el) return;

        const onLoadedMetadata = () => setDuration(el.duration || 0);
        const onTimeUpdate = () => setCurrentTime(el.currentTime);
        const onProgress = () => {
            if (el.buffered.length > 0) {
                setBuffered(el.buffered.end(el.buffered.length - 1));
            }
        };
        const onPlay = () => setPlaying(true);
        const onPause = () => setPlaying(false);
        const onWaiting = () => setLoading(true);
        const onCanPlay = () => setLoading(false);
        const onVolumeChange = () => {
            setVolume(el.volume);
            setMuted(el.muted);
        };
        const onEnterPip = () => setPipActive(true);
        const onLeavePip = () => setPipActive(false);

        el.addEventListener("loadedmetadata", onLoadedMetadata);
        el.addEventListener("timeupdate", onTimeUpdate);
        el.addEventListener("progress", onProgress);
        el.addEventListener("play", onPlay);
        el.addEventListener("pause", onPause);
        el.addEventListener("waiting", onWaiting);
        el.addEventListener("canplay", onCanPlay);
        el.addEventListener("volumechange", onVolumeChange);
        el.addEventListener("enterpictureinpicture", onEnterPip);
        el.addEventListener("leavepictureinpicture", onLeavePip);

        return () => {
            el.removeEventListener("loadedmetadata", onLoadedMetadata);
            el.removeEventListener("timeupdate", onTimeUpdate);
            el.removeEventListener("progress", onProgress);
            el.removeEventListener("play", onPlay);
            el.removeEventListener("pause", onPause);
            el.removeEventListener("waiting", onWaiting);
            el.removeEventListener("canplay", onCanPlay);
            el.removeEventListener("volumechange", onVolumeChange);
            el.removeEventListener("enterpictureinpicture", onEnterPip);
            el.removeEventListener("leavepictureinpicture", onLeavePip);
        };
    }, [activeSourceIdx, src]);

    // Fullscreen state tracking
    useEffect(() => {
        const onFsChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
        document.addEventListener("fullscreenchange", onFsChange);
        return () => document.removeEventListener("fullscreenchange", onFsChange);
    }, []);

    // Auto-hide controls while playing and idle
    const scheduleHide = () => {
        clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
            if (playing) setShowControls(false);
        }, 2500);
    };
    const wake = () => {
        setShowControls(true);
        scheduleHide();
    };
    useEffect(() => {
        if (!playing) {
            setShowControls(true);
            clearTimeout(hideTimerRef.current);
        } else {
            scheduleHide();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [playing]);

    // Keyboard shortcuts, scoped to this player
    useEffect(() => {
        const onKeyDown = (e) => {
            if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== document.body) return;
            const el = videoElRef.current;
            if (!el) return;
            switch (e.key) {
                case " ":
                case "k":
                    e.preventDefault();
                    togglePlay();
                    break;
                case "ArrowRight":
                    el.currentTime = Math.min(el.duration, el.currentTime + 5);
                    break;
                case "ArrowLeft":
                    el.currentTime = Math.max(0, el.currentTime - 5);
                    break;
                case "ArrowUp":
                    e.preventDefault();
                    el.volume = Math.min(1, el.volume + 0.1);
                    break;
                case "ArrowDown":
                    e.preventDefault();
                    el.volume = Math.max(0, el.volume - 0.1);
                    break;
                case "m":
                    el.muted = !el.muted;
                    break;
                case "f":
                    toggleFullscreen();
                    break;
                default:
                    break;
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const togglePlay = () => {
        const el = videoElRef.current;
        if (!el) return;
        if (el.paused) el.play();
        else el.pause();
    };

    const skip = (seconds) => {
        const el = videoElRef.current;
        if (!el) return;
        el.currentTime = Math.min(Math.max(0, el.currentTime + seconds), el.duration || Infinity);
    };

    const onScrub = (e) => {
        const el = videoElRef.current;
        if (!el || !duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        el.currentTime = ratio * duration;
        setCurrentTime(ratio * duration);
    };

    const toggleMute = () => {
        const el = videoElRef.current;
        if (!el) return;
        el.muted = !el.muted;
    };

    const onVolumeSlider = (e) => {
        const el = videoElRef.current;
        if (!el) return;
        const v = Number(e.target.value);
        el.volume = v;
        el.muted = v === 0;
    };

    const changeRate = (r) => {
        const el = videoElRef.current;
        if (!el) return;
        el.playbackRate = r;
        setRate(r);
        setShowSpeedMenu(false);
    };

    const changeQuality = (idx) => {
        const el = videoElRef.current;
        if (!el) return;
        const wasPlaying = !el.paused;
        const time = el.currentTime;
        setActiveSourceIdx(idx);
        setShowQualityMenu(false);
        // let the src swap, then restore position/playback
        requestAnimationFrame(() => {
            const fresh = videoElRef.current;
            if (!fresh) return;
            fresh.currentTime = time;
            if (wasPlaying) fresh.play();
        });
    };

    const toggleFullscreen = () => {
        const container = containerRef.current;
        if (!container) return;
        if (document.fullscreenElement) document.exitFullscreen();
        else container.requestFullscreen?.();
    };

    const togglePip = async () => {
        const el = videoElRef.current;
        if (!el) return;
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else if (document.pictureInPictureEnabled) {
                await el.requestPictureInPicture();
            }
        } catch {
            // PiP unsupported for this element/browser — fail silently
        }
    };

    const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
    const bufferedPct = duration ? (buffered / duration) * 100 : 0;
    const playedPct = duration ? (currentTime / duration) * 100 : 0;

    return (
        <div
            ref={containerRef}
            className={`group relative aspect-video bg-black rounded-xl overflow-hidden select-none ${className}`}
            onMouseMove={wake}
            onMouseLeave={() => playing && setShowControls(false)}
            onClick={(e) => {
                // clicking the video itself toggles play, clicking a control shouldn't
                if (e.target === videoElRef.current) togglePlay();
            }}
            onDoubleClick={toggleFullscreen}
        >
            <video
                ref={videoElRef}
                src={activeSources[activeSourceIdx]?.src}
                poster={poster}
                className="w-full h-full"
                playsInline
                onClick={togglePlay}
            />

            {/* Loading spinner */}
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <Loader2 className="h-10 w-10 text-white animate-spin" />
                </div>
            )}

            {/* Center play/pause tap target + icon flash */}
            {!loading && !playing && (
                <button
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
                >
                    <span className="h-16 w-16 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="h-8 w-8 text-white ml-1" fill="white" />
                    </span>
                </button>
            )}

            {/* Title, top-left, fades with controls */}
            {title && (
                <div
                    className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent transition-opacity duration-200 ${showControls ? "opacity-100" : "opacity-0"
                        }`}
                >
                    <p className="text-white text-sm font-medium line-clamp-1">{title}</p>
                </div>
            )}

            {/* Bottom control bar */}
            <div
                className={`absolute bottom-0 left-0 right-0 px-3 pb-2 pt-8 bg-gradient-to-t from-black/85 via-black/50 to-transparent transition-opacity duration-200 ${showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Scrub bar */}
                <div
                    className="relative h-3 flex items-center cursor-pointer group/scrub mb-1"
                    onMouseDown={(e) => {
                        setScrubbing(true);
                        onScrub(e);
                    }}
                    onMouseMove={(e) => scrubbing && onScrub(e)}
                    onMouseUp={() => setScrubbing(false)}
                >
                    <div className="relative w-full h-1 group-hover/scrub:h-1.5 rounded-full bg-white/25 transition-all">
                        <div className="absolute inset-y-0 left-0 rounded-full bg-white/40" style={{ width: `${bufferedPct}%` }} />
                        <div className="absolute inset-y-0 left-0 rounded-full bg-red-600" style={{ width: `${playedPct}%` }} />
                        <div
                            className="absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full bg-red-600 opacity-0 group-hover/scrub:opacity-100 transition-opacity"
                            style={{ left: `calc(${playedPct}% - 6px)` }}
                        />
                    </div>
                </div>

                <div className="flex items-center gap-3 text-white">
                    <button onClick={togglePlay} className="hover:opacity-80">
                        {playing ? <Pause className="h-5 w-5" fill="white" /> : <Play className="h-5 w-5" fill="white" />}
                    </button>

                    <button onClick={() => skip(-10)} className="hidden sm:block hover:opacity-80" title="Back 10s">
                        <RotateCcw className="h-4.5 w-4.5" />
                    </button>
                    <button onClick={() => skip(10)} className="hidden sm:block hover:opacity-80" title="Forward 10s">
                        <RotateCw className="h-4.5 w-4.5" />
                    </button>

                    {/* Volume */}
                    <div className="flex items-center gap-1.5 group/vol">
                        <button onClick={toggleMute} className="hover:opacity-80">
                            <VolumeIcon className="h-5 w-5" />
                        </button>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.01}
                            value={muted ? 0 : volume}
                            onChange={onVolumeSlider}
                            className="w-0 group-hover/vol:w-16 transition-all duration-200 accent-white h-1 cursor-pointer"
                        />
                    </div>

                    <span className="text-xs font-mono text-white/90 whitespace-nowrap">
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    <div className="flex-1" />

                    {/* Speed */}
                    <div className="relative">
                        <button
                            onClick={() => {
                                setShowSpeedMenu((v) => !v);
                                setShowQualityMenu(false);
                            }}
                            className="text-xs font-semibold px-1.5 hover:opacity-80"
                            title="Playback speed"
                        >
                            {rate}x
                        </button>
                        {showSpeedMenu && (
                            <div className="absolute bottom-8 right-0 bg-black/90 rounded-lg py-1.5 min-w-[88px] shadow-xl">
                                {SPEED_OPTIONS.map((r) => (
                                    <button
                                        key={r}
                                        onClick={() => changeRate(r)}
                                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center justify-between ${r === rate ? "text-red-500" : "text-white"
                                            }`}
                                    >
                                        {r === 1 ? "Normal" : `${r}x`}
                                        {r === rate && <Check className="h-3 w-3" />}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Quality, only shown when multiple sources were provided */}
                    {activeSources.length > 1 && (
                        <div className="relative">
                            <button
                                onClick={() => {
                                    setShowQualityMenu((v) => !v);
                                    setShowSpeedMenu(false);
                                }}
                                className="hover:opacity-80"
                                title="Quality"
                            >
                                <Settings className="h-4.5 w-4.5" />
                            </button>
                            {showQualityMenu && (
                                <div className="absolute bottom-8 right-0 bg-black/90 rounded-lg py-1.5 min-w-[100px] shadow-xl">
                                    {activeSources.map((s, idx) => (
                                        <button
                                            key={s.label}
                                            onClick={() => changeQuality(idx)}
                                            className={`w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 flex items-center justify-between ${idx === activeSourceIdx ? "text-red-500" : "text-white"
                                                }`}
                                        >
                                            {s.label}
                                            {idx === activeSourceIdx && <Check className="h-3 w-3" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {document.pictureInPictureEnabled && (
                        <button onClick={togglePip} className="hover:opacity-80" title="Picture in picture">
                            <PictureInPicture2 className="h-4.5 w-4.5" />
                        </button>
                    )}

                    <button onClick={toggleFullscreen} className="hover:opacity-80" title="Fullscreen">
                        {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ============================================================
// Video Card Component
// ============================================================
function VideoCard({ video, onClick, isActive }) {
    return (
        <div
            onClick={() => onClick(video)}
            className={`group cursor-pointer rounded-xl overflow-hidden bg-card border border-border hover:border-primary/40 transition-all hover:-translate-y-0.5 ${isActive ? "ring-2 ring-primary" : ""
                }`}
        >
            <div className="relative aspect-video bg-secondary">
                {video.thumbnail ? (
                    <img
                        src={video.thumbnail}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-secondary">
                        <PlayCircle className="h-12 w-12 text-primary/40" />
                    </div>
                )}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                    <PlayCircle className="h-14 w-14 text-white opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100" />
                </div>
                <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded">
                    {video.duration || "45:00"}
                </span>
                {video.level && (
                    <span className="absolute top-2 left-2 bg-primary/90 text-white text-xs px-2 py-0.5 rounded">
                        {video.level}
                    </span>
                )}
            </div>
            <div className="p-3">
                <p className="font-semibold text-sm line-clamp-2 group-hover:text-primary transition-colors">
                    {video.title}
                </p>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                    <span>{video.teacher_name || "Unknown"}</span>
                    <span>•</span>
                    <span>{video.views || 0} views</span>
                    <span>•</span>
                    <span>{video.created_at ? formatDistanceToNow(new Date(video.created_at), { addSuffix: true }) : "Recently"}</span>
                </p>
            </div>
        </div>
    );
}

// ============================================================
// Main Video Library Component
// ============================================================
export default function VideoLibrary() {
    const navigate = useNavigate();
    const { videoId } = useParams();
    const [videos, setVideos] = useState([]);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [filterLevel, setFilterLevel] = useState("all");
    const [filterSubject, setFilterSubject] = useState("all");
    const [viewMode, setViewMode] = useState("grid");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const [isSaved, setIsSaved] = useState(false);
    const [relatedVideos, setRelatedVideos] = useState([]);
    const [layoutMode, setLayoutMode] = useState("sidebar"); // "sidebar" | "stacked"
    const videoRef = useRef(null);

    // Available filters
    const [filters, setFilters] = useState({ levels: [], subjects: [] });

    // ============================================================
    // Load Videos
    // ============================================================
    useEffect(() => {
        loadVideos();
    }, []);

    const loadVideos = async () => {
        setLoading(true);
        try {
            const response = await api.get("/courses");
            const data = response.data || [];
            setVideos(data);

            // Extract filters
            const levels = [...new Set(data.map(v => v.level).filter(Boolean))];
            const subjects = [...new Set(data.map(v => v.subject).filter(Boolean))];
            setFilters({ levels, subjects });

            // If videoId in URL, load that video
            if (videoId) {
                const video = data.find(v => v.course_id === videoId);
                if (video) {
                    setCurrentVideo(video);
                    loadRelatedVideos(video, data);
                } else if (data.length > 0) {
                    setCurrentVideo(data[0]);
                    loadRelatedVideos(data[0], data);
                }
            } else if (data.length > 0) {
                setCurrentVideo(data[0]);
                loadRelatedVideos(data[0], data);
            }
        } catch (error) {
            console.error("Failed to load videos:", error);
            toast.error("Failed to load videos");
        } finally {
            setLoading(false);
        }
    };

    const loadRelatedVideos = (video, allVideos) => {
        if (!video) return;
        const related = allVideos
            .filter(v => v.course_id !== video.course_id)
            .filter(v => v.subject === video.subject || v.level === video.level)
            .slice(0, 10);
        setRelatedVideos(related);
    };

    // ============================================================
    // Video Selection
    // ============================================================
    const selectVideo = async (video) => {
        setCurrentVideo(video);
        loadRelatedVideos(video, videos);
        navigate(`/videos/${video.course_id}`, { replace: true });

        // Register view
        try {
            await api.post(`/courses/${video.course_id}/view`);
        } catch (error) {
            // Silently fail
        }
    };

    // ============================================================
    // Filter & Search
    // ============================================================
    const filteredVideos = videos.filter(video => {
        const matchesSearch = video.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            video.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            video.teacher_name?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = filterLevel === "all" || video.level === filterLevel;
        const matchesSubject = filterSubject === "all" || video.subject === filterSubject;
        return matchesSearch && matchesLevel && matchesSubject;
    });

    const currentEmbedUrl = currentVideo ? getYouTubeEmbedUrl(currentVideo.video_url) : null;
    const isYouTubeVideo = Boolean(currentEmbedUrl);
    // In stacked layout the player sits pinned at roughly half the viewport height,
    // with the full video list scrollable underneath it.
    const playerWrapperClass = layoutMode === "stacked" ? "max-h-[50vh] mx-auto" : "";

    // ============================================================
    // Render
    // ============================================================
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* ============================================================
                TOP NAV BAR (YouTube style)
                ============================================================ */}
            <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
                <div className="flex items-center justify-between px-4 h-14">
                    {/* Left: Logo + Menu */}
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSidebarOpen(!sidebarOpen)}
                            className="p-2 hover:bg-secondary rounded-full transition-colors lg:hidden"
                        >
                            <Menu className="h-5 w-5" />
                        </button>
                        <div
                            onClick={() => navigate("/")}
                            className="flex items-center gap-2 cursor-pointer"
                        >
                            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shadow-glow">
                                <PlayCircle className="h-5 w-5 text-white" />
                            </div>
                            <span className="font-display font-bold text-lg hidden sm:block">GCSHARP</span>
                            <span className="text-xs text-muted-foreground font-medium hidden sm:block">Videos</span>
                        </div>
                    </div>

                    {/* Center: Search */}
                    <div className="flex-1 max-w-2xl mx-4 hidden md:flex">
                        <div className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search videos..."
                                className="pl-9 h-10 rounded-full bg-secondary border-0 focus-visible:ring-1"
                            />
                        </div>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-2">
                        <button className="p-2 hover:bg-secondary rounded-full transition-colors hidden sm:flex">
                            <Settings className="h-5 w-5" />
                        </button>
                        <button
                            onClick={() => navigate("/")}
                            className="p-2 hover:bg-secondary rounded-full transition-colors"
                        >
                            <Home className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Mobile Search */}
                <div className="px-4 pb-2 md:hidden">
                    <div className="relative w-full">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search videos..."
                            className="pl-9 h-10 rounded-full bg-secondary border-0 focus-visible:ring-1"
                        />
                    </div>
                </div>
            </header>

            {/* ============================================================
                SIDEBAR (Mobile)
                ============================================================ */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/50 lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                >
                    <div
                        className="absolute top-0 left-0 w-72 h-full bg-background p-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-2">
                                <PlayCircle className="h-6 w-6 text-primary" />
                                <span className="font-display font-bold">GCSHARP</span>
                            </div>
                            <button
                                onClick={() => setSidebarOpen(false)}
                                className="p-2 hover:bg-secondary rounded-full"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                        <nav className="space-y-2">
                            {[
                                { icon: Home, label: "Home", path: "/" },
                                { icon: TrendingUp, label: "Trending", path: "/videos" },
                                { icon: BookOpen, label: "Study Center", path: "/study" },
                                { icon: Sparkles, label: "AI Tutor", path: "/ai" },
                            ].map((item) => (
                                <button
                                    key={item.label}
                                    onClick={() => {
                                        navigate(item.path);
                                        setSidebarOpen(false);
                                    }}
                                    className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-secondary transition-colors"
                                >
                                    <item.icon className="h-5 w-5" />
                                    <span>{item.label}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>
            )}

            {/* ============================================================
                MAIN CONTENT (YouTube style two-column layout)
                ============================================================ */}
            <div className={layoutMode === "sidebar" ? "flex" : "max-w-5xl mx-auto"}>
                {/* Left: Video Player + Details */}
                <div className={layoutMode === "sidebar" ? "flex-1 p-4 lg:p-6 max-w-5xl" : "p-4 lg:p-6"}>
                    {currentVideo ? (
                        <>
                            {/* Video Player.
                                YouTube links get the real, native YouTube iframe (its own
                                play/seek/volume/captions/quality/speed/fullscreen/PiP controls).
                                Everything else (mp4, webm, ogg, mov...) gets a custom player
                                built to look and behave the same way. */}
                            {isYouTubeVideo ? (
                                <div className={`relative aspect-video bg-black rounded-xl overflow-hidden ${playerWrapperClass}`}>
                                    <iframe
                                        key={currentEmbedUrl}
                                        ref={videoRef}
                                        src={currentEmbedUrl}
                                        className="w-full h-full"
                                        title={currentVideo.title}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                </div>
                            ) : currentVideo.video_url ? (
                                <CustomVideoPlayer
                                    key={currentVideo.video_url}
                                    src={currentVideo.video_url}
                                    sources={currentVideo.sources}
                                    poster={currentVideo.thumbnail}
                                    title={currentVideo.title}
                                    className={playerWrapperClass}
                                />
                            ) : (
                                <div className={`relative aspect-video bg-black rounded-xl overflow-hidden flex flex-col items-center justify-center text-slate-400 gap-2 ${playerWrapperClass}`}>
                                    <AlertCircle className="h-8 w-8" />
                                    <p className="text-sm">This video doesn't have a playable link.</p>
                                </div>
                            )}

                            {/* Video Info */}
                            <div className="mt-4">
                                <h1 className="text-xl font-display font-bold">{currentVideo.title}</h1>
                                <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-5 w-5 text-primary" />
                                            </div>
                                            <div>
                                                <p className="font-medium text-sm">{currentVideo.teacher_name || "Unknown"}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {currentVideo.views || 0} views • {currentVideo.created_at ? formatDistanceToNow(new Date(currentVideo.created_at), { addSuffix: true }) : "Recently"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setIsLiked(!isLiked)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${isLiked ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                                                }`}
                                        >
                                            <ThumbsUp className="h-4 w-4" />
                                            <span className="text-sm">12</span>
                                        </button>
                                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors">
                                            <ThumbsDown className="h-4 w-4" />
                                        </button>
                                        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors">
                                            <Share2 className="h-4 w-4" />
                                            <span className="text-sm hidden sm:inline">Share</span>
                                        </button>
                                        <button
                                            onClick={() => setIsSaved(!isSaved)}
                                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors ${isSaved ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                                                }`}
                                        >
                                            {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                                            <span className="text-sm hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
                                        </button>
                                        <button
                                            onClick={() => setLayoutMode(m => m === "sidebar" ? "stacked" : "sidebar")}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border hover:bg-secondary transition-colors"
                                            title={layoutMode === "sidebar" ? "Move video list below the player" : "Move video list to the sidebar"}
                                        >
                                            {layoutMode === "sidebar" ? <PanelBottom className="h-4 w-4" /> : <PanelRight className="h-4 w-4" />}
                                            <span className="text-sm hidden sm:inline">{layoutMode === "sidebar" ? "Stack" : "Sidebar"}</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Description */}
                                <div className="mt-4 p-4 rounded-xl bg-secondary/50">
                                    <p className="text-sm leading-relaxed">{currentVideo.description || "No description available."}</p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                            {currentVideo.subject || "General"}
                                        </span>
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
                                            {currentVideo.level || "All levels"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-[60vh] text-muted-foreground">
                            <PlayCircle className="h-16 w-16 mb-4 opacity-20" />
                            <p className="text-lg font-medium">No video selected</p>
                            <p className="text-sm">Choose a video from the library to start learning</p>
                        </div>
                    )}
                </div>

                {/* Right: Sidebar - Video List (sidebar layout only) */}
                {layoutMode === "sidebar" && (
                    <div className="w-full lg:w-[420px] p-4 border-l border-border hidden lg:block">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="font-semibold text-sm">Up next</h3>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setViewMode("grid")}
                                    className={`p-1.5 rounded ${viewMode === "grid" ? "bg-secondary" : ""}`}
                                >
                                    <Grid3x3 className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => setViewMode("list")}
                                    className={`p-1.5 rounded ${viewMode === "list" ? "bg-secondary" : ""}`}
                                >
                                    <List className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Filters */}
                        <div className="flex flex-wrap gap-2 mb-4">
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="text-xs px-2 py-1 rounded-full border border-border bg-background"
                            >
                                <option value="all">All Levels</option>
                                {filters.levels.map(level => (
                                    <option key={level} value={level}>{level}</option>
                                ))}
                            </select>
                            <select
                                value={filterSubject}
                                onChange={(e) => setFilterSubject(e.target.value)}
                                className="text-xs px-2 py-1 rounded-full border border-border bg-background"
                            >
                                <option value="all">All Subjects</option>
                                {filters.subjects.map(subject => (
                                    <option key={subject} value={subject}>{subject}</option>
                                ))}
                            </select>
                        </div>

                        {/* Video List */}
                        <div className={`space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 scrollbar-thin ${viewMode === "grid" ? "grid grid-cols-2 gap-2" : ""}`}>
                            {filteredVideos.length > 0 ? (
                                filteredVideos.map(video => (
                                    <div
                                        key={video.course_id}
                                        onClick={() => selectVideo(video)}
                                        className={`cursor-pointer rounded-lg overflow-hidden transition-all ${currentVideo?.course_id === video.course_id
                                            ? "ring-2 ring-primary"
                                            : "hover:bg-secondary/50"
                                            } ${viewMode === "grid" ? "aspect-video" : "flex gap-3 p-2"}`}
                                    >
                                        {viewMode === "grid" ? (
                                            <div className="relative w-full h-full bg-secondary">
                                                {video.thumbnail && (
                                                    <img
                                                        src={video.thumbnail}
                                                        alt={video.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                )}
                                                <PlayCircle className="absolute inset-0 m-auto h-8 w-8 text-white/60" />
                                                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                    {video.duration || "45:00"}
                                                </span>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="relative w-40 shrink-0 aspect-video bg-secondary rounded overflow-hidden">
                                                    {video.thumbnail && (
                                                        <img
                                                            src={video.thumbnail}
                                                            alt={video.title}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    )}
                                                    <PlayCircle className="absolute inset-0 m-auto h-6 w-6 text-white/50" />
                                                    <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                                                        {video.duration || "45:00"}
                                                    </span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-sm line-clamp-2">{video.title}</p>
                                                    <p className="text-xs text-muted-foreground truncate mt-1">{video.teacher_name || "Unknown"}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {video.views || 0} views
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    <p className="text-sm">No videos found</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* ============================================================
                STACKED LAYOUT: full video grid below the player
                ============================================================ */}
            {layoutMode === "stacked" && (
                <div className="max-w-6xl mx-auto p-4 lg:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <h3 className="font-semibold text-sm">All videos</h3>
                        <div className="flex flex-wrap gap-2">
                            <select
                                value={filterLevel}
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className="text-xs px-2 py-1 rounded-full border border-border bg-background"
                            >
                                <option value="all">All Levels</option>
                                {filters.levels.map(level => (
                                    <option key={level} value={level}>{level}</option>
                                ))}
                            </select>
                            <select
                                value={filterSubject}
                                onChange={(e) => setFilterSubject(e.target.value)}
                                className="text-xs px-2 py-1 rounded-full border border-border bg-background"
                            >
                                <option value="all">All Subjects</option>
                                {filters.subjects.map(subject => (
                                    <option key={subject} value={subject}>{subject}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                        {filteredVideos.length > 0 ? (
                            filteredVideos.map(video => (
                                <VideoCard
                                    key={video.course_id}
                                    video={video}
                                    onClick={selectVideo}
                                    isActive={currentVideo?.course_id === video.course_id}
                                />
                            ))
                        ) : (
                            <div className="col-span-full text-center py-8 text-muted-foreground">
                                <p className="text-sm">No videos found</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ============================================================
                MOBILE: Horizontal scroll for related videos (sidebar layout only —
                stacked layout already shows every video in the grid above)
                ============================================================ */}
            {layoutMode === "sidebar" && (
                <div className="lg:hidden p-4 border-t border-border">
                    <h3 className="font-semibold text-sm mb-3">Related videos</h3>
                    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                        {filteredVideos.slice(0, 10).map(video => (
                            <div
                                key={video.course_id}
                                onClick={() => selectVideo(video)}
                                className="min-w-[200px] cursor-pointer rounded-lg overflow-hidden bg-card border border-border hover:border-primary/40 transition-all"
                            >
                                <div className="relative aspect-video bg-secondary">
                                    {video.thumbnail && (
                                        <img
                                            src={video.thumbnail}
                                            alt={video.title}
                                            className="w-full h-full object-cover"
                                        />
                                    )}
                                    <PlayCircle className="absolute inset-0 m-auto h-8 w-8 text-white/60" />
                                </div>
                                <div className="p-2">
                                    <p className="font-medium text-xs line-clamp-2">{video.title}</p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{video.teacher_name || "Unknown"}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}