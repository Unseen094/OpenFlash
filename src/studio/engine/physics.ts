import { Vector2, generateId } from './math'

export interface PhysicsBody {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  width: number
  height: number
  mass: number
  restitution: number
  friction: number
  isStatic: boolean
  rotation: number
  angularVelocity: number
}

export class PhysicsWorld {
  gravity: Vector2
  bodies: PhysicsBody[]

  constructor(gravityY = 500) {
    this.gravity = { x: 0, y: gravityY }
    this.bodies = []
  }

  addBody(x: number, y: number, w: number, h: number, isStatic = false): PhysicsBody {
    const body = createBody(x, y, w, h, isStatic)
    this.bodies.push(body)
    return body
  }

  step(dt: number): void {
    this.bodies = this.bodies.map(body => {
      if (body.isStatic) return body
      return {
        ...body,
        vy: body.vy + this.gravity.y * dt,
        x: body.x + body.vx * dt,
        y: body.y + body.vy * dt,
        rotation: body.rotation + body.angularVelocity * dt
      }
    })
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const a = this.bodies[i], b = this.bodies[j]
        if (a.isStatic && b.isStatic) continue
        if (overlap(a, b)) resolveCollision(a, b)
      }
    }
  }

  dispose(): void {
    this.bodies = []
  }
}

export const createWorld = (gravityY = 500): PhysicsWorld => new PhysicsWorld(gravityY)

export const createBody = (x: number, y: number, w: number, h: number, isStatic = false): PhysicsBody => ({
  id: generateId(),
  x, y, vx: 0, vy: 0,
  width: w, height: h,
  mass: isStatic ? Infinity : w * h * 0.01,
  restitution: 0.5,
  friction: 0.3,
  isStatic,
  rotation: 0,
  angularVelocity: 0
})

export const stepWorld = (world: PhysicsWorld, dt: number): PhysicsWorld => { world.step(dt); return world }

const overlap = (a: PhysicsBody, b: PhysicsBody): boolean =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y

const resolveCollision = (a: PhysicsBody, b: PhysicsBody) => {
  const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  const restitution = (a.restitution + b.restitution) / 2

  if (overlapX < overlapY) {
    const sign = a.x < b.x ? -1 : 1
    if (!a.isStatic) { a.x += sign * overlapX / 2; a.vx = -a.vx * restitution }
    if (!b.isStatic) { b.x -= sign * overlapX / 2; b.vx = -b.vx * restitution }
  } else {
    const sign = a.y < b.y ? -1 : 1
    if (!a.isStatic) { a.y += sign * overlapY / 2; a.vy = -a.vy * restitution }
    if (!b.isStatic) { b.y -= sign * overlapY / 2; b.vy = -b.vy * restitution }
  }
}
