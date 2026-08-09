export type ShaderType = 'crt' | 'bloom' | 'glow' | 'chromatic' | 'grain' | 'blur' | 'none'

/*
 * WebGL shader pipeline: NOT YET IMPLEMENTED.
 *
 * A GLSL-based post-processing pipeline (SHADER_VERTEX / SHADER_FRAGMENTS /
 * ShaderPipeline) previously lived here but was never wired up - nothing ever
 * instantiated it, its `render()` uploaded a texture and drew nothing, and the
 * fragment sources referenced an undeclared `u_texture` uniform so they could
 * not have compiled. It was removed to keep it out of the bundle.
 *
 * The shipping implementation is the Canvas2D `applyShaderOverlay` below.
 * See git history for the original WebGL draft if/when this is revisited.
 */

export const applyShaderOverlay = (ctx: CanvasRenderingContext2D, type: ShaderType, width: number, height: number, intensity = 1, time = 0): void => {
  if (type === 'none') return

  ctx.save()

  switch (type) {
    case 'crt': {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.15 * intensity})`
      for (let y = 0; y < height; y += 3) {
        ctx.fillRect(0, y, width, 1)
      }
      const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height) / 1.2)
      gradient.addColorStop(0, 'rgba(0,0,0,0)')
      gradient.addColorStop(1, `rgba(0,0,0,${0.4 * intensity})`)
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, width, height)
      break
    }
    case 'bloom': {
      ctx.globalCompositeOperation = 'screen'
      ctx.filter = `blur(${8 * intensity}px)`
      ctx.globalAlpha = 0.3 * intensity
      ctx.drawImage(ctx.canvas, 0, 0)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      break
    }
    case 'glow': {
      ctx.globalCompositeOperation = 'lighter'
      ctx.filter = `blur(${4 * intensity}px)`
      ctx.globalAlpha = 0.2 * intensity
      ctx.drawImage(ctx.canvas, 0, 0)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      break
    }
    case 'chromatic': {
      const offset = 2 * intensity
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = 0.5
      ctx.filter = 'url(#red-channel)'
      ctx.drawImage(ctx.canvas, offset, 0)
      ctx.filter = 'url(#blue-channel)'
      ctx.drawImage(ctx.canvas, -offset, 0)
      ctx.filter = 'none'
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      break
    }
    case 'grain': {
      const imageData = ctx.getImageData(0, 0, width, height)
      const data = imageData.data
      const amount = 25 * intensity
      for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * amount
        data[i] += noise
        data[i + 1] += noise
        data[i + 2] += noise
      }
      ctx.putImageData(imageData, 0, 0)
      break
    }
    case 'blur': {
      ctx.filter = `blur(${2 * intensity}px)`
      ctx.drawImage(ctx.canvas, 0, 0)
      ctx.filter = 'none'
      break
    }
  }

  ctx.restore()
}
