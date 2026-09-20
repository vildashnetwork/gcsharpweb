// hooks/useGroupSocket.js
// Live connection to a study group room over WebSocket (TCP).
//
// Handles: connect, automatic reconnect with backoff, heartbeat pings,
// presence, typing, read receipts, incoming messages and a REST fallback so a
// message is never lost if the socket happens to be down.
import { useCallback, useEffect, useRef, useState } from "react";
import { API } from "../lib/api";
import { authHeaders, groupSocketUrl } from "../lib/realtime";

const PING_MS = 25_000;
const MAX_BACKOFF_MS = 15_000;

export default function useGroupSocket(groupId, handlers = {}) {
    const [connected, setConnected] = useState(false);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);
    const socketRef = useRef(null);
    const handlersRef = useRef(handlers);
    const retryRef = useRef(0);
    const closedByUsRef = useRef(false);
    const timersRef = useRef({ ping: null, reconnect: null, typing: {} });

    // Keep the latest handlers without re-opening the socket on every render.
    useEffect(() => {
        handlersRef.current = handlers;
    }, [handlers]);

    const emit = useCallback((event, payload = {}) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return false;
        try {
            socket.send(JSON.stringify({ type: event, ...payload }));
            return true;
        } catch (err) {
            console.error("group socket send failed:", err);
            return false;
        }
    }, []);

    useEffect(() => {
        if (!groupId) return undefined;
        closedByUsRef.current = false;

        const open = () => {
            let socket;
            try {
                socket = new WebSocket(groupSocketUrl(groupId));
            } catch (err) {
                console.error("group socket could not be created:", err);
                return;
            }
            socketRef.current = socket;

            socket.onopen = () => {
                retryRef.current = 0;
                setConnected(true);
                timersRef.current.ping = setInterval(() => {
                    if (socket.readyState === WebSocket.OPEN) {
                        socket.send(JSON.stringify({ type: "ping" }));
                    }
                }, PING_MS);
            };

            socket.onmessage = (raw) => {
                let data;
                try {
                    data = JSON.parse(raw.data);
                } catch {
                    return;
                }
                const H = handlersRef.current;
                switch (data.event) {
                    case "ready":
                        setOnlineUsers(data.online || []);
                        H.onReady?.(data);
                        break;
                    case "message":
                        H.onMessage?.(data.message);
                        break;
                    case "presence":
                        setOnlineUsers(data.online_users || []);
                        H.onPresence?.(data);
                        break;
                    case "typing":
                        setTypingUsers((prev) => {
                            const others = prev.filter((t) => t.user_id !== data.user_id);
                            return data.typing
                                ? [...others, { user_id: data.user_id, name: data.name }]
                                : others;
                        });
                        if (data.typing) {
                            clearTimeout(timersRef.current.typing[data.user_id]);
                            timersRef.current.typing[data.user_id] = setTimeout(() => {
                                setTypingUsers((prev) =>
                                    prev.filter((t) => t.user_id !== data.user_id)
                                );
                            }, 4000);
                        }
                        break;
                    case "read":
                        H.onRead?.(data);
                        break;
                    case "reaction":
                        H.onReaction?.(data);
                        break;
                    case "message_deleted":
                        H.onMessageDeleted?.(data);
                        break;
                    case "members_changed":
                        H.onMembersChanged?.();
                        break;
                    case "group_updated":
                        H.onGroupUpdated?.(data.updates);
                        break;
                    case "group_deleted":
                        H.onGroupDeleted?.(data);
                        break;
                    case "join_request":
                        H.onJoinRequest?.(data.request);
                        break;
                    case "ai_thinking":
                        H.onAIThinking?.(data);
                        break;
                    case "error":
                        H.onError?.(data.detail);
                        break;
                    default:
                        break;
                }
            };

            socket.onclose = () => {
                setConnected(false);
                setTypingUsers([]);
                clearInterval(timersRef.current.ping);
                if (closedByUsRef.current) return;
                const attempt = (retryRef.current += 1);
                const delay = Math.min(1200 * attempt, MAX_BACKOFF_MS);
                timersRef.current.reconnect = setTimeout(open, delay);
            };
        };

        open();

        return () => {
            closedByUsRef.current = true;
            clearInterval(timersRef.current.ping);
            clearTimeout(timersRef.current.reconnect);
            Object.values(timersRef.current.typing).forEach(clearTimeout);
            const socket = socketRef.current;
            if (socket && socket.readyState <= WebSocket.OPEN) {
                socket.close();
            }
            socketRef.current = null;
            setConnected(false);
            setOnlineUsers([]);
        };
    }, [groupId]);

    /** Send a message - over the socket, falling back to REST. */
    const sendMessage = useCallback(async (payload, replyTo = null) => {
        if (emit("message", { payload, reply_to: replyTo })) {
            return { ok: true, via: "socket" };
        }
        try {
            const res = await fetch(`${API}/groups/${groupId}/messages`, {
                method: "POST",
                credentials: "include",
                headers: authHeaders({ "Content-Type": "application/json" }),
                body: JSON.stringify({ ...payload, reply_to: replyTo }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) return { ok: false, detail: data.detail };
            return { ok: true, via: "rest", message: data.message };
        } catch (err) {
            return { ok: false, detail: String(err) };
        }
    }, [emit, groupId]);

    const sendTyping = useCallback((typing) => emit("typing", { typing }), [emit]);
    const sendRead = useCallback((uptoSeq) => emit("read", { upto_seq: uptoSeq }), [emit]);
    const askAI = useCallback((question) => emit("ask_ai", { question }), [emit]);

    return { connected, onlineUsers, typingUsers, sendMessage, sendTyping, sendRead, askAI };
}
