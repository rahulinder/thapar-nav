import { ROLES } from "./config.js";
import { clearRole, clearVisitorName, getRole, getVisitorName, setRole, setVisitorName } from "./roles.js";
import { getContact, getRollNo, isValidContact, isValidRollNo, setContact, setRollNo, syncVisit } from "./visits.js";

const role = getRole();
if (!role) {
    window.location.replace("user-option.html?next=profile.html");
}

const note = document.getElementById("profile-note");
const status = document.getElementById("profile-status");
const rows = Array.from(document.querySelectorAll(".profile-row"));

function say(text, isError = false) {
    status.textContent = text;
    status.classList.toggle("is-error", isError);
}

function effective(field) {
    return field === "contact" && getRole() === "student" ? "roll" : field;
}

function currentValue(field) {
    const key = effective(field);
    if (key === "name") return getVisitorName();
    if (key === "roll") return getRollNo();
    if (key === "contact") return getContact();
    return getRole() ? ROLES[getRole()].label : "";
}

function render() {
    const initial = (getVisitorName() || "G").trim().charAt(0).toUpperCase() || "G";
    document.getElementById("profile-avatar").textContent = initial;
    const hasName = Boolean(getVisitorName());
    const hasContact = Boolean(getRole() === "student" ? getRollNo() : getContact());
    for (const row of rows) {
        const field = row.dataset.field;
        if (field === "contact") {
            row.querySelector(".profile-label").textContent = effective(field) === "roll" ? "Roll no." : "Contact";
        }
        const value = row.querySelector("[data-value]");
        const text = currentValue(field);
        value.textContent = text || (field === "name" ? "Guest" : "Not set");
        value.classList.toggle("is-empty", !text);
    }
    note.hidden = hasName && hasContact;
    note.textContent = `You are browsing as a guest. Add both your name and your ${getRole() === "student" ? "roll number" : "contact"} to be listed as a registered user.`;
}

function closeEditors() {
    document.querySelectorAll(".profile-editor").forEach((editor) => editor.remove());
}

function buildInput(field) {
    const key = effective(field);
    if (field === "role") {
        const select = document.createElement("select");
        select.setAttribute("aria-label", "User type");
        for (const [key, info] of Object.entries(ROLES)) {
            const option = document.createElement("option");
            option.value = key;
            option.textContent = info.label;
            select.append(option);
        }
        select.value = getRole();
        return select;
    }
    const input = document.createElement("input");
    input.type = "text";
    input.value = currentValue(field);
    if (key === "roll") {
        input.maxLength = 15;
        input.autocomplete = "off";
        input.setAttribute("aria-label", "Roll number");
    } else if (key === "name") {
        input.maxLength = 40;
        input.autocomplete = "name";
        input.setAttribute("aria-label", "Name");
    } else {
        input.maxLength = 80;
        input.autocomplete = "tel";
        input.setAttribute("aria-label", "Phone number or email");
    }
    return input;
}

function save(field, value) {
    if (field === "name") {
        const clean = value.trim();
        if (!clean) return "Enter your name.";
        setVisitorName(clean);
    } else if (effective(field) === "roll") {
        if (!isValidRollNo(value)) return "Enter a valid roll number (letters and digits only).";
        setRollNo(value);
    } else if (field === "contact") {
        if (!isValidContact(value)) return "Enter a valid phone number or email address.";
        setContact(value);
    } else {
        if (!ROLES[value]) return "Choose a user type.";
        setRole(value);
    }
    syncVisit(getRole());
    return "";
}

function openEditor(row) {
    closeEditors();
    say("");
    const field = row.dataset.field;
    const editor = document.createElement("form");
    editor.className = "profile-editor";
    const input = buildInput(field);
    const error = document.createElement("p");
    error.className = "profile-error";
    error.hidden = true;
    const actions = document.createElement("div");
    actions.className = "profile-actions";
    const saveButton = document.createElement("button");
    saveButton.type = "submit";
    saveButton.textContent = "Save";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "profile-cancel";
    cancel.textContent = "Cancel";
    cancel.addEventListener("click", closeEditors);
    actions.append(saveButton, cancel);
    editor.append(input, error, actions);
    editor.addEventListener("submit", (event) => {
        event.preventDefault();
        const problem = save(field, input.value);
        if (problem) {
            error.textContent = problem;
            error.hidden = false;
            return;
        }
        closeEditors();
        render();
        say("Saved.");
    });
    row.after(editor);
    input.focus();
}

for (const row of rows) {
    row.querySelector(".profile-edit").addEventListener("click", () => openEditor(row));
}

render();

document.getElementById("profile-logout").addEventListener("click", () => {
    clearRole();
    clearVisitorName();
    window.location.href = "user-option.html?next=index.html";
});
