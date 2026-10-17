function escapeRegex(text) {
    return String(text).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function searchTokens(query) {
    return String(query || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 6)
        .map((token) => new RegExp(escapeRegex(token), "i"));
}

module.exports = { escapeRegex, searchTokens };
