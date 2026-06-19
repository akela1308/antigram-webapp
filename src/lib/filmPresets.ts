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
  iconUrl?:  string
}

export const FILM_PRESETS: FilmPreset[] = [
  {
    id: 'none', name: '∅ Без фильтра', color: '#444444', filter: 'none',
    grain: { intensity: 0.004, size: 0.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'kodak', name: 'Kodak Portra', color: '#C8A050',
    filter: 'contrast(1.18) saturate(1.65) brightness(1.05) sepia(0.22) hue-rotate(-4deg)',
    grain: { intensity: 0.048, size: 1.2, shape: 'tgrain', r: 1.0, g: 0.90, b: 0.65 },
    iconUrl: '/presets/kodak.png',
  },
  {
    id: 'fuji', name: 'Fuji Superia', color: '#4A8B6B',
    filter: 'contrast(1.22) saturate(0.72) hue-rotate(-14deg) brightness(0.94)',
    grain: { intensity: 0.035, size: 1.0, shape: 'round', r: 0.70, g: 1.0, b: 0.85 },
    iconUrl: '/presets/fuji.png',
  },
  {
    id: 'agfa', name: 'Agfa Vista', color: '#C47832',
    filter: 'contrast(1.22) saturate(1.75) sepia(0.25) hue-rotate(8deg)',
    grain: { intensity: 0.055, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.65 },
    iconUrl: '/presets/agfa.png',
  },
  {
    id: 'warm', name: 'Warm', color: '#D4703A',
    filter: 'contrast(1.08) saturate(1.35) sepia(0.48) brightness(1.06)',
    grain: { intensity: 0.040, size: 1.0, shape: 'round', r: 1.0, g: 0.80, b: 0.50 },
    iconUrl: '/presets/warm.png',
  },
  {
    id: 'cold', name: 'Cold', color: '#4A78B8',
    filter: 'contrast(1.25) saturate(0.55) hue-rotate(22deg) brightness(0.92)',
    grain: { intensity: 0.038, size: 1.0, shape: 'round', r: 0.55, g: 0.80, b: 1.0 },
    iconUrl: '/presets/cold.png',
  },
  {
    id: 'bleach', name: 'Bleach Bypass', color: '#888880',
    filter: 'contrast(1.60) saturate(0.40) brightness(0.88)',
    grain: { intensity: 0.055, size: 1.3, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    iconUrl: '/presets/bleach.png',
  },
  {
    id: 'slide', name: 'Slide', color: '#B86840',
    filter: 'contrast(1.38) saturate(1.65) brightness(0.92) hue-rotate(-6deg)',
    grain: { intensity: 0.025, size: 0.8, shape: 'round', r: 1.0, g: 0.90, b: 0.80 },
    iconUrl: '/presets/slide.png',
  },
  {
    id: 'technicolor', name: 'Technicolor', color: '#D4A020',
    filter: 'contrast(1.32) saturate(1.90) hue-rotate(-12deg) brightness(0.93)',
    grain: { intensity: 0.065, size: 1.7, shape: 'round', r: 1.0, g: 0.95, b: 0.45 },
    iconUrl: '/presets/technicolor.png',
  },
  {
    id: 'hc_bw', name: 'HC B&W', color: '#606060',
    filter: 'grayscale(1) contrast(1.45) brightness(0.86)',
    grain: { intensity: 0.080, size: 2.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    iconUrl: '/presets/hc_bw.png',
  },
  {
    id: 'lc_bw', name: 'LC B&W', color: '#909090',
    filter: 'grayscale(1) contrast(0.90) brightness(1.08)',
    grain: { intensity: 0.040, size: 1.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    iconUrl: '/presets/lc_bw.png',
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
