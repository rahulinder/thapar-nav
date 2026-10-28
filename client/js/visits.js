import { API_BASE_URL, API_PREFIX } from "./config.js";
import { storage } from "./storage.js";

const ID_KEY = "thaparNav.clientId";
const NAME_KEY = "thaparNav.name";
const CONTACT_KEY = "thaparNav.contact";
const ROLL_KEY = "thaparNav.rollNo";
const SENT_KEY = "thaparNav.visitSent";
const CONTACT_PATTERN = /^([^\s@]+@[^\s@]+\.[^\s@]+|\+?[0-9][0-9\s-]{6,18}[0-9])$/;

export function isValidContact(value) {
    return CONTACT_PATTERN.test(String(value || "").trim());
}

export function isValidRollNo(value) {
    return /^[A-Za-z0-9]{5,15}$/.test(String(value || "").trim());
}

export function getRollNo() {
    const value = storage.get(ROLL_KEY);
    return typeof value === "string" ? value : "";
}

export function setRollNo(value) {
    const clean = String(value || "").trim().toUpperCase().slice(0, 15);
    if (clean) {
        storage.set(ROLL_KEY, clean);
    } else {
        storage.remove(ROLL_KEY);
    }
}

export function getContact() {
    const value = storage.get(CONTACT_KEY);
    return typeof value === "string" ? value : "";
}

export function setContact(value) {
    const clean = String(value || "").trim().slice(0, 80);
    if (clean) {
        storage.set(CONTACT_KEY, clean);
    } else {
        storage.remove(CONTACT_KEY);
    }
}

function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function getClientId() {
    const saved = storage.get(ID_KEY);
    if (typeof saved === "string" && /^[A-Za-z0-9-]{16,64}$/.test(saved)) {
        return saved;
    }
    const fresh = makeId();
    storage.set(ID_KEY, fresh);
    return fresh;
}

function sendPing(role) {
    const name = storage.get(NAME_KEY);
    const body = { clientId: getClientId(), userType: role };
    if (typeof name === "string" && name.trim()) {
        if (role === "student") {
            const rollNo = getRollNo();
            if (isValidRollNo(rollNo)) {
                body.name = name.trim();
                body.rollNo = rollNo;
            }
        } else {
            const contact = getContact();
            if (isValidContact(contact)) {
                body.name = name.trim();
                body.contact = contact;
            }
        }
    }
    fetch(API_BASE_URL + API_PREFIX + "/clients/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true
    }).catch(() => {});
}

export function registerVisit(role) {
    try {
        if (window.sessionStorage.getItem(SENT_KEY) === role) {
            return;
        }
        window.sessionStorage.setItem(SENT_KEY, role);
    } catch {
        return;
    }
    sendPing(role);
}

export function syncVisit(role) {
    try {
        window.sessionStorage.setItem(SENT_KEY, role);
    } catch {
    }
    sendPing(role);
}
