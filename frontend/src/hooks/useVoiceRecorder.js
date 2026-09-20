// hooks/useVoiceRecorder.js
// Records a voice note in the browser with MediaRecorder and returns a Blob
// ready to be uploaded to the study group.
import { useCallback, useEffect, useRef, useState } from "react";

function pickMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export default function useVoiceRecorder() {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState("");
    const mediaRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const startedAtRef = useRef(0);

    const cleanup = useCallback(() => {
        clearInterval(timerRef.current);
        if (mediaRef.current && mediaRef.current.state !== "inactive") {
            try {
                mediaRef.current.stop();
            } catch {
                /* already stopped */
            }
        }
        mediaRef.current?.stream?.getTracks?.().forEach((track) => track.stop());
        mediaRef.current = null;
    }, []);

    useEffect(() => cleanup, [cleanup]);

    const start = useCallback(async () => {
        setError("");
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            setError("Voice notes need a browser with microphone support (Chrome or Edge).");
            return false;
        }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mimeType = pickMimeType();
            const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
            chunksRef.current = [];

            recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
            };
            recorder.start();
            mediaRef.current = recorder;
            startedAtRef.current = Date.now();
            setSeconds(0);
            setRecording(true);
            timerRef.current = setInterval(() => {
                setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
            }, 500);
            return true;
        } catch (err) {
            console.error("microphone access failed:", err);
            setError("I could not reach your microphone. Check the browser permission.");
            return false;
        }
    }, []);

    /** Stop and resolve with { blob, duration, mimeType } (or null if cancelled). */
    const stop = useCallback(() => {
        return new Promise((resolve) => {
            const recorder = mediaRef.current;
            if (!recorder) {
                resolve(null);
                return;
            }
            const duration = (Date.now() - startedAtRef.current) / 1000;
            recorder.onstop = () => {
                const blob = new Blob(chunksRef.current, {
                    type: recorder.mimeType || "audio/webm",
                });
                cleanup();
                setRecording(false);
                setSeconds(0);
                // Anything shorter than half a second is an accidental tap.
                resolve(blob.size > 1200 ? { blob, duration, mimeType: blob.type } : null);
            };
            try {
                recorder.stop();
            } catch {
                cleanup();
                setRecording(false);
                resolve(null);
            }
        });
    }, [cleanup]);

    /** Abort without sending anything. */
    const cancel = useCallback(() => {
        const recorder = mediaRef.current;
        if (recorder) recorder.onstop = null;
        cleanup();
        setRecording(false);
        setSeconds(0);
    }, [cleanup]);

    return { recording, seconds, error, start, stop, cancel };
}
