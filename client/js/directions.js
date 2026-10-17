import { distanceMeters } from "./geo.js";

const COMPASS = [
    "north",
    "north-east",
    "east",
    "south-east",
    "south",
    "south-west",
    "west",
    "north-west"
];

function bearing(a, b) {
    const toRad = (d) => (d * Math.PI) / 180;
    const dLng = toRad(b.lng - a.lng);
    const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
    const x =
        Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
        Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function compassName(angle) {
    return COMPASS[Math.round(angle / 45) % 8];
}

function turnText(delta) {
    const size = Math.abs(delta);
    const side = delta > 0 ? "right" : "left";
    if (size < 60) {
        return `Bear slightly ${side}`;
    }
    if (size < 135) {
        return `Turn ${side}`;
    }
    return `Make a sharp ${side}`;
}

export function formatDistance(meters) {
    return meters >= 1000 ? `${(meters / 1000).toFixed(1)} km` : `${Math.round(meters / 5) * 5 || 5} m`;
}

export function buildSteps(coordinates, destinationName) {
    const points = [];
    for (const point of coordinates) {
        const last = points[points.length - 1];
        if (!last || distanceMeters(last, point) >= 2) {
            points.push(point);
        }
    }
    if (points.length < 2) {
        return [{ text: `You are already at ${destinationName}`, meters: 0 }];
    }

    const legs = [];
    for (let i = 1; i < points.length; i += 1) {
        legs.push({
            angle: bearing(points[i - 1], points[i]),
            meters: distanceMeters(points[i - 1], points[i])
        });
    }

    const steps = [{ text: `Head ${compassName(legs[0].angle)}`, meters: legs[0].meters }];
    for (let i = 1; i < legs.length; i += 1) {
        let delta = legs[i].angle - legs[i - 1].angle;
        if (delta > 180) {
            delta -= 360;
        }
        if (delta < -180) {
            delta += 360;
        }
        if (Math.abs(delta) < 25) {
            steps[steps.length - 1].meters += legs[i].meters;
        } else {
            steps.push({ text: turnText(delta), meters: legs[i].meters });
        }
    }
    steps.push({ text: `Arrive at ${destinationName}`, meters: 0 });
    return steps;
}
