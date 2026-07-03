# BSP Dungeon Generator (+ Three.js, WIP)

Procedural dungeon generator built from scratch in TypeScript. Uses **Binary
Space Partitioning (BSP)** to lay out the map, builds a **room graph** on top
of it (with a few extra loop edges so it isn't a perfect maze), and classifies
rooms (start / boss / treasure) using **BFS** over that graph. Currently
rendered on a 2D `<canvas>`; a Three.js 3D view is in progress.

## How it works

1. **BSP partitioning** — the map rectangle is recursively split (alternating
   horizontal/vertical, with some randomness) until a max depth or minimum
   partition size is reached. Each leaf of the resulting tree is one
   partition of the map.
2. **Room carving** — every leaf gets a randomly sized/positioned room inside
   it, inset by a padding value (padding shrinks automatically for leaves too
   small to fit a room otherwise).
3. **Graph + corridors (spanning tree)** — walking back up the BSP tree, every
   internal node connects the **closest pair** of rooms between its left and
   right subtrees. This guarantees every room is reachable, with exactly
   `rooms - 1` corridors and no cycles yet.
4. **Corridors** — each connection is drawn as an L-shaped corridor: two
   rectangles (one horizontal, one vertical) meeting at a corner between the
   two rooms' centers.
5. **Loop edges** — a handful of extra edges are added between nearby rooms
   that aren't already connected, so the dungeon has alternate routes instead
   of being a single perfect maze.
6. **Room classification (BFS)** — a breadth-first search from a chosen start
   room computes graph distance (in corridor hops, *not* BSP tree depth) to
   every other room:
   - **Start room** — near a map corner.
   - **Boss room** — the room with the largest BFS distance from start.
   - **Treasure room(s)** — dead ends (rooms with exactly one connection)
     that aren't the start or boss.

## Tech stack

- TypeScript + Vite
- Canvas 2D (current renderer)
- Three.js (planned/in-progress 3D renderer)

## Project structure

```
src/
  generator/
    bsp.ts       BSP_Node: tree splitting, leaf discovery, connect(),
                 closestPair(), loop-edge candidates, adjacency lookups,
                 BFS distance + room classification
  main.ts        wires everything together and draws to <canvas>
  style.css
index.html
```

## Run locally

```bash
npm install
npm run dev
```

## Status

- [x] BSP partitioning
- [x] Room carving
- [x] Room graph (spanning tree, closest-pair connections)
- [x] L-shaped corridors
- [x] Loop edges
- [x] BFS room classification (start / boss / treasure)
- [x] 2D canvas rendering + legend
- [ ] Three.js 3D rendering

## License

MIT