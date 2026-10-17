const { Junction, Walkway, Place } = require("../models");
const { HttpError } = require("../utils/httpError");
const { buildGraph, findShortestPath, nearestNode } = require("../utils/pathfinding");

const WALKING_SPEED_METERS_PER_SECOND = 1.3;
const MAX_SNAP_METERS = 400;

let cache = { normal: null, accessible: null };

function invalidateGraph() {
    cache = { normal: null, accessible: null };
}

async function getGraph(accessibleOnly) {
    const key = accessibleOnly ? "accessible" : "normal";
    if (!cache[key]) {
        const [junctions, walkways] = await Promise.all([
            Junction.find().lean(),
            Walkway.find().lean()
        ]);
        cache[key] = buildGraph(junctions, walkways, { accessibleOnly });
    }
    return cache[key];
}

async function resolveEndpoint({ placeId, lat, lng, role, label }) {
    if (placeId) {
        const filter = { _id: placeId, isActive: true };
        if (role) {
            filter.visibleTo = role;
        }
        const place = await Place.findOne(filter).lean();
        if (!place) {
            throw new HttpError(404, label + " place was not found.");
        }
        return {
            point: { lat: place.lat, lng: place.lng },
            junctionId: place.junction ? String(place.junction) : null,
            info: { type: "place", id: String(place._id), name: place.name, lat: place.lat, lng: place.lng }
        };
    }
    return {
        point: { lat, lng },
        junctionId: null,
        info: { type: "point", lat, lng }
    };
}

function snapToGraph(graph, endpoint, label) {
    if (endpoint.junctionId && graph.has(endpoint.junctionId)) {
        const node = graph.get(endpoint.junctionId);
        return { node, gap: 0 };
    }
    const nearest = nearestNode(graph, endpoint.point);
    if (!nearest || nearest.distance > MAX_SNAP_METERS) {
        throw new HttpError(
            422,
            label + " is too far from the campus footpaths (more than " + MAX_SNAP_METERS + " metres)."
        );
    }
    return { node: nearest.node, gap: nearest.distance };
}

function round(value, digits = 1) {
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
}

async function findRoute({ from, to, role, accessible }) {
    const graph = await getGraph(accessible);
    if (graph.size === 0) {
        throw new HttpError(503, "The footpath network has not been set up yet.");
    }

    const start = await resolveEndpoint({ ...from, role, label: "The starting" });
    const end = await resolveEndpoint({ ...to, role, label: "The destination" });

    const startSnap = snapToGraph(graph, start, "The starting point");
    const endSnap = snapToGraph(graph, end, "The destination");

    const result = findShortestPath(graph, startSnap.node.id, endSnap.node.id);
    if (!result) {
        throw new HttpError(404, "No walking path connects these two points.");
    }

    const coordinates = [{ lat: start.point.lat, lng: start.point.lng }];
    for (const nodeId of result.nodeIds) {
        const node = graph.get(nodeId);
        coordinates.push({ lat: node.lat, lng: node.lng });
    }
    coordinates.push({ lat: end.point.lat, lng: end.point.lng });

    const distanceMeters = startSnap.gap + result.distance + endSnap.gap;
    return {
        distanceMeters: round(distanceMeters),
        durationSeconds: Math.max(1, Math.round(distanceMeters / WALKING_SPEED_METERS_PER_SECOND)),
        accessible: Boolean(accessible),
        from: start.info,
        to: end.info,
        coordinates: coordinates.map((c) => ({ lat: round(c.lat, 6), lng: round(c.lng, 6) }))
    };
}

module.exports = { findRoute, invalidateGraph, WALKING_SPEED_METERS_PER_SECOND, MAX_SNAP_METERS };
