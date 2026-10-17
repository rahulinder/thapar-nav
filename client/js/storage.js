const fallback = new Map();

function readRaw(key) {
    try {
        return window.localStorage.getItem(key);
    } catch {
        return fallback.has(key) ? fallback.get(key) : null;
    }
}

function writeRaw(key, value) {
    try {
        window.localStorage.setItem(key, value);
    } catch {
        fallback.set(key, value);
    }
}

function removeRaw(key) {
    try {
        window.localStorage.removeItem(key);
    } catch {
    }
    fallback.delete(key);
}

export const storage = {
    get(key) {
        const raw = readRaw(key);
        if (raw === null) {
            return null;
        }
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    },
    set(key, value) {
        writeRaw(key, JSON.stringify(value));
    },
    remove(key) {
        removeRaw(key);
    }
};
