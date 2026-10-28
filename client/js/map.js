import { CAMPUS_CENTER, DEFAULT_ZOOM, FOCUS_ZOOM } from "./config.js";
import { categoryColor, categoryLabel } from "./categories.js";
import { el } from "./dom.js";

function stubMap() {
    return {
        available: false,
        setPlaces() {},
        focusPlace() {},
        fitToPlaces() {},
        showUser() {},
        hideUser() {},
        watch: () => () => {},
        panTo() {},
        drawRoute() {},
        clearRoute() {},
        locate: () => Promise.resolve(null),
        invalidate() {},
        toggleSatellite: () => false
    };
}

export function createCampusMap(container, { onSelect }) {
    const L = window.L;
    if (!L) {
        return stubMap();
    }

    const map = L.map(container, {
        zoomControl: false,
        attributionControl: true,
        tap: false
    }).setView([CAMPUS_CENTER.lat, CAMPUS_CENTER.lng], DEFAULT_ZOOM);

    map.attributionControl.setPosition("topright");
    map.attributionControl.setPrefix(false);
    const credit = map.attributionControl.getContainer();
    credit.classList.add("compact");
    let creditTimer = null;
    credit.addEventListener("click", () => {
        const open = credit.classList.toggle("is-open");
        window.clearTimeout(creditTimer);
        if (open) {
            creditTimer = window.setTimeout(() => credit.classList.remove("is-open"), 5000);
        }
    });

    const streetLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap"
    });
    const satelliteLayer = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
        maxZoom: 19,
        maxNativeZoom: 18,
        attribution: "Imagery &copy; Esri"
    }).addTo(map);
    let satelliteOn = true;

    function toggleSatellite() {
        satelliteOn = !satelliteOn;
        if (satelliteOn) {
            streetLayer.remove();
            satelliteLayer.addTo(map);
        } else {
            satelliteLayer.remove();
            streetLayer.addTo(map);
        }
        return satelliteOn;
    }

    const markers = new Map();
    let userMarker = null;
    let accuracyCircle = null;
    let selectedId = null;
    let routeLine = null;
    let onlyIds = null;

    function applyVisibility() {
        for (const { marker, place } of markers.values()) {
            const show = !onlyIds || onlyIds.has(place.id);
            if (show && !map.hasLayer(marker)) {
                marker.addTo(map);
            } else if (!show) {
                marker.remove();
            }
        }
    }

    function pinIcon(place, selected) {
        const pin = el("span", { class: selected ? "map-pin is-selected" : "map-pin" });
        pin.style.setProperty("--pin", categoryColor(place.category));
        const wrapper = document.createElement("div");
        wrapper.append(pin);
        return L.divIcon({
            html: wrapper.innerHTML,
            className: "map-pin-wrapper",
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });
    }

    function setPlaces(places) {
        for (const entry of markers.values()) {
            entry.marker.remove();
        }
        markers.clear();
        for (const place of places) {
            const marker = L.marker([place.lat, place.lng], {
                icon: pinIcon(place, place.id === selectedId),
                title: place.name,
                keyboard: true,
                riseOnHover: true
            });
            marker.bindTooltip(
                el("span", {}, [
                    el("strong", { text: place.name }),
                    el("br"),
                    el("small", { text: categoryLabel(place.category) })
                ]),
                { direction: "top", offset: [0, -12] }
            );
            marker.on("click", () => onSelect(place));
            marker.addTo(map);
            markers.set(place.id, { marker, place });
        }
        applyVisibility();
    }

    function refreshIcons() {
        for (const { marker, place } of markers.values()) {
            marker.setIcon(pinIcon(place, place.id === selectedId));
        }
    }

    function focusPlace(place) {
        selectedId = place.id;
        refreshIcons();
        map.flyTo([place.lat, place.lng], FOCUS_ZOOM, { duration: 0.8 });
    }

    function fitToPlaces(places) {
        if (!places.length) {
            return;
        }
        const bounds = L.latLngBounds(places.map((place) => [place.lat, place.lng]));
        map.fitBounds(bounds, { padding: [24, 24], maxZoom: DEFAULT_ZOOM });
    }

    function showUser(point, accuracy) {
        const latlng = [point.lat, point.lng];
        if (!userMarker) {
            userMarker = L.marker(latlng, {
                icon: L.divIcon({
                    html: '<span class="user-dot"></span>',
                    className: "map-pin-wrapper",
                    iconSize: [22, 22],
                    iconAnchor: [11, 11]
                }),
                keyboard: false,
                interactive: false,
                zIndexOffset: 1000
            }).addTo(map);
        } else {
            userMarker.setLatLng(latlng);
        }
        if (accuracy && accuracy > 0) {
            if (!accuracyCircle) {
                accuracyCircle = L.circle(latlng, {
                    radius: accuracy,
                    interactive: false,
                    weight: 1,
                    color: "#0071e3",
                    fillColor: "#0071e3",
                    fillOpacity: 0.12
                }).addTo(map);
            } else {
                accuracyCircle.setLatLng(latlng);
                accuracyCircle.setRadius(accuracy);
            }
        } else if (accuracyCircle) {
            accuracyCircle.remove();
            accuracyCircle = null;
        }
    }

    function hideUser() {
        if (userMarker) {
            userMarker.remove();
            userMarker = null;
        }
        if (accuracyCircle) {
            accuracyCircle.remove();
            accuracyCircle = null;
        }
    }

    function watch(onUpdate, onError) {
        if (!navigator.geolocation) {
            onError({ code: 0, message: "unsupported" });
            return () => {};
        }
        const id = navigator.geolocation.watchPosition(
            (position) =>
                onUpdate({
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    heading: position.coords.heading
                }),
            (error) => onError({ code: error.code, message: error.message }),
            { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
        );
        return () => navigator.geolocation.clearWatch(id);
    }

    function locate() {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
                () => resolve(null),
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
            );
        });
    }

    function drawRoute(coordinates, { fit = true, only = null, zoomTo = null } = {}) {
        clearRoute();
        const latlngs = coordinates.map((c) => [c.lat, c.lng]);
        routeLine = L.polyline(latlngs, {
            color: "#0071e3",
            weight: 6,
            opacity: 0.85,
            lineJoin: "round",
            interactive: false
        }).addTo(map);
        if (only) {
            onlyIds = new Set(only);
            applyVisibility();
        }
        if (zoomTo) {
            map.setView([zoomTo.lat, zoomTo.lng], FOCUS_ZOOM);
        } else if (fit && latlngs.length > 1) {
            map.fitBounds(routeLine.getBounds(), { padding: [40, 40], maxZoom: FOCUS_ZOOM });
        }
    }

    function clearRoute() {
        if (routeLine) {
            routeLine.remove();
            routeLine = null;
        }
        if (onlyIds) {
            onlyIds = null;
            applyVisibility();
        }
    }

    function invalidate() {
        map.invalidateSize();
    }

    if (typeof ResizeObserver === "function") {
        new ResizeObserver(() => map.invalidateSize()).observe(container);
    }

    return {
        available: true,
        setPlaces(places) {
            setPlaces(places);
        },
        focusPlace,
        fitToPlaces,
        showUser,
        hideUser,
        watch,
        locate,
        invalidate,
        toggleSatellite,
        drawRoute,
        clearRoute,
        panTo(point, zoom = DEFAULT_ZOOM) {
            map.setView([point.lat, point.lng], zoom);
        }
    };
}
