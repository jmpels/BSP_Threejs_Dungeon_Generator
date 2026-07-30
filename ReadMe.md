# BSP Dungeon Generator (2D + Three.js)

Procedural dungeon generator built from scratch in TypeScript. Uses **Binary
Space Partitioning (BSP)** to lay out the map, builds a **room graph** on top
of it (with a few extra loop edges so it isn't a perfect maze), classifies
rooms (start / boss / treasure) using **BFS** over that graph, and renders
the result two ways side by side: a 2D top-down canvas view, and a live
**Three.js** 3D scene built from the same data.

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
   `rooms - 1` corridors and no cycles yet. Each connection is drawn as an
   L-shaped corridor (two rectangles meeting at a corner).
4. **Loop edges** — a handful of extra edges are added between nearby rooms
   that aren't already connected, so the dungeon has alternate routes instead
   of being a single perfect maze.
5. **Room classification (BFS)** — a breadth-first search from a chosen start
   room computes graph distance (in corridor hops, *not* BSP tree depth) to
   every other room:
   - **Start room** — near a map corner.
   - **Boss room** — the room with the largest BFS distance from start.
   - **Treasure room(s)** — dead ends (rooms with exactly one connection)
     that aren't the start or boss.
6. **3D rendering** — the 2D room/corridor rectangles are rasterized into a
   coarser grid (`CELL_SIZE` world-units per cell), tagged as room floor,
   corridor floor, or empty. Walls are placed wherever a walkable cell
   borders a non-walkable neighbor. Floors and walls are drawn with
   `THREE.InstancedMesh` (one draw call per type, regardless of dungeon
   size), and start/boss/treasure rooms get a distinct marker mesh at their
   center. Coordinate mapping: dungeon `x → world x`, dungeon `y → world z`,
   `world y` reserved for height.

## Tech stack

- TypeScript + Vite
- Canvas 2D (top-down layout + room graph overlay)
- Three.js + OrbitControls (3D scene)

## Project structure

```
src/
  generator/
    bsp.ts       BSP_Node: tree splitting, leaf discovery, connect(),
                 closestPair(), loop-edge candidates, adjacency lookups,
                 BFS distance + room classification
  main.ts        pipeline orchestration (generate + draw), grid
                 rasterization, wall-edge detection, Three.js scene setup
                 and rendering
  style.css
index.html
```

## Controls

- **New Dungeon** — regenerates the whole dungeon (BSP → rooms → corridors →
  loop edges → BFS classification) and redraws both views.
- **Toggle 3D View** — shows/hides the 3D panel without shifting the 2D
  panel's position (uses `visibility`, not `display`, so layout space stays
  reserved).
- **Legend** (top-right of the 2D panel) — color key for start / normal /
  treasure / boss rooms, shared between both views.

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
- [x] Three.js 3D rendering (instanced floors, walls, room markers)
- [x] Regenerate + toggle-3D UI controls
- [ ] Seeded RNG (reproducible/shareable layouts)
- [ ] Door gaps / finer corridor-to-room wall transitions

## License

MIT