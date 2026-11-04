// import axios from "axios";

// const BACKEND_URL = process.env.APP_BACKEND_URL;
// export const API = `${BACKEND_URL}/api`;

// const api = axios.create({
//     baseURL: API,
//     withCredentials: true,
// });

// export default api;
























// src/lib/api.ts
import axios from "axios";

const BACKEND_URL = process.env.APP_BACKEND_URL || "https://auth.gcsharp.com";
export const API = `${BACKEND_URL}/api`;

const api = axios.create({
    baseURL: API,
    withCredentials: true,
    headers: {
        "Content-Type": "application/json",
    },
});

// Add session token interceptor
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("session_token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default api;