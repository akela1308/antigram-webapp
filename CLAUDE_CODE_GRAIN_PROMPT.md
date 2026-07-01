# ANTIGRAM — Photo Processing Pipeline (Claude Code / Opus)

## Задача

Реализовать полноценный пайплайн обработки фото в Telegram Mini App (`src/pages/UploadPage.tsx`).
Цель: совпасть по результату с Python-бэкендом и мобильным приложением — реальное зерно плёнки, алгоритмические пресеты, процедурные световые утечки.

**Не MVP — это production-quality фото-обработка.**

---

## Контекст кода

Файл для редактирования: `src/pages/UploadPage.tsx`  
Стек: React + TypeScript + Canvas 2D API (без внешних зависимостей для изображений).

Текущий `capture()`:
```typescript
function capture() {
  const ctx = canvas.getContext('2d')!
  if (preset.filter !== 'none') ctx.filter = preset.filter  // CSS LUT simulation
  ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size)
  canvas.toBlob(blob => { ... }, 'image/jpeg', 0.92)
}
```

Текущие `FILM_PRESETS` — только CSS filter строки (без зерна и алго-пресетов).

---

## Эталоны

### Python add_noise (бэкэнд, `src/base/helpers.py`)
```python
def add_noise(image_filename: str, noise_parameter: int):
    img = cv2.imread(image_filename)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    noise = (noise_parameter * np.random.random(img.shape)).clip(0, 255).astype(np.uint8)
    noise = cv2.cvtColor(noise, cv2.COLOR_BGR2GRAY)   # grayscale → равномерный шум
    noise_3d = cv2.merge([noise, noise, noise])
    noisy = cv2.add(img, noise_3d)                    # аддитивное смешение
    return noisy
```

### Python add_flare (бэкэнд, `src/base/helpers.py`)
```python
async def add_flare(image_np_array, flare_name: str) -> Image.Image:
    _, thresh = cv2.threshold(resized_flare, 1, 255, cv2.THRESH_TOZERO)
    img_with_thresh = cv2.add(image_np_array, thresh)  # аддитивное = screen blend
    return Image.fromarray(img_with_thresh)
```
→ Canvas-эквивалент: `globalCompositeOperation: 'screen'`

### Mobile GrainConfig (мобильное приложение, `src/constants/filmPresets.ts`)
```typescript
type GrainConfig = {
  intensity: number   // 0–1: сила сдвига цвета на пиксель (шкала: 0.005–0.022)
  size:      number   // размер кластера зерна: 1.0=мелкое, 2.5=крупное
  shape:     'round' | 'tgrain'  // round=Gaussian, tgrain=T-grain Kodak
  r: number; g: number; b: number  // веса каналов (1.0=норма, >1=усиление, <1=подавление)
}
```

---

## Что нужно реализовать

### 1. Обновить FILM_PRESETS — добавить GrainConfig к каждому пресету

Заменить `FilmPreset` интерфейс и массив `FILM_PRESETS` в UploadPage:

```typescript
type GrainConfig = {
  intensity: number
  size:      number
  shape:     'round' | 'tgrain'
  r: number
  g: number
  b: number
}

type AlgoType = 'orthochrom' | 'ultramax' | 'vision_t'

interface FilmPreset {
  id:        string
  name:      string
  filter:    string       // CSS filter для viewfinder preview
  grain:     GrainConfig
  algoType?: AlgoType    // если задан — применять алго-трансформацию ПОСЛЕ CSS filter
}
```

**Точные значения grain для каждого пресета (из мобильного приложения):**

```typescript
const FILM_PRESETS: FilmPreset[] = [
  {
    id: 'none', name: '∅', filter: 'none',
    grain: { intensity: 0.004, size: 0.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'kodak', name: 'Kodak Portra', filter: 'contrast(1.06) saturate(1.2) brightness(1.02) sepia(0.08) hue-rotate(-2deg)',
    grain: { intensity: 0.010, size: 1.2, shape: 'tgrain', r: 1.0, g: 0.90, b: 0.65 },
  },
  {
    id: 'fuji', name: 'Fuji Superia', filter: 'contrast(1.1) saturate(0.88) hue-rotate(-8deg) brightness(0.97)',
    grain: { intensity: 0.007, size: 1.0, shape: 'round', r: 0.70, g: 1.0, b: 0.85 },
  },
  {
    id: 'agfa', name: 'Agfa Vista', filter: 'contrast(1.1) saturate(1.28) sepia(0.14) hue-rotate(6deg)',
    grain: { intensity: 0.012, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.65 },
  },
  {
    id: 'warm', name: 'Warm', filter: 'contrast(1.04) saturate(1.15) sepia(0.3) brightness(1.04)',
    grain: { intensity: 0.009, size: 1.0, shape: 'round', r: 1.0, g: 0.80, b: 0.50 },
  },
  {
    id: 'cold', name: 'Cold', filter: 'contrast(1.12) saturate(0.72) hue-rotate(14deg) brightness(0.96)',
    grain: { intensity: 0.008, size: 1.0, shape: 'round', r: 0.55, g: 0.80, b: 1.0 },
  },
  {
    id: 'bleach', name: 'Bleach Bypass', filter: 'contrast(1.38) saturate(0.62) brightness(0.92)',
    grain: { intensity: 0.011, size: 1.3, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  {
    id: 'slide', name: 'Slide', filter: 'contrast(1.22) saturate(1.38) brightness(0.95) hue-rotate(-4deg)',
    grain: { intensity: 0.005, size: 0.8, shape: 'round', r: 1.0, g: 0.90, b: 0.80 },
  },
  {
    id: 'technicolor', name: 'Technicolor', filter: 'contrast(1.16) saturate(1.48) hue-rotate(-9deg) brightness(0.96)',
    grain: { intensity: 0.014, size: 1.7, shape: 'round', r: 1.0, g: 0.95, b: 0.45 },
  },
  {
    id: 'hc_bw', name: 'HC B&W', filter: 'grayscale(1) contrast(1.18) brightness(0.93)',
    grain: { intensity: 0.018, size: 2.0, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
  },
  // Алгоритмические пресеты
  {
    id: 'orthochrom', name: 'Orthochrom', filter: 'none',
    grain: { intensity: 0.022, size: 1.8, shape: 'round', r: 1.0, g: 1.0, b: 1.0 },
    algoType: 'orthochrom',
  },
  {
    id: 'ultramax', name: 'Ultramax', filter: 'none',
    grain: { intensity: 0.010, size: 1.3, shape: 'round', r: 1.0, g: 0.85, b: 0.60 },
    algoType: 'ultramax',
  },
  {
    id: 'vision_t', name: 'Vision T', filter: 'none',
    grain: { intensity: 0.009, size: 1.5, shape: 'tgrain', r: 0.65, g: 0.80, b: 1.0 },
    algoType: 'vision_t',
  },
]
```

---

### 2. Функция `applyGrain(ctx, canvas, grain: GrainConfig)`

Портируй Python `add_noise()` на Canvas ImageData. Алгоритм:

```
1. getImageData → data[Uint8ClampedArray]  (RGBA, 4 байта на пиксель)
2. Для каждого пикселя (i шагом 4):
   a. Генерируй scalar noise ∈ [0, 1]:
      - shape='round':  noise = Math.random() — равномерный (как Python np.random.random)
      - shape='tgrain': noise = triangleRandom() — сумма 2 случайных / 2 → треугольное распределение
         (имитирует Kodak T-Grain: менее равномерный, более органичный)
   b. Масштабируй: noiseVal = noise * grain.intensity * 255
   c. Применяй с весами каналов (аддитивно, как cv2.add):
      data[i]   = clamp(data[i]   + noiseVal * grain.r, 0, 255)
      data[i+1] = clamp(data[i+1] + noiseVal * grain.g, 0, 255)
      data[i+2] = clamp(data[i+2] + noiseVal * grain.b, 0, 255)
      (data[i+3] — альфа, не трогать)
3. Если grain.size > 1.0:
   - Зерно кластеризуй: вместо per-pixel noise, генерируй на downscaled grid
   - Способ: рисуй noise в offscreenCanvas размером floor(W/size) × floor(H/size),
     затем drawImage обратно на размер W×H через OffscreenCanvas.
   - Это создаёт visible grain clusters как на плёнке.
4. putImageData обратно.
```

`triangleRandom()`:
```typescript
function triangleRandom(): number {
  return (Math.random() + Math.random()) / 2
}
```

`clamp`:
```typescript
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}
```

**Важно:** grain.intensity на Canvas нужно масштабировать чуть агрессивнее чем в Python, потому что Canvas работает в [0,255] уже, а Python `noise_parameter` обычно передаётся в диапазоне 30-60. Множитель: `noiseVal = noise * grain.intensity * 220` (подобрано по визуальному совпадению с Python-результатом при intensity ≈ 0.010).

---

### 3. Алгоритмические пресеты `applyAlgo(ctx, canvas, algoType: AlgoType)`

Применяется ПОСЛЕ bake CSS filter, ДО grain. Используй `getImageData/putImageData`.

#### `orthochrom`
```
Имитация орфохроматической плёнки: только красный канал → grayscale, высокий контраст.
Для каждого пикселя:
  lum = data[i] * 0.90 + data[i+1] * 0.06 + data[i+2] * 0.04  // R-heavy weighting
  lum = clamp((lum - 128) * 1.55 + 128, 0, 255)                // S-curve contrast
  data[i] = data[i+1] = data[i+2] = lum
```

#### `ultramax`
```
Имитация Kodak Ultramax 400: тёплый сдвиг +500K, насыщенность ↑, контраст ↑.
Для каждого пикселя:
  r = clamp(data[i]   * 1.08 + 12,  0, 255)   // красный вверх + тёплый offset
  g = clamp(data[i+1] * 1.02,        0, 255)   // зелёный чуть вверх
  b = clamp(data[i+2] * 0.85 - 6,   0, 255)   // синий вниз
  // Контраст через S-curve:
  r = clamp((r - 128) * 1.10 + 128, 0, 255)
  g = clamp((g - 128) * 1.08 + 128, 0, 255)
  b = clamp((b - 128) * 1.10 + 128, 0, 255)
  data[i]=r; data[i+1]=g; data[i+2]=b
```

#### `vision_t`
```
Имитация Kodak Vision3: холодный сдвиг -500K, мягкий контраст, защита светов.
Для каждого пикселя:
  r = clamp(data[i]   * 0.88 - 8,  0, 255)    // красный вниз
  g = clamp(data[i+1] * 0.97,       0, 255)    // зелёный почти не трогаем
  b = clamp(data[i+2] * 1.14 + 10, 0, 255)    // синий вверх + offset
  // Мягкий S-curve (menее агрессивный чем ultramax):
  r = clamp((r - 128) * 0.95 + 128, 0, 255)
  g = clamp((g - 128) * 0.95 + 128, 0, 255)
  b = clamp((b - 128) * 0.95 + 128, 0, 255)
  data[i]=r; data[i+1]=g; data[i+2]=b
```

---

### 4. Световые утечки `applyFlare(ctx, canvas, flareType: FlareType)`

**Процедурная генерация — без внешних PNG файлов.**

Эквивалент Python `add_flare()` — аддитивное смешение (screen blend).

```typescript
type FlareType = 'none' | 'leak_warm' | 'leak_cool' | 'edge_burn' | 'streak'
```

Реализуй каждый тип через Canvas gradients с `globalCompositeOperation: 'screen'`:

#### `leak_warm` — тёплая утечка в левом верхнем углу
```
Создай offscreenCanvas W×H.
ctx.globalCompositeOperation = 'screen'
Нарисуй radialGradient:
  center: (0, 0)
  r0: 0, r1: W * 0.65
  stop 0.0: rgba(200, 140, 60, 0.55)
  stop 0.5: rgba(180, 100, 30, 0.20)
  stop 1.0: rgba(0, 0, 0, 0)
Добавь второй softer слой:
  radialGradient center (W*0.1, 0), r1: W*0.45
  stop 0.0: rgba(255, 200, 100, 0.20)
  stop 1.0: rgba(0,0,0,0)
Нанеси на основной canvas через drawImage с 'screen'
```

#### `leak_cool` — холодная утечка снизу справа
```
radialGradient center (W, H), r1: W * 0.7
stop 0.0: rgba(60, 100, 200, 0.45)
stop 0.4: rgba(40, 80, 180, 0.15)
stop 1.0: rgba(0, 0, 0, 0)
```

#### `edge_burn` — тёмный виньет по краям (экспозиционный бёрн)
```
ВНИМАНИЕ: это MULTIPLY, не screen.
ctx.globalCompositeOperation = 'multiply'
radialGradient center (W/2, H/2):
  r0: W*0.3, r1: W*0.72
  stop 0.0: rgba(255,255,255,0)  // прозрачный центр
  stop 1.0: rgba(30, 20, 15, 0.75)  // тёмный тёплый край
```

#### `streak` — горизонтальная полоса света (cinematographic streak)
```
ctx.globalCompositeOperation = 'screen'
linearGradient from (0, H*0.45) to (0, H*0.55)
stop 0.0: rgba(0,0,0,0)
stop 0.5: rgba(210, 180, 130, 0.18)
stop 1.0: rgba(0,0,0,0)
// Добавь несколько вертикальных полос разной непрозрачности для органичности:
linearGradient from (W*0.2, 0) to (W*0.3, 0):
  rgba(255,230,180,0.08) → rgba(0,0,0,0)
```

**Применение:** после grain, на отдельном offscreenCanvas (чтобы не повреждать ImageData), затем drawImage на основной canvas.

---

### 5. Обновить пайплайн `capture()`

Полный порядок операций:

```typescript
async function capture() {
  const video  = videoRef.current
  const canvas = canvasRef.current
  if (!video || !canvas) return

  const size = Math.min(video.videoWidth, video.videoHeight)
  if (!size) return

  canvas.width  = size
  canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // ── 1. Bake CSS filter (LUT simulation) ────────────────────────────────────
  if (preset.filter !== 'none') ctx.filter = preset.filter
  const ox = (video.videoWidth  - size) / 2
  const oy = (video.videoHeight - size) / 2
  ctx.drawImage(video, ox, oy, size, size, 0, 0, size, size)
  ctx.filter = 'none'  // сбросить после drawImage

  // ── 2. Алго-пресет (если задан) ───────────────────────────────────────────
  if (preset.algoType) {
    applyAlgo(ctx, canvas, preset.algoType)
  }

  // ── 3. Зерно плёнки ───────────────────────────────────────────────────────
  applyGrain(ctx, canvas, preset.grain)

  // ── 4. Световая утечка (если выбрана) ────────────────────────────────────
  if (selectedFlare !== 'none') {
    applyFlare(ctx, canvas, selectedFlare)
  }

  // ── 5. Экспорт ────────────────────────────────────────────────────────────
  canvas.toBlob(blob => {
    if (!blob) return
    setPhotoBlob(blob)
    setPreviewUrl(URL.createObjectURL(blob))
    streamRef.current?.getTracks().forEach(t => t.stop())
    setPhase('preview')
  }, 'image/jpeg', 0.92)
}
```

Добавить state: `const [selectedFlare, setSelectedFlare] = useState<FlareType>('none')`

---

### 6. UI для световых утечек в viewfinder

Добавить в bottom panel (перед пресетами плёнки) небольшой ряд кнопок утечек:

```tsx
// Над film presets strip:
<div style={{ display: 'flex', gap: 8, padding: '0 16px', alignItems: 'center' }}>
  <span style={{ color: '#555', fontSize: 11, fontWeight: 700, letterSpacing: 0.5 }}>СВЕТ</span>
  {(['none', 'leak_warm', 'leak_cool', 'edge_burn', 'streak'] as FlareType[]).map(f => {
    const labels: Record<FlareType, string> = {
      none: '∅', leak_warm: '🔥', leak_cool: '❄️', edge_burn: '◎', streak: '—'
    }
    const active = selectedFlare === f
    return (
      <button key={f} onClick={() => setSelectedFlare(f)} style={{
        width: 36, height: 36, borderRadius: 18,
        border: `${active ? 2 : 1}px solid ${active ? 'var(--amber)' : '#333'}`,
        background: active ? 'rgba(196,168,130,0.15)' : 'transparent',
        color: active ? 'var(--amber)' : '#555',
        fontSize: 16, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {labels[f]}
      </button>
    )
  })}
</div>
```

---

### 7. Preview страница — показать зерно и утечку текстом

На preview странице под preset badge добавить метку:

```tsx
{/* Processing info */}
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '6px 16px' }}>
  {preset.id !== 'none' && (
    <span style={{ color: '#555', fontSize: 11 }}>
      {preset.name} · grain {Math.round(preset.grain.intensity * 1000)}
    </span>
  )}
  {selectedFlare !== 'none' && (
    <span style={{ color: '#555', fontSize: 11 }}>· {selectedFlare}</span>
  )}
</div>
```

---

## Технические требования

### TypeScript
- Нет `any` типов (кроме `window as unknown as ...` при необходимости)
- Все функции типизированы: `applyGrain`, `applyAlgo`, `applyFlare` возвращают `void`
- `GrainConfig`, `AlgoType`, `FlareType` — экспортировать не нужно, достаточно локальных типов

### Canvas
- `getContext('2d', { willReadFrequently: true })` — обязательно для частых `getImageData`
- Для `applyGrain` со `size > 1.0` — использовать `OffscreenCanvas`:
  ```typescript
  const small = new OffscreenCanvas(Math.floor(W / grain.size), Math.floor(H / grain.size))
  const smallCtx = small.getContext('2d')!
  // ... draw noise on small canvas ...
  ctx.drawImage(small, 0, 0, W, H)  // upscale → cluster effect
  ```
- Для flare — отдельный `OffscreenCanvas` того же размера, drawImage с globalCompositeOperation на main canvas

### Производительность
- Для изображений > 1080px — grain можно применять на половинном разрешении и upscale (уже заложено в size clustering)
- `applyAlgo` и `applyGrain` должны завершаться < 200ms на iPhone 12 / Pixel 9a (размер 1080×1080 → ~3.5M операций — это нормально для JS)

### Без новых зависимостей
- Только `Canvas 2D API` — встроен в браузер
- Не добавлять npm пакеты

---

## Порядок выполнения

1. Прочитай `src/pages/UploadPage.tsx` полностью
2. Добавь типы `GrainConfig`, `AlgoType`, `FlareType` в начало файла
3. Замени `FilmPreset` интерфейс и `FILM_PRESETS` массив (точные grain значения из промпта)
4. Реализуй функцию `triangleRandom()` и `clamp()`
5. Реализуй `applyGrain(ctx, canvas, grain)` с поддержкой size clustering через OffscreenCanvas
6. Реализуй `applyAlgo(ctx, canvas, algoType)` — три кейса
7. Реализуй `applyFlare(ctx, canvas, flareType)` — четыре кейса + 'none'
8. Обнови `capture()` — добавь async и все 4 шага пайплайна
9. Добавь state `selectedFlare`
10. Добавь UI кнопок утечек в viewfinder (над film strip)
11. Добавь processing info на preview странице
12. `npm run build` — 0 ошибок TypeScript
13. Сообщи финальный список изменений

---

## Критерии успеха

- [ ] `npm run build` — 0 TypeScript ошибок
- [ ] 13 пресетов (включая orthochrom, ultramax, vision_t)
- [ ] Зерно видно на фото после capture — отличается для разных пресетов (warm vs cold)
- [ ] Kodak и Vision T используют T-grain (треугольное распределение) — зерно органичнее
- [ ] Orthochrom даёт Ч/Б с резким контрастом
- [ ] Ultramax — заметный тёплый сдвиг
- [ ] Vision T — заметный холодный сдвиг, мягкий контраст  
- [ ] leak_warm — видимый оранжевый gradient сверху-слева
- [ ] edge_burn — тёмный виньет по краям
- [ ] streak — тонкая горизонтальная полоса
- [ ] Viewfinder по-прежнему показывает CSS-filter preview (живой)
- [ ] capture() применяет grain ПОСЛЕ bake, flare ПОСЛЕДНИМ

---

## Справка: где что лежит

```
telegram-webapp/
  src/
    pages/
      UploadPage.tsx      ← ТОЛЬКО ЭТОТ ФАЙЛ РЕДАКТИРУЙ
    lib/
      types.ts            ← ReactionType, EMOTIONS (не трогай)
      supabase.ts         ← не трогай
    contexts/
      AuthContext.tsx     ← не трогай
```

Дополнительный контекст по мобильному приложению (если нужно):
- `../mobile/src/constants/filmPresets.ts` — оригинальные grain конфиги (уже перенесены в промпт)
- `../antigram_image_back-main/src/base/helpers.py` — Python алгоритмы (уже перенесены в промпт)
