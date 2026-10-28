import { storage } from "./storage.js";

const FAVOURITES_KEY = "thaparNav.favourites";
const RECENT_KEY = "thaparNav.recent";
const MAX_FAVOURITES = 10;
const MAX_RECENT = 5;

function read(key) {
    const value = storage.get(key);
    return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

function changed() {
    document.dispatchEvent(new CustomEvent("saved-changed"));
}

export function getFavouriteIds() {
    return read(FAVOURITES_KEY);
}

export function isFavourite(id) {
    return read(FAVOURITES_KEY).includes(id);
}

export function toggleFavourite(id) {
    const list = read(FAVOURITES_KEY);
    const index = list.indexOf(id);
    let saved;
    if (index >= 0) {
        list.splice(index, 1);
        saved = false;
    } else {
        list.unshift(id);
        saved = true;
    }
    storage.set(FAVOURITES_KEY, list.slice(0, MAX_FAVOURITES));
    changed();
    return saved;
}

export function getRecentIds() {
    return read(RECENT_KEY);
}

export function addRecent(id) {
    const list = read(RECENT_KEY).filter((item) => item !== id);
    list.unshift(id);
    storage.set(RECENT_KEY, list.slice(0, MAX_RECENT));
    changed();
}

export function clearRecent() {
    storage.remove(RECENT_KEY);
    changed();
}
