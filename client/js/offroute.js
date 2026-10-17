import { distanceMeters } from "./geo.js";

const METERS_PER_DEGREE = 111320;

export function distanceToRoute(point, coordinates) {
    if (!coordinates || coordinates.length === 0) {
        return Infinity;
    }
    const cosLat = Math.cos((point.lat * Math.PI) / 180);
    const toXY = (p) => ({
        x: (p.lng - point.lng) * METERS_PER_DEGREE * cosLat,
        y: (p.lat - point.lat) * METERS_PER_DEGREE
    });
    let best = Infinity;
    const first = toXY(coordinates[0]);
    best = Math.hypot(first.x, first.y);
    for (let i = 1; i < coordinates.length; i += 1) {
        const a = toXY(coordinates[i - 1]);
        const b = toXY(coordinates[i]);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSquared = dx * dx + dy * dy;
        let t = lengthSquared === 0 ? 0 : -(a.x * dx + a.y * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));
        best = Math.min(best, Math.hypot(a.x + t * dx, a.y + t * dy));
    }
    return best;
}

export function createOffRouteTracker({
    minDistance = 35,
    accuracyFactor = 1.5,
    fixesNeeded = 3,
    cooldownMs = 20000,
    arrivalMeters = 25,
    now = () => Date.now()
} = {}) {
    let coordinates = null;
    let destination = null;
    let strikes = 0;
    let lastRerouteAt = -Infinity;

    return {
        start(routeCoordinates, destinationPoint) {
            coordinates = routeCoordinates;
            destination = destinationPoint;
            strikes = 0;
        },
        stop() {
            coordinates = null;
            destination = null;
            strikes = 0;
        },
        markRerouted() {
            lastRerouteAt = now();
            strikes = 0;
        },
        isActive() {
            return coordinates !== null;
        },
        check(point) {
            if (!coordinates) {
                return "idle";
            }
            if (destination && distanceMeters(point, destination) <= arrivalMeters) {
                return "arrived";
            }
            const accuracy = point.accuracy > 0 ? point.accuracy : 0;
            const limit = Math.max(minDistance, accuracy * accuracyFactor);
            if (distanceToRoute(point, coordinates) <= limit) {
                strikes = 0;
                return "on-route";
            }
            strikes += 1;
            if (strikes >= fixesNeeded && now() - lastRerouteAt >= cooldownMs) {
                return "off-route";
            }
            return "drifting";
        }
    };
}
