import type { ThemeName } from '../sim/board'

export interface Palette {
  bg0: string
  bg1: string
  felt: string
  frame: string
  frameDeep: string
  peg: string
  pegDeep: string
  gold: string
  danger: string
  accent: string
  steel: string
  well: string
}

export const PALETTE: Record<ThemeName, Palette> = {
  workshop: {
    bg0: '#0c1012',
    bg1: '#1c282c',
    felt: '#142226',
    frame: '#e0b07a',
    frameDeep: '#6a4328',
    peg: '#f4e7d6',
    pegDeep: '#8a684c',
    gold: '#ffd56a',
    danger: '#ff6b5a',
    accent: '#7ee0c6',
    steel: '#d5dee3',
    well: '#b7a4ff',
  },
  foundry: {
    bg0: '#120c0a',
    bg1: '#2a1612',
    felt: '#241410',
    frame: '#e39a62',
    frameDeep: '#6a3018',
    peg: '#f0d2bc',
    pegDeep: '#8a4e32',
    gold: '#ffcf70',
    danger: '#ff5a3c',
    accent: '#ff8a5b',
    steel: '#e7d2c4',
    well: '#ffb088',
  },
  gravity: {
    bg0: '#0c0c16',
    bg1: '#1a1730',
    felt: '#141228',
    frame: '#c9b6ff',
    frameDeep: '#3a3060',
    peg: '#e4e0f4',
    pegDeep: '#6a6490',
    gold: '#ffe08a',
    danger: '#ff6b8a',
    accent: '#b7a4ff',
    steel: '#ddd6ff',
    well: '#8eb6ff',
  },
  grinder: {
    bg0: '#101114',
    bg1: '#1c1e24',
    felt: '#16181e',
    frame: '#d7de6a',
    frameDeep: '#3e4218',
    peg: '#e7e4d4',
    pegDeep: '#6e6a48',
    gold: '#ffe56a',
    danger: '#ff5d4a',
    accent: '#e6f27a',
    steel: '#dfe6c8',
    well: '#d7de6a',
  },
}
