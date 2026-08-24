// import "@/App.css";
// import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
// import { AuthProvider, useAuth } from "@/context/AuthContext";
// import { ThemeProvider } from "@/context/ThemeContext";
// import { Toaster } from "sonner";

// import Login from "@/pages/Login";
// import AuthCallback from "@/pages/AuthCallback";
// import Onboarding from "@/pages/Onboarding";
// import AppLayout from "@/components/layout/AppLayout";
// import Dashboard from "@/pages/Dashboard";
// import StudyCenter from "@/pages/StudyCenter";
// import ExamMode from "@/pages/ExamMode";
// import PaperReader from "@/pages/PaperReader";
// import AITutor from "@/pages/AITutor";
// import Analytics from "@/pages/Analytics";
// import TeacherPortal from "@/pages/TeacherPortal";
// import Settings from "@/pages/Settings";
// import PhoneSignIn from "@/pages/PhoneNumber";
// import VideoLibrary from "./pages/VideoLibrary";
// import SearchPage from "./pages/SearchPage";
// import { Loader2 } from "lucide-react";

// function FullLoader() {
//     return (
//         <div className="min-h-screen flex items-center justify-center bg-background">
//             <Loader2 className="h-8 w-8 animate-spin text-primary" />
//         </div>
//     );
// }

// function Protected({ children }) {
//     const { user, loading } = useAuth();
//     if (loading) return <FullLoader />;
//     if (!user) return <Navigate to="/" replace />;
//     if (!user.onboarded) return <Navigate to="/onboarding" replace />;
//     return <AppLayout>{children}</AppLayout>;
// }

// function LoginGate() {
//     const { user, loading } = useAuth();
//     if (loading) return <FullLoader />;
//     if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;
//     if (user) return <Navigate to="/dashboard" replace />;
//     return <Login />;
// }

// function AppRouter() {
//     const location = useLocation();
//     if (location.hash?.includes("session_id=")) return <AuthCallback />;
//     return (
//         <Routes>
//             <Route path="/" element={<LoginGate />} />
//             <Route path="/phone-signin" element={<PhoneSignIn />} />
//             <Route path="/onboarding" element={<Onboarding />} />
//             <Route path="/search" element={<Protected><SearchPage /></Protected>} />
//             <Route path="/videos" element={<VideoLibrary />} />
//             <Route path="/videos/:videoId" element={<VideoLibrary />} />
//             <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
//             <Route path="/study" element={<Protected><StudyCenter /></Protected>} />
//             <Route path="/study/exam" element={<Protected><ExamMode /></Protected>} />
//             <Route path="/study/paper/:paperId" element={<Protected><PaperReader /></Protected>} />
//             <Route path="/ai" element={<Protected><AITutor /></Protected>} />
//             <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
//             <Route path="/teacher" element={<Protected><TeacherPortal /></Protected>} />
//             <Route path="/settings" element={<Protected><Settings /></Protected>} />
//             <Route path="*" element={<Navigate to="/" replace />} />
//         </Routes>
//     );
// }

// function App() {
//     return (
//         <ThemeProvider>
//             <AuthProvider>
//                 <BrowserRouter>
//                     <AppRouter />
//                     <Toaster position="top-right" richColors />
//                 </BrowserRouter>
//             </AuthProvider>
//         </ThemeProvider>
//     );
// }

// export default App;



































import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "sonner";
import { Seo } from "@/components/Seo";

import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Onboarding from "@/pages/Onboarding";
import AppLayout from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import StudyCenter from "@/pages/StudyCenter";
import ExamMode from "@/pages/ExamMode";
import PaperReader from "@/pages/PaperReader";
import AITutor from "@/pages/AITutor";
import Analytics from "@/pages/Analytics";
import TeacherPortal from "@/pages/TeacherPortal";
import Settings from "@/pages/Settings";
import PhoneSignIn from "@/pages/PhoneNumber";
import VideoLibrary from "./pages/VideoLibrary";
import SearchPage from "./pages/SearchPage";
import { Loader2 } from "lucide-react";

function FullLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}

// Every route that goes through here is behind auth, so it should never
// be indexed — set once here instead of relying on each page to remember
// to add <Seo noindex /> itself.
function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <FullLoader />;
    if (!user) return <Navigate to="/" replace />;
    if (!user.onboarded) return <Navigate to="/onboarding" replace />;
    return (
        <AppLayout>
            <Seo noindex />
            {children}
        </AppLayout>
    );
}

// For public-URL-but-not-content routes (onboarding flow, phone sign-in) —
// reachable without auth, but there's nothing here worth ranking, so they
// get noindex too without needing Protected's auth redirects.
function NoIndex({ children }) {
    return (
        <>
            <Seo noindex />
            {children}
        </>
    );
}

function LoginGate() {
    const { user, loading } = useAuth();
    if (loading) return <FullLoader />;
    if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;
    if (user) return <Navigate to="/dashboard" replace />;
    return (
        <>
            {/* The real homepage tags — falls back to these when a page
                further down the tree doesn't set its own <Seo>. Individual
                pages (like VideoLibrary) still override title/description
                for their own content; this is just the site-wide default. */}
            <Seo
                title="Login In To Access  A different Worl Of learning"
                description="Study smarter for GCE O Level, GCE A Level, HND and Concours exams with GCSHARP — AI-marked past papers, narrated video solutions, and a personal AI tutor built for Cameroonian students."
                path="/"
            />
            <Login />
        </>
    );
}

function AppRouter() {
    const location = useLocation();
    if (location.hash?.includes("session_id=")) return <AuthCallback />;
    return (
        <Routes>
            <Route path="/" element={<LoginGate />} />
            <Route path="/phone-signin" element={<NoIndex><PhoneSignIn /></NoIndex>} />
            <Route path="/onboarding" element={<NoIndex><Onboarding /></NoIndex>} />
            <Route path="/search" element={<Protected><SearchPage /></Protected>} />
            {/* Public, indexable — VideoLibrary sets its own per-video <Seo> internally */}
            <Route path="/videos" element={<VideoLibrary />} />
            <Route path="/videos/:videoId" element={<VideoLibrary />} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/study" element={<Protected><StudyCenter /></Protected>} />
            <Route path="/study/exam" element={<Protected><ExamMode /></Protected>} />
            <Route path="/study/paper/:paperId" element={<Protected><PaperReader /></Protected>} />
            <Route path="/ai" element={<Protected><AITutor /></Protected>} />
            <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
            <Route path="/teacher" element={<Protected><TeacherPortal /></Protected>} />
            <Route path="/settings" element={<Protected><Settings /></Protected>} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

function App() {
    return (
        <HelmetProvider>
            <ThemeProvider>
                <AuthProvider>
                    <BrowserRouter>
                        <AppRouter />
                        <Toaster position="top-right" richColors />
                    </BrowserRouter>
                </AuthProvider>
            </ThemeProvider>
        </HelmetProvider>
    );
}

export default App;