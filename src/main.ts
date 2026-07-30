import "./style.css";
import { BSP_Node, Corridor, Room } from "../../vite-project/generator/bsp"; // adjust path if your project structure differs
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as THREE from "three";

// =====================================================================
// DOM references
// =====================================================================

const canvas = document.querySelector<HTMLCanvasElement>("#canvas")!;
const ctx = canvas.getContext("2d")!;

const container = document.querySelector<HTMLDivElement>("#viewport-3d")!;
const panel3D = document.querySelector<HTMLDivElement>("#panel-3d")!;
const toggle3DBtn = document.querySelector<HTMLButtonElement>("#toggle-graph-btn")!;
const regenerateBtn = document.querySelector<HTMLButtonElement>("#regenerate-btn")!;

// =====================================================================
// Grid / rasterization constants + helpers
// (pure data transforms — no Three.js, no canvas — reused every regenerate)
// =====================================================================

const CELL_EMPTY = 0;
const CELL_ROOM = 1;
const CELL_CORRIDOR = 2;

const CELL_SIZE = 8; // world units per grid cell
const MAP_WIDTH = 800; // matches canvas width — the dungeon's native coordinate space
const MAP_HEIGHT = 600;

const gridWidth = Math.ceil(MAP_WIDTH / CELL_SIZE);
const gridHeight = Math.ceil(MAP_HEIGHT / CELL_SIZE);

function scaleRect(
  rect: { x: number; y: number; w: number; h: number },
  cellSize: number,
): { x: number; y: number; w: number; h: number } {
  return {
    x: rect.x / cellSize,
    y: rect.y / cellSize,
    w: rect.w / cellSize,
    h: rect.h / cellSize,
  };
}

function stampRectType(
  grid: Uint8Array,
  gridW: number,
  gridH: number,
  rect: { x: number; y: number; w: number; h: number },
  cellType: number,
): void {
  let x0 = Math.max(0, Math.floor(rect.x));
  let y0 = Math.max(0, Math.floor(rect.y));
  let x1 = Math.min(gridW, Math.ceil(rect.x + rect.w));
  let y1 = Math.min(gridH, Math.ceil(rect.y + rect.h));

  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      grid[y * gridW + x] = cellType;
    }
  }
}

function isWalkable(
  grid: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  return grid[y * width + x] !== CELL_EMPTY;
}

function findWallEdges(
  grid: Uint8Array,
  width: number,
  height: number,
): { x: number; y: number; side: string }[] {
  let walls: { x: number; y: number; side: string }[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!isWalkable(grid, width, height, x, y)) continue;

      if (!isWalkable(grid, width, height, x, y - 1))
        walls.push({ x, y, side: "north" });
      if (!isWalkable(grid, width, height, x, y + 1))
        walls.push({ x, y, side: "south" });
      if (!isWalkable(grid, width, height, x - 1, y))
        walls.push({ x, y, side: "west" });
      if (!isWalkable(grid, width, height, x + 1, y))
        walls.push({ x, y, side: "east" });
    }
  }
  return walls;
}

// =====================================================================
// Three.js scene setup (runs once — never recreated on regenerate)
// =====================================================================

const WALL_HEIGHT = 1.4;
const WALL_THICKNESS = 0.1;
const FLOOR_THICKNESS = 0.15;

// Fixed: previously room/corridor floors were both dark, near-identical
// slate tones (0x475569 vs 0x334155) — nearly invisible under lighting.
// Using a clearly different hue (warm stone vs cool slate) instead of
// just a lightness tweak, so the distinction reads even with shadows.
const ROOM_FLOOR_COLOR = 0x8a7a5c; // warm stone — rooms
const CORRIDOR_FLOOR_COLOR = 0x334155; // cool slate — corridors

const ROOM_TYPE_COLORS: Record<string, number | null> = {
  "Starting room": 0x60a5fa,
  "Boss room": 0xf87171,
  "Treasure room": 0xfbbf24,
  "Normal room": null,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f172a);

const camera = new THREE.PerspectiveCamera(
  55,
  container.clientWidth / container.clientHeight,
  0.1,
  2000,
);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
container.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const ambient = new THREE.AmbientLight(0x8899cc, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff2d9, 1.1);
sun.position.set(200, 300, 100);
sun.castShadow = true;
scene.add(sun);

const dungeonGroup = new THREE.Group();
scene.add(dungeonGroup);

window.addEventListener("resize", () => {
  const w = container.clientWidth;
  const h = container.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
});

// ---- Toggle 3D view (fade handled by CSS via the "hidden" class) ----
let show3d = true;

toggle3DBtn.addEventListener("click", () => {
  show3d = !show3d;
  panel3D.classList.toggle("hidden", !show3d);
});

// ---- Render loop ----
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  if (show3d) {
    renderer.render(scene, camera);
  }
}
animate();

// =====================================================================
// Three.js dungeon construction (rebuilt every regenerate)
// =====================================================================

function clearDungeonGroup(): void {
  for (const child of [...dungeonGroup.children]) {
    dungeonGroup.remove(child);
    if (child instanceof THREE.InstancedMesh || child instanceof THREE.Mesh) {
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    }
  }
}

function buildFloorInstances(
  cells: { x: number; y: number }[],
  color: number,
): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(1, FLOOR_THICKNESS, 1);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
  const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
  mesh.receiveShadow = true;

  const m = new THREE.Matrix4();
  cells.forEach((cell, i) => {
    m.makeTranslation(cell.x + 0.5, -FLOOR_THICKNESS / 2, cell.y + 0.5);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function renderDungeon3D(
  grid: Uint8Array,
  gridW: number,
  gridH: number,
  wallEdges: { x: number; y: number; side: string }[],
  allRooms: Room[],
): void {
  clearDungeonGroup();

  // ---- floors: split by cell type, one InstancedMesh per type ----
  const roomCells: { x: number; y: number }[] = [];
  const corridorCells: { x: number; y: number }[] = [];

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const cellType = grid[y * gridW + x];
      if (cellType === CELL_ROOM) roomCells.push({ x, y });
      else if (cellType === CELL_CORRIDOR) corridorCells.push({ x, y });
    }
  }

  dungeonGroup.add(buildFloorInstances(roomCells, ROOM_FLOOR_COLOR));
  dungeonGroup.add(buildFloorInstances(corridorCells, CORRIDOR_FLOOR_COLOR));

  // ---- walls: one instance per wall edge ----
  const wallGeo = new THREE.BoxGeometry(1, WALL_HEIGHT, WALL_THICKNESS);
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
  const wallMesh = new THREE.InstancedMesh(wallGeo, wallMat, wallEdges.length);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;

  const wallMatrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const scale1 = new THREE.Vector3(1, 1, 1);

  wallEdges.forEach((wall, i) => {
    let worldX: number, worldZ: number, rotY: number;

    switch (wall.side) {
      case "north":
        worldX = wall.x + 0.5;
        worldZ = wall.y;
        rotY = 0;
        break;
      case "south":
        worldX = wall.x + 0.5;
        worldZ = wall.y + 1;
        rotY = 0;
        break;
      case "west":
        worldX = wall.x;
        worldZ = wall.y + 0.5;
        rotY = Math.PI / 2;
        break;
      case "east":
      default:
        worldX = wall.x + 1;
        worldZ = wall.y + 0.5;
        rotY = Math.PI / 2;
        break;
    }

    quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY);
    wallMatrix.compose(new THREE.Vector3(worldX, WALL_HEIGHT / 2, worldZ), quat, scale1);
    wallMesh.setMatrixAt(i, wallMatrix);
  });
  wallMesh.instanceMatrix.needsUpdate = true;
  dungeonGroup.add(wallMesh);

  // ---- markers: start / boss / treasure ----
  for (const room of allRooms) {
    const color = ROOM_TYPE_COLORS[room.type];
    if (color === null || color === undefined) continue;

    const geo =
      room.type === "Starting room"
        ? new THREE.ConeGeometry(0.6, 1.2, 16)
        : room.type === "Boss room"
        ? new THREE.OctahedronGeometry(0.7)
        : new THREE.TetrahedronGeometry(0.55);

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.35,
    });

    const marker = new THREE.Mesh(geo, mat);
    const centerX = room.x / CELL_SIZE + room.w / CELL_SIZE / 2;
    const centerZ = room.y / CELL_SIZE + room.h / CELL_SIZE / 2; // dungeon y -> world z
    marker.position.set(centerX, 1.2, centerZ);
    marker.castShadow = true;
    dungeonGroup.add(marker);
  }

  // ---- camera framing (top-down) ----
  const target = new THREE.Vector3(gridW / 2, 0, gridH / 2);
  controls.target.copy(target);
  const radius = Math.max(gridW, gridH);
  camera.position.set(target.x, radius * 0.8, target.z);
  camera.up.set(0, 0, -1);
  controls.update();
}

// =====================================================================
// Full pipeline: BSP -> rooms -> corridors -> loops -> BFS -> 2D + 3D draw
// =====================================================================

function generateAndRenderDungeon(): void {
  // ---- 2D setup ----
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  // ---- BSP + rooms ----
  let rootNode = new BSP_Node(0, 0, canvas.width, canvas.height);
  rootNode.split(rootNode);
  let leafNodes = rootNode.getLeafNodes(rootNode);

  let padding = 10;
  for (let leaf of leafNodes) {
    leaf.room = new Room(0, 0, 0, 0).carveRoom(leaf, padding);
  }

  for (let leaf of leafNodes) {
    ctx.strokeStyle = "lime";
    ctx.lineWidth = 2;
    ctx.strokeRect(leaf.rect.x, leaf.rect.y, leaf.rect.w, leaf.rect.h);

    ctx.strokeStyle = "grey";
    ctx.lineWidth = 2;
    ctx.strokeRect(leaf.room!.x, leaf.room!.y, leaf.room!.w, leaf.room!.h);
  }

  // ---- graph + corridors (spanning tree) ----
  let allRooms = rootNode.connect(rootNode);
  let corridors = rootNode.corridors;

  ctx.fillStyle = "red";
  ctx.lineWidth = 2;
  for (let corridor of corridors) {
    ctx.fillRect(corridor.rectX.x, corridor.rectX.y, corridor.rectX.w, corridor.rectX.h);
    ctx.fillRect(corridor.rectY.x, corridor.rectY.y, corridor.rectY.w, corridor.rectY.h);
  }

  // ---- loop edges ----
  let loopCount = Math.floor(Math.random() * 5) + 1;
  let loopCandidates = rootNode.findLoopCandidates(allRooms, corridors);
  for (let i = 0; i < loopCount && loopCandidates.length > 0; i++) {
    let randomIndex = Math.floor(Math.random() * loopCandidates.length);
    let [roomA, roomB] = loopCandidates[randomIndex];
    let corridor = new Corridor(roomA, roomB);
    corridors.push(corridor);

    ctx.fillStyle = "blue";
    ctx.fillRect(corridor.rectX.x, corridor.rectX.y, corridor.rectX.w, corridor.rectX.h);
    ctx.fillRect(corridor.rectY.x, corridor.rectY.y, corridor.rectY.w, corridor.rectY.h);

    loopCandidates.splice(randomIndex, 1);
  }

  // ---- BFS classification ----
  rootNode.bfsDistanceAndRoomTypeAtribution(allRooms[0], corridors);

  for (let room of allRooms) {
    ctx.fillStyle =
      room.type === "Treasure room"
        ? "yellow"
        : room.type === "Boss room"
        ? "red"
        : room.type === "Starting room"
        ? "blue"
        : "green";
    ctx.fillRect(room.x, room.y, room.w, room.h);
  }

  // ---- 3D: rasterize + walls + render ----
  const grid = new Uint8Array(gridWidth * gridHeight);

  for (const room of allRooms) {
    stampRectType(grid, gridWidth, gridHeight, scaleRect(room, CELL_SIZE), CELL_ROOM);
  }
  for (const corridor of corridors) {
    stampRectType(grid, gridWidth, gridHeight, scaleRect(corridor.rectX, CELL_SIZE), CELL_CORRIDOR);
    stampRectType(grid, gridWidth, gridHeight, scaleRect(corridor.rectY, CELL_SIZE), CELL_CORRIDOR);
  }

  const wallEdges = findWallEdges(grid, gridWidth, gridHeight);
  renderDungeon3D(grid, gridWidth, gridHeight, wallEdges, allRooms);
}

// =====================================================================
// Boot + button wiring
// =====================================================================

generateAndRenderDungeon();

regenerateBtn.addEventListener("click", () => {
  generateAndRenderDungeon();
});