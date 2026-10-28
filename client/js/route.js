let handler = null;

export function setRouteHandler(fn) {
    handler = fn;
}

export function openInGoogleMaps(place, mode = "walking") {
    const destination = `${place.lat},${place.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=${mode === "driving" ? "driving" : "walking"}`;
    window.open(url, "_blank", "noopener");
}

export function startRoute(place) {
    if (handler) {
        handler(place);
        return;
    }
    openInGoogleMaps(place);
}
