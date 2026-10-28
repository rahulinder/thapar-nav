import { getSession, saveSession } from "./auth.js";
import { call } from "./api.js";

const getMe = () => call("/auth/me");
const updateProfile = (body) => call("/auth/me", { method: "PUT", body });
const changePassword = (body) => call("/auth/password", { method: "PUT", body });

const note = document.getElementById("account-note");
const photo = document.getElementById("profile-photo");
const DEFAULT_PHOTO = photo.getAttribute("src");
let admin = null;

function say(text, isError = false) {
    note.textContent = text;
    note.classList.toggle("error", isError);
}

function refreshTopBar() {
    const name = document.getElementById("top-bar-admin-name");
    const picture = document.getElementById("top-bar-profile-image");
    if (name) name.textContent = admin.displayName || admin.username;
    if (picture) picture.src = admin.avatar || DEFAULT_PHOTO;
}

function remember(updated) {
    admin = updated;
    const session = getSession();
    if (session) saveSession({ ...session, admin });
    render();
    refreshTopBar();
}

function render() {
    if (!admin) return;
    document.getElementById("value-username").textContent = admin.username;
    photo.src = admin.avatar || DEFAULT_PHOTO;
    document.querySelectorAll(".editable").forEach((row) => {
        const value = row.querySelector("[data-value]");
        const text = admin[row.dataset.field] || "";
        value.textContent = text || "Not set";
        value.classList.toggle("empty", !text);
    });
}

function openEditor(row) {
    closeEditors();
    const field = row.dataset.field;
    const form = document.createElement("form");
    form.className = "edit-panel";
    form.dataset.editor = field;
    const input = document.createElement("input");
    input.type = row.dataset.type;
    input.maxLength = Number(row.dataset.max);
    input.value = admin[field] || "";
    input.placeholder = row.dataset.label;
    input.setAttribute("aria-label", row.dataset.label);
    input.autocomplete = row.dataset.autocomplete;
    const buttons = document.createElement("div");
    buttons.className = "panel-buttons";
    const save = document.createElement("button");
    save.type = "submit";
    save.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closeEditors);
    buttons.append(save, cancel);
    form.append(input, buttons);
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        save.disabled = true;
        try {
            const data = await updateProfile({ [field]: input.value.trim() });
            remember(data.admin);
            closeEditors();
            say(`${row.dataset.label} saved.`);
        } catch (error) {
            say(error.message, true);
            save.disabled = false;
        }
    });
    row.after(form);
    input.focus();
}

function closeEditors() {
    document.querySelectorAll("[data-editor]").forEach((form) => form.remove());
    document.getElementById("password-form").hidden = true;
}

document.querySelectorAll(".editable .edit-btn").forEach((button) => {
    button.addEventListener("click", () => openEditor(button.closest(".editable")));
});

document.getElementById("password-edit").addEventListener("click", () => {
    closeEditors();
    document.getElementById("password-form").hidden = false;
    document.getElementById("pw-current").focus();
});

document.getElementById("pw-cancel").addEventListener("click", () => {
    document.getElementById("password-form").reset();
    closeEditors();
});

document.getElementById("password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const current = document.getElementById("pw-current").value;
    const next = document.getElementById("pw-new").value;
    const confirm = document.getElementById("pw-confirm").value;
    if (next !== confirm) {
        say("The new passwords do not match.", true);
        return;
    }
    if (next.length < 10) {
        say("New password must be at least 10 characters.", true);
        return;
    }
    try {
        await changePassword({ currentPassword: current, newPassword: next });
        event.target.reset();
        closeEditors();
        say("Password changed.");
    } catch (error) {
        say(error.message, true);
    }
});

function resizeToAvatar(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            const size = 96;
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;
            const side = Math.min(image.width, image.height);
            const context = canvas.getContext("2d");
            context.drawImage(image, (image.width - side) / 2, (image.height - side) / 2, side, side, 0, 0, size, size);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL("image/jpeg", 0.75));
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("That file is not a readable image."));
        };
        image.src = url;
    });
}

async function saveAvatar(avatar) {
    try {
        const data = await updateProfile({ avatar });
        remember(data.admin);
        say(avatar ? "Profile picture saved." : "Profile picture removed.");
    } catch (error) {
        say(error.message, true);
    }
}

const fileInput = document.getElementById("photo-input");
document.getElementById("photo-change").addEventListener("click", () => fileInput.click());
document.getElementById("photo-remove").addEventListener("click", () => saveAvatar(""));
fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    fileInput.value = "";
    if (!file) return;
    try {
        await saveAvatar(await resizeToAvatar(file));
    } catch (error) {
        say(error.message, true);
    }
});

document.getElementById("title-container").addEventListener("click", () => {
    window.location.href = "./settings.html";
});

const startSession = getSession();
if (startSession && startSession.admin) {
    admin = startSession.admin;
    render();
}

document.addEventListener("shell-ready", async () => {
    try {
        const data = await getMe();
        admin = data.admin;
        render();
        refreshTopBar();
    } catch (error) {
        say("Could not load your details: " + error.message, true);
    }
});
