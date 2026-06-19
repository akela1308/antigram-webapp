export type GrainConfig = {
  intensity: number
  size:      number
  shape:     'round' | 'tgrain'
  r: number
  g: number
  b: number
}

export type AlgoType = 'orthochrom' | 'ultramax' | 'vision_t'
export type FlareType = 'none' | 'leak_warm' | 'leak_cool' | 'edge_burn' | 'streak'

export interface FilmPreset {
  id:        string
  name:      string
  color:     string
  filter:    string
  grain:     GrainConfig
  algoType?: AlgoType
}

export const FILM_PRESETS: FilmPreset[] = [
  {
    id: 'none', name: '∅ Без фильтра', color: '#444444', filter: 'none',
    grain: { intensity: 0.004, size: 0.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'kodak', name: 'Kodak Portra', color: '#C8A050', filter: 'contrast(1.06) saturate(1.2) brightness(1.02) sepia(0.08) hue-rotate(-2deg)',
    grain: { intensity: 0.048, size: 1.2, shape: 'tgrain', r: 1.0, g: 0.90, b: 0.65 },
  },
  {
    id: 'fuji', name: 'Fuji Superia', color: '#4A8B6B', filter: 'contrast(1.1) saturate(0.88) hue-rotate(-8deg) brightness(0.97)',
    grain: { intensity: 0.035, size: 1.0, shape: 'round', r: 0.70, g: 1.0, b: 0.85 },
  },
  {
    id: 'agfa', name: 'Agfa Vista', color: '#C47832', filter: 'contrast(1.1) saturate(1.28) sepia(0.14) hue-rotate(6deg)',
    grain: { intensity: 0.055, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.65 },
  },
  {
    id: 'warm', name: 'Warm', color: '#D4703A', filter: 'contrast(1.04) saturate(1.15) sepia(0.3) brightness(1.04)',
    grain: { intensity: 0.040, size: 1.0, shape: 'round', r: 1.0, g: 0.80, b: 0.50 },
  },
  {
    id: 'cold', name: 'Cold', color: '#4A78B8', filter: 'contrast(1.12) saturate(0.72) hue-rotate(14deg) brightness(0.96)',
    grain: { intensity: 0.038, size: 1.0, shape: 'round', r: 0.55, g: 0.80, b: 1.0 },
  },
  {
    id: 'bleach', name: 'Bleach Bypass', color: '#888880', filter: 'contrast(1.38) saturate(0.62) brightness(0.92)',
    grain: { intensity: 0.055, size: 1.3, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'slide', name: 'Slide', color: '#B86840', filter: 'contrast(1.22) saturate(1.38) brightness(0.95) hue-rotate(-4deg)',
    grain: { intensity: 0.025, size: 0.8, shape: 'round', r: 1.0, g: 0.90, b: 0.80 },
  },
  {
    id: 'technicolor', name: 'Technicolor', color: '#D4A020', filter: 'contrast(1.16) saturate(1.48) hue-rotate(-9deg) brightness(0.96)',
    grain: { intensity: 0.065, size: 1.7, shape: 'round', r: 1.0, g: 0.95, b: 0.45 },
  },
  {
    id: 'hc_bw', name: 'HC B&W', color: '#606060', filter: 'grayscale(1) contrast(1.18) brightness(0.93)',
    grain: { intensity: 0.080, size: 2.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'orthochrom', name: 'Orthochrom', color: '#404040', filter: 'none',
    grain: { intensity: 0.090, size: 1.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    algoType: 'orthochrom',
  },
  {
    id: 'ultramax', name: 'Ultramax', color: '#D48030', filter: 'none',
    grain: { intensity: 0.048, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.60 },
    algoType: 'ultramax',
  },
  {
    id: 'vision_t', name: 'Vision T', color: '#4858A8', filter: 'none',
    grain: { intensity: 0.042, size: 1.5, shape: 'tgrain', r: 0.65, g: 0.80, b: 1.0 },
    algoType: 'vision_t',
  },
]
