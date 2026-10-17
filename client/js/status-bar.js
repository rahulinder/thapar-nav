import { el } from "./dom.js";

export function createStatusBar(container) {
    function clear() {
        container.replaceChildren();
        container.removeAttribute("data-tone");
    }

    function show(message, { tone = "info", actionLabel = "", onAction = null } = {}) {
        container.replaceChildren();
        container.dataset.tone = tone;
        const children = [el("span", { class: "status-text", text: message })];
        if (actionLabel && typeof onAction === "function") {
            children.push(
                el("button", { type: "button", class: "status-action", text: actionLabel, onclick: onAction })
            );
        }
        container.append(...children);
    }

    return { show, clear };
}
