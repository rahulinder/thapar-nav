import { ROLE_SHORTCUTS } from "./config.js";
import { nearestPlace } from "./geo.js";

export function buildShortcuts(role, places, origin) {
    const wanted = ROLE_SHORTCUTS[role] || [];
    const result = [];
    for (const item of wanted) {
        const matches = places.filter((place) => place.category === item.category);
        if (matches.length === 0) {
            continue;
        }
        const nearest = origin ? nearestPlace(matches, origin) : null;
        result.push({ label: item.label, place: nearest ? nearest.place : matches[0] });
    }
    return result;
}
