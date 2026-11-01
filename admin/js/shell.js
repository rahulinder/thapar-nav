import { requireLogin, getSession, saveSession, clearSession, goToLogin } from "./auth.js";
import { call } from "./api.js";

async function loadPart(url, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return null;
    const response = await fetch(url);
    if (!response.ok) throw new Error(url + " not found");
    target.innerHTML = await response.text();
    return target;
}

function markActiveLink() {
    const here = window.location.pathname.split("/").pop() || "dashboard.html";
    const related = { "places-data.html": "campus-data.html", "path-editor.html": "campus-data.html", "import-places.html": "campus-data.html" };
    const current = related[here] || here;
    document.querySelectorAll("#side-bar a[href]").forEach((link) => {
        if (link.getAttribute("href") === current) link.classList.add("active");
    });
}

function fillAdminName() {
    const session = getSession();
    const admin = session && session.admin;
    if (!admin) return;
    const name = document.getElementById("top-bar-admin-name");
    const role = document.getElementById("top-bar-admin-role");
    const picture = document.getElementById("top-bar-profile-image");
    if (name) name.textContent = admin.displayName || admin.username;
    if (picture && admin.avatar) picture.src = admin.avatar;
    if (role) role.textContent = admin.role === "superadmin" ? "Super admin" : "Admin";
}

async function refreshAdmin() {
    try {
        const data = await call("/auth/me");
        const session = getSession();
        if (session && data.admin) saveSession({ ...session, admin: data.admin });
        fillAdminName();
    } catch (error) {
        return;
    }
}

async function start() {
    if (!requireLogin()) return;
    document.body.hidden = false;
    try {
        await loadPart("top-bar.html", "top-bar-container");
        fillAdminName();
        refreshAdmin();
        await loadPart("side-bar.html", "sidebar-container");
    } catch (error) {
        console.error(error);
        return;
    }
    const sidebar = document.getElementById("side-bar");
    const menuButton = document.getElementById("menu-toggle-btn");
    if (menuButton && sidebar) {
        menuButton.addEventListener("click", () => sidebar.classList.toggle("expanded"));
    }
    const logout = document.getElementById("logout-button");
    if (logout) {
        logout.addEventListener("click", (event) => {
            event.preventDefault();
            clearSession();
            goToLogin("logout");
        });
    }
    markActiveLink();
    document.dispatchEvent(new CustomEvent("shell-ready"));
}

function watchScroll() {
    const body = document.body;
    const last = new WeakMap();
    let lockUntil = 0;
    document.addEventListener(
        "scroll",
        (event) => {
            const area = event.target;
            if (!(area instanceof Element) || area.closest("#sidebar-container") || !area.closest("#dashboard-body")) return;
            const top = area.scrollTop;
            if (performance.now() < lockUntil) {
                last.set(area, top);
                return;
            }
            const previous = last.has(area) ? last.get(area) : top;
            const delta = top - previous;
            const hidden = body.classList.contains("top-bar-hidden");
            const roomToHide = area.scrollHeight - area.clientHeight > 160;
            if (!hidden && delta > 6 && top > 80 && roomToHide) {
                body.classList.add("top-bar-hidden");
                lockUntil = performance.now() + 400;
            } else if (hidden && (delta < -6 || top < 20)) {
                body.classList.remove("top-bar-hidden");
                lockUntil = performance.now() + 400;
            }
            last.set(area, top);
        },
        true
    );
}

watchScroll();
start();
