export default function DocsPage() {
  const api = [
    {
      name: 'OpenFlash.on(event, handler)',
      sig: 'on(event: OFEventType, handler: (event: OFEvent) => void): () => void',
      desc: 'Register a handler for a runtime event. Returns an unsubscribe function.',
      note: 'The global runtime is exposed as the parameter OpenFlash (and its alias Open) in the Studio code editor.',
      events: ["'tick' — every frame, event has delta (seconds)", "'pointerDown' — event has x, y", "'pointerUp' — event has x, y", "'pointerMove' — event has x, y", "'keyDown' — event has key", "'keyUp' — event has key", "'collision' — event has target, other", "'trigger' — custom trigger", "'sceneLoad' — a scene was loaded", "'sceneUnload' — a scene was unloaded"]
    },
    {
      name: 'OpenFlash.createSprite(options)',
      sig: '(options: { name?, x?, y?, width?, height?, color? }): OFSprite',
      desc: 'Create a sprite on the stage. The returned object is mutable — set .x, .y, .width, .height, .rotation, .alpha, .visible, .scaleX, .scaleY each frame to animate it.',
      props: ['x, y — position (center of the sprite)', 'width, height — size in pixels', 'rotation — degrees (spins in render)', 'alpha — opacity 0..1', 'visible — draw or hide', 'scaleX, scaleY — scaling factors', 'vx, vy — velocity (if you integrate it yourself)', 'data.color — fill color (set at spawn via the color option)']
    },
    { name: 'OpenFlash.getSprite(name)', sig: '(name: string): OFSprite | undefined', desc: 'Look up a sprite by its name. Sprites are keyed by options.name, so pass a name at creation to fetch it later.' },
    { name: 'OpenFlash.removeSprite(name)', sig: '(name: string): void', desc: 'Remove a sprite from the stage.' },
    { name: 'OpenFlash.clear()', sig: '(): void', desc: 'Remove every sprite and particle from the running session.' },
    { name: 'OpenFlash.isKeyDown(key)', sig: '(key: string): boolean', desc: 'Is a key currently held? Use inside a tick handler for smooth keyboard movement (e.g. isKeyDown("ArrowRight")).' },
    { name: 'OpenFlash.drawRect / drawCircle / drawLine / drawText', sig: 'drawRect(x, y, width, height, color) / drawCircle(x, y, radius, color) / drawLine(x1, y1, x2, y2, color, width) / drawText(text, x, y, color, size)', desc: 'Immediate-mode drawing helpers that paint straight onto the stage canvas every frame.' },
    { name: 'OpenFlash.drawParticle(x, y, options)', sig: '(x: number, y: number, options: { color?, count?, speed?, size? }): void', desc: 'Burst a particle effect. count defaults to 10, speed to 5, color to #FFE600.' },
    { name: 'OpenFlash.playSound(type)', sig: '(type: "hit" | "jump" | "shoot" | "explode" | "click"): void', desc: 'Play a retro synthesized sound effect. The AudioContext is created lazily on first call.' },
    { name: 'OpenFlash.createScene / loadScene / transition', sig: 'createScene(name, width?, height?) / loadScene(name) / transitionTo(name)', desc: 'Organize the game into scenes and switch between them. loadScene emits sceneUnload then sceneLoad.' },
    { name: 'OpenFlash.setKey / getKey / removeKey', sig: 'setKey(key, value) / getKey(key) / removeKey(key)', desc: 'Persistent local storage for high scores, settings, or save data. Survives reloads.' },
    { name: 'OpenFlash.postScore(score)', sig: '(score: number): void', desc: 'Submit a score to the Arcade leaderboard for this game. Each call replaces the previous entry for this player if the new score is higher. Non-finite values are ignored. Use it liberally — the leaderboard tracks the best score per player.' },
    { name: 'console.log / warn / error', sig: 'console.log(...args)', desc: 'Print to the Studio output panel. Errors surface as [Error] lines in the console.' },
    { name: 'OpenFlash.mouseX / mouseY / frameRate / spriteCount', sig: 'get mouseX / mouseY / frameRate / spriteCount', desc: 'Live getters — cursor position, the current FPS, and how many sprites exist.' }
  ]

  const examples = [
    {
      name: 'Move a sprite every frame',
      code: [
        "const p = OpenFlash.createSprite({ name: 'player', x: 80, y: 200, width: 40, height: 24, color: '#00F0FF' })",
        '',
        "OpenFlash.on('tick', (e) => {",
        '  p.x += 100 * e.delta',
        "  if (OpenFlash.isKeyDown('ArrowUp')) p.y -= 150 * e.delta",
        "  if (OpenFlash.isKeyDown('ArrowDown')) p.y += 150 * e.delta",
        '})'
      ].join('\n')
    },
    {
      name: 'Particles + sound on click',
      code: [
        "OpenFlash.on('pointerDown', (e) => {",
        "  OpenFlash.drawParticle(e.x, e.y, { color: '#FFE600', count: 24 })",
        "  OpenFlash.playSound('hit')",
        '})'
      ].join('\n')
    },
    {
      name: 'Scenes and switching',
      code: [
        "const menu = OpenFlash.createSprite({ name: 'playBtn', x: 340, y: 200, width: 120, height: 40, color: '#FFD400' })",
        "OpenFlash.on('pointerDown', (e) => {",
        "  if (Math.abs(e.x - 400) < 60 && Math.abs(e.y - 220) < 20) {",
        "    OpenFlash.playSound('click')",
        "    OpenFlash.postScore(1)",
        "  }",
        '})'
      ].join('\n')
    }
  ]

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>
      <div style={{ marginBottom: 32 }}>
        <p className="badge badge-cyan" style={{ marginBottom: 12 }}>DOCUMENTATION</p>
        <h1 style={{ fontFamily: 'var(--font-sans)', fontWeight: 800, fontSize: 32, letterSpacing: '-0.03em', margin: 0 }}>
          OpenFlash API
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginTop: 8 }}>
          Write TypeScript in the Studio code panel and it runs <strong>live</strong> against the OpenFlash runtime on the
          stage. The runtime exposes a single object — <code className="code-inline">OpenFlash</code> — plus the
          standard <code className="code-inline">console</code>. Click <strong>Run</strong> to start and click
          <strong> Stop</strong> to tear the session down.
        </p>
      </div>

      <section style={{ marginBottom: 40 }}>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: 16 }}>
          Runtime API
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {api.map(entry => (
            <div key={entry.name} className="card" style={{ padding: 20, background: 'var(--bg-secondary)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h3 style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--accent-yellow)' }}>{entry.name}</h3>
                <code style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>{entry.sig}</code>
                <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{entry.desc}</p>
                {(entry.events || entry.props) && (
                  <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.7 }}>
                    {(entry.events || entry.props).map(item => <li key={item}>{item}</li>)}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--accent-cyan)', marginBottom: 16 }}>
          Examples
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {examples.map(ex => (
            <div key={ex.name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <h3 style={{ margin: 0, fontSize: 14, color: 'var(--text-primary)' }}>{ex.name}</h3>
              <pre className="card" style={{
                background: 'var(--bg-secondary)', padding: 16, borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.7, overflowX: 'auto', margin: 0
              }}>{ex.code}</pre>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}