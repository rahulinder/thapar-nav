import { ROLES, STORAGE_KEYS } from "./config.js";
import { storage } from "./storage.js";
import { registerVisit } from "./visits.js";

const SAFE_NEXT = /^[A-Za-z0-9_-]+\.html(\?[A-Za-z0-9_\-=&%.+]*)?$/;

export function getRole() {
    const value = storage.get(STORAGE_KEYS.role);
    return typeof value === "string" && ROLES[value] ? value : null;
}

export function setRole(role) {
    if (!ROLES[role]) {
        throw new Error(`Unknown role: ${role}`);
    }
    storage.set(STORAGE_KEYS.role, role);
}

export function clearRole() {
    storage.remove(STORAGE_KEYS.role);
}

export function getVisitorName() {
    const value = storage.get(STORAGE_KEYS.name);
    return typeof value === "string" ? value : "";
}

export function setVisitorName(name) {
    const clean = String(name || "").trim().slice(0, 40);
    if (clean) {
        storage.set(STORAGE_KEYS.name, clean);
    } else {
        storage.remove(STORAGE_KEYS.name);
    }
}

export function clearVisitorName() {
    storage.remove(STORAGE_KEYS.name);
}

export function safeNextUrl(next) {
    return typeof next === "string" && SAFE_NEXT.test(next) ? next : "index.html";
}

const PENDING_KEY = "thaparNav.pendingLogin";

export function isLoginPending() {
    return storage.get(PENDING_KEY) === true;
}

export function setLoginPending(value) {
    if (value) {
        storage.set(PENDING_KEY, true);
    } else {
        storage.remove(PENDING_KEY);
    }
}

function currentPage() {
    const page = window.location.pathname.split("/").pop() || "index.html";
    return `${page}${window.location.search}`;
}

export function requireRole() {
    const role = getRole();
    if (!role) {
        window.location.replace(`user-option.html?next=${encodeURIComponent(currentPage())}`);
        return null;
    }
    if (isLoginPending()) {
        window.location.replace(`login.html?next=${encodeURIComponent(currentPage())}`);
        return null;
    }
    registerVisit(role);
    return role;
}
