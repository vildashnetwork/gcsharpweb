// import { useState } from "react";
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

//     const initials = (user?.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

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
//                         <button className="lg:hidden" onClick={() => setMobileOpen(true)} data-testid="mobile-menu-btn">
//                             {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
//                         </button>
//                         <div className="flex-1 max-w-xl">
//                             <div className="relative">
//                                 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
//                                 <input
//                                     data-testid="global-search"
//                                     placeholder="Search past papers or ask AI anything…"
//                                     onKeyDown={(e) => { if (e.key === "Enter") navigate("/ai"); }}
//                                     className="w-full h-11 pl-11 pr-4 rounded-full bg-secondary/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors"
//                                 />
//                             </div>
//                         </div>
//                         <button
//                             onClick={toggle}
//                             data-testid="theme-toggle"
//                             className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
//                         >
//                             {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
//                         </button>
//                         <button className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors relative" data-testid="notifications-btn">
//                             <Bell className="h-5 w-5" />
//                             <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
//                         </button>
//                         <Avatar className="h-10 w-10 border border-border" data-testid="user-avatar">
//                             <AvatarImage src={user?.picture} />
//                             <AvatarFallback className="bg-primary text-white text-sm">{initials}</AvatarFallback>
//                         </Avatar>
//                     </div>
//                 </header>

//                 <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
//             </div>
//         </div>
//     );
// }














































import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import {
    LayoutGrid, BookOpen, Bot, BarChart3, Presentation, Settings as SettingsIcon,
    GraduationCap, Upload, HelpCircle, LogOut, Search, Bell, Moon, Sun, Menu, X, Video,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Button } from "../ui/button";

const NAV = [
    { key: "dashboard", label: "Dashboard", icon: LayoutGrid, path: "/dashboard" },
    { key: "study", label: "Study Center", icon: BookOpen, path: "/study" },
    { key: "ai", label: "AI Assistant", icon: Bot, path: "/ai" },
    { key: "analytics", label: "Analytics", icon: BarChart3, path: "/analytics" },
    { key: "lesson-videos", label: "Lesson Videos", icon: Video, path: "/videos" },
    { key: "teacher", label: "Teacher Portal", icon: Presentation, path: "/teacher" },
    { key: "settings", label: "Settings", icon: SettingsIcon, path: "/settings" },
];

export default function AppLayout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, logout } = useAuth();
    const { theme, toggle } = useTheme();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [searchActive, setSearchActive] = useState(false);
    const searchInputRef = useRef(null);
    const searchContainerRef = useRef(null);

    const initials = (user?.name || "U").split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();

    // Handle click outside to close search on mobile
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
                setSearchActive(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Handle escape key to close search
    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === "Escape") {
                setSearchActive(false);
                searchInputRef.current?.blur();
            }
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, []);

    const handleSearchFocus = () => {
        setSearchActive(true);
    };

    const handleSearchClose = () => {
        setSearchActive(false);
        searchInputRef.current?.blur();
        if (searchInputRef.current) {
            searchInputRef.current.value = "";
        }
    };

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

            <nav className="flex-1 px-4 space-y-1">
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
                        {/* Mobile menu button - hidden when search is active */}
                        <button
                            className={`lg:hidden transition-all duration-300 ${searchActive ? "opacity-0 w-0 overflow-hidden px-0" : "opacity-100"}`}
                            onClick={() => setMobileOpen(true)}
                            data-testid="mobile-menu-btn"
                        >
                            <Menu className="h-6 w-6" />
                        </button>

                        {/* Search container */}
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
                                    className={`w-full h-11 pl-11 pr-4 rounded-full bg-secondary/70 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all duration-300 ${searchActive ? "ring-2 ring-primary/50 bg-background" : ""
                                        }`}
                                />
                                {/* Close button for mobile search */}
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

                        {/* Right side buttons - hidden when search is active on mobile */}
                        <div className={`flex items-center gap-2 transition-all duration-300 ${searchActive ? "lg:flex hidden" : "flex"
                            }`}>
                            <button
                                onClick={toggle}
                                data-testid="theme-toggle"
                                className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors"
                            >
                                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                            </button>
                            <button className="h-10 w-10 rounded-lg border border-border flex items-center justify-center hover:bg-secondary transition-colors relative" data-testid="notifications-btn">
                                <Bell className="h-5 w-5" />
                                <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-destructive" />
                            </button>
                            <Avatar className="h-10 w-10 border border-border" data-testid="user-avatar">
                                <AvatarImage src={user?.picture} />
                                <AvatarFallback className="bg-primary text-white text-sm">{initials}</AvatarFallback>
                            </Avatar>
                        </div>
                    </div>
                </header>

                <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
            </div>
        </div>
    );
}