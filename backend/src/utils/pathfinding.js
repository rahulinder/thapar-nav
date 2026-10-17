class MinHeap {
    constructor() {
        this.items = [];
    }

    get size() {
        return this.items.length;
    }

    push(node, priority) {
        const items = this.items;
        items.push({ node, priority });
        let index = items.length - 1;
        while (index > 0) {
            const parent = (index - 1) >> 1;
            if (items[parent].priority <= items[index].priority) {
                break;
            }
            [items[parent], items[index]] = [items[index], items[parent]];
            index = parent;
        }
    }

    pop() {
        const items = this.items;
        const top = items[0];
        const last = items.pop();
        if (items.length > 0) {
            items[0] = last;
            let index = 0;
            for (;;) {
                const left = index * 2 + 1;
                const right = left + 1;
                let smallest = index;
                if (left < items.length && items[left].priority < items[smallest].priority) {
                    smallest = left;
                }
                if (right < items.length && items[right].priority < items[smallest].priority) {
                    smallest = right;
                }
                if (smallest === index) {
                    break;
                }
                [items[smallest], items[index]] = [items[index], items[smallest]];
                index = smallest;
            }
        }
        return top.node;
    }
}

function buildGraph(junctions, walkways, { accessibleOnly = false } = {}) {
    const nodes = new Map();
    for (const junction of junctions) {
        nodes.set(String(junction._id), {
            id: String(junction._id),
            lat: junction.lat,
            lng: junction.lng,
            edges: []
        });
    }

    for (const walkway of walkways) {
        if (accessibleOnly && walkway.wheelchairAccessible === false) {
            continue;
        }
        const from = nodes.get(String(walkway.from));
        const to = nodes.get(String(walkway.to));
        if (!from || !to) {
            continue;
        }
        from.edges.push({ to: to.id, distance: walkway.distanceMeters });
        if (walkway.bidirectional !== false) {
            to.edges.push({ to: from.id, distance: walkway.distanceMeters });
        }
    }
    return nodes;
}

function straightLineMeters(a, b) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

function findShortestPath(graph, startId, goalId) {
    const start = graph.get(startId);
    const goal = graph.get(goalId);
    if (!start || !goal) {
        return null;
    }
    if (startId === goalId) {
        return { nodeIds: [startId], distance: 0 };
    }

    const best = new Map([[startId, 0]]);
    const cameFrom = new Map();
    const closed = new Set();
    const open = new MinHeap();
    open.push(startId, straightLineMeters(start, goal));

    while (open.size > 0) {
        const currentId = open.pop();
        if (closed.has(currentId)) {
            continue;
        }
        if (currentId === goalId) {
            const nodeIds = [goalId];
            let step = goalId;
            while (cameFrom.has(step)) {
                step = cameFrom.get(step);
                nodeIds.push(step);
            }
            nodeIds.reverse();
            return { nodeIds, distance: best.get(goalId) };
        }
        closed.add(currentId);

        const current = graph.get(currentId);
        const currentCost = best.get(currentId);
        for (const edge of current.edges) {
            if (closed.has(edge.to)) {
                continue;
            }
            const cost = currentCost + edge.distance;
            if (cost < (best.has(edge.to) ? best.get(edge.to) : Infinity)) {
                best.set(edge.to, cost);
                cameFrom.set(edge.to, currentId);
                open.push(edge.to, cost + straightLineMeters(graph.get(edge.to), goal));
            }
        }
    }
    return null;
}

function nearestNode(graph, point) {
    let best = null;
    let bestDistance = Infinity;
    for (const node of graph.values()) {
        const distance = straightLineMeters(point, node);
        if (distance < bestDistance) {
            best = node;
            bestDistance = distance;
        }
    }
    return best ? { node: best, distance: bestDistance } : null;
}

module.exports = { buildGraph, findShortestPath, nearestNode, MinHeap };
