import { call } from "./api.js";

const COUNTS = {
    hostel: { path: "/places?includeInactive=true&category=hostel&limit=1", one: "hostel", many: "hostels" },
    food: { path: "/places?includeInactive=true&category=food&limit=1", one: "shop", many: "shops" },
    other: { path: "/places?includeInactive=true&category=other&limit=1", one: "place", many: "places" },
    academic: { path: "/places?includeInactive=true&category=academic&limit=1", one: "building", many: "buildings" },
    visitor: { path: "/clients?userType=visitor&limit=1", one: "visitor", many: "visitors" }
};

async function fillCount(node) {
    const info = COUNTS[node.dataset.count];
    if (!info) return;
    try {
        const data = await call(info.path);
        const total = typeof data.total === "number" ? data.total : 0;
        node.textContent = total + " " + (total === 1 ? info.one : info.many);
        node.hidden = false;
    } catch (error) {
        node.hidden = true;
    }
}

document.addEventListener("shell-ready", () => {
    document.querySelectorAll(".quick-card-count").forEach(fillCount);
});
