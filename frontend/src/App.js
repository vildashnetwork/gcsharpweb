import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { Toaster } from "sonner";

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
import { Loader2 } from "lucide-react";

function FullLoader() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-background">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
}

function Protected({ children }) {
    const { user, loading } = useAuth();
    if (loading) return <FullLoader />;
    if (!user) return <Navigate to="/" replace />;
    if (!user.onboarded) return <Navigate to="/onboarding" replace />;
    return <AppLayout>{children}</AppLayout>;
}

function LoginGate() {
    const { user, loading } = useAuth();
    if (loading) return <FullLoader />;
    if (user && !user.onboarded) return <Navigate to="/onboarding" replace />;
    if (user) return <Navigate to="/dashboard" replace />;
    return <Login />;
}

function AppRouter() {
    const location = useLocation();
    if (location.hash?.includes("session_id=")) return <AuthCallback />;
    return (
        <Routes>
            <Route path="/" element={<LoginGate />} />
            <Route path="/onboarding" element={<Onboarding />} />
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
        <ThemeProvider>
            <AuthProvider>
                <BrowserRouter>
                    <AppRouter />
                    <Toaster position="top-right" richColors />
                </BrowserRouter>
            </AuthProvider>
        </ThemeProvider>
    );
}

export default App;
