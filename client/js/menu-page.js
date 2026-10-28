import { clearRole, clearVisitorName } from "./roles.js";

document.getElementById("menu-close").addEventListener("click", () => {
    if (window.history.length > 1 && document.referrer) {
        window.history.back();
    } else {
        window.location.href = "index.html";
    }
});

document.getElementById("logout-button").addEventListener("click", () => {
    clearRole();
    clearVisitorName();
    window.location.href = "user-option.html?next=index.html";
});
