import { API_BASE_URL, API_PREFIX, REQUEST_TIMEOUT_MS, MAX_ATTEMPTS } from "./config.js";

const RETRYABLE_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);
const BACKOFF_MS = [1500, 3500];

export class ApiError extends Error {
    constructor(message, { status = 0, retryable = false } = {}) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.retryable = retryable;
    }
}

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestJson(path) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const url = `${API_BASE_URL}${API_PREFIX}${path}`;

    try {
        let response;
        try {
            response = await fetch(url, {
                signal: controller.signal,
                headers: { Accept: "application/json" }
            });
        } catch (error) {
            if (error && error.name === "AbortError") {
                throw new ApiError("The server took too long to respond.", { retryable: true });
            }
            throw new ApiError("Could not reach the server. Check your internet connection.", {
                retryable: true
            });
        }

        let body = null;
        try {
            body = await response.json();
        } catch {
            body = null;
        }

        if (!response.ok) {
            const serverMessage = body && typeof body.error === "string" ? body.error : "";
            if (response.status === 403) {
                throw new ApiError(
                    serverMessage || "The server refused this website. Its CLIENT_ORIGINS setting must include this address.",
                    { status: 403 }
                );
            }
            throw new ApiError(serverMessage || `Server error (${response.status}).`, {
                status: response.status,
                retryable: RETRYABLE_STATUSES.has(response.status)
            });
        }

        if (body === null) {
            throw new ApiError("The server sent an unreadable response.", { retryable: true });
        }
        return body;
    } finally {
        clearTimeout(timer);
    }
}

function toText(value) {
    return typeof value === "string" ? value.trim() : "";
}

export function normalizePlace(raw) {
    if (!raw || typeof raw !== "object") {
        return null;
    }
    const lat = Number(raw.lat);
    const lng = Number(raw.lng);
    const name = toText(raw.name);
    const id = toText(String(raw._id || raw.id || ""));
    if (!id || !name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
    }
    const aliases = Array.isArray(raw.aliases)
        ? raw.aliases.map(toText).filter(Boolean)
        : [];
    return {
        id,
        name,
        category: toText(raw.category) || "other",
        description: toText(raw.description),
        aliases,
        altName: aliases[0] || "",
        lat,
        lng,
        openingHours: toText(raw.openingHours),
        isEntrance: Boolean(raw.isEntrance),
        visibleTo: Array.isArray(raw.visibleTo) ? raw.visibleTo : [],
        photoUrl: raw.hasPhoto
            ? `${API_BASE_URL}${API_PREFIX}/places/${encodeURIComponent(id)}/photo?v=${Number(raw.photoVersion) || 0}`
            : "",
        gallery: Array.isArray(raw.gallery)
            ? raw.gallery.map((imageId) => `${API_BASE_URL}${API_PREFIX}/places/${encodeURIComponent(id)}/gallery/${encodeURIComponent(imageId)}`)
            : []
    };
}

export function normalizePlaces(list) {
    if (!Array.isArray(list)) {
        return [];
    }
    return list.map(normalizePlace).filter(Boolean);
}

export async function fetchPlaces(role, { onRetry } = {}) {
    const path = `/places?role=${encodeURIComponent(role)}&limit=500`;
    let lastError = null;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        try {
            const body = await requestJson(path);
            return normalizePlaces(body.places);
        } catch (error) {
            lastError = error;
            const canRetry = error instanceof ApiError && error.retryable && attempt < MAX_ATTEMPTS;
            if (!canRetry) {
                break;
            }
            if (typeof onRetry === "function") {
                onRetry(attempt + 1, MAX_ATTEMPTS);
            }
            await wait(BACKOFF_MS[attempt - 1] || 3500);
        }
    }

    throw lastError instanceof ApiError
        ? lastError
        : new ApiError("Something went wrong while loading places.");
}

export async function fetchRoute(params) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null) {
            query.set(key, String(value));
        }
    }
    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt += 1) {
        try {
            const body = await requestJson(`/route?${query.toString()}`);
            if (!body.route || !Array.isArray(body.route.coordinates)) {
                throw new ApiError("The server sent an unreadable route.");
            }
            return body.route;
        } catch (error) {
            lastError = error;
            if (!(error instanceof ApiError && error.retryable && attempt < 2)) {
                break;
            }
            await wait(BACKOFF_MS[0]);
        }
    }
    throw lastError instanceof ApiError ? lastError : new ApiError("Could not find a route.");
}
