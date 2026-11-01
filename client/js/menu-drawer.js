import { clearRole, clearVisitorName } from "./roles.js";

const link = document.createElement("link");
link.rel = "stylesheet";
link.href = "./css/drawer.css";
document.head.append(link);

function item(tag, props, label) {
    const node = document.createElement(tag);
    Object.assign(node, props);
    const heading = document.createElement("h1");
    heading.textContent = label;
    node.append(heading);
    return node;
}

const backdrop = document.createElement("div");
backdrop.id = "menu-backdrop";

const drawer = document.createElement("aside");
drawer.id = "menu-drawer";
drawer.setAttribute("aria-label", "Menu");
drawer.setAttribute("aria-hidden", "true");

const head = document.createElement("div");
head.className = "drawer-head";
const closeButton = document.createElement("button");
closeButton.type = "button";
closeButton.className = "drawer-close";
closeButton.setAttribute("aria-label", "Close menu");
const closeIcon = document.createElement("img");
closeIcon.src = "./assets/client-interface/balck-cross.svg";
closeIcon.alt = "";
closeButton.append(closeIcon);
head.append(closeButton);

const logout = item("button", { type: "button", className: "drawer-item" }, "Logout");

drawer.append(
    head,
    item("a", { href: "index.html" }, "Home"),
    item("a", { href: "profile.html" }, "Profile"),
    item("a", { href: "user-option.html?next=index.html" }, "Change user type"),
    item("a", { href: "support.html" }, "Support"),
    logout
);
document.body.append(backdrop, drawer);

const supportBackdrop = document.createElement("div");
supportBackdrop.id = "support-backdrop";
const supportBox = document.createElement("div");
supportBox.id = "support-overlay";
supportBox.setAttribute("role", "dialog");
supportBox.setAttribute("aria-modal", "true");
supportBox.setAttribute("aria-labelledby", "support-title");
supportBox.hidden = true;
supportBackdrop.hidden = true;
const supportClose = document.createElement("button");
supportClose.type = "button";
supportClose.className = "support-close";
supportClose.setAttribute("aria-label", "Close support");
const supportCloseIcon = document.createElement("img");
supportCloseIcon.src = "./assets/client-interface/balck-cross.svg";
supportCloseIcon.alt = "";
supportClose.append(supportCloseIcon);
const supportTitle = document.createElement("h2");
supportTitle.id = "support-title";
supportTitle.textContent = "Support";
function supportHeading(text) {
    const node = document.createElement("h3");
    node.className = "support-heading";
    node.textContent = text;
    return node;
}

function supportLine(label, values, kind) {
    const line = document.createElement("p");
    const strong = document.createElement("strong");
    strong.textContent = label + " ";
    line.append(strong);
    values.forEach((value, index) => {
        if (index > 0) line.append(document.createElement("br"));
        const link = document.createElement("a");
        link.href = (kind === "mail" ? "mailto:" : "tel:") + value;
        link.textContent = value;
        line.append(link);
    });
    return line;
}

const techSection = document.createElement("section");
techSection.className = "support-group";
techSection.append(
    supportHeading("Technical Support"),
    supportLine("Email:", ["nav.support@thapar.edu"], "mail"),
    supportLine("Contact:", ["9876543210"], "tel")
);

const emergencySection = document.createElement("section");
emergencySection.className = "support-group";
emergencySection.append(
    supportHeading("Emergency"),
    supportLine("Ambulance:", ["9182736405", "9282726258"], "tel"),
    supportLine("Security:", ["9392048204", "9587340524"], "tel")
);

supportBox.append(supportClose, supportTitle, techSection, emergencySection);
document.body.append(supportBackdrop, supportBox);

let supportOpener = null;

function openSupport(trigger) {
    supportOpener = trigger || null;
    supportBackdrop.hidden = false;
    supportBox.hidden = false;
    supportClose.focus();
}

function closeSupport() {
    supportBackdrop.hidden = true;
    supportBox.hidden = true;
    if (supportOpener) supportOpener.focus();
}

let opener = null;

function open(trigger) {
    opener = trigger || null;
    backdrop.classList.add("is-open");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    closeButton.focus();
}

function close() {
    backdrop.classList.remove("is-open");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    if (opener) opener.focus();
}

document.addEventListener("click", (event) => {
    const support = event.target.closest('a[href="support.html"]');
    if (support) {
        event.preventDefault();
        if (drawer.classList.contains("is-open")) {
            opener = null;
            close();
        }
        openSupport(support.closest("#menu-drawer") ? null : support);
        return;
    }
    const trigger = event.target.closest('a[href="menu.html"]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
});

closeButton.addEventListener("click", close);
supportClose.addEventListener("click", closeSupport);
supportBackdrop.addEventListener("click", closeSupport);
backdrop.addEventListener("click", close);
document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    if (!supportBox.hidden) closeSupport();
    else if (drawer.classList.contains("is-open")) close();
});

logout.addEventListener("click", () => {
    clearRole();
    clearVisitorName();
    window.location.href = "user-option.html?next=index.html";
});
