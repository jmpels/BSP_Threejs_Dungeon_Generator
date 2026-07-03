let minSize = 50;
let maxDepth = 5;

class BSP_Node {
  rect: { x: number; y: number; w: number; h: number };
  room: Room | null;
  corridors: Corridor[];
  left: BSP_Node | null;
  right: BSP_Node | null;

  constructor(x: number, y: number, w: number, h: number) {
    this.rect = { x, y, w, h };
    this.room = null;
    this.corridors = [];
    this.left = null;
    this.right = null;
  }

  split(node: BSP_Node, depth: number = 0): void {
    console.log("split called", depth, node);
    if (depth >= maxDepth) {
      return;
    }

    let canSplitHorizontal = node.rect.h >= minSize * 2;
    let canSplitVertical = node.rect.w >= minSize * 2;

    if (!canSplitHorizontal && !canSplitVertical) {
      return;
    }

    if (node.rect.w >= node.rect.h) {
      let randomSplitPoint =
        Math.floor(Math.random() * (node.rect.w - minSize * 2)) + minSize;
      node.left = new BSP_Node(
        node.rect.x,
        node.rect.y,
        randomSplitPoint,
        node.rect.h,
      );
      node.right = new BSP_Node(
        node.rect.x + randomSplitPoint,
        node.rect.y,
        node.rect.w - randomSplitPoint,
        node.rect.h,
      );

      //falta desenhar no canvas
    } else {
      let randomSplitPoint =
        Math.floor(Math.random() * (node.rect.h - minSize * 2)) + minSize;
      node.left = new BSP_Node(
        node.rect.x,
        node.rect.y,
        node.rect.w,
        randomSplitPoint,
      );
      node.right = new BSP_Node(
        node.rect.x,
        node.rect.y + randomSplitPoint,
        node.rect.w,
        node.rect.h - randomSplitPoint,
      );
      //falta desenhar no canvas
    }
    this.split(node.left, depth + 1);
    this.split(node.right, depth + 1);

    // ctx.strokeStyle = 'lime'
    // ctx.lineWidth = 1
    // ctx.strokeRect(node.left.rect.x, node.left.rect.y, node.left.rect.w, node.left.rect.h)
    // ctx.strokeRect(node.right.rect.x, node.right.rect.y, node.right.rect.w, node.right.rect.h)
  }

  getLeafNodes(node: BSP_Node): BSP_Node[] {
    if (node.left === null && node.right === null) {
      return [node];
    }
    return node.getLeafNodes(node.left!).concat(node.getLeafNodes(node.right!));
  }

  connect(node: BSP_Node): Room[] {
    if (node.left == null && node.right == null) {
      return [node.room!];
    }
    let leftRooms = this.connect(node.left!);
    let rightRooms = this.connect(node.right!);

    let closestRooms = BSP_Node.closestPair(leftRooms, rightRooms);
    let roomA = closestRooms[0];
    let roomB = closestRooms[1];

    let corridor = new Corridor(roomA, roomB);
    this.corridors.push(corridor);

    return leftRooms.concat(rightRooms);
  }

  static closestPair(roomsA: Room[], roomsB: Room[]): [Room, Room] {
    let bestA: Room | null = null;
    let bestB: Room | null = null;
    let minDistance = Infinity;

    let distance = null;
    for (let roomA of roomsA) {
      for (let roomB of roomsB) {
        distance = Math.sqrt(
          Math.pow(roomA.x - roomB.x, 2) + Math.pow(roomA.y - roomB.y, 2),
        );
        if (distance < minDistance) {
          minDistance = distance;
          bestA = roomA;
          bestB = roomB;
        }
      }
    }
    return [bestA!, bestB!];
  }

  edgeExists(corridors: Corridor[], roomA: Room, roomB: Room): boolean {
    for (let corridor of corridors) {
      if (
        (corridor.room1 === roomA && corridor.room2 === roomB) ||
        (corridor.room1 === roomB && corridor.room2 === roomA)
      ) {
        return true;
      }
    }
    return false;
  }

  findLoopCandidates(
    allRooms: Room[],
    existingCorridors: Corridor[],
  ): [Room, Room, number][] {
    let loopCandidates: [Room, Room, number][] = [];
    for (let i = 0; i < allRooms.length; i++) {
      for (let j = i + 1; j < allRooms.length; j++) {
        let roomA = allRooms[i];
        let roomB = allRooms[j];
        if (this.edgeExists(existingCorridors, roomA, roomB)) {
          continue; // Skip if a corridor already exists between these rooms
        }
        loopCandidates.push([
          roomA,
          roomB,
          Math.sqrt(
            Math.pow(roomA.x - roomB.x, 2) + Math.pow(roomA.y - roomB.y, 2),
          ),
        ]);
      }
    }
    loopCandidates.sort((a, b) => a[2] - b[2]); // Sort by distance ascending
    return loopCandidates;
  }

  buildAdjacencyList(room: Room, corridors: Corridor[]): Room[] {
    let adjacencyList: Room[] = [];

    for (let corridor of corridors) {
      if (corridor.room1 === room) {
        adjacencyList.push(corridor.room2!);
      } else if (corridor.room2 === room) {
        adjacencyList.push(corridor.room1!);
      }
    }
    return adjacencyList;
  }

  bfsDistanceAndRoomTypeAtribution(
    startRoom: Room,
    corridors: Corridor[],
  ): void {
    let queue: Room[] = [];
    let visited: Set<Room> = new Set();

    queue.push(startRoom);
    startRoom.distanceFromStart = 0;
    startRoom.type = "Starting room";

    while (queue.length > 0) {
      let currentRoom = queue.shift()!;
      visited.add(currentRoom);
      let adjacentRooms = this.buildAdjacencyList(currentRoom, corridors);
      for (let adjacentRoom of adjacentRooms) {
        if (adjacentRoom.distanceFromStart === null) {
          adjacentRoom.distanceFromStart = currentRoom.distanceFromStart! + 1;

          if (this.buildAdjacencyList(adjacentRoom, corridors).length === 1) {
            adjacentRoom.type = "Treasure room"; // or dead-end room
          }

          queue.push(adjacentRoom);
        }
      }
    }
    let maxDistance = Math.max(
      ...Array.from(visited).map((room) => room.distanceFromStart!),
    );

    for (let room of visited) {
      if (room.distanceFromStart === maxDistance) {
        room.type = "Boss room";
      }
    }
  }
}

class Room {
  x: number;
  y: number;
  w: number;
  h: number;
  type: string;
  distanceFromStart: number | null = null; // New property to store distance from the starting room

  constructor(
    x: number,
    y: number,
    w: number,
    h: number,
    type: string = "Normal room",
    distanceFromStart: number | null = null,
  ) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
    this.distanceFromStart = distanceFromStart;
  }

  carveRoom(leaf: BSP_Node, padding: number): Room {
    while (leaf.rect.w < padding * 2 || leaf.rect.h < padding * 2) {
      padding = padding / 2; // Reduce padding if the leaf is too small
    }

    let maxRoomWidth = leaf.rect.w - padding * 2;
    let maxRoomHeight = leaf.rect.h - padding * 2;

    let roomW = Math.floor(Math.random() * (maxRoomWidth - 10)) + 10;
    let roomH = Math.floor(Math.random() * (maxRoomHeight - 10)) + 10;

    let slackX = leaf.rect.w - roomW - padding * 2;
    let slackY = leaf.rect.h - roomH - padding * 2;

    let roomX = leaf.rect.x + padding + Math.floor(Math.random() * slackX);
    let roomY = leaf.rect.y + padding + Math.floor(Math.random() * slackY);

    this.x = roomX;
    this.y = roomY;
    this.w = roomW;
    this.h = roomH;

    return new Room(roomX, roomY, roomW, roomH, this.type);
  }
}

class Corridor {
  rectX: { x: number; y: number; w: number; h: number };
  rectY: { x: number; y: number; w: number; h: number };
  room1: Room | null;
  room2: Room | null;
  corridorWidth: number = 5;

  constructor(room1: Room, room2: Room) {
    this.room1 = room1;
    this.room2 = room2;
    this.rectX = {
      x: Math.min(room1.x, room2.x),
      y: room1.y - this.corridorWidth / 2,
      w: Math.abs(room2.x - room1.x) + this.corridorWidth,
      h: this.corridorWidth,
    };
    this.rectY = {
      x: room2.x - this.corridorWidth / 2,
      y: Math.min(room1.y, room2.y),
      w: this.corridorWidth,
      h: Math.abs(room2.y - room1.y) + this.corridorWidth,
    };
  }
}

export { BSP_Node, Room, Corridor };
