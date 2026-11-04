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
import PublicPapers from "@/pages/PublicPapers";
import VideoLibrary from "./pages/VideoLibrary";
import SearchPage from "./pages/SearchPage";
import { Loader2 } from "lucide-react";
import StudyGroups from "./pages/StudyGroups";
import Payments from "@/pages/Payments";
// 
function FullLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}

// Every route through here is behind auth. A logged-out crawler hits the
// redirect to "/" before any content renders, so these can never actually
// be indexed with real content — noindex just makes that explicit instead
// of leaving Google to guess via a redirect. Title still sets the browser
// tab text; only the indexing behavior is affected.
function Protected({ children, title }) {
    const { user, loading } = useAuth();
    if (loading) return <FullLoader />;
    if (!user) return <Navigate to="/" replace />;
    if (!user.onboarded) return <Navigate to="/onboarding" replace />;
    return (
        <AppLayout>
            <Seo title={title} noindex />
            {children}
        </AppLayout>
    );
}

// Public flow routes that should be discoverable by search engines.
function NoIndex({ title, children }) {
    return (
        <>
            <Seo title={title} noindex />
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
            {/* Real, indexable homepage tags */}
            <Seo
                title="GCSHARP · AI-Powered GCE, HND & Concours Past Papers"
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

            <Route
                path="/phone-signin"
                element={
                    <>
                        <Seo
                            title="Sign In with Google, Email or Phone"
                            description="Sign in to GCSHARP with Google, email or phone number to access past papers, AI tutoring and study tools."
                            path="/phone-signin"
                        />
                        <PhoneSignIn />
                    </>
                }
            />

            <Route path="/papers" element={<PublicPapers />} />
            <Route path="/papers/:paperSlug" element={<PublicPapers />} />

            <Route
                path="/onboarding"
                element={
                    <NoIndex title="Set Up Your GCSHARP Profile">
                        <Onboarding />
                    </NoIndex>
                }
            />

            <Route
                path="/search"
                element={
                    <Protected title="Search">
                        <SearchPage />
                    </Protected>
                }
            />

            {/* Public, indexable. VideoLibrary sets its own per-video <Seo>
                once a video is loaded, overriding this default. */}
            <Route
                path="/videos"
                element={
                    <>
                        <Seo
                            title="Video Solutions Library"
                            description="Watch narrated, step-by-step AI video solutions for GCE, HND and Concours past paper questions."
                            path="/videos"
                        />
                        <VideoLibrary />
                    </>
                }
            />
            <Route path="/videos/:videoId" element={<VideoLibrary />} />

            <Route
                path="/dashboard"
                element={
                    <Protected title="Dashboard">
                        <Dashboard />
                    </Protected>
                }
            />

            {/* Study groups. The browser lives at /groups, the create form at
                /groups/create and the chat at /groups/:groupId. StudyGroups
                navigates to both sub-paths (and the backend links every group
                notification to /groups/<id>), so without these routes the "*"
                catch-all below bounced them straight back to the home page. */}
            <Route
                path="/groups"
                element={
                    <Protected title="Study Groups">
                        <StudyGroups />
                    </Protected>
                }
            />

            <Route
                path="/groups/create"
                element={
                    <Protected title="New Study Group">
                        <StudyGroups />
                    </Protected>
                }
            />

            <Route
                path="/groups/:groupId"
                element={
                    <Protected title="Study Group Chat">
                        <StudyGroups />
                    </Protected>
                }
            />



            <Route
                path="/study"
                element={
                    <Protected title="Study Center">
                        <StudyCenter />
                    </Protected>
                }
            />

            <Route
                path="/study/exam"
                element={
                    <Protected title="Exam Mode">
                        <ExamMode />
                    </Protected>
                }
            />

            <Route
                path="/study/paper/:paperId"
                element={
                    <Protected title="Paper Reader">
                        <PaperReader />
                    </Protected>
                }
            />

            <Route
                path="/ai"
                element={
                    <Protected title="AI Tutor">
                        <AITutor />
                    </Protected>
                }
            />

            <Route
                path="/buy-tokens"
                element={
                    // <Protected title="Buy Tokens & Offline Access">
                    <Payments />
                    // </Protected>
                }
            />

            <Route
                path="/analytics"
                element={
                    <Protected title="Analytics">
                        <Analytics />
                    </Protected>
                }
            />

            <Route
                path="/teacher"
                element={
                    <Protected title="Teacher Portal">
                        <TeacherPortal />
                    </Protected>
                }
            />

            <Route
                path="/settings"
                element={
                    <Protected title="Settings">
                        <Settings />
                    </Protected>
                }
            />

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