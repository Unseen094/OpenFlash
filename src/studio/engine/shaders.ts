export type ShaderType = 'crt' | 'bloom' | 'glow' | 'chromatic' | 'grain' | 'blur' | 'none'

export interface ShaderUniforms {
  time: number
  resolution: [number, number]
  intensity: number
  colorShift?: [number, number, number]
}

export const SHADER_VERTEX = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

export const SHADER_FRAGMENTS: Record<Exclude<ShaderType, 'none'>, string> = {
  crt: `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    void main() {
      vec2 uv = v_uv;
      vec2 curve = (uv - 0.5) * 2.0;
      vec2 offset = abs(curve.yx) / vec2(6.0, 4.0);
      uv = uv + curve * offset * offset * u_intensity * 0.02;
      float scanline = sin(uv.y * u_resolution.y * 1.5 + u_time * 5.0) * 0.02 * u_intensity;
      float mask = mod(gl_FragCoord.x, 3.0) < 1.0 ? 0.95 : 1.0;
      vec4 color = texture2D(u_texture, uv);
      color.rgb *= mask;
      color.rgb += scanline;
      color.rgb = smoothstep(0.0, 1.0, color.rgb);
      float vignette = 1.0 - dot(curve * 0.5, curve * 0.5) * u_intensity * 0.3;
      color.rgb *= vignette;
      gl_FragColor = color;
    }
  `,
  bloom: `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    void main() {
      vec4 sum = vec4(0.0);
      float blur = 2.0 * u_intensity;
      for (float x = -4.0; x <= 4.0; x += 1.0) {
        for (float y = -4.0; y <= 4.0; y += 1.0) {
          vec2 offset = vec2(x, y) * blur / u_resolution;
          sum += texture2D(u_texture, v_uv + offset);
        }
      }
      vec4 blur_color = sum / 81.0;
      vec4 original = texture2D(u_texture, v_uv);
      gl_FragColor = original + blur_color * u_intensity * 0.5;
    }
  `,
  glow: `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    void main() {
      vec4 color = texture2D(u_texture, v_uv);
      float brightness = dot(color.rgb, vec3(0.299, 0.587, 0.114));
      vec4 glow = vec4(0.0);
      float size = 4.0 * u_intensity;
      for (float x = -size; x <= size; x += 1.0) {
        for (float y = -size; y <= size; y += 1.0) {
          float dist = length(vec2(x, y));
          float weight = exp(-dist * dist / (size * size));
          vec2 offset = vec2(x, y) / u_resolution;
          vec4 sample_color = texture2D(u_texture, v_uv + offset);
          float sample_brightness = dot(sample_color.rgb, vec3(0.299, 0.587, 0.114));
          glow += sample_color * sample_brightness * weight * u_intensity * 0.1;
        }
      }
      gl_FragColor = color + glow;
    }
  `,
  chromatic: `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    void main() {
      float amount = 0.005 * u_intensity * (1.0 + 0.3 * sin(u_time * 2.0));
      vec2 dir = v_uv - vec2(0.5);
      vec2 offset = dir * amount;
      float r = texture2D(u_texture, v_uv + offset).r;
      float g = texture2D(u_texture, v_uv).g;
      float b = texture2D(u_texture, v_uv - offset).b;
      gl_FragColor = vec4(r, g, b, 1.0);
    }
  `,
  grain: `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    float random(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
    }
    void main() {
      vec4 color = texture2D(u_texture, v_uv);
      float noise = random(v_uv + u_time) * u_intensity * 0.15;
      color.rgb += noise - u_intensity * 0.075;
      gl_FragColor = color;
    }
  `,
  blur: `
    precision mediump float;
    varying vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform float u_intensity;
    void main() {
      vec4 sum = vec4(0.0);
      float radius = 3.0 * u_intensity;
      for (float x = -3.0; x <= 3.0; x += 1.0) {
        for (float y = -3.0; y <= 3.0; y += 1.0) {
          vec2 offset = vec2(x, y) * radius / u_resolution;
          sum += texture2D(u_texture, v_uv + offset);
        }
      }
      gl_FragColor = sum / 49.0;
    }
  `
}

export class ShaderPipeline {
  private gl: WebGLRenderingContext | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private framebuffer: WebGLFramebuffer | null = null
  private activeShaders: Set<ShaderType> = new Set()
  private uniforms: Map<string, number> = new Map()
  private time = 0
  private canvas: HTMLCanvasElement | null = null

  initialize(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas
    const gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true })
    if (!gl) return false
    this.gl = gl
    this.setupGL()
    return true
  }

  private setupGL(): void {
    const gl = this.gl!
    gl.getExtension('OES_standard_derivatives')
    this.texture = gl.createTexture()
    this.framebuffer = gl.createFramebuffer()
  }

  addShader(type: ShaderType): void {
    this.activeShaders.add(type)
  }

  removeShader(type: ShaderType): void {
    this.activeShaders.delete(type)
  }

  hasShader(type: ShaderType): boolean {
    return this.activeShaders.has(type)
  }

  getActiveShaders(): ShaderType[] {
    return Array.from(this.activeShaders)
  }

  render(sourceCanvas: HTMLCanvasElement, width: number, height: number): void {
    if (!this.gl || this.activeShaders.size === 0) return
    const gl = this.gl
    gl.viewport(0, 0, width, height)

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sourceCanvas)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.time += 0.016
  }

  dispose(): void {
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture)
      if (this.framebuffer) this.gl.deleteFramebuffer(this.framebuffer)
      if (this.program) this.gl.deleteProgram(this.program)
    }
    this.gl = null
    this.activeShaders.clear()
  }
}

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
