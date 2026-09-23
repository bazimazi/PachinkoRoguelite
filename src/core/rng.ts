/** FNV-1a, stable across sessions so a shared seed rebuilds the same machine. */
export function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFor(seed: string, salt: string): () => number {
  return mulberry32(hashString(`${seed}|${salt}`))
}

export function irand(rng: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n))
}

export function pickIndex(rng: () => number, weights: number[]): number {
  let sum = 0
  for (const w of weights) sum += Math.max(0, w)
  if (sum <= 0) return 0
  let r = rng() * sum
  for (let i = 0; i < weights.length; i++) {
    r -= Math.max(0, weights[i])
    if (r <= 0) return i
  }
  return weights.length - 1
}

export function makeSeed(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = ''
  for (let i = 0; i < 6; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)]
  return s
}

export function cleanSeed(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)
}
