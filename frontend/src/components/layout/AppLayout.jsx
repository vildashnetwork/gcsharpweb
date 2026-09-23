
// import { useState, useRef, useEffect } from "react";
// import { useNavigate, useLocation } from "react-router-dom";
// import { useAuth } from "../../context/AuthContext";
// import { useTheme } from "../../context/ThemeContext";
// import {
//     LayoutGrid, BookOpen, Bot, BarChart3, Presentation, Settings as SettingsIcon,
//     GraduationCap, Upload, HelpCircle, LogOut, Search, Bell, Moon, Sun, Menu, X, Video,
// } from "lucide-react";
// import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
// import { Button } from "../ui/button";

// const NAV = [
//     { key: "dashboard", label: "Dashboard", icon: LayoutGrid, path: "/dashboard" },
//     { key: "study", label: "Study Center", icon: BookOpen, path: "/study" },
//     { key: "ai", label: "AI Assistant", icon: Bot, path: "/ai" },
//     { key: "analytics", label: "Analytics", icon: BarChart3, path: "/analytics" },
//     { key: "lesson-videos", label: "Lesson Videos", icon: Video, path: "/videos" },
//     { key: "teacher", label: "Teacher Portal", icon: Presentation, path: "/teacher" },
//     { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
// ];

// export default function AppLayout({ children }) {
//     const navigate = useNavigate();
//     const location = useLocation();
//     const { user, logout } = useAuth();
//     const { theme, toggle } = useTheme();
//     const [mobileOpen, setMobileOpen] = useState(false);
//     const [searchActive, setSearchActive] = useState(false);
//     const searchInputRef = useRef(null);
//     const searchContainerRef = useRef(null);

//     const initials = (user?.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

//     // Handle click outside to close search on mobile
//     useEffect(() => {
//         const handleClickOutside = (e) => {
//             if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
//                 setSearchActive(false);
//             }
//         };
//         document.addEventListener("mousedown", handleClickOutside);
//         return () => document.removeEventListener("mousedown", handleClickOutside);
//     }, []);

//     // Handle escape key to close search
//     useEffect(() => {
//         const handleEsc = (e) => {
//             if (e.key === "Escape") {
//                 setSearchActive(false);
//                 searchInputRef.current?.blur();
//             }
//         };
//         document.addEventListener("keydown", handleEsc);
//         return () => document.removeEventListener("keydown", handleEsc);
//     }, []);

//     const handleSearchFocus = () => {
//         setSearchActive(true);
//     };

//     const handleSearchClose = () => {
//         setSearchActive(false);
//         searchInputRef.current?.blur();
//         if (searchInputRef.current) {
//             searchInputRef.current.value = "";
//         }
//     };

//     const SidebarContent = () => (
//         <div className="flex flex-col h-full bg-sidebar">
//             <div className="p-6 flex items-center gap-3">
//                 <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
//                     <GraduationCap className="h-5 w-5 text-white" />
//                 </div>
//                 <div>
//                     <h1 className="font-display font-bold text-lg leading-none text-primary">GCSHARP</h1>
//                     <p className="text-xs text-muted-foreground mt-0.5">Sharpening Potential</p>
//                 </div>
//             </div>

//             <nav className="flex-1 px-4 space-y-1">
//                 {NAV.map((item) => {
//                     const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
//                     return (
//                         <button
//                             key={item.key}
//                             data-testid={`sidebar-nav-${item.key}`}
//                             onClick={() => { navigate(item.path); setMobileOpen(false); }}
//                             className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary text-white shadow-glow" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
//                         >
//                             <item.icon className="h-4.5 w-4.5" />
//                             {item.label}
//                         </button>
//                     );
//                 })}
//             </nav>

//             <div className="p-4 space-y-3">
//                 <Button
//                     data-testid="upload-content-btn"
//                     onClick={() => navigate("/teacher")}
//                     className="w-full h-11 gap-2 shadow-glow"
//                 >
//                     <Upload className="h-4 w-4" /> Upload Content
//                 </Button>
//                 <div className="border-t border-border pt-3 space-y-1">
//                     <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
//                         <HelpCircle className="h-4.5 w-4.5" /> Help Center
//                     </button>
//                     <button
//                         data-testid="logout-btn"
//                         onClick={logout}
//                         className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
//                     >
//                         <LogOut className="h-4.5 w-4.5" /> Logout
//                     </button>
//                 </div>
//             </div>
//         </div>
//     );

//     return (
//         <div className="min-h-screen bg-background flex">
//             {/* desktop sidebar */}
//             <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-border sticky top-0 h-screen">
//                 <SidebarContent />
//             </aside>

//             {/* mobile drawer */}
//             {mobileOpen && (
//                 <div className="fixed inset-0 z-50 lg:hidden">
//                     <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
//                     <div className="absolute left-0 top-0 h-full w-[260px] border-r border-border bg-sidebar">
//                         <SidebarContent />
//                     </div>
//                 </div>
//             )}

//             <div className="flex-1 min-w-0 flex flex-col">
//                 {/* topbar */}
//                 <header className="sticky top-0 z-40 glass border-b border-border">
//                     <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
//                         {/* Mobile menu button - hidden when search is active */}
//                         <button
//                             className={`lg:hidden transition-all duration-300 ${searchActive ? "opacity-0 w-0 overflow-hidden px-0" : "opacity-100"}`}
//                             onClick={() => setMobileOpen(true)}
//                             data-testid="mobile-menu-btn"
//                         >
//                             <Menu className="h-6 w-6" />
//                         </button>

//                         {/* Search container */}
//                         <div
//                             ref={searchContainerRef}
//                             className={`flex-1 transition-all duration-300 ${searchActive ? "max-w-full" : "max-w-xl"}`}
//                         >
//                             <div className="relative">
//                                 <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors ${searchActive ? "text-primary" : ""}`} />

//                                 <input
//                                     ref={searchInputRef}
//                                     data-testid="global-search"
//                                     placeholder="Search past papers or ask AI anything…"
//                                     onFocus={handleSearchFocus}
//                                     onKeyDown={(e) => {
//                                         if (e.key === "Enter" && e.target.value.trim()) {
//                                             navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
//                                             setSearchActive(false);
//                                         }
//                                     }}
//                                     className={`w-full h-11 pl-11 pr-4 rounded-full bg-secondary/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 ${searchActive ? "ring-2 ring-primary/50 bg-background" : ""
//                                         }`}
//                                 />
//                                 {/* Close button for mobile search */}
//                                 {searchActive && (
//                                     <button
//                                         onClick={handleSearchClose}
//                                         className="absolute right-3 top-1/2 -translate-y-1/2 lg:hidden text-muted-foreground hover:text-foreground transition-colors"
//                                     >
//                                         <X className="h-5 w-5" />
//                                     </button>
//                                 )}
//                             </div>
//                         </div>

//                         {/* Right side buttons - hidden when search is active on mobile */}
//                         <div className={`flex items-center gap-2 transition-all duration-300 ${searchActive ? "lg:flex hidden" : "flex"
//                             }`}>
//                             <button
//                                 onClick={toggle}
//                                 data-testid="theme-toggle"
//                                 className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
//                             >
//                                 {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
//                             </button>
//                             <button className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors relative" data-testid="notifications-btn">
//                                 <Bell className="h-5 w-5" />
//                                 <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
//                             </button>
//                             <Avatar className="h-10 w-10 border border-border" data-testid="user-avatar">
//                                 <AvatarImage src={user?.picture} />
//                                 <AvatarFallback className="bg-primary text-white text-sm">{initials}</AvatarFallback>
//                             </Avatar>
//                         </div>
//                     </div>
//                 </header>

//                 <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
//             </div>
//         </div>
//     );
// }
























































// components/layout/AppLayout.jsx
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
    LayoutGrid, BookOpen, Bot, BarChart3, Presentation, Settings as SettingsIcon,
    GraduationCap, Upload, HelpCircle, LogOut, Search, Bell, Moon, Sun, Menu, X, Video,
    Check, XCircle, Info, AlertCircle, Flame, Users
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";
import io from "socket.io-client";
import api from "../../lib/api";
import { toast } from "sonner";

// WebSocket URL (adjust to your backend)
const SOCKET_URL = import.meta.env.VITE_API_URL || "https://gcsharpweb.onrender.com";

function urlBase64ToUint8Array(value) {
    const padding = "=".repeat((4 - (value.length % 4)) % 4);
    const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
    return Uint8Array.from(window.atob(base64), (character) => character.charCodeAt(0));
}

const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, path: "/dashboard" },
    { key: "study", label: "Study Center", icon: BookOpen, path: "/study" },
    { key: "groups", label: "Study Groups", icon: Users, path: "/groups" },
    { key: "ai", label: "AI Assistant", icon: Bot, path: "/ai" },
    { key: "analytics", label: "Analytics", icon: BarChart3, path: "/analytics" },
    { key: "lesson-videos", label: "Lesson Videos", icon: Video, path: "/videos" },
    { key: "teacher", label: "Teacher Portal", icon: Presentation, path: "/teacher" },
    { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
];

// ----- Notification Dropdown Component -----
function NotificationDropdown({ notifications, unreadCount, onMarkRead, onMarkAllRead, onClose }) {
    const getIcon = (type) => {
        switch (type) {
            case "streak": return <Flame className="h-4 w-4 text-orange-500" />;
            case "reminder": return <Bell className="h-4 w-4 text-blue-500" />;
            case "xp": return <Zap className="h-4 w-4 text-yellow-500" />;
            default: return <Info className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getTimeAgo = (date) => {
        const diff = Date.now() - new Date(date).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "just now";
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    };

    return (
        <div className="absolute right-0 top-12 z-50 w-80 max-h-[400px] overflow-y-auto rounded-xl border border-border bg-card shadow-2xl py-2">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <span className="font-medium text-sm">Notifications</span>
                {unreadCount > 0 && (
                    <button
                        onClick={onMarkAllRead}
                        className="text-xs text-primary hover:underline"
                    >
                        Mark all as read
                    </button>
                )}
            </div>
            {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No notifications yet
                </div>
            ) : (
                notifications.map((n) => (
                    <div
                        key={n._id}
                        className={`flex items-start gap-3 px-4 py-3 hover:bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-0 ${!n.read ? "bg-primary/5" : ""}`}
                        onClick={() => onMarkRead(n._id)}
                    >
                        <div className="mt-0.5">{getIcon(n.type)}</div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-foreground break-words">{n.message}</p>
                            {n.link && (
                                <a
                                    href={n.link}
                                    className="text-xs text-primary hover:underline block mt-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    View
                                </a>
                            )}
                            <span className="text-[10px] text-muted-foreground block mt-0.5">
                                {getTimeAgo(n.createdAt)}
                            </span>
                        </div>
                        {!n.read && <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                    </div>
                ))
            )}
            <button
                onClick={onClose}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground py-2 border-t border-border mt-1"
            >
                Close
            </button>
        </div>
    );
}

// ----- Main AppLayout -----
export default function AppLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchActive, setSearchActive] = useState(false);
    const searchInputRef = useRef(null);
    const searchContainerRef = useRef(null);

    // Notification state
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [socket, setSocket] = useState(null);

    // Study-groups unread badge state
    const [groupUnreadMap, setGroupUnreadMap] = useState({});
    const [groupMeta, setGroupMeta] = useState(null);

    const initials = (user?.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

    // ----- Fetch initial notifications -----
    const fetchNotifications = async () => {
        try {
            const res = await api.get("/notifications");
            setNotifications(res.data);
            setUnreadCount(res.data.filter(n => !n.read).length);
        } catch (err) {
            console.error("Failed to fetch notifications", err);
        }
    };

    // ----- Fetch study-groups summary (unread badge) -----
    const fetchGroupMeta = async () => {
        try {
            const res = await api.get("/groups/summary/badges");
            setGroupMeta(res.data);
            setGroupUnreadMap(res.data?.unread_by_group || {});
        } catch (err) {
            console.error("Failed to fetch group badges", err);
        }
    };

    // ----- Mark notification as read -----
    const markAsRead = async (notifId) => {
        try {
            await api.put(`/notifications/${notifId}/read`);
            setNotifications(prev =>
                prev.map(n => n._id === notifId ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error("Failed to mark as read", err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.put("/notifications/read-all");
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error("Failed to mark all as read", err);
        }
    };

    // ----- WebSocket connection -----
    useEffect(() => {
        if (!user?.user_id) return;

        // Connect to WebSocket with user ID
        const newSocket = io(SOCKET_URL, {
            path: "/ws/notifications",
            query: { user_id: user.user_id },
            transports: ["websocket"],
        });

        newSocket.on("connect", () => {
            console.log("Notification WebSocket connected");
        });

        newSocket.on("notification", (data) => {
            // Add new notification to the list
            setNotifications(prev => [data, ...prev]);
            setUnreadCount(prev => prev + 1);

            // Keep the bottom-tab group unread badge fresh when a group notification arrives.
            if (data?.type === "group_message" && data?.link?.startsWith("/groups/")) {
                try {
                    const group_id = data.link.slice("/groups/".length).split("/")[0];
                    if (group_id) fetchGroupMeta();
                } catch (_) { /* best effort */ }
            }

            // Show browser notification if supported
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("GCSHARP", {
                    body: data.message,
                    icon: "/logo192.png",
                });
            }

            // Also show toast
            toast.info(data.message, { duration: 5000 });
        });

        newSocket.on("disconnect", () => {
            console.log("Notification WebSocket disconnected");
        });

        setSocket(newSocket);

        // Cleanup
        return () => {
            newSocket.disconnect();
        };
    }, [user]);

    // Fetch initial notifications when user logs in
    useEffect(() => {
        if (user?.user_id) {
            fetchNotifications();
            fetchGroupMeta();
        }
    }, [user]);

    // Register this device for notifications that arrive while the site is closed.
    useEffect(() => {
        if (!user?.user_id || !("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) return;

        const registerPush = async () => {
            const permission = await Notification.requestPermission();
            if (permission !== "granted") return;

            const registration = await navigator.serviceWorker.register("/push-sw.js");
            const { data } = await api.get("/notifications/push-key");
            let subscription = await registration.pushManager.getSubscription();
            if (!subscription) {
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(data.public_key),
                });
            }
            await api.post("/notifications/push-subscription", subscription.toJSON());
        };

        registerPush().catch((error) => {
            console.error("Push notification registration failed:", error);
        });
    }, [user]);

    // ----- Request notification permission -----
    const requestNotificationPermission = () => {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
    };

    // ----- Handle click outside to close search and dropdown -----
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setSearchActive(false);
            }
            // Close dropdown when clicking outside
            if (isDropdownOpen) {
                const dropdown = document.getElementById("notification-dropdown");
                if (dropdown && !dropdown.contains(e.target)) {
                    setIsDropdownOpen(false);
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isDropdownOpen]);

    // ----- Handle escape key -----
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                setSearchActive(false);
                searchInputRef.current?.blur();
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, []);

    const handleSearchFocus = () => setSearchActive(true);
    const handleSearchClose = () => {
        setSearchActive(false);
        searchInputRef.current?.blur();
        if (searchInputRef.current) searchInputRef.current.value = "";
    };

    // Toggle dropdown
    const toggleDropdown = () => {
        setIsDropdownOpen(prev => !prev);
        // Request permission if not yet
        requestNotificationPermission();
        // Optionally mark notifications as read on open? We'll let user click individually.
    };

    // ----- Sidebar content (unchanged) -----
    const SidebarContent = () => (
        <div className="flex flex-col h-full bg-sidebar">
            <div className="p-6 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center shadow-glow">
                    <GraduationCap className="h-5 w-5 text-white" />
                </div>
                <div>
                    <h1 className="font-display font-bold text-lg leading-none text-primary">GCSHARP</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">Sharpening Potential</p>
                </div>
            </div>
            <nav className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-1 scrollbar-thin">
                {NAV.map((item) => {
                    const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                    return (
                        <button
                            key={item.key}
                            data-testid={`sidebar-nav-${item.key}`}
                            onClick={() => { navigate(item.path); setMobileOpen(false); }}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${active ? "bg-primary text-white shadow-glow" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
                        >
                            <item.icon className="h-4.5 w-4.5" />
                            {item.label}
                        </button>
                    );
                })}
            </nav>
            <div className="p-4 space-y-3">
                <Button
                    data-testid="upload-content-btn"
                    onClick={() => navigate("/teacher")}
                    className="w-full h-11 gap-2 shadow-glow"
                >
                    <Upload className="h-4 w-4" /> Upload Content
                </Button>
                <div className="border-t border-border pt-3 space-y-1">
                    <button className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-muted-foreground hover:bg-secondary transition-colors">
                        <HelpCircle className="h-4.5 w-4.5" /> Help Center
                    </button>
                    <button
                        data-testid="logout-btn"
                        onClick={logout}
                        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-destructive hover:bg-destructive/10 transition-colors"
                    >
                        <LogOut className="h-4.5 w-4.5" /> Logout
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background flex">
            {/* desktop sidebar */}
            <aside className="hidden lg:flex w-[260px] shrink-0 border-r border-border sticky top-0 h-screen">
                <SidebarContent />
            </aside>

            {/* mobile drawer */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
                    <div className="absolute left-0 top-0 h-full w-[260px] border-r border-border bg-sidebar">
                        <SidebarContent />
                    </div>
                </div>
            )}

            <div className="flex-1 min-w-0 flex flex-col">
                {/* topbar */}
                <header className="sticky top-0 z-40 glass border-b border-border">
                    <div className="flex items-center gap-3 px-4 sm:px-6 h-16">
                        {/* Mobile menu button */}
                        <button
                            className={`lg:hidden transition-all duration-300 ${searchActive ? "opacity-0 w-0 overflow-hidden px-0" : "opacity-100"}`}
                            onClick={() => setMobileOpen(true)}
                            data-testid="mobile-menu-btn"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {/* Search */}
                        <div
                            ref={searchContainerRef}
                            className={`flex-1 transition-all duration-300 ${searchActive ? "max-w-full" : "max-w-xl"}`}
                        >
                            <div className="relative">
                                <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors ${searchActive ? "text-primary" : ""}`} />
                                <input
                                    ref={searchInputRef}
                                    data-testid="global-search"
                                    placeholder="Search past papers or ask AI anything…"
                                    onFocus={handleSearchFocus}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" && e.target.value.trim()) {
                                            navigate(`/search?q=${encodeURIComponent(e.target.value.trim())}`);
                                            setSearchActive(false);
                                        }
                                    }}
                                    className={`w-full h-11 pl-11 pr-4 rounded-full bg-secondary/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 ${searchActive ? "ring-2 ring-primary/50 bg-background" : ""}`}
                                />
                                {searchActive && (
                                    <button
                                        onClick={handleSearchClose}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 lg:hidden text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <X className="h-5 w-5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Right side buttons */}
                        <div className={`flex items-center gap-2 transition-all duration-300 ${searchActive ? "lg:flex hidden" : "flex"}`}>
                            <button
                                onClick={toggle}
                                data-testid="theme-toggle"
                                className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                            </button>

                            {/* Notification Bell with dropdown */}
                            <div className="relative">
                                <button
                                    onClick={toggleDropdown}
                                    className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors relative"
                                    data-testid="notifications-btn"
                                >
                                    <Bell className="h-5 w-5" />
                                    {unreadCount > 0 && (
                                        <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-white text-[10px] flex items-center justify-center font-bold">
                                            {unreadCount > 9 ? "9+" : unreadCount}
                                        </span>
                                    )}
                                </button>
                                {isDropdownOpen && (
                                    <div id="notification-dropdown" className="absolute right-0 top-12">
                                        <NotificationDropdown
                                            notifications={notifications}
                                            unreadCount={unreadCount}
                                            onMarkRead={markAsRead}
                                            onMarkAllRead={markAllAsRead}
                                            onClose={() => setIsDropdownOpen(false)}
                                        />
                                    </div>
                                )}
                            </div>

                            <Avatar onClick={() => { navigate("/settings") }} className="h-10 w-10 cursor-pointer border border-border" data-testid="user-avatar">
                                <AvatarImage src={user?.picture} />
                                <AvatarFallback className="bg-primary text-white text-sm">{initials}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                {/* Mobile bottom tab bar — quick switch to Study Groups */}
                <nav className="lg:hidden flex items-center gap-1 px-2 pb-1 pt-1 border-t border-border/60 bg-sidebar/90 backdrop-blur shrink-0">
                    {NAV.filter(item => ["dashboard", "study", "groups", "ai", "analytics"].includes(item.key)).map((item) => {
                        const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
                        const isGroups = item.key === "groups";
                        const badge = isGroups && typeof groupUnreadMap === "object" ? groupUnreadMap[item.key] : null;
                        return (
                            <button
                                key={item.key}
                                data-testid={`bottom-tab-${item.key}`}
                                onClick={() => { navigate(item.path); setMobileOpen(false); }}
                                className={`relative flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-medium transition-colors ${active ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                <item.icon className="h-4.5 w-4.5" />
                                <span className="ml-1.5">{item.label}</span>
                                {isGroups && badge != null && badge > 0 && (
                                    <span className="absolute -top-1 right-1/2 -translate-x-1/2 h-4 w-4 rounded-full bg-destructive text-white text-[9px] flex items-center justify-center font-bold">
                                        {badge > 99 ? "99+" : badge}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-16 lg:pb-8">{children}</main>
            </div>
        </div>
    );
}