const MAX_SIDE = 1280;
const MAX_BYTES = 400 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

function loadImage(file) {
    if (typeof createImageBitmap === "function") {
        return createImageBitmap(file).catch(() => loadWithElement(file));
    }
    return loadWithElement(file);
}

function loadWithElement(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("bad image"));
        };
        image.src = url;
    });
}

function toBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function preparePhoto(file) {
    if (!file || !TYPES.includes(file.type)) {
        throw new Error("Choose a JPEG, PNG or WebP photo.");
    }
    let image;
    try {
        image = await loadImage(file);
    } catch (error) {
        throw new Error("That photo could not be opened. Try another one.");
    }
    const width = image.width || image.naturalWidth;
    const height = image.height || image.naturalHeight;
    if (!width || !height) {
        throw new Error("That photo could not be opened. Try another one.");
    }
    let scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const context = canvas.getContext("2d");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        for (const quality of [0.85, 0.75, 0.65, 0.55]) {
            const blob = await toBlob(canvas, quality);
            if (blob && blob.size <= MAX_BYTES) {
                if (typeof image.close === "function") image.close();
                return blob;
            }
        }
        scale *= 0.8;
    }
    throw new Error("That photo is too large to shrink. Try a smaller one.");
}
