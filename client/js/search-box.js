import { el, clear } from "./dom.js";
import { createSearch } from "./search.js";
import { SUGGESTION_LIMIT } from "./config.js";
import { categoryLabel, categoryColor } from "./categories.js";

export function createSearchBox({ form, input, list, onSelect }) {
    let search = createSearch([]);
    let results = [];
    let active = -1;
    let blurTimer = null;

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", list.id);
    input.setAttribute("autocomplete", "off");
    list.setAttribute("role", "listbox");

    function optionId(index) {
        return `${list.id}-option-${index}`;
    }

    function setActive(index) {
        active = index;
        input.setAttribute("aria-activedescendant", index >= 0 ? optionId(index) : "");
        [...list.children].forEach((item, position) => {
            item.setAttribute("aria-selected", position === index ? "true" : "false");
            item.classList.toggle("is-active", position === index);
        });
        const current = list.children[index];
        if (current && typeof current.scrollIntoView === "function") {
            current.scrollIntoView({ block: "nearest" });
        }
    }

    function close() {
        list.hidden = true;
        clear(list);
        results = [];
        active = -1;
        input.setAttribute("aria-expanded", "false");
        input.removeAttribute("aria-activedescendant");
    }

    function choose(place) {
        close();
        input.value = "";
        input.blur();
        onSelect(place);
    }

    function open() {
        clear(list);
        const text = input.value.trim();
        if (!text) {
            close();
            return;
        }
        results = search.query(text, SUGGESTION_LIMIT);
        if (results.length === 0) {
            list.append(
                el("li", { class: "suggestion-empty", role: "presentation", text: "No places match your search" })
            );
        } else {
            results.forEach((place, index) => {
                list.append(
                    el(
                        "li",
                        {
                            id: optionId(index),
                            class: "suggestion",
                            role: "option",
                            "aria-selected": "false",
                            onmousedown: (event) => event.preventDefault(),
                            onclick: () => choose(place)
                        },
                        [
                            el("span", {
                                class: "suggestion-dot",
                                style: `background:${categoryColor(place.category)}`,
                                "aria-hidden": "true"
                            }),
                            el("span", { class: "suggestion-name", text: place.name }),
                            el("span", { class: "suggestion-category", text: categoryLabel(place.category) })
                        ]
                    )
                );
            });
        }
        list.hidden = false;
        active = -1;
        input.setAttribute("aria-expanded", "true");
        input.removeAttribute("aria-activedescendant");
    }

    input.addEventListener("input", open);
    input.addEventListener("focus", () => {
        clearTimeout(blurTimer);
        if (input.value.trim()) {
            open();
        }
    });
    input.addEventListener("blur", () => {
        blurTimer = setTimeout(close, 150);
    });
    input.addEventListener("keydown", (event) => {
        if (list.hidden || results.length === 0) {
            if (event.key === "Escape") {
                close();
            }
            return;
        }
        if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((active + 1) % results.length);
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive(active <= 0 ? results.length - 1 : active - 1);
        } else if (event.key === "Escape") {
            close();
        }
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (results.length === 0) {
            open();
            return;
        }
        choose(results[active >= 0 ? active : 0]);
    });

    return {
        setPlaces(places) {
            search = createSearch(places);
            if (document.activeElement === input && input.value.trim()) {
                open();
            }
        }
    };
}
