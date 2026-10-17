const EARTH_RADIUS_METERS = 6371000;

function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}

export function distanceMeters(a, b) {
    const dLat = toRadians(b.lat - a.lat);
    const dLng = toRadians(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function nearestPlace(places, point) {
    let best = null;
    let bestDistance = Infinity;
    for (const place of places) {
        const distance = distanceMeters(point, place);
        if (distance < bestDistance) {
            best = place;
            bestDistance = distance;
        }
    }
    return best ? { place: best, distance: bestDistance } : null;
}
