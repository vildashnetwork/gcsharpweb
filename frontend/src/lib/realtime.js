// lib/realtime.js
// Real-time transport helpers for GCSHARP.
//
// IMPORTANT: the backend exposes *raw* Starlette WebSockets (TCP), not
// Socket.IO. Always connect with the native browser WebSocket API:

import { API } from "./api";

/** Absolute backend origin, e.g. https://auth.gcsharp.com */
export const BACKEND_ORIGIN = API.replace(/\/api$/, "");

/** Bearer/cookie credentials for REST calls made outside axios. */
export function authHeaders(extra = {}) {
    const token = localStorage.getItem("session_token");
    return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

export function sessionToken() {
    return localStorage.getItem("session_token") || "";
}

/** ws(s):// URL for a study-group room socket. */
export function groupSocketUrl(groupId) {
    const base = BACKEND_ORIGIN.replace(/^http/i, (m) =>
        m.toLowerCase() === "https" ? "wss" : "ws"
    );
    return `${base}/api/ws/groups/${groupId}?token=${encodeURIComponent(sessionToken())}`;
}

/** Absolute URL for streaming a voice note (audio elements cannot send headers). */
export function voiceNoteUrl(audioId) {
    return `${BACKEND_ORIGIN}/api/groups/voice/${audioId}?token=${encodeURIComponent(sessionToken())}`;
}

/** ws(s):// URL for the personal notification channel. */
export function notificationSocketUrl(userId) {
    const base = BACKEND_ORIGIN.replace(/^http/i, (m) =>
        m.toLowerCase() === "https" ? "wss" : "ws"
    );
    const token = encodeURIComponent(sessionToken());
    return `${base}/api/ws/notifications?user_id=${encodeURIComponent(userId)}&token=${token}`;
}
