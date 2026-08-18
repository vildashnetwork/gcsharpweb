// import { createContext, useContext, useEffect, useState, useCallback } from "react";
// import api from "../lib/api";

// const AuthContext = createContext(null);

// export function AuthProvider({ children }) {
//     const [user, setUser] = useState(null);
//     const [loading, setLoading] = useState(true);

//     const checkAuth = useCallback(async () => {
//         try {
//             const { data } = await api.get("/auth/me");
//             setUser(data);
//         } catch {
//             setUser(null);
//         } finally {
//             setLoading(false);
//         }
//     }, []);

//     useEffect(() => {
//         // CRITICAL: If returning from OAuth callback, skip the /me check.
//         // AuthCallback will exchange the session_id and establish the session first.
//         if (window.location.hash?.includes("session_id=")) {
//             setLoading(false);
//             return;
//         }
//         checkAuth();
//     }, [checkAuth]);

//     const logout = async () => {
//         try { await api.post("/auth/logout"); } catch {}
//         setUser(null);
//         window.location.href = "/";
//     };

//     return (
//         <AuthContext.Provider value={{ user, setUser, loading, checkAuth, logout }}>
//             {children}
//         </AuthContext.Provider>
//     );
// }

// export const useAuth = () => useContext(AuthContext);





















// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = useCallback(async () => {
        try {
            const { data } = await api.get("/auth/me");
            setUser(data);
        } catch {

            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        // Check for OAuth callback
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        const hash = window.location.hash;

        if (sessionId || hash?.includes("session_id=")) {
            // Exchange session_id for user session
            exchangeSession(sessionId || hash.split("session_id=")[1]);
            return;
        }
        checkAuth();
    }, [checkAuth]);

    const exchangeSession = async (sessionId: string) => {
        try {
            const { data } = await api.post("/auth/session", { session_id: sessionId });
            setUser(data);
            // Clean up URL
            window.history.replaceState({}, document.title, "/dashboard");
        } catch (error) {
            console.error("Session exchange failed:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try { await api.post("/auth/logout"); } catch { }
        setUser(null);
        window.location.href = "/";
    };

    return (
        <AuthContext.Provider value={{ user, setUser, loading, checkAuth, logout }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);