





// // src/context/AuthContext.tsx
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
//         // Check for OAuth callback
//         const params = new URLSearchParams(window.location.search);
//         const sessionId = params.get("session_id");
//         const hash = window.location.hash;

//         if (sessionId || hash?.includes("session_id=")) {
//             // Exchange session_id for user session
//             exchangeSession(sessionId || hash.split("session_id=")[1]);
//             return;
//         }
//         checkAuth();
//     }, [checkAuth]);

//     const exchangeSession = async (sessionId: string) => {
//         try {
//             const { data } = await api.post("/auth/session", { session_id: sessionId });
//             setUser(data);
//             // Clean up URL
//             window.history.replaceState({}, document.title, "/dashboard");
//         } catch (error) {
//             console.error("Session exchange failed:", error);
//             setUser(null);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const logout = async () => {
//         try { await api.post("/auth/logout"); } catch { }
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

    // Check if user is authenticated
    const checkAuth = useCallback(async () => {
        try {
            // First check localStorage for user data
            const userData = localStorage.getItem("user");
            if (userData) {
                try {
                    const parsedUser = JSON.parse(userData);
                    setUser(parsedUser);

                    // Verify with backend
                    try {
                        const { data } = await api.get("/auth/me");
                        setUser(data);
                        // Update localStorage with fresh data
                        localStorage.setItem("user", JSON.stringify(data));
                    } catch (e) {
                        // Backend verification failed but we have local data
                        console.log("Backend verification failed, but using cached user");
                    }
                } catch (e) {
                    console.error("Error parsing user data:", e);
                    localStorage.removeItem("user");
                    setUser(null);
                }
            } else {
                // Try to get user from backend
                try {
                    const { data } = await api.get("/auth/me");
                    setUser(data);
                    localStorage.setItem("user", JSON.stringify(data));
                } catch (e) {
                    setUser(null);
                }
            }
        } catch (error) {
            console.error("Auth check error:", error);
            setUser(null);
        } finally {
            setLoading(false);
        }
    }, []);

    // Exchange OAuth session
    const exchangeSession = async (sessionId) => {
        try {
            console.log("🔄 Exchanging OAuth session...");
            console.log("Session ID:", sessionId);

            const { data } = await api.post("/auth/exchange-session", { sessionId });

            console.log("📦 Exchange response:", data);

            if (data?.user) {
                const userData = data.user;
                const sessionToken = data.session_token || data.token;

                // Store user data
                if (userData) {
                    setUser(userData);
                    localStorage.setItem("user", JSON.stringify(userData));
                    console.log("✅ User stored:", userData.email);
                }

                // Store session token
                if (sessionToken) {
                    localStorage.setItem("session_token", sessionToken);
                    console.log("✅ Session token stored:", sessionToken.substring(0, 20) + "...");
                } else {
                    console.error("❌ No session_token in response!");
                    // Try to get from cookie
                    const cookies = document.cookie.split(';');
                    for (const cookie of cookies) {
                        const [name, value] = cookie.trim().split('=');
                        if (name === 'session_token' && value) {
                            localStorage.setItem("session_token", value);
                            console.log("✅ Found session_token in cookie");
                            break;
                        }
                    }
                }

                // Clean up URL and redirect
                window.history.replaceState({}, document.title, "/dashboard");
                window.location.href = "/dashboard";
            } else {
                console.error("❌ No user in response");
            }
        } catch (error) {
            console.error("❌ Session exchange failed:", error);
            console.error("Error details:", error.response?.data);
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    // ✅ FIXED: Added checkAuth to dependency array
    useEffect(() => {
        // Check for OAuth callback
        const params = new URLSearchParams(window.location.search);
        const sessionId = params.get("session_id");
        const hash = window.location.hash;
        const authHash = new URLSearchParams(hash.replace(/^#/, ""));
        const authToken = authHash.get("auth_token");
        const authUserId = authHash.get("user_id");

        if (authToken) {
            localStorage.setItem("session_token", authToken);
            if (authUserId) localStorage.setItem("user_id", authUserId);
            window.history.replaceState({}, document.title, window.location.pathname);
            checkAuth().then(() => {
                const storedUser = JSON.parse(localStorage.getItem("user") || "null");
                window.location.href = storedUser?.onboarded ? "/dashboard" : "/onboarding";
            });
            return;
        }

        if (sessionId || hash?.includes("session_id=")) {
            const id = sessionId || hash.split("session_id=")[1]?.split("&")[0];
            if (id) {
                exchangeSession(id);
                return;
            }
        }

        // Check if user is already in localStorage
        const userData = localStorage.getItem("user");
        if (userData) {
            try {
                const parsedUser = JSON.parse(userData);
                setUser(parsedUser);
                setLoading(false);
                // Verify with backend in background
                checkAuth();
                return;
            } catch (e) {
                localStorage.removeItem("user");
            }
        }

        checkAuth();
    }, [checkAuth]); // ✅ ADDED checkAuth to dependency array

    // Login with email
    const loginWithEmail = async (email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post("/auth/email/login", { email, password });
            if (data?.success && data?.user) {
                const userData = {
                    ...data.user,
                    token: data.session_token,
                };
                setUser(userData);
                localStorage.setItem("user", JSON.stringify(userData));
                if (data.session_token) {
                    localStorage.setItem("session_token", data.session_token);
                }
                return { success: true, user: userData };
            }
            return { success: false, error: data?.message || "Login failed" };
        } catch (error) {
            console.error("Email login error:", error);
            return {
                success: false,
                error: error.response?.data?.detail || "Login failed. Please try again."
            };
        } finally {
            setLoading(false);
        }
    };

    // Register with email
    const registerWithEmail = async (name, email, password) => {
        setLoading(true);
        try {
            const { data } = await api.post("/auth/email/register", { name, email, password });
            if (data?.success && data?.user) {
                const userData = {
                    ...data.user,
                    token: data.session_token,
                };
                setUser(userData);
                localStorage.setItem("user", JSON.stringify(userData));
                if (data.session_token) {
                    localStorage.setItem("session_token", data.session_token);
                }
                return { success: true, user: userData };
            }
            return { success: false, error: data?.message || "Registration failed" };
        } catch (error) {
            console.error("Email registration error:", error);
            return {
                success: false,
                error: error.response?.data?.detail || "Registration failed. Please try again."
            };
        } finally {
            setLoading(false);
        }
    };

    // Login with Google
    const loginWithGoogle = async () => {
        try {
            const backendUrl = process.env.REACT_APP_BACKEND_URL || "https://gcsharpweb.onrender.com";
            const returnUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
            window.location.href = `${backendUrl}/api/auth/google/login?redirect=${encodeURIComponent(returnUrl)}`;
        } catch (error) {
            console.error("Google login error:", error);
            throw error;
        }
    };

    // Logout
    const logout = async () => {
        try {
            await api.post("/auth/logout");
        } catch (error) {
            console.error("Logout error:", error);
        }
        setUser(null);
        localStorage.removeItem("user");
        localStorage.removeItem("session_token");
        window.location.href = "/";
    };

    // Update user
    const updateUser = (userData) => {
        setUser(userData);
        localStorage.setItem("user", JSON.stringify(userData));
    };

    return (
        <AuthContext.Provider
            value={{
                user,
                setUser,
                loading,
                checkAuth,
                logout,
                loginWithEmail,
                registerWithEmail,
                loginWithGoogle,
                updateUser,
                exchangeSession,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};