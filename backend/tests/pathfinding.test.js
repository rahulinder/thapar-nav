const test = require("node:test");
const assert = require("node:assert/strict");
const { buildGraph, findShortestPath, nearestNode, MinHeap } = require("../src/utils/pathfinding");

const J = (id, lat, lng) => ({ _id: id, lat, lng });
const W = (from, to, distanceMeters, extra = {}) => ({ from, to, distanceMeters, ...extra });

const junctions = [
    J("a", 30.3547, 76.3621),
    J("b", 30.3557, 76.3621),
    J("c", 30.3547, 76.3631),
    J("d", 30.3557, 76.3631),
    J("lonely", 30.36, 76.37)
];

test("heap pops items in priority order", () => {
    const heap = new MinHeap();
    [5, 1, 4, 2, 3, 0, 9].forEach((n) => heap.push(n, n));
    const out = [];
    while (heap.size) {
        out.push(heap.pop());
    }
    assert.deepEqual(out, [0, 1, 2, 3, 4, 5, 9]);
});

test("finds the shortest of two routes", () => {
    const graph = buildGraph(junctions, [W("a", "b", 100), W("b", "d", 100), W("a", "c", 100), W("c", "d", 300)]);
    const result = findShortestPath(graph, "a", "d");
    assert.deepEqual(result.nodeIds, ["a", "b", "d"]);
    assert.equal(result.distance, 200);
});

test("walkways are two-way unless marked one-way", () => {
    const twoWay = buildGraph(junctions, [W("a", "b", 100)]);
    assert.ok(findShortestPath(twoWay, "b", "a"));
    const oneWay = buildGraph(junctions, [W("a", "b", 100, { bidirectional: false })]);
    assert.ok(findShortestPath(oneWay, "a", "b"));
    assert.equal(findShortestPath(oneWay, "b", "a"), null);
});

test("returns null when no path exists and handles same start and goal", () => {
    const graph = buildGraph(junctions, [W("a", "b", 100)]);
    assert.equal(findShortestPath(graph, "a", "lonely"), null);
    assert.deepEqual(findShortestPath(graph, "a", "a"), { nodeIds: ["a"], distance: 0 });
    assert.equal(findShortestPath(graph, "a", "missing"), null);
});

test("accessible-only graphs skip inaccessible walkways", () => {
    const walkways = [W("a", "b", 100, { wheelchairAccessible: false }), W("a", "c", 100), W("c", "b", 100)];
    const normal = findShortestPath(buildGraph(junctions, walkways), "a", "b");
    assert.deepEqual(normal.nodeIds, ["a", "b"]);
    const accessible = findShortestPath(buildGraph(junctions, walkways, { accessibleOnly: true }), "a", "b");
    assert.deepEqual(accessible.nodeIds, ["a", "c", "b"]);
});

test("nearestNode picks the closest junction", () => {
    const graph = buildGraph(junctions, []);
    const hit = nearestNode(graph, { lat: 30.3556, lng: 76.3622 });
    assert.equal(hit.node.id, "b");
    assert.ok(hit.distance < 30);
});
