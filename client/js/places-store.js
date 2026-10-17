import { CACHE_MAX_AGE_MS, SLOW_NOTICE_MS, STORAGE_KEYS } from "./config.js";
import { fetchPlaces } from "./api.js";
import { storage } from "./storage.js";

export function readCache(role) {
    const all = storage.get(STORAGE_KEYS.places);
    const entry = all && typeof all === "object" ? all[role] : null;
    if (!entry || !Array.isArray(entry.places) || typeof entry.savedAt !== "number") {
        return null;
    }
    if (Date.now() - entry.savedAt > CACHE_MAX_AGE_MS) {
        return null;
    }
    return entry.places;
}

export function writeCache(role, places) {
    const all = storage.get(STORAGE_KEYS.places);
    const next = all && typeof all === "object" ? { ...all } : {};
    next[role] = { savedAt: Date.now(), places };
    storage.set(STORAGE_KEYS.places, next);
}

export function createLoader({ role, statusBar, onPlaces, onLoading, onFailure }) {
    let rendered = false;
    let lastJson = "";
    let running = false;

    function render(places) {
        const json = JSON.stringify(places);
        if (rendered && json === lastJson) {
            return;
        }
        lastJson = json;
        rendered = true;
        onPlaces(places);
    }

    async function refresh() {
        if (running) {
            return;
        }
        running = true;
        const slowTimer = setTimeout(() => {
            statusBar.show(
                rendered
                    ? "Refreshing places. The server is waking up, this can take a minute."
                    : "The server is waking up. This can take up to a minute the first time.",
                { tone: "info" }
            );
        }, SLOW_NOTICE_MS);

        try {
            const places = await fetchPlaces(role, {
                onRetry: (attempt, total) => {
                    statusBar.show(`Still trying to reach the server (attempt ${attempt} of ${total}).`, {
                        tone: "info"
                    });
                }
            });
            writeCache(role, places);
            statusBar.clear();
            render(places);
        } catch (error) {
            if (rendered) {
                statusBar.show("Showing saved places. Could not refresh them.", {
                    tone: "warn",
                    actionLabel: "Try again",
                    onAction: start
                });
            } else {
                statusBar.clear();
                onFailure(error);
            }
        } finally {
            clearTimeout(slowTimer);
            running = false;
        }
    }

    function start() {
        if (!rendered) {
            const cached = readCache(role);
            if (cached) {
                render(cached);
            } else {
                onLoading();
            }
        }
        refresh();
    }

    return { start };
}
