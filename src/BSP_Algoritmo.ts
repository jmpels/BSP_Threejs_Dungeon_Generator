import './style.css'

// This makes a nice canvas randomly split into rectangles using a binary space partitioning algorithm

const canvas = document.querySelector<HTMLCanvasElement>('#canvas')!;
const ctx = canvas.getContext('2d')!;

ctx.fillRect(0, 0, 800, 600);

let minSize = 50
let maxDepth = 5

class Node {
  rect: { x: number, y: number, w: number, h: number }
  left: Node | null
  right: Node | null

  constructor(x: number, y: number, w: number, h: number) {
    this.rect = { x, y, w, h }
    this.left = null
    this.right = null
  }

  split(node:Node, depth:number = 0 ):void {
    console.log('split called', depth, node.rect)
    if (depth >= maxDepth) {
      return
    }

    let canSplitHorizontal = node.rect.h >= minSize * 2
    let canSplitVertical   = node.rect.w >= minSize * 2

    if (!canSplitHorizontal && !canSplitVertical) {
      return
    }

    if( node.rect.w >= node.rect.h) {
      let randomSplitPoint = Math.floor(Math.random() * (node.rect.w - minSize * 2)) + minSize  
      node.left = new Node(node.rect.x, node.rect.y, randomSplitPoint, node.rect.h)
      node.right = new Node(node.rect.x + randomSplitPoint, node.rect.y, node.rect.w - randomSplitPoint, node.rect.h)

     //falta desenhar no canvas
    }else{
      let randomSplitPoint = Math.floor(Math.random() * (node.rect.h - minSize * 2)) + minSize
      node.left = new Node(node.rect.x, node.rect.y, node.rect.w, randomSplitPoint)
      node.right = new Node(node.rect.x, node.rect.y + randomSplitPoint, node.rect.w, node.rect.h - randomSplitPoint)
     //falta desenhar no canvas
    }
    this.split(node.left, depth + 1)
    this.split(node.right, depth + 1)

    ctx.strokeStyle = 'lime'
    ctx.lineWidth = 1
    ctx.strokeRect(node.left.rect.x, node.left.rect.y, node.left.rect.w, node.left.rect.h)
    ctx.strokeRect(node.right.rect.x, node.right.rect.y, node.right.rect.w, node.right.rect.h)

  }
}

// falta instanciar o node class
let rootNode = new Node(0, 0, canvas.width, canvas.height)
rootNode.split(rootNode)