import { Vector2, distance } from './math'

export interface PhysicsBody {
  id: string
  position: Vector2
  velocity: Vector2
  acceleration: Vector2
  mass: number
  restitution: number
  friction: number
  isStatic: boolean
  isTrigger: boolean
  shape: 'circle' | 'box'
  radius?: number
  width?: number
  height?: number
  rotation: number
  angularVelocity: number
  gravityScale: number
  layer: string
  collisionMask: string[]
}

export interface CollisionInfo {
  bodyA: PhysicsBody
  bodyB: PhysicsBody
  normal: Vector2
  penetration: number
  contactPoint: Vector2
}

export interface RaycastHit {
  body: PhysicsBody
  point: Vector2
  normal: Vector2
  distance: number
}

export class PhysicsWorld {
  private bodies: Map<string, PhysicsBody> = new Map()
  private gravity: Vector2 = { x: 0, y: 500 }
  private timeScale = 1
  private collisionCallbacks: Array<(collision: CollisionInfo) => void> = []
  private triggerCallbacks: Array<(collision: CollisionInfo) => void> = []

  setGravity(x: number, y: number): void {
    this.gravity = { x, y }
  }

  getGravity(): Vector2 {
    return this.gravity
  }

  setTimeScale(scale: number): void {
    this.timeScale = scale
  }

  createBody(config: Partial<PhysicsBody> & { id: string }): PhysicsBody {
    const body: PhysicsBody = {
      position: { x: 0, y: 0 },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
      mass: 1,
      restitution: 0.5,
      friction: 0.3,
      isStatic: false,
      isTrigger: false,
      shape: 'circle',
      radius: 20,
      width: 40,
      height: 40,
      rotation: 0,
      angularVelocity: 0,
      gravityScale: 1,
      layer: 'default',
      collisionMask: ['default'],
      ...config
    }
    this.bodies.set(body.id, body)
    return body
  }

  removeBody(id: string): void {
    this.bodies.delete(id)
  }

  getBody(id: string): PhysicsBody | undefined {
    return this.bodies.get(id)
  }

  getAllBodies(): PhysicsBody[] {
    return Array.from(this.bodies.values())
  }

  applyForce(id: string, force: Vector2): void {
    const body = this.bodies.get(id)
    if (!body || body.isStatic) return
    body.velocity.x += force.x / body.mass
    body.velocity.y += force.y / body.mass
  }

  applyImpulse(id: string, impulse: Vector2): void {
    const body = this.bodies.get(id)
    if (!body || body.isStatic) return
    body.velocity.x += impulse.x / body.mass
    body.velocity.y += impulse.y / body.mass
  }

  setVelocity(id: string, velocity: Vector2): void {
    const body = this.bodies.get(id)
    if (!body || body.isStatic) return
    body.velocity = velocity
  }

  onCollision(callback: (collision: CollisionInfo) => void): void {
    this.collisionCallbacks.push(callback)
  }

  onTrigger(callback: (collision: CollisionInfo) => void): void {
    this.triggerCallbacks.push(callback)
  }

  step(dt: number): void {
    const scaledDt = dt * this.timeScale

    for (const [, body] of this.bodies) {
      if (body.isStatic) continue

      body.velocity.x += this.gravity.x * body.gravityScale * scaledDt
      body.velocity.y += this.gravity.y * body.gravityScale * scaledDt

      body.velocity.x *= (1 - body.friction * scaledDt)
      body.velocity.y *= (1 - body.friction * scaledDt)

      body.position.x += body.velocity.x * scaledDt
      body.position.y += body.velocity.y * scaledDt

      body.rotation += body.angularVelocity * scaledDt
      body.angularVelocity *= (1 - body.friction * scaledDt)
    }

    this.detectCollisions()
  }

  private detectCollisions(): void {
    const bodies = this.getAllBodies()

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]
        const b = bodies[j]

        if (a.isStatic && b.isStatic) continue
        if (!this.canCollide(a, b)) continue

        const collision = this.testCollision(a, b)
        if (collision) {
          if (a.isTrigger || b.isTrigger) {
            this.triggerCallbacks.forEach(cb => cb(collision))
          } else {
            this.resolveCollision(collision)
            this.collisionCallbacks.forEach(cb => cb(collision))
          }
        }
      }
    }
  }

  private canCollide(a: PhysicsBody, b: PhysicsBody): boolean {
    return a.collisionMask.includes(b.layer) || b.collisionMask.includes(a.layer)
  }

  private testCollision(a: PhysicsBody, b: PhysicsBody): CollisionInfo | null {
    if (a.shape === 'circle' && b.shape === 'circle') {
      return this.circleVsCircle(a, b)
    }
    if (a.shape === 'box' && b.shape === 'box') {
      return this.boxVsBox(a, b)
    }
    if (a.shape === 'circle' && b.shape === 'box') {
      return this.circleVsBox(a, b)
    }
    if (a.shape === 'box' && b.shape === 'circle') {
      const result = this.circleVsBox(b, a)
      if (result) {
        result.normal = { x: -result.normal.x, y: -result.normal.y }
        return { ...result, bodyA: a, bodyB: b }
      }
    }
    return null
  }

  private circleVsCircle(a: PhysicsBody, b: PhysicsBody): CollisionInfo | null {
    const dist = distance(a.position, b.position)
    const combinedRadius = (a.radius || 0) + (b.radius || 0)

    if (dist >= combinedRadius) return null

    const normal: Vector2 = dist === 0
      ? { x: 1, y: 0 }
      : { x: (b.position.x - a.position.x) / dist, y: (b.position.y - a.position.y) / dist }

    return {
      bodyA: a,
      bodyB: b,
      normal,
      penetration: combinedRadius - dist,
      contactPoint: {
        x: a.position.x + normal.x * (a.radius || 0),
        y: a.position.y + normal.y * (a.radius || 0)
      }
    }
  }

  private boxVsBox(a: PhysicsBody, b: PhysicsBody): CollisionInfo | null {
    const aHalfW = (a.width || 0) / 2
    const aHalfH = (a.height || 0) / 2
    const bHalfW = (b.width || 0) / 2
    const bHalfH = (b.height || 0) / 2

    const dx = b.position.x - a.position.x
    const dy = b.position.y - a.position.y
    const overlapX = aHalfW + bHalfW - Math.abs(dx)
    const overlapY = aHalfH + bHalfH - Math.abs(dy)

    if (overlapX <= 0 || overlapY <= 0) return null

    const normal: Vector2 = overlapX < overlapY
      ? { x: dx < 0 ? -1 : 1, y: 0 }
      : { x: 0, y: dy < 0 ? -1 : 1 }

    const penetration = Math.min(overlapX, overlapY)

    return {
      bodyA: a,
      bodyB: b,
      normal,
      penetration,
      contactPoint: {
        x: a.position.x + normal.x * aHalfW,
        y: a.position.y + normal.y * aHalfH
      }
    }
  }

  private circleVsBox(circle: PhysicsBody, box: PhysicsBody): CollisionInfo | null {
    const boxHalfW = (box.width || 0) / 2
    const boxHalfH = (box.height || 0) / 2
    const radius = circle.radius || 0

    const dx = circle.position.x - box.position.x
    const dy = circle.position.y - box.position.y

    const closestX = Math.max(-boxHalfW, Math.min(boxHalfW, dx))
    const closestY = Math.max(-boxHalfH, Math.min(boxHalfH, dy))

    const closest: Vector2 = { x: box.position.x + closestX, y: box.position.y + closestY }
    const dist = distance(circle.position, closest)

    if (dist >= radius) return null

    const normal: Vector2 = dist === 0
      ? { x: 0, y: -1 }
      : { x: (circle.position.x - closest.x) / dist, y: (circle.position.y - closest.y) / dist }

    return {
      bodyA: circle,
      bodyB: box,
      normal,
      penetration: radius - dist,
      contactPoint: closest
    }
  }

  private resolveCollision(collision: CollisionInfo): void {
    const { bodyA, bodyB, normal, penetration } = collision

    const totalMass = (bodyA.isStatic ? Infinity : bodyA.mass) + (bodyB.isStatic ? Infinity : bodyB.mass)
    const aRatio = bodyA.isStatic ? 0 : bodyB.isStatic ? 1 : bodyB.mass / totalMass
    const bRatio = bodyB.isStatic ? 0 : bodyA.isStatic ? 1 : bodyA.mass / totalMass

    bodyA.position.x -= normal.x * penetration * aRatio
    bodyA.position.y -= normal.y * penetration * aRatio
    bodyB.position.x += normal.x * penetration * bRatio
    bodyB.position.y += normal.y * penetration * bRatio

    const relVelX = bodyA.velocity.x - bodyB.velocity.x
    const relVelY = bodyA.velocity.y - bodyB.velocity.y
    const velAlongNormal = relVelX * normal.x + relVelY * normal.y

    if (velAlongNormal > 0) return

    const restitution = Math.min(bodyA.restitution, bodyB.restitution)
    const impulse = -(1 + restitution) * velAlongNormal / (1 / bodyA.mass + 1 / bodyB.mass)

    if (!bodyA.isStatic) {
      bodyA.velocity.x += (impulse / bodyA.mass) * normal.x
      bodyA.velocity.y += (impulse / bodyA.mass) * normal.y
    }
    if (!bodyB.isStatic) {
      bodyB.velocity.x -= (impulse / bodyB.mass) * normal.x
      bodyB.velocity.y -= (impulse / bodyB.mass) * normal.y
    }
  }

  raycast(origin: Vector2, direction: Vector2, maxDistance = 1000, layerFilter?: string): RaycastHit | null {
    const dirLen = Math.sqrt(direction.x ** 2 + direction.y ** 2)
    const dir: Vector2 = { x: direction.x / dirLen, y: direction.y / dirLen }

    let closestHit: RaycastHit | null = null

    for (const [, body] of this.bodies) {
      if (layerFilter && !body.collisionMask.includes(layerFilter)) continue

      const hit = this.raycastBody(origin, dir, body, maxDistance)
      if (hit && (!closestHit || hit.distance < closestHit.distance)) {
        closestHit = hit
      }
    }

    return closestHit
  }

  private raycastBody(origin: Vector2, dir: Vector2, body: PhysicsBody, maxDist: number): RaycastHit | null {
    if (body.shape === 'circle') {
      return this.raycastCircle(origin, dir, body, maxDist)
    }
    return this.raycastBox(origin, dir, body, maxDist)
  }

  private raycastCircle(origin: Vector2, dir: Vector2, body: PhysicsBody, maxDist: number): RaycastHit | null {
    const radius = body.radius || 0
    const ox = origin.x - body.position.x
    const oy = origin.y - body.position.y

    const a = dir.x ** 2 + dir.y ** 2
    const b = 2 * (ox * dir.x + oy * dir.y)
    const c = ox ** 2 + oy ** 2 - radius ** 2
    const discriminant = b ** 2 - 4 * a * c

    if (discriminant < 0) return null

    const sqrt = Math.sqrt(discriminant)
    const t1 = (-b - sqrt) / (2 * a)
    const t2 = (-b + sqrt) / (2 * a)
    const t = t1 >= 0 ? t1 : t2

    if (t < 0 || t > maxDist) return null

    return {
      body,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t },
      normal: { x: (origin.x + dir.x * t - body.position.x) / radius, y: (origin.y + dir.y * t - body.position.y) / radius },
      distance: t
    }
  }

  private raycastBox(origin: Vector2, dir: Vector2, body: PhysicsBody, maxDist: number): RaycastHit | null {
    const halfW = (body.width || 0) / 2
    const halfH = (body.height || 0) / 2
    const minX = body.position.x - halfW
    const maxX = body.position.x + halfW
    const minY = body.position.y - halfH
    const maxY = body.position.y + halfH

    let tmin = -Infinity
    let tmax = Infinity

    if (Math.abs(dir.x) > 0.0001) {
      const t1 = (minX - origin.x) / dir.x
      const t2 = (maxX - origin.x) / dir.x
      tmin = Math.max(tmin, Math.min(t1, t2))
      tmax = Math.min(tmax, Math.max(t1, t2))
    } else if (origin.x < minX || origin.x > maxX) {
      return null
    }

    if (Math.abs(dir.y) > 0.0001) {
      const t1 = (minY - origin.y) / dir.y
      const t2 = (maxY - origin.y) / dir.y
      tmin = Math.max(tmin, Math.min(t1, t2))
      tmax = Math.min(tmax, Math.max(t1, t2))
    } else if (origin.y < minY || origin.y > maxY) {
      return null
    }

    if (tmax < 0 || tmin > tmax || tmin > maxDist) return null

    const t = tmin >= 0 ? tmin : tmax
    const point = { x: origin.x + dir.x * t, y: origin.y + dir.y * t }
    const normal: Vector2 = Math.abs(point.x - minX) < 0.01 ? { x: -1, y: 0 }
      : Math.abs(point.x - maxX) < 0.01 ? { x: 1, y: 0 }
      : Math.abs(point.y - minY) < 0.01 ? { x: 0, y: -1 }
      : { x: 0, y: 1 }

    return { body, point, normal, distance: t }
  }

  dispose(): void {
    this.bodies.clear()
    this.collisionCallbacks = []
    this.triggerCallbacks = []
  }
}
