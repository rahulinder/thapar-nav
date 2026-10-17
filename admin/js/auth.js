import { STORAGE_KEYS } from "./config.js";

function readRaw() {
    try {
        return sessionStorage.getItem(STORAGE_KEYS.session);
    } catch (error) {
        return memory.value;
    }
}

const memory = { value: null };

export function saveSession(session) {
    const text = JSON.stringify(session);
    memory.value = text;
    try {
        sessionStorage.setItem(STORAGE_KEYS.session, text);
    } catch (error) {
        return;
    }
}

export function clearSession() {
    memory.value = null;
    try {
        sessionStorage.removeItem(STORAGE_KEYS.session);
    } catch (error) {
        return;
    }
}

function tokenExpiry(token) {
    try {
        const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const payload = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")));
        return typeof payload.exp === "number" ? payload.exp * 1000 : 0;
    } catch (error) {
        return 0;
    }
}

export function getSession() {
    const raw = readRaw();
    if (!raw) return null;
    try {
        const session = JSON.parse(raw);
        if (!session || typeof session.token !== "string") return null;
        return session;
    } catch (error) {
        return null;
    }
}

export function hasValidSession() {
    const session = getSession();
    if (!session) return false;
    return tokenExpiry(session.token) > Date.now() + 5000;
}

export function goToLogin(reason, next) {
    const params = new URLSearchParams();
    if (reason) params.set("reason", reason);
    if (next) params.set("next", next);
    const query = params.toString();
    window.location.replace("./index.html" + (query ? "?" + query : ""));
}

export function requireLogin() {
    if (hasValidSession()) return true;
    clearSession();
    const here = window.location.pathname.split("/").pop() || "dashboard.html";
    goToLogin("expired", here);
    return false;
}

export function safeNext(value) {
    if (typeof value === "string" && /^[a-z0-9-]+\.html$/i.test(value) && value !== "index.html") return value;
    return "dashboard.html";
}
