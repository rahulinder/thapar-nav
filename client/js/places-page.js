import { byId, clear, el } from "./dom.js";
import { requireRole } from "./roles.js";
import { createStatusBar } from "./status-bar.js";
import { createLoader } from "./places-store.js";
import { createSearchBox } from "./search-box.js";
import { createPlaceCard, createSkeletonSection, createStateCard } from "./cards.js";
import { initPlacePanel } from "./place-panel.js";
import { categoryLabel, groupByCategory, orderCategories } from "./categories.js";
import { startRoute } from "./route.js";

const CATEGORY_PATTERN = /^[a-z0-9_-]{1,40}$/;

function readCategory() {
    const value = new URLSearchParams(window.location.search).get("category");
    return value && CATEGORY_PATTERN.test(value) ? value : "";
}

function main() {
    const role = requireRole();
    if (!role) {
        return;
    }

    const list = byId("places-list");
    const chips = byId("category-chips");
    const title = byId("page-title");
    const count = byId("result-count");
    const statusBar = createStatusBar(byId("status"));

    let places = [];
    let selected = readCategory();

    const panel = initPlacePanel({ dialog: byId("place-panel") });

    const searchBox = createSearchBox({
        form: byId("search-bar"),
        input: byId("search-input"),
        list: byId("search-suggestions"),
        onSelect: (place) => {
            window.location.href = `index.html?place=${encodeURIComponent(place.id)}`;
        }
    });

    function setSelected(category) {
        selected = category;
        const url = category ? `places.html?category=${encodeURIComponent(category)}` : "places.html";
        window.history.replaceState(null, "", url);
        renderList();
        renderChips();
    }

    function renderChips() {
        clear(chips);
        const groups = groupByCategory(places);
        const keys = orderCategories([...groups.keys()], role);
        const options = [{ key: "", label: "All" }, ...keys.map((key) => ({ key, label: categoryLabel(key) }))];
        for (const option of options) {
            chips.append(
                el("button", {
                    type: "button",
                    class: "hostel-category-buttons",
                    text: option.label,
                    "aria-pressed": option.key === selected ? "true" : "false",
                    onclick: () => setSelected(option.key)
                })
            );
        }
    }

    function renderList() {
        clear(list);
        const visible = selected ? places.filter((place) => place.category === selected) : places;
        title.textContent = selected ? categoryLabel(selected) : "All places";
        document.title = `${title.textContent} - Thapar-Nav`;
        count.textContent = `${visible.length} ${visible.length === 1 ? "place" : "places"}`;

        if (visible.length === 0) {
            list.append(
                createStateCard({
                    title: selected ? "Nothing here yet" : "No places yet",
                    text: selected
                        ? `There are no ${categoryLabel(selected)} places to show for you.`
                        : "There are no places to show for you right now.",
                    actionLabel: selected ? "Show all places" : "",
                    onAction: selected ? () => setSelected("") : null
                })
            );
            return;
        }

        const sorted = [...visible].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        );
        for (const place of sorted) {
            list.append(
                createPlaceCard(place, {
                    onOpen: (item) => panel.open(item),
                    onRoute: startRoute,
                    showCategory: !selected
                })
            );
        }
    }

    function showLoading() {
        clear(list);
        title.textContent = selected ? categoryLabel(selected) : "All places";
        count.textContent = "";
        list.append(createSkeletonSection());
    }

    const loader = createLoader({
        role,
        statusBar,
        onLoading: showLoading,
        onPlaces: (loaded) => {
            places = loaded;
            searchBox.setPlaces(places);
            renderChips();
            renderList();
        },
        onFailure: (error) => {
            clear(list);
            clear(chips);
            list.append(
                createStateCard({
                    title: "Could not load places",
                    text: error && error.message ? error.message : "Something went wrong.",
                    actionLabel: "Try again",
                    onAction: () => loader.start()
                })
            );
        }
    });

    loader.start();
}

main();
