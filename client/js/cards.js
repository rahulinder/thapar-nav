import { el } from "./dom.js";
import { categoryLabel, categoryColor } from "./categories.js";
import { HOME_CARDS_PER_SECTION } from "./config.js";

const ALIAS_MAX = 14;
const ALIAS_MIN = 9;

function fitAlias(name) {
    const title = name.querySelector(".name-text");
    const alias = name.querySelector(".name-in-brackets");
    if (!title || !alias || name.clientWidth === 0) return;
    const style = getComputedStyle(name);
    const available = name.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    const gap = parseFloat(style.columnGap) || 0;
    const margins = parseFloat(getComputedStyle(alias).marginLeft) + parseFloat(getComputedStyle(alias).marginRight);
    title.style.whiteSpace = "nowrap";
    const titleWidth = Math.min(title.scrollWidth, available);
    title.style.whiteSpace = "";
    alias.style.maxWidth = "";
    let size = ALIAS_MAX;
    alias.style.fontSize = size + "px";
    while (size > ALIAS_MIN && titleWidth + gap + margins + alias.scrollWidth > available) {
        size -= 1;
        alias.style.fontSize = size + "px";
    }
    if (titleWidth + gap + margins + alias.scrollWidth > available) {
        alias.style.maxWidth = Math.max(60, available - Math.min(titleWidth, available * 0.6) - gap - margins) + "px";
    }
}

function watchAlias(name) {
    if (typeof ResizeObserver !== "function") return;
    new ResizeObserver(() => fitAlias(name)).observe(name);
}

export function createPlaceCard(place, { onOpen, onRoute, showCategory = false }) {
    const name = el("h1", { class: "location-name" }, [el("span", { class: "name-text", text: place.name })]);
    if (place.altName) {
        name.append(el("p", { class: "name-in-brackets", text: `(${place.altName})` }));
        watchAlias(name);
    }

    const children = [
        el("button", {
            type: "button",
            class: "card-open",
            "aria-label": `View details for ${place.name}`,
            onclick: () => onOpen(place)
        })
    ];
    if (showCategory) {
        children.push(el("span", { class: "card-badge", text: categoryLabel(place.category) }));
    }
    children.push(
        el("div", { class: "card-details" }, [
            name,
            el("button", {
                type: "button",
                class: "route-button",
                text: "Start Route",
                "aria-label": `Start route to ${place.name}`,
                onclick: () => onRoute(place)
            })
        ])
    );

    const card = el("div", { class: "cards place-card", dataset: { category: place.category, placeId: place.id } }, children);
    card.style.setProperty("--accent", categoryColor(place.category));
    if (place.photoUrl) {
        card.classList.add("has-photo");
        card.style.setProperty("--photo", `url("${place.photoUrl}")`);
    }
    return card;
}

export function createSection({ category, places, onOpen, onRoute }) {
    const label = categoryLabel(category);
    const shown = places.slice(0, HOME_CARDS_PER_SECTION);
    const container = el(
        "div",
        { class: "horizontal-scroll-container" },
        shown.map((place) => createPlaceCard(place, { onOpen, onRoute }))
    );
    container.append(
        el("a", {
            class: "see-all-button",
            href: `places.html?category=${encodeURIComponent(category)}`,
            text: `See all ${label} (${places.length}) →`
        })
    );
    return el("div", { class: "horizontal-scroll-blocks", id: `section-${category}` }, [
        el("h3", { class: "horizontal-scroll-titles", text: label }),
        container
    ]);
}

export function createSkeletonSection() {
    return el("div", { class: "horizontal-scroll-blocks skeleton-block", "aria-hidden": "true" }, [
        el("h3", { class: "horizontal-scroll-titles skeleton-title" }, [el("span", { class: "skeleton-line" })]),
        el("div", { class: "horizontal-scroll-container" }, [
            el("div", { class: "cards skeleton" }),
            el("div", { class: "cards skeleton" })
        ])
    ]);
}

export function createStateCard({ title, text, actionLabel = "", onAction = null, href = "" }) {
    const children = [el("h2", { text: title }), el("p", { text })];
    if (actionLabel && typeof onAction === "function") {
        children.push(el("button", { type: "button", class: "state-action", text: actionLabel, onclick: onAction }));
    } else if (actionLabel && href) {
        children.push(el("a", { class: "state-action", href, text: actionLabel }));
    }
    return el("div", { class: "state-card", role: "alert" }, children);
}
