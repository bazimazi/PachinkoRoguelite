export class Input {
  keys = new Set<string>()
  pressed = new Set<string>()
  x = 0
  y = 0
  dx = 0
  dy = 0
  pointer = false
  clicked = false
  private downOnCanvas = false

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault()
      if (e.repeat) return
      this.keys.add(e.code)
      this.pressed.add(e.code)
    })
    window.addEventListener('keyup', (e) => this.keys.delete(e.code))
    window.addEventListener('blur', () => {
      this.keys.clear()
      this.pressed.clear()
    })
    canvas.addEventListener('pointermove', (e) => this.track(e))
    canvas.addEventListener('pointerdown', (e) => {
      this.track(e)
      this.downOnCanvas = true
    })
    window.addEventListener('pointerup', (e) => {
      if (this.downOnCanvas) this.clicked = true
      this.downOnCanvas = false
      this.track(e)
    })
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
  }

  private track(e: PointerEvent): void {
    const r = this.canvas.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    this.dx = x - this.x
    this.dy = y - this.y
    this.x = x
    this.y = y
    this.pointer = true
  }

  endFrame(): void {
    this.pressed.clear()
    this.clicked = false
    this.dx = 0
    this.dy = 0
  }
}
