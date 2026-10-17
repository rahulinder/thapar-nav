import { categoryLabel } from "./categories.js";

export function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function scoreToken(entry, token) {
    if (entry.name.startsWith(token)) {
        return 100;
    }
    if (entry.nameWords.some((word) => word.startsWith(token))) {
        return 70;
    }
    if (entry.name.includes(token)) {
        return 50;
    }
    if (entry.aliases.some((alias) => alias.split(" ").some((word) => word.startsWith(token)))) {
        return 40;
    }
    if (entry.aliases.some((alias) => alias.includes(token))) {
        return 30;
    }
    if (entry.category.includes(token)) {
        return 20;
    }
    if (entry.description.includes(token)) {
        return 10;
    }
    return 0;
}

export function createSearch(places) {
    const entries = places.map((place) => {
        const name = normalizeText(place.name);
        return {
            place,
            name,
            nameWords: name.split(" "),
            aliases: place.aliases.map(normalizeText).filter(Boolean),
            category: normalizeText(categoryLabel(place.category)),
            description: normalizeText(place.description)
        };
    });

    function query(text, limit = 6) {
        const tokens = normalizeText(text).split(" ").filter(Boolean);
        if (tokens.length === 0) {
            return [];
        }
        const results = [];
        for (const entry of entries) {
            let total = 0;
            let matchedAll = true;
            for (const token of tokens) {
                const score = scoreToken(entry, token);
                if (score === 0) {
                    matchedAll = false;
                    break;
                }
                total += score;
            }
            if (matchedAll) {
                results.push({ place: entry.place, score: total });
            }
        }
        results.sort(
            (a, b) =>
                b.score - a.score ||
                a.place.name.localeCompare(b.place.name, undefined, { numeric: true, sensitivity: "base" })
        );
        return results.slice(0, limit).map((item) => item.place);
    }

    return { query };
}
