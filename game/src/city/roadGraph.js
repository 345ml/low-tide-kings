// The road network: intersections (nodes) joined by two-lane streets (edges), with the helpers
// drivers need: lane positions, traffic signals, the nearest intersection and shortest routes.
import { LANE_OFFSET, TILE } from '../core/config.js';
import { hash2 } from '../core/random.js';
import { ISLAND_COLUMNS, ISLAND_ROWS, ROAD_COLUMNS, ROAD_ROWS } from './districts.js';

/** Streets left out of the grid so parks and big blocks break it up: "h|v:tx:ty" of the edge's first node. */
const REMOVED_EDGES = new Set(['v:86:14', 'h:14:110', 'h:122:46', 'v:32:126']);
const BRIDGE_ROW = 78;
const SIGNAL_PERIOD = 15;

export const SIGNAL_GREEN = 0;
export const SIGNAL_YELLOW = 1;
export const SIGNAL_RED = 2;

export function buildRoadGraph() {
  const nodes = [];
  const edges = [];
  const byTile = new Map();

  function addNode(tx, ty) {
    const node = { id: nodes.length, tx, ty, x: tx * TILE, y: ty * TILE, links: [], signal: false, phase: hash2(tx, ty) * SIGNAL_PERIOD };
    nodes.push(node);
    byTile.set(`${tx},${ty}`, node);
  }

  function link(ax, ay, bx, by, horizontal, bridge) {
    const a = byTile.get(`${ax},${ay}`);
    const b = byTile.get(`${bx},${by}`);
    if (!a || !b || REMOVED_EDGES.has(`${horizontal ? 'h' : 'v'}:${ax}:${ay}`)) return;
    const edge = { id: edges.length, a: a.id, b: b.id, horizontal, bridge };
    edges.push(edge);
    a.links.push({ node: b.id, edge: edge.id });
    b.links.push({ node: a.id, edge: edge.id });
  }

  function grid(columns, rows) {
    for (const ty of rows) for (const tx of columns) addNode(tx, ty);
    for (const ty of rows) for (let i = 0; i + 1 < columns.length; i += 1) link(columns[i], ty, columns[i + 1], ty, true, false);
    for (const tx of columns) for (let j = 0; j + 1 < rows.length; j += 1) link(tx, rows[j], tx, rows[j + 1], false, false);
  }

  grid(ROAD_COLUMNS, ROAD_ROWS);
  grid(ISLAND_COLUMNS, ISLAND_ROWS);
  link(ROAD_COLUMNS[ROAD_COLUMNS.length - 1], BRIDGE_ROW, ISLAND_COLUMNS[0], BRIDGE_ROW, true, true);
  for (const node of nodes) node.signal = node.links.length >= 3;
  return { nodes, edges };
}

/** Unit direction of travel from node `from` to node `to`. */
export function travelDirection(graph, from, to) {
  const a = graph.nodes[from];
  const b = graph.nodes[to];
  const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { dx: (b.x - a.x) / length, dy: (b.y - a.y) / length, length };
}

/** A point in the right-hand lane of the street from `from` to `to`, `along` units past `from`. */
export function lanePoint(graph, from, to, along) {
  const a = graph.nodes[from];
  const d = travelDirection(graph, from, to);
  return { x: a.x + d.dx * along - d.dy * LANE_OFFSET, y: a.y + d.dy * along + d.dx * LANE_OFFSET };
}

/** The signal a driver arriving at `node` along a horizontal or vertical street sees. */
export function signalState(node, clock, horizontal) {
  if (!node.signal) return SIGNAL_GREEN;
  const t = (clock + node.phase) % SIGNAL_PERIOD;
  const own = horizontal ? (t + SIGNAL_PERIOD / 2) % SIGNAL_PERIOD : t;
  if (own < 6) return SIGNAL_GREEN;
  if (own < 7.5) return SIGNAL_YELLOW;
  return SIGNAL_RED;
}

export function nearestNode(graph, x, y) {
  let best = graph.nodes[0];
  let bestDistance = Infinity;
  for (const node of graph.nodes) {
    const d = (node.x - x) * (node.x - x) + (node.y - y) * (node.y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = node;
    }
  }
  return best;
}

/** The shortest chain of node ids from `from` to `to` (both included), by breadth-first search. */
export function findRoute(graph, from, to) {
  if (from === to) return [from];
  const previous = new Int16Array(graph.nodes.length).fill(-1);
  const queue = [from];
  previous[from] = from;
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const { node } of graph.nodes[current].links) {
      if (previous[node] !== -1) continue;
      previous[node] = current;
      if (node === to) {
        const route = [to];
        let step = to;
        while (step !== from) {
          step = previous[step];
          route.push(step);
        }
        return route.reverse();
      }
      queue.push(node);
    }
  }
  return [from];
}

/** A random spot in a random lane: where it is, which way it faces and the street it is on. */
export function randomLaneSpot(graph, random) {
  const edge = graph.edges[Math.floor(random() * graph.edges.length)];
  const forward = random() < 0.5;
  const from = forward ? edge.a : edge.b;
  const to = forward ? edge.b : edge.a;
  const d = travelDirection(graph, from, to);
  const along = 110 + random() * Math.max(1, d.length - 220);
  const point = lanePoint(graph, from, to, along);
  return { x: point.x, y: point.y, angle: Math.atan2(d.dy, d.dx), from, to };
}
