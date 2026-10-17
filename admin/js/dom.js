export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
        if (value === undefined || value === null || value === false) continue;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else if (key === "dataset") Object.assign(node.dataset, value);
        else if (key.startsWith("on") && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
        else if (value === true) node.setAttribute(key, "");
        else node.setAttribute(key, value);
    }
    for (const child of [].concat(children)) {
        if (child === null || child === undefined || child === false) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
}

let toastTimer = null;

export function toast(message, kind = "ok") {
    let box = document.getElementById("toast");
    if (!box) {
        box = el("div", { id: "toast", role: "status", "aria-live": "polite" });
        document.body.append(box);
    }
    box.textContent = message;
    box.className = "toast show " + kind;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        box.className = "toast";
    }, 4000);
}

export function confirmDialog(message, yesLabel = "Delete") {
    return new Promise((resolve) => {
        const dialog = el("dialog", { class: "confirm-dialog" });
        const form = el("form", { method: "dialog" }, [
            el("p", { text: message }),
            el("div", { class: "dialog-buttons" }, [
                el("button", { value: "cancel", type: "submit", class: "plain", text: "Cancel" }),
                el("button", { value: "yes", type: "submit", class: "danger", text: yesLabel })
            ])
        ]);
        dialog.append(form);
        document.body.append(dialog);
        dialog.addEventListener("close", () => {
            const answer = dialog.returnValue === "yes";
            dialog.remove();
            resolve(answer);
        });
        dialog.showModal();
    });
}
