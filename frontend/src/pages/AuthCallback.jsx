import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Loader2 } from "lucide-react";

export default function AuthCallback() {
    const location = useLocation();
    const navigate = useNavigate();
    const { setUser } = useAuth();
    const hasProcessed = useRef(false);

    useEffect(() => {
        if (hasProcessed.current) return;
        hasProcessed.current = true;

        const hash = location.hash || "";
        const match = hash.match(/session_id=([^&]+)/);
        const sessionId = match ? match[1] : null;

        (async () => {
            if (!sessionId) { navigate("/", { replace: true }); return; }
            try {
                const { data } = await api.post("/auth/session", {}, {
                    headers: { "X-Session-ID": sessionId },
                });
                setUser(data);
                window.history.replaceState(null, "", window.location.pathname);
                if (!data.onboarded) navigate("/onboarding", { replace: true });
                else navigate("/dashboard", { replace: true });
            } catch {
                navigate("/", { replace: true });
            }
        })();
    }, [location, navigate, setUser]);

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">Signing you in…</p>
        </div>
    );
}
