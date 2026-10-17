const PROPERTY_KEYS = new Set(["value", "disabled", "hidden", "checked"]);

export function el(tag, attributes = {}, children = []) {
    const node = document.createElement(tag);

    for (const [key, value] of Object.entries(attributes)) {
        if (value === null || value === undefined || value === false) {
            continue;
        }
        if (key === "class") {
            node.className = value;
        } else if (key === "text") {
            node.textContent = value;
        } else if (key === "dataset") {
            Object.assign(node.dataset, value);
        } else if (key.startsWith("on") && typeof value === "function") {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (PROPERTY_KEYS.has(key)) {
            node[key] = value;
        } else {
            node.setAttribute(key, value === true ? "" : String(value));
        }
    }

    const list = Array.isArray(children) ? children : [children];
    for (const child of list) {
        if (child === null || child === undefined || child === false) {
            continue;
        }
        node.append(child.nodeType ? child : document.createTextNode(String(child)));
    }

    return node;
}

export function clear(node) {
    node.replaceChildren();
}

export function byId(id) {
    return document.getElementById(id);
}

export function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
