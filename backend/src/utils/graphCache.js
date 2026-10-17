const Junction = require('../models/Junction');
const Walkway = require('../models/Walkway');
const { buildGraph } = require('./astar');

let cached = null;
let loading = null;

async function loadGraph() {
  const [junctions, walkways] = await Promise.all([Junction.find().lean(), Walkway.find().lean()]);
  return buildGraph(junctions, walkways);
}

async function getGraph() {
  if (cached) return cached;
  if (!loading) {
    loading = loadGraph()
      .then((graph) => {
        cached = graph;
        return graph;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

function invalidateGraph() {
  cached = null;
}

module.exports = { getGraph, invalidateGraph };
