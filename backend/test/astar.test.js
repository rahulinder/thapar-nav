const test = require('node:test');
const assert = require('node:assert');

const { buildGraph, nearestNode, findPath, MinHeap } = require('../src/utils/astar');
const { buildSteps } = require('../src/utils/directions');
const { haversine } = require('../src/utils/geo');

const junctions = [
  { _id: 'a', lat: 30.3500, lng: 76.3600 },
  { _id: 'b', lat: 30.3500, lng: 76.3620 },
  { _id: 'c', lat: 30.3520, lng: 76.3620 },
  { _id: 'd', lat: 30.3520, lng: 76.3600 },
  { _id: 'far', lat: 30.3600, lng: 76.3700 },
  { _id: 'island', lat: 30.3700, lng: 76.3800 },
];

const walkways = [
  { from: 'a', to: 'b' },
  { from: 'b', to: 'c' },
  { from: 'a', to: 'd' },
  { from: 'd', to: 'c' },
  { from: 'c', to: 'far' },
];

test('min heap returns items in priority order', () => {
  const heap = new MinHeap();
  [5, 1, 4, 2, 3].forEach((n) => heap.push(String(n), n));
  const out = [];
  while (heap.size) out.push(heap.pop());
  assert.deepStrictEqual(out, ['1', '2', '3', '4', '5']);
});

test('haversine gives roughly 222 m for 0.002 degrees of latitude', () => {
  const d = haversine({ lat: 30.35, lng: 76.36 }, { lat: 30.352, lng: 76.36 });
  assert.ok(d > 215 && d < 230, `got ${d}`);
});

test('finds the shortest path and its length', () => {
  const graph = buildGraph(junctions, walkways);
  const result = findPath(graph, 'a', 'far');
  assert.ok(result);
  assert.strictEqual(result.nodeIds[0], 'a');
  assert.strictEqual(result.nodeIds[result.nodeIds.length - 1], 'far');
  const expected = haversine(junctions[0], junctions[3]) + haversine(junctions[3], junctions[2]) + haversine(junctions[2], junctions[4]);
  assert.ok(Math.abs(result.distance - expected) < 1, `got ${result.distance}, expected about ${expected}`);
});

test('prefers a shorter detour over a longer direct-looking edge', () => {
  const nodes = [
    { _id: 's', lat: 30.0, lng: 76.0 },
    { _id: 'm', lat: 30.0, lng: 76.001 },
    { _id: 'e', lat: 30.0, lng: 76.002 },
  ];
  const edges = [
    { from: 's', to: 'e', distance: 1000 },
    { from: 's', to: 'm' },
    { from: 'm', to: 'e' },
  ];
  const graph = buildGraph(nodes, edges);
  const result = findPath(graph, 's', 'e');
  assert.deepStrictEqual(result.nodeIds, ['s', 'm', 'e']);
});

test('returns null when there is no connection', () => {
  const graph = buildGraph(junctions, walkways);
  assert.strictEqual(findPath(graph, 'a', 'island'), null);
});

test('same start and end gives a zero-length path', () => {
  const graph = buildGraph(junctions, walkways);
  assert.deepStrictEqual(findPath(graph, 'b', 'b'), { nodeIds: ['b'], distance: 0 });
});

test('nearestNode snaps to the closest junction', () => {
  const graph = buildGraph(junctions, walkways);
  const snap = nearestNode(graph, { lat: 30.3521, lng: 76.3621 });
  assert.strictEqual(snap.node.id, 'c');
});

test('directions: straight legs merge, turns are named, arrival is last', () => {
  const points = [
    { lat: 30.3500, lng: 76.3600 },
    { lat: 30.3500, lng: 76.3610 },
    { lat: 30.3500, lng: 76.3620 },
    { lat: 30.3510, lng: 76.3620 },
  ];
  const steps = buildSteps(points, 'Library');
  assert.strictEqual(steps[0].instruction, 'Head east');
  assert.strictEqual(steps[1].instruction, 'Turn left');
  assert.strictEqual(steps[steps.length - 1].instruction, 'Arrive at Library');
  assert.strictEqual(steps.length, 3);
});

test('directions: right turn is detected', () => {
  const points = [
    { lat: 30.3510, lng: 76.3600 },
    { lat: 30.3510, lng: 76.3620 },
    { lat: 30.3500, lng: 76.3620 },
  ];
  const steps = buildSteps(points, 'Hostel');
  assert.strictEqual(steps[1].instruction, 'Turn right');
});
