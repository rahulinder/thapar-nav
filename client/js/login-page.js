import { getRole, getVisitorName, isLoginPending, safeNextUrl, setLoginPending, setVisitorName } from "./roles.js";
import { getContact, getRollNo, isValidContact, isValidRollNo, setContact, setRollNo } from "./visits.js";

const params = new URLSearchParams(window.location.search);
const next = safeNextUrl(params.get("next"));
const role = getRole();

if (!role) {
    window.location.replace(`user-option.html?next=${encodeURIComponent(next)}`);
} else if (!isLoginPending()) {
    window.location.replace(next);
}

const isStudent = role === "student";
const form = document.getElementById("credentials-card");
const nameInput = document.getElementById("visitor-name");
const contactInput = document.getElementById("visitor-contact");
const rollInput = document.getElementById("visitor-roll");
nameInput.value = getVisitorName();
contactInput.value = getContact();
rollInput.value = getRollNo();

document.getElementById("contact-field").hidden = isStudent;
document.getElementById("roll-field").hidden = !isStudent;
const nameError = document.getElementById("name-error");
const contactError = document.getElementById("contact-error");
const rollError = document.getElementById("roll-error");

function setError(input, node, message) {
    node.textContent = message;
    node.hidden = !message;
    if (message) {
        input.setAttribute("aria-invalid", "true");
    } else {
        input.removeAttribute("aria-invalid");
    }
}

function finish() {
    setLoginPending(false);
    window.location.href = next;
}

nameInput.addEventListener("input", () => setError(nameInput, nameError, ""));
contactInput.addEventListener("input", () => setError(contactInput, contactError, ""));
rollInput.addEventListener("input", () => setError(rollInput, rollError, ""));

form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameOk = nameInput.value.trim().length > 0;
    setError(nameInput, nameError, nameOk ? "" : "Enter your name.");
    let detailOk;
    if (isStudent) {
        detailOk = isValidRollNo(rollInput.value);
        setError(rollInput, rollError, detailOk ? "" : "Enter a valid roll number (letters and digits only).");
    } else {
        detailOk = isValidContact(contactInput.value);
        setError(contactInput, contactError, detailOk ? "" : "Enter a valid phone number or email address.");
    }
    if (!nameOk) {
        nameInput.focus();
        return;
    }
    if (!detailOk) {
        (isStudent ? rollInput : contactInput).focus();
        return;
    }
    if (isStudent) {
        setRollNo(rollInput.value);
    } else {
        setContact(contactInput.value);
    }
    setVisitorName(nameInput.value);
    finish();
});

const skipButton = document.getElementById("skip-btn");
if (role === "student" || role === "staff") {
    skipButton.textContent = "Skip";
}

skipButton.addEventListener("click", () => {
    setVisitorName("");
    setContact("");
    setRollNo("");
    finish();
});
