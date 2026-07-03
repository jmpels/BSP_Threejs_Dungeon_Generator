import './style.css'
import { BSP_Node, Corridor, Room } from '../../vite-project/generator/bsp'

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const ctx = canvas.getContext('2d')!;

ctx.fillRect(0, 0, 800, 600);

// falta instanciar o node class
let rootNode = new BSP_Node(0, 0, canvas.width, canvas.height)
rootNode.split(rootNode)



let leafNodes = rootNode.getLeafNodes(rootNode)





let padding = 10
for (let leaf of leafNodes) {
  let room = new Room(0, 0, 0, 0).carveRoom(leaf, padding)
  leaf.room = room

  console.log("Room carved:", room)

}




for (let leaf of leafNodes) {
  ctx.strokeStyle = 'lime'
  ctx.lineWidth = 2
  ctx.strokeRect(leaf.rect.x, leaf.rect.y, leaf.rect.w, leaf.rect.h)

  ctx.strokeStyle = 'grey'
  ctx.lineWidth = 2
  ctx.strokeRect(leaf.room!.x, leaf.room!.y, leaf.room!.w, leaf.room!.h)
}


let allRooms = rootNode.connect(rootNode)

let corridors = rootNode.corridors

console.log("corridors:", corridors)

console.log("nº Leaf Nodes:", leafNodes.length, "nº Corridors:", corridors.length)
ctx.fillStyle = 'red'
ctx.lineWidth = 2

for (let corridor of corridors) {
  ctx.beginPath()
  // want to make the rectangles appear in the rooms center

  ctx.fillRect(corridor.rectX.x, corridor.rectX.y, corridor.rectX.w, corridor.rectX.h)
  ctx.fillRect(corridor.rectY.x, corridor.rectY.y, corridor.rectY.w, corridor.rectY.h)
  ctx.closePath()
  ctx.stroke()
}

let loopCount = Math.floor(Math.random() * 5) + 1; // Randomly choose between 1 and 5 loops

console.log("Loop Count:", loopCount)

let loopCandidates = rootNode.findLoopCandidates(allRooms, corridors)
console.log("Loop Candidates:", loopCandidates.length)
for (let i = 0; i < loopCount && loopCandidates.length > 0; i++) {
  let randomIndex = Math.floor(Math.random() * loopCandidates.length)
  let [roomA, roomB, distance] = loopCandidates[randomIndex]
  let corridor = new Corridor(roomA, roomB)
  corridors.push(corridor)

  ctx.fillStyle = 'blue'
  ctx.fillRect(corridor.rectX.x, corridor.rectX.y, corridor.rectX.w, corridor.rectX.h)
  ctx.fillRect(corridor.rectY.x, corridor.rectY.y, corridor.rectY.w, corridor.rectY.h)

  // Remove the used candidate to avoid duplicates
  loopCandidates.splice(randomIndex, 1)
}


rootNode.bfsDistanceAndRoomTypeAtribution(allRooms[0], corridors)

for (let room of allRooms) {
  ctx.fillStyle = room.type === "Treasure room" ? 'yellow' : room.type === "Boss room" ? 'red' :room.type ==="Starting room" ? 'blue' : 'green'
  ctx.fillRect(room.x, room.y, room.w, room.h)

  

}