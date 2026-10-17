import { login } from "./api.js";
import { saveSession, hasValidSession, safeNext } from "./auth.js";

const params = new URLSearchParams(window.location.search);
const next = safeNext(params.get("next"));

if (hasValidSession()) {
    window.location.replace("./" + next);
}

const form = document.getElementById("login-form");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const button = document.getElementById("loginButt");
const errorBox = document.getElementById("login-error");
const notice = document.getElementById("login-notice");

const REASONS = {
    expired: "Please log in to continue.",
    logout: "You have been logged out."
};

if (REASONS[params.get("reason")]) {
    notice.textContent = REASONS[params.get("reason")];
    notice.hidden = false;
}

function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = false;
}

function setBusy(busy, label) {
    button.disabled = busy;
    usernameInput.disabled = busy;
    passwordInput.disabled = busy;
    button.textContent = label || "Login";
}

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorBox.hidden = true;
    const username = usernameInput.value.trim();
    const password = passwordInput.value;
    if (!username || !password) {
        showError("Enter your username and password.");
        return;
    }
    setBusy(true, "Logging in...");
    try {
        const data = await login(username, password, () => {
            button.textContent = "Server is waking up...";
        });
        saveSession({ token: data.token, admin: data.admin });
        window.location.replace("./" + next);
    } catch (error) {
        setBusy(false);
        passwordInput.value = "";
        showError(error.message);
        passwordInput.focus();
    }
});
