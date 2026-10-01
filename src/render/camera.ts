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
  // Reserve room for the instrument docks on tablet and laptop layouts too.
  const gutter = cssW < 560 ? 6 : cssW < 760 ? 72 : cssW < 1180 ? 174 : 220
  const machinePx = Math.min(Math.max(260, cssW - gutter * 2), 860)
  return machinePx / boardW
}

export function screenToWorld(cam: Cam, sx: number, sy: number): { x: number; y: number } {
  const z = cam.scale * cam.zoom
  return {
    x: (sx - cam.cssW / 2 - cam.shakeX) / z + cam.boardW / 2,
    y: (sy - cam.cssH / 2 - cam.shakeY) / z + cam.camY,
  }
}
