import { API_BASE_URL, API_PREFIX, REQUEST_TIMEOUT_MS, SLOW_NOTICE_MS, PAGE_SIZE } from "./config.js";
import { getSession, clearSession, goToLogin } from "./auth.js";

export class ApiError extends Error {
    constructor(message, status, details) {
        super(message);
        this.status = status;
        this.details = details || [];
    }
}

export async function call(path, { method = "GET", body, auth = true, onSlow } = {}) {
    const headers = { Accept: "application/json" };
    const isBlob = typeof Blob !== "undefined" && body instanceof Blob;
    if (body !== undefined) headers["Content-Type"] = isBlob ? body.type : "application/json";
    if (auth) {
        const session = getSession();
        if (session) headers.Authorization = "Bearer " + session.token;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const slow = onSlow ? setTimeout(onSlow, SLOW_NOTICE_MS) : null;
    let response;
    try {
        response = await fetch(API_BASE_URL + API_PREFIX + path, {
            method,
            headers,
            body: body === undefined ? undefined : isBlob ? body : JSON.stringify(body),
            signal: controller.signal
        });
    } catch (error) {
        throw new ApiError(
            error.name === "AbortError"
                ? "The server took too long to answer. Please try again."
                : "Cannot reach the server. Check your internet and try again.",
            0
        );
    } finally {
        clearTimeout(timeout);
        if (slow) clearTimeout(slow);
    }
    let data = null;
    if (response.status !== 204) {
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }
    }
    if (!response.ok) {
        if (response.status === 401 && auth) {
            clearSession();
            goToLogin("expired", window.location.pathname.split("/").pop());
        }
        const message = (data && data.error) || "Something went wrong (error " + response.status + ").";
        throw new ApiError(message, response.status, data && data.details);
    }
    if (method !== "GET" && /^\/(places|paths)/.test(path)) {
        document.dispatchEvent(new CustomEvent("data-edited"));
    }
    return data;
}

export function login(username, password, onSlow) {
    return call("/auth/login", { method: "POST", body: { username, password }, auth: false, onSlow });
}

export function me() {
    return call("/auth/me");
}

export async function listPlaces() {
    const all = [];
    let page = 1;
    let total = Infinity;
    while (all.length < total && page < 50) {
        const data = await call("/places?includeInactive=true&limit=" + PAGE_SIZE + "&page=" + page);
        const batch = data.places || [];
        all.push(...batch);
        total = typeof data.total === "number" ? data.total : all.length;
        if (batch.length === 0) break;
        page += 1;
    }
    return all;
}

export function createPlace(place) {
    return call("/places", { method: "POST", body: place });
}

export function updatePlace(id, place) {
    return call("/places/" + encodeURIComponent(id), { method: "PUT", body: place });
}

export function deletePlace(id) {
    return call("/places/" + encodeURIComponent(id), { method: "DELETE" });
}

export function getNetwork() {
    return call("/paths/network");
}

export function createJunction(junction) {
    return call("/paths/junctions", { method: "POST", body: junction });
}

export function updateJunction(id, junction) {
    return call("/paths/junctions/" + encodeURIComponent(id), { method: "PUT", body: junction });
}

export function deleteJunction(id) {
    return call("/paths/junctions/" + encodeURIComponent(id), { method: "DELETE" });
}

export function createWalkway(walkway) {
    return call("/paths/walkways", { method: "POST", body: walkway });
}

export function updateWalkway(id, walkway) {
    return call("/paths/walkways/" + encodeURIComponent(id), { method: "PUT", body: walkway });
}

export function deleteWalkway(id) {
    return call("/paths/walkways/" + encodeURIComponent(id), { method: "DELETE" });
}

export function bulkImportPlaces(places, mode) {
    return call("/places/bulk", { method: "POST", body: { mode, places } });
}

export function uploadPlacePhoto(id, blob) {
    return call("/places/" + encodeURIComponent(id) + "/photo", { method: "PUT", body: blob });
}

export function deletePlacePhoto(id) {
    return call("/places/" + encodeURIComponent(id) + "/photo", { method: "DELETE" });
}

export function placePhotoUrl(place) {
    return API_BASE_URL + API_PREFIX + "/places/" + encodeURIComponent(place._id) + "/photo?v=" + (place.photoVersion || 0);
}

export function uploadGalleryImage(id, blob) {
    return call("/places/" + encodeURIComponent(id) + "/gallery", { method: "POST", body: blob });
}

export function deleteGalleryImage(id, imageId) {
    return call("/places/" + encodeURIComponent(id) + "/gallery/" + encodeURIComponent(imageId), { method: "DELETE" });
}

export function galleryImageUrl(placeId, imageId) {
    return API_BASE_URL + API_PREFIX + "/places/" + encodeURIComponent(placeId) + "/gallery/" + encodeURIComponent(imageId);
}

export function listEditHistory({ entity, action, q, page, limit }) {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    if (q) params.set("q", q);
    return call("/audit?" + params.toString());
}
