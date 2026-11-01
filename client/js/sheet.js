const sheet = document.getElementById("places-sheet");
const grip = document.getElementById("sheet-grip");
const handle = document.getElementById("sheet-handle");

if (sheet && grip && handle) {
    const topBar = () => {
        const bar = document.getElementById("logo-and-search");
        return bar ? bar.getBoundingClientRect().height : 88;
    };
    const snaps = () => {
        const full = Math.max(260, window.innerHeight - topBar() - 8);
        return [Math.min(170, full), Math.min(Math.round(window.innerHeight * 0.52), full), full];
    };
    let current = 1;
    let startY = 0;
    let startH = 0;
    let dragging = false;
    let moved = false;
    let onHandle = false;

    function setHeight(px) {
        sheet.style.setProperty("--sheet-h", px + "px");
    }

    function snapTo(index) {
        current = Math.max(0, Math.min(2, index));
        setHeight(snaps()[current]);
    }

    function nearest(px) {
        const list = snaps();
        let best = 0;
        list.forEach((value, index) => {
            if (Math.abs(value - px) < Math.abs(list[best] - px)) best = index;
        });
        return best;
    }

    grip.addEventListener("pointerdown", (event) => {
        if (event.button !== undefined && event.button !== 0) return;
        dragging = true;
        moved = false;
        onHandle = Boolean(event.target.closest && event.target.closest("#sheet-handle"));
        startY = event.clientY;
        startH = sheet.getBoundingClientRect().height;
        sheet.classList.add("is-dragging");
        grip.setPointerCapture(event.pointerId);
    });

    grip.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        const delta = startY - event.clientY;
        if (Math.abs(delta) > 4) moved = true;
        const list = snaps();
        setHeight(Math.max(list[0], Math.min(list[2], startH + delta)));
    });

    function release(event) {
        if (!dragging) return;
        dragging = false;
        sheet.classList.remove("is-dragging");
        if (grip.hasPointerCapture(event.pointerId)) grip.releasePointerCapture(event.pointerId);
        if (moved) snapTo(nearest(sheet.getBoundingClientRect().height));
        else if (onHandle && event.type === "pointerup") snapTo(current === 2 ? 0 : current + 1);
    }

    grip.addEventListener("pointerup", release);
    grip.addEventListener("pointercancel", release);

    handle.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            snapTo(current === 2 ? 0 : current + 1);
        }
    });

    window.addEventListener("resize", () => snapTo(current));
    snapTo(1);
}
