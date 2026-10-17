const { haversine } = require('./geo');

class MinHeap {
  constructor() {
    this.items = [];
  }

  get size() {
    return this.items.length;
  }

  push(node, priority) {
    this.items.push({ node, priority });
    let i = this.items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.items[parent].priority <= this.items[i].priority) break;
      [this.items[parent], this.items[i]] = [this.items[i], this.items[parent]];
      i = parent;
    }
  }

  pop() {
    const top = this.items[0];
    const last = this.items.pop();
    if (this.items.length > 0) {
      this.items[0] = last;
      let i = 0;
      const n = this.items.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < n && this.items[left].priority < this.items[smallest].priority) smallest = left;
        if (right < n && this.items[right].priority < this.items[smallest].priority) smallest = right;
        if (smallest === i) break;
        [this.items[smallest], this.items[i]] = [this.items[i], this.items[smallest]];
        i = smallest;
      }
    }
    return top.node;
  }
}

function buildGraph(junctions, walkways) {
  const nodes = new Map();
  for (const j of junctions) {
    const id = String(j._id || j.id);
    nodes.set(id, { id, lat: j.lat, lng: j.lng, label: j.label || '', edges: [] });
  }
  for (const w of walkways) {
    const from = nodes.get(String(w.from));
    const to = nodes.get(String(w.to));
    if (!from || !to) continue;
    const distance = typeof w.distance === 'number' && w.distance > 0 ? w.distance : haversine(from, to);
    from.edges.push({ to: to.id, distance, name: w.name || '' });
    to.edges.push({ to: from.id, distance, name: w.name || '' });
  }
  return nodes;
}

function nearestNode(graph, point) {
  let best = null;
  let bestDistance = Infinity;
  for (const node of graph.values()) {
    const d = haversine(node, point);
    if (d < bestDistance) {
      bestDistance = d;
      best = node;
    }
  }
  return best ? { node: best, distance: bestDistance } : null;
}

function findPath(graph, startId, endId) {
  const start = graph.get(startId);
  const end = graph.get(endId);
  if (!start || !end) return null;
  if (startId === endId) return { nodeIds: [startId], distance: 0 };

  const open = new MinHeap();
  const cameFrom = new Map();
  const gScore = new Map([[startId, 0]]);
  const closed = new Set();
  open.push(startId, haversine(start, end));

  while (open.size > 0) {
    const currentId = open.pop();
    if (closed.has(currentId)) continue;
    if (currentId === endId) {
      const nodeIds = [currentId];
      let cursor = currentId;
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor);
        nodeIds.push(cursor);
      }
      nodeIds.reverse();
      return { nodeIds, distance: gScore.get(endId) };
    }
    closed.add(currentId);
    const current = graph.get(currentId);
    for (const edge of current.edges) {
      if (closed.has(edge.to)) continue;
      const tentative = gScore.get(currentId) + edge.distance;
      if (tentative < (gScore.get(edge.to) ?? Infinity)) {
        cameFrom.set(edge.to, currentId);
        gScore.set(edge.to, tentative);
        open.push(edge.to, tentative + haversine(graph.get(edge.to), end));
      }
    }
  }
  return null;
}

module.exports = { buildGraph, nearestNode, findPath, MinHeap };
