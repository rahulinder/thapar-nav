import { getRole, safeNextUrl, setLoginPending, setRole } from "./roles.js";

const params = new URLSearchParams(window.location.search);
const next = safeNextUrl(params.get("next"));
const current = getRole();

for (const button of document.querySelectorAll(".role-option")) {
    const role = button.dataset.role;
    if (role === current) {
        button.setAttribute("aria-current", "true");
    }
    button.addEventListener("click", () => {
        const firstChoice = !getRole();
        setRole(role);
        if (firstChoice) {
            setLoginPending(true);
            window.location.href = `login.html?next=${encodeURIComponent(next)}`;
        } else {
            window.location.href = next;
        }
    });
}
