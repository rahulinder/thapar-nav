import { getRole, getVisitorName, safeNextUrl, setVisitorName } from "./roles.js";

const params = new URLSearchParams(window.location.search);
const next = safeNextUrl(params.get("next"));

if (getRole()) {
    window.location.replace(next);
}

const form = document.getElementById("credentials-card");
const nameInput = document.getElementById("visitor-name");
nameInput.value = getVisitorName();

function goToRoleChoice() {
    window.location.href = `user-option.html?next=${encodeURIComponent(next)}`;
}

form.addEventListener("submit", (event) => {
    event.preventDefault();
    setVisitorName(nameInput.value);
    goToRoleChoice();
});

document.getElementById("skip-btn").addEventListener("click", () => {
    setVisitorName("");
    goToRoleChoice();
});
