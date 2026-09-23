export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t
export const len = (x: number, y: number) => Math.hypot(x, y)

export function formatMult(n: number): string {
  const r = Math.round(n * 10) / 10
  return Number.isInteger(r) ? `×${r.toFixed(0)}` : `×${r.toFixed(1)}`
}

export function capitalize(s: string): string {
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
