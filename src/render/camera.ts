export interface Cam {
  scale: number
  camY: number
  cssW: number
  cssH: number
  boardW: number
  zoom: number
  shakeX: number
  shakeY: number
}

export function machineScale(cssW: number, boardW: number): number {
  const gutter = cssW < 1180 ? 36 : 220
  const machinePx = Math.min(Math.max(280, cssW - gutter * 2), 860)
  return machinePx / boardW
}

export function screenToWorld(cam: Cam, sx: number, sy: number): { x: number; y: number } {
  const z = cam.scale * cam.zoom
  return {
    x: (sx - cam.cssW / 2 - cam.shakeX) / z + cam.boardW / 2,
    y: (sy - cam.cssH / 2 - cam.shakeY) / z + cam.camY,
  }
}
