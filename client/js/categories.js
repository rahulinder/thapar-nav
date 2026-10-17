import { CATEGORIES, ROLES, DEFAULT_CATEGORY_COLOR } from "./config.js";

export function categoryLabel(key) {
    if (CATEGORIES[key]) {
        return CATEGORIES[key].label;
    }
    return String(key)
        .replace(/[-_]+/g, " ")
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function categoryColor(key) {
    return CATEGORIES[key] ? CATEGORIES[key].color : DEFAULT_CATEGORY_COLOR;
}

export function byName(a, b) {
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
}

export function orderCategories(keys, role) {
    const preferred = ROLES[role] ? ROLES[role].order : [];
    const rank = (key) => {
        const index = preferred.indexOf(key);
        return index === -1 ? preferred.length : index;
    };
    return [...keys].sort((a, b) => rank(a) - rank(b) || categoryLabel(a).localeCompare(categoryLabel(b)));
}

export function groupByCategory(places) {
    const groups = new Map();
    for (const place of places) {
        if (!groups.has(place.category)) {
            groups.set(place.category, []);
        }
        groups.get(place.category).push(place);
    }
    for (const list of groups.values()) {
        list.sort(byName);
    }
    return groups;
}
