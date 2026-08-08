import { Vector2, generateId } from './math'

export interface Particle {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  alpha: number
  rotation: number
  rotationSpeed: number
}

export interface ParticleEmitter {
  id: string
  name: string
  x: number
  y: number
  rate: number
  maxParticles: number
  particleLife: number
  speed: number
  speedVariance: number
  angle: number
  spread: number
  size: number
  sizeVariance: number
  color: string
  gravity: number
  particles: Particle[]
  emitting: boolean
}

export const createEmitter = (x: number, y: number): ParticleEmitter => ({
  id: generateId(),
  name: 'Emitter',
  x, y,
  rate: 10,
  maxParticles: 100,
  particleLife: 60,
  speed: 3,
  speedVariance: 1,
  angle: -90,
  spread: 30,
  size: 4,
  sizeVariance: 2,
  color: '#FFE600',
  gravity: 0.1,
  particles: [],
  emitting: true
})

export const emitParticle = (emitter: ParticleEmitter): Particle => {
  const angleRad = (emitter.angle + (Math.random() - 0.5) * emitter.spread) * Math.PI / 180
  const speed = emitter.speed + (Math.random() - 0.5) * emitter.speedVariance * 2
  return {
    id: generateId(),
    x: emitter.x,
    y: emitter.y,
    vx: Math.cos(angleRad) * speed,
    vy: Math.sin(angleRad) * speed,
    life: emitter.particleLife,
    maxLife: emitter.particleLife,
    size: emitter.size + (Math.random() - 0.5) * emitter.sizeVariance * 2,
    color: emitter.color,
    alpha: 1,
    rotation: Math.random() * 360,
    rotationSpeed: (Math.random() - 0.5) * 10
  }
}

export const updateEmitter = (emitter: ParticleEmitter): ParticleEmitter => {
  let particles = emitter.particles.map(p => ({
    ...p,
    x: p.x + p.vx,
    y: p.y + p.vy + emitter.gravity,
    vx: p.vx * 0.99,
    vy: p.vy * 0.99,
    life: p.life - 1,
    alpha: Math.max(0, p.life / p.maxLife),
    rotation: p.rotation + p.rotationSpeed
  })).filter(p => p.life > 0)

  if (emitter.emitting && particles.length < emitter.maxParticles) {
    const toEmit = Math.min(emitter.rate, emitter.maxParticles - particles.length)
    for (let i = 0; i < toEmit; i++) {
      particles.push(emitParticle(emitter))
    }
  }

  return { ...emitter, particles }
}

export const renderParticles = (ctx: CanvasRenderingContext2D, emitter: ParticleEmitter) => {
  for (const p of emitter.particles) {
    ctx.save()
    ctx.globalAlpha = p.alpha
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rotation * Math.PI / 180)
    ctx.fillStyle = p.color
    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
    ctx.restore()
  }
}
