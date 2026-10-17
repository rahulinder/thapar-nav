import { el, clear } from "./dom.js";
import { categoryLabel, categoryColor } from "./categories.js";
import { startRoute } from "./route.js";

export function initPlacePanel({ dialog, onShowOnMap = null }) {
    function close() {
        if (typeof dialog.close === "function") {
            dialog.close();
        } else {
            dialog.removeAttribute("open");
        }
    }

    function row(label, value) {
        return [el("dt", { text: label }), el("dd", { text: value })];
    }

    function open(place) {
        clear(dialog);
        dialog.setAttribute("aria-labelledby", "place-panel-title");

        const facts = [...row("Category", categoryLabel(place.category))];
        facts.push(...row("Opening hours", place.openingHours || "Not listed"));
        if (place.isEntrance) {
            facts.push(...row("Type", "Gate or entrance"));
        }

        const actions = [];
        if (typeof onShowOnMap === "function") {
            actions.push(
                el("button", {
                    type: "button",
                    class: "panel-button secondary",
                    text: "Show on map",
                    onclick: () => {
                        close();
                        onShowOnMap(place);
                    }
                })
            );
        }
        actions.push(
            el("button", {
                type: "button",
                class: "panel-button primary",
                text: "Start Route",
                onclick: () => startRoute(place)
            })
        );

        const badge = el("span", { class: "panel-badge", text: categoryLabel(place.category) });
        badge.style.setProperty("--accent", categoryColor(place.category));

        dialog.append(
            el("div", { class: "panel-handle", "aria-hidden": "true" }),
            el(
                "button",
                { type: "button", class: "panel-close", "aria-label": "Close details", onclick: close },
                [el("img", { src: "./assets/client-interface/balck-cross.svg", alt: "", width: "24", height: "24" })]
            ),
            badge,
            el("h2", { id: "place-panel-title", class: "panel-title", tabindex: "-1", autofocus: true, text: place.name }),
            place.altName ? el("p", { class: "panel-alt", text: place.altName }) : null,
            place.description ? el("p", { class: "panel-description", text: place.description }) : null,
            el("dl", { class: "panel-facts" }, facts),
            el("div", { class: "panel-actions" }, actions)
        );

        if (typeof dialog.showModal === "function") {
            if (!dialog.open) {
                dialog.showModal();
            }
        } else {
            dialog.setAttribute("open", "");
        }
    }

    dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
            close();
        }
    });

    return { open, close };
}
