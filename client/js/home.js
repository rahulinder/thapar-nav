import {
    CAMPUS_CENTER,
    CAMPUS_RADIUS_METERS,
    FOCUS_ZOOM,
    FALLBACK_LOCATION_NAME,
    NEAR_PLACE_METERS,
    OFF_CAMPUS_LOCATION_NAME,
    ROLES
} from "./config.js";
import { byId, clear, el, prefersReducedMotion } from "./dom.js";
import { requireRole, getVisitorName } from "./roles.js";
import { createStatusBar } from "./status-bar.js";
import { createLoader } from "./places-store.js";
import { createSearchBox } from "./search-box.js";
import { createSection, createSkeletonSection, createStateCard } from "./cards.js";
import { initPlacePanel } from "./place-panel.js";
import { createCampusMap } from "./map.js";
import { groupByCategory, orderCategories } from "./categories.js";
import { distanceMeters, nearestPlace } from "./geo.js";
import { startRoute, setRouteHandler, openInGoogleMaps } from "./route.js";
import { fetchRoute } from "./api.js";
import { buildSteps, formatDistance } from "./directions.js";
import { createOffRouteTracker } from "./offroute.js";
import { buildShortcuts } from "./shortcuts.js";

function main() {
    const role = requireRole();
    if (!role) {
        return;
    }

    const sections = byId("sections");
    const locationLabel = byId("current-location");
    const statusBar = createStatusBar(byId("status"));

    let places = [];
    let userPoint = null;
    let deepLinkHandled = false;

    const panel = initPlacePanel({
        dialog: byId("place-panel"),
        onShowOnMap: (place) => {
            map.focusPlace(place);
            byId("home-map").scrollIntoView({
                behavior: prefersReducedMotion() ? "auto" : "smooth",
                block: "start"
            });
        }
    });

    const map = createCampusMap(byId("map"), { onSelect: (place) => panel.open(place) });

    const searchBox = createSearchBox({
        form: byId("search-bar"),
        input: byId("search-input"),
        list: byId("search-suggestions"),
        onSelect: (place) => {
            map.focusPlace(place);
            panel.open(place);
        }
    });

    function renderRoleNote() {
        const name = getVisitorName();
        const note = byId("role-note");
        clear(note);
        note.append(
            el("span", {
                text: `${name ? `Hi ${name}. ` : ""}Showing places for ${ROLES[role].plural}.`
            }),
            el("a", { href: "user-option.html?next=index.html", text: "Change" })
        );
    }

    function updateLocationLabel() {
        if (!userPoint) {
            locationLabel.textContent = FALLBACK_LOCATION_NAME;
            return;
        }
        if (distanceMeters(userPoint, CAMPUS_CENTER) > CAMPUS_RADIUS_METERS) {
            locationLabel.textContent = OFF_CAMPUS_LOCATION_NAME;
            return;
        }
        const nearest = nearestPlace(places, userPoint);
        if (!nearest) {
            locationLabel.textContent = "On campus";
        } else if (nearest.distance <= NEAR_PLACE_METERS) {
            locationLabel.textContent = nearest.place.name;
        } else {
            locationLabel.textContent = `Near ${nearest.place.name}`;
        }
    }

    const routeBanner = byId("route-banner");
    let routeToken = 0;
    const tracker = createOffRouteTracker();

    function clearRoute() {
        routeToken += 1;
        tracker.stop();
        map.clearRoute();
        stepsList.hidden = true;
        planner.hidden = true;
        routeBanner.hidden = true;
        clear(routeBanner);
    }

    function formatDuration(seconds) {
        const minutes = Math.max(1, Math.round(seconds / 60));
        return `${minutes} min walk`;
    }

    function showBanner({ title, meta, tone = "info", buttons = [] }) {
        clear(routeBanner);
        routeBanner.dataset.tone = tone;
        routeBanner.hidden = false;
        routeBanner.append(
            el("div", { class: "route-info" }, [
                el("span", { class: "route-title", text: title }),
                meta ? el("span", { class: "route-meta", text: meta }) : null
            ]),
            el(
                "div",
                { class: "route-buttons" },
                buttons.map((button) => el("button", { type: "button", text: button.label, onclick: button.onClick }))
            )
        );
    }

    const stepsList = byId("route-steps");
    const planner = byId("route-planner");
    const fromInput = byId("planner-from-input");
    const toInput = byId("planner-to-input");
    let currentTo = null;
    let currentFrom = null;
    let currentSteps = [];

    function updatePlanner() {
        fromInput.placeholder = currentFrom ? currentFrom.name : "My location";
        toInput.placeholder = currentTo ? currentTo.name : "Choose a destination";
    }

    function openPlanner() {
        updatePlanner();
        planner.hidden = false;
        toInput.focus();
    }

    function renderSteps() {
        clear(stepsList);
        for (const step of currentSteps) {
            stepsList.append(
                el("li", {}, [
                    step.text,
                    step.meters > 0 ? el("span", { class: "step-distance", text: ` for ${formatDistance(step.meters)}` }) : null
                ])
            );
        }
    }

    function toggleSteps() {
        stepsList.hidden = !stepsList.hidden;
    }

    async function showRoute(place, fromPlace = null, { auto = false } = {}) {
        routeToken += 1;
        const token = routeToken;
        tracker.stop();
        map.clearRoute();
        stepsList.hidden = true;
        clear(stepsList);
        currentTo = place;
        currentFrom = fromPlace;
        updatePlanner();
        if (!auto) {
            byId("home-map").scrollIntoView({
                behavior: prefersReducedMotion() ? "auto" : "smooth",
                block: "start"
            });
        }

        const title = `Route to ${place.name}`;
        const changeButton = { label: "Change", onClick: openPlanner };

        if (fromPlace && fromPlace.id === place.id) {
            showBanner({
                title,
                meta: "Your start and destination are the same place.",
                tone: "error",
                buttons: [changeButton, { label: "Close", onClick: clearRoute }]
            });
            return;
        }

        const params = { toPlace: place.id, role };
        let startNote;
        let usingGps = false;
        if (fromPlace) {
            params.fromPlace = fromPlace.id;
            startNote = `From ${fromPlace.name}`;
        } else if (userPoint && distanceMeters(userPoint, CAMPUS_CENTER) <= CAMPUS_RADIUS_METERS) {
            params.fromLat = userPoint.lat;
            params.fromLng = userPoint.lng;
            startNote = "From your location";
            usingGps = true;
        } else {
            const gate = places.find((item) => item.isEntrance);
            if (!gate) {
                showBanner({
                    title,
                    meta: "We could not find your location yet. Turn on GPS or choose a start place.",
                    tone: "error",
                    buttons: [changeButton, { label: "Close", onClick: clearRoute }]
                });
                return;
            }
            params.fromPlace = gate.id;
            startNote = `From ${gate.name} (your location is not on campus)`;
        }

        showBanner({
            title,
            meta: auto ? "You left the path. Finding a new route..." : "Finding the best walking path...",
            buttons: [{ label: "Cancel", onClick: clearRoute }]
        });

        try {
            const route = await fetchRoute(params);
            if (token !== routeToken) {
                return;
            }
            map.drawRoute(route.coordinates, { fit: !auto });
            if (usingGps) {
                tracker.start(route.coordinates, place);
            }
            currentSteps = buildSteps(route.coordinates, place.name);
            renderSteps();
            showBanner({
                title,
                meta: `${formatDistance(route.distanceMeters)} · ${formatDuration(route.durationSeconds)} · ${startNote}${auto ? " · Re-routed" : ""}`,
                buttons: [
                    { label: "Directions", onClick: toggleSteps },
                    changeButton,
                    { label: "Clear route", onClick: clearRoute }
                ]
            });
        } catch (error) {
            if (token !== routeToken) {
                return;
            }
            showBanner({
                title: `Could not find a route to ${place.name}`,
                meta: error && error.message ? error.message : "Something went wrong.",
                tone: "error",
                buttons: [
                    changeButton,
                    { label: "Open in Google Maps", onClick: () => openInGoogleMaps(place) },
                    { label: "Close", onClick: clearRoute }
                ]
            });
        }
    }

    const fromBox = createSearchBox({
        form: byId("planner-from"),
        input: fromInput,
        list: byId("planner-from-list"),
        onSelect: (place) => {
            currentFrom = place;
            updatePlanner();
            if (currentTo) {
                showRoute(currentTo, place);
            }
        }
    });

    const toBox = createSearchBox({
        form: byId("planner-to"),
        input: toInput,
        list: byId("planner-to-list"),
        onSelect: (place) => showRoute(place, currentFrom)
    });

    byId("planner-from-me").addEventListener("click", () => {
        currentFrom = null;
        updatePlanner();
        if (currentTo) {
            showRoute(currentTo, null);
        }
    });
    byId("planner-close").addEventListener("click", () => {
        planner.hidden = true;
    });
    byId("directions-button").addEventListener("click", openPlanner);

    setRouteHandler(showRoute);

    function showSkeletons() {
        clear(sections);
        sections.append(createSkeletonSection(), createSkeletonSection(), createSkeletonSection());
    }

    function handleDeepLink() {
        if (deepLinkHandled) {
            return;
        }
        deepLinkHandled = true;
        const params = new URLSearchParams(window.location.search);
        const routeId = params.get("route");
        const id = params.get("place");
        if (!id && !routeId) {
            return;
        }
        const place = places.find((item) => item.id === (routeId || id));
        window.history.replaceState(null, "", window.location.pathname);
        if (place && routeId) {
            showRoute(place);
        } else if (place) {
            map.focusPlace(place);
            panel.open(place);
        }
    }

    const shortcutsNav = byId("shortcuts");

    function shortcutOrigin() {
        if (userPoint && distanceMeters(userPoint, CAMPUS_CENTER) <= CAMPUS_RADIUS_METERS) {
            return userPoint;
        }
        return places.find((item) => item.isEntrance) || CAMPUS_CENTER;
    }

    function renderShortcuts() {
        clear(shortcutsNav);
        const items = buildShortcuts(role, places, shortcutOrigin());
        shortcutsNav.hidden = items.length === 0;
        for (const item of items) {
            shortcutsNav.append(
                el("button", {
                    type: "button",
                    title: `Route to ${item.place.name}`,
                    text: item.label,
                    onclick: () => showRoute(item.place)
                })
            );
        }
    }

    function renderPlaces(list) {
        places = list;
        clear(sections);
        map.setPlaces(places);
        searchBox.setPlaces(places);
        fromBox.setPlaces(places);
        toBox.setPlaces(places);
        updateLocationLabel();
        renderShortcuts();

        if (places.length === 0) {
            sections.append(
                createStateCard({
                    title: "No places yet",
                    text: "There are no places to show for you right now. Please check back soon."
                })
            );
            return;
        }

        const groups = groupByCategory(places);
        for (const category of orderCategories([...groups.keys()], role)) {
            sections.append(
                createSection({
                    category,
                    places: groups.get(category),
                    onOpen: (place) => panel.open(place),
                    onRoute: startRoute
                })
            );
        }
        handleDeepLink();
    }

    function renderFailure(error) {
        clear(sections);
        sections.append(
            createStateCard({
                title: "Could not load places",
                text: error && error.message ? error.message : "Something went wrong.",
                actionLabel: "Try again",
                onAction: () => loader.start()
            })
        );
    }

    const loader = createLoader({
        role,
        statusBar,
        onLoading: showSkeletons,
        onPlaces: renderPlaces,
        onFailure: renderFailure
    });

    byId("explore-button").addEventListener("click", () => {
        sections.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    });

    renderRoleNote();
    updateLocationLabel();
    loader.start();

    let stopWatch = null;
    let hasFix = false;
    const locateButton = byId("locate-button");

    function followRoute(point) {
        const state = tracker.check(point);
        if (state === "arrived" && currentTo) {
            const arrivedAt = currentTo;
            tracker.stop();
            map.clearRoute();
            stepsList.hidden = true;
            showBanner({
                title: `You have arrived at ${arrivedAt.name}`,
                tone: "info",
                buttons: [{ label: "Close", onClick: clearRoute }]
            });
        } else if (state === "off-route" && currentTo) {
            tracker.markRerouted();
            showRoute(currentTo, null, { auto: true });
        }
    }

    let shortcutsPoint = null;

    function handleFix(point) {
        userPoint = point;
        if (!shortcutsPoint || distanceMeters(shortcutsPoint, point) > 100) {
            shortcutsPoint = point;
            renderShortcuts();
        }
        updateLocationLabel();
        const onCampus = distanceMeters(point, CAMPUS_CENTER) <= CAMPUS_RADIUS_METERS;
        if (onCampus) {
            map.showUser(point, point.accuracy);
        } else {
            map.hideUser();
        }
        locateButton.classList.add("is-active");
        hasFix = true;
        if (onCampus) {
            followRoute(point);
        }
    }

    function handleLocationError(error) {
        hasFix = false;
        locateButton.classList.remove("is-active");
        if (error.code === 1) {
            statusBar.show("Location is blocked. Allow location access in your browser to see where you are.", {
                tone: "warn"
            });
            stopTracking();
        } else if (error.code === 0) {
            statusBar.show("This browser cannot share your location.", { tone: "warn" });
        } else {
            statusBar.show("Waiting for a GPS signal. Try moving to an open area.", { tone: "info" });
        }
    }

    function startTracking() {
        if (stopWatch) {
            return;
        }
        stopWatch = map.watch(handleFix, handleLocationError);
    }

    function stopTracking() {
        if (stopWatch) {
            stopWatch();
            stopWatch = null;
        }
    }

    locateButton.addEventListener("click", () => {
        if (!stopWatch) {
            startTracking();
        }
        if (hasFix && userPoint && distanceMeters(userPoint, CAMPUS_CENTER) <= CAMPUS_RADIUS_METERS) {
            map.panTo(userPoint, FOCUS_ZOOM);
        } else if (hasFix) {
            statusBar.show("You seem to be away from campus, so your dot is hidden.", { tone: "info" });
        } else {
            statusBar.show("Finding your location...", { tone: "info" });
        }
    });

    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            stopTracking();
        } else {
            startTracking();
        }
    });

    startTracking();
}

main();
