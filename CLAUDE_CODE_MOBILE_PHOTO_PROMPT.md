# ANTIGRAM Mobile — Photo Processing Pipeline (Claude Code / Opus)

## Контекст

Expo + React Native приложение. Папка: `/Users/maksimilin/Desktop/ANTIGRAM/mobile/`

В отличие от Telegram webapp, у мобильного приложения есть реальные `.cube` LUT-файлы и `expo-gl` — значит делаем GPU-обработку через WebGL шейдер, как в настоящем профессиональном редакторе.

**Стек обработки:**
- LUT (цветокоррекция) → `expo-gl` + GLSL fragment shader (3D LUT lookup)
- Зерно + алго → `jpeg-js` pixel manipulation (тот же алгоритм что и Python бэкэнд)
- Нет Canvas API, нет CSS filter

---

## Доступные ресурсы в проекте

### .cube LUT файлы (реальные, не симуляция!)
```
assets/presets/agfa.cube
assets/presets/bleach.cube
assets/presets/cold.cube
assets/presets/fuji.cube
assets/presets/hc_bw.cube
assets/presets/kodak.cube
assets/presets/lc_bw.cube
assets/presets/slide.cube
assets/presets/technicolor.cube
assets/presets/warm.cube
```

### Установленные библиотеки (из package.json)
- `expo-gl` ~16.0.10 — WebGL для React Native
- `jpeg-js` ^0.4.4 — JPEG decode/encode с доступом к пикселям
- `expo-image-manipulator` ~14.0.8 — базовые трансформации
- `expo-file-system` ~19.0.23 — чтение/запись файлов
- `expo-camera` ~17.0.10 — камера
- `base64-arraybuffer` ^1.0.2 — конвертация

### Типы уже определены в `src/constants/filmPresets.ts`:
```typescript
type GrainConfig = {
  intensity: number   // 0–1
  size:      number   // 1.0 = мелкое, 2.5 = крупное
  shape:     'round' | 'tgrain'
  r: number; g: number; b: number
}
type AlgoType = 'orthochrom' | 'ultramax' | 'vision_t'
type FilmPreset = {
  id: string; name: string
  thumb?: number; cube?: number
  grain: GrainConfig
  algoType?: AlgoType
}
export const FILM_PRESETS: FilmPreset[]  // 13 пресетов уже определены
```

---

## Что нужно создать

### Файл 1: `src/lib/photoProcessor.ts`

Главный модуль обработки фото. Экспортирует одну функцию:

```typescript
export async function processPhoto(
  sourceUri: string,
  preset: FilmPreset,
  flareType?: FlareType,
): Promise<string>
// Принимает URI исходного фото (с камеры)
// Возвращает URI обработанного фото (tmpDir)
```

**Внутренний пайплайн:**
1. Прочитать файл → base64 → ArrayBuffer → jpeg-js decode → raw RGBA
2. Если `preset.algoType` → `applyAlgo(pixels, algoType)`
3. `applyGrain(pixels, width, height, preset.grain)`
4. Если `preset.cube` → `applyLUT(pixels, width, height, preset.cube)` через expo-gl
5. Если `flareType && flareType !== 'none'` → `applyFlare(glContext, flareType)`
6. jpeg-js encode → base64 → запись в tmpDir → вернуть URI

---

### Реализация каждого шага

#### Шаг 1: Decode / Encode через jpeg-js

```typescript
import * as FileSystem from 'expo-file-system'
import * as jpeg from 'jpeg-js'
import { decode as decodeBase64, encode as encodeBase64 } from 'base64-arraybuffer'

async function readImagePixels(uri: string): Promise<{
  data: Uint8ClampedArray
  width: number
  height: number
}> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  })
  const buffer = decodeBase64(base64)
  const raw = jpeg.decode(new Uint8Array(buffer), { useTArray: true, formatAsRGBA: true })
  return { data: new Uint8ClampedArray(raw.data), width: raw.width, height: raw.height }
}

async function writeImagePixels(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  quality = 92,
): Promise<string> {
  const encoded = jpeg.encode({ data: Buffer.from(data), width, height }, quality)
  const base64 = encodeBase64(encoded.data)
  const outputUri = FileSystem.cacheDirectory + `processed_${Date.now()}.jpg`
  await FileSystem.writeAsStringAsync(outputUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  })
  return outputUri
}
```

---

#### Шаг 2: applyGrain — порт Python add_noise()

```
Python оригинал:
  noise = (noise_parameter * np.random.random(img.shape)).clip(0, 255)
  noise = cv2.cvtColor(noise, cv2.COLOR_BGR2GRAY)   // grayscale scalar
  noise_3d = cv2.merge([noise, noise, noise])
  noisy = cv2.add(img, noise_3d)                    // аддитивное смешение
```

TypeScript реализация (RGBA pixels, шаг 4):

```typescript
function triangleRandom(): number {
  return (Math.random() + Math.random()) / 2  // T-grain: более органичное
}

function clamp(v: number): number {
  return Math.max(0, Math.min(255, v))
}

function applyGrain(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  grain: GrainConfig,
): void {
  const scale = grain.intensity * 220  // масштаб: 220 подобран под диапазон 0.005–0.022

  if (grain.size <= 1.0) {
    // Попиксельный шум (мелкое зерно)
    for (let i = 0; i < data.length; i += 4) {
      const rnd = grain.shape === 'tgrain' ? triangleRandom() : Math.random()
      const n = rnd * scale
      data[i]     = clamp(data[i]     + n * grain.r)
      data[i + 1] = clamp(data[i + 1] + n * grain.g)
      data[i + 2] = clamp(data[i + 2] + n * grain.b)
      // data[i+3] = alpha, не трогаем
    }
  } else {
    // Кластерное зерно (size > 1.0): генерируем на сетке, размываем по кластерам
    const cellW = Math.ceil(grain.size)
    const cellH = Math.ceil(grain.size)

    // Генерируем шум на уменьшенной сетке
    const gridW = Math.ceil(width  / cellW)
    const gridH = Math.ceil(height / cellH)
    const noiseGrid = new Float32Array(gridW * gridH)
    for (let k = 0; k < noiseGrid.length; k++) {
      const rnd = grain.shape === 'tgrain' ? triangleRandom() : Math.random()
      noiseGrid[k] = rnd * scale
    }

    // Применяем шум к каждому пикселю из ближайшей ячейки сетки
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gx = Math.min(Math.floor(x / cellW), gridW - 1)
        const gy = Math.min(Math.floor(y / cellH), gridH - 1)
        const n = noiseGrid[gy * gridW + gx]
        const i = (y * width + x) * 4
        data[i]     = clamp(data[i]     + n * grain.r)
        data[i + 1] = clamp(data[i + 1] + n * grain.g)
        data[i + 2] = clamp(data[i + 2] + n * grain.b)
      }
    }
  }
}
```

---

#### Шаг 3: applyAlgo — алгоритмические пресеты

```typescript
type AlgoType = 'orthochrom' | 'ultramax' | 'vision_t'

function applyAlgo(data: Uint8ClampedArray, algoType: AlgoType): void {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2]

    if (algoType === 'orthochrom') {
      // Орфохромная плёнка: красный канал dominates → Ч/Б с резким контрастом
      const lum = r * 0.90 + g * 0.06 + b * 0.04
      const c = clamp((lum - 128) * 1.55 + 128)
      data[i] = data[i + 1] = data[i + 2] = c

    } else if (algoType === 'ultramax') {
      // Kodak Ultramax: тёплый +500K, контрастный
      let nr = clamp(r * 1.08 + 12)
      let ng = clamp(g * 1.02)
      let nb = clamp(b * 0.85 - 6)
      data[i]     = clamp((nr - 128) * 1.10 + 128)
      data[i + 1] = clamp((ng - 128) * 1.08 + 128)
      data[i + 2] = clamp((nb - 128) * 1.10 + 128)

    } else if (algoType === 'vision_t') {
      // Kodak Vision3: холодный -500K, мягкий контраст
      let nr = clamp(r * 0.88 - 8)
      let ng = clamp(g * 0.97)
      let nb = clamp(b * 1.14 + 10)
      data[i]     = clamp((nr - 128) * 0.95 + 128)
      data[i + 1] = clamp((ng - 128) * 0.95 + 128)
      data[i + 2] = clamp((nb - 128) * 0.95 + 128)
    }
  }
}
```

---

#### Шаг 4: applyLUT — реальный .cube через expo-gl GLSL

Это самая важная часть — **реальная 3D LUT** через WebGL.

**Алгоритм:**
1. Прочитать `.cube` файл (expo-asset + expo-file-system)
2. Распарсить — извлечь размер (`LUT_3D_SIZE`) и значения RGB triplets
3. Создать 3D текстуру или 2D strip texture в OpenGL
4. Применить к изображению через GLSL fragment shader

**4.1 Парсинг .cube файла:**

```typescript
interface Lut3D {
  size: number      // обычно 32 или 64
  data: Float32Array  // size^3 * 3 значений RGB [0, 1]
}

async function parseCubeFile(cubeAssetModule: number): Promise<Lut3D> {
  // Получить URI ассета через expo-asset
  const asset = await Asset.fromModule(cubeAssetModule).downloadAsync()
  const text = await FileSystem.readAsStringAsync(asset.localUri!)

  let size = 32
  const values: number[] = []

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.startsWith('#') || trimmed === '') continue
    if (trimmed.startsWith('LUT_3D_SIZE')) {
      size = parseInt(trimmed.split(/\s+/)[1])
      continue
    }
    if (trimmed.startsWith('TITLE') || trimmed.startsWith('DOMAIN')) continue
    const parts = trimmed.split(/\s+/)
    if (parts.length >= 3) {
      values.push(parseFloat(parts[0]), parseFloat(parts[1]), parseFloat(parts[2]))
    }
  }

  return { size, data: new Float32Array(values) }
}
```

**4.2 Применение LUT через expo-gl:**

expo-gl даёт WebGL контекст в React Native. Используем offscreen render через `GLView.createContextAsync()`:

```typescript
import { GLView } from 'expo-gl'
import { Asset } from 'expo-asset'

async function applyLUT(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  cubeAssetModule: number,
): Promise<void> {
  // Парсим LUT
  const lut = await parseCubeFile(cubeAssetModule)

  // Создаём offscreen GL контекст
  const gl = await GLView.createContextAsync()

  // Загружаем исходное изображение как текстуру
  const imgTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, imgTex)
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGBA,
    width, height, 0,
    gl.RGBA, gl.UNSIGNED_BYTE,
    new Uint8Array(data.buffer),
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  // LUT как 2D strip текстура (size*size x size, RGB)
  // В WebGL ES2 нет gl.TEXTURE_3D — используем 2D strip
  const lutSize = lut.size
  const lutWidth = lutSize * lutSize
  const lutHeight = lutSize
  const lutData = new Uint8Array(lutWidth * lutHeight * 3)
  for (let i = 0; i < lut.data.length / 3; i++) {
    lutData[i * 3]     = Math.round(lut.data[i * 3]     * 255)
    lutData[i * 3 + 1] = Math.round(lut.data[i * 3 + 1] * 255)
    lutData[i * 3 + 2] = Math.round(lut.data[i * 3 + 2] * 255)
  }
  const lutTex = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, lutTex)
  gl.texImage2D(
    gl.TEXTURE_2D, 0, gl.RGB,
    lutWidth, lutHeight, 0,
    gl.RGB, gl.UNSIGNED_BYTE,
    lutData,
  )
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  // Vertex shader — простой fullscreen quad
  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `

  // Fragment shader — 3D LUT lookup через 2D strip текстуру
  const fsSource = `
    precision mediump float;
    uniform sampler2D u_image;
    uniform sampler2D u_lut;
    uniform float u_lutSize;
    varying vec2 v_texCoord;

    vec3 applyLut(vec3 color) {
      float blueSlice = color.b * (u_lutSize - 1.0);
      float sliceIndex = floor(blueSlice);
      float sliceFract = fract(blueSlice);

      // Позиция в 2D strip LUT текстуре
      vec2 uv1;
      uv1.x = (sliceIndex + color.r * (u_lutSize - 1.0) / u_lutSize + 0.5 / u_lutSize) / u_lutSize;
      uv1.y = (color.g * (u_lutSize - 1.0) + 0.5) / u_lutSize;

      vec2 uv2;
      uv2.x = ((sliceIndex + 1.0) + color.r * (u_lutSize - 1.0) / u_lutSize + 0.5 / u_lutSize) / u_lutSize;
      uv2.y = uv1.y;

      vec3 c1 = texture2D(u_lut, uv1).rgb;
      vec3 c2 = texture2D(u_lut, uv2).rgb;
      return mix(c1, c2, sliceFract);
    }

    void main() {
      vec4 color = texture2D(u_image, v_texCoord);
      gl_FragColor = vec4(applyLut(color.rgb), color.a);
    }
  `

  // Компилируем шейдерную программу
  function compileShader(type: number, source: string): WebGLShader {
    const shader = gl.createShader(type)!
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    return shader
  }

  const vs = compileShader(gl.VERTEX_SHADER, vsSource)
  const fs = compileShader(gl.FRAGMENT_SHADER, fsSource)
  const program = gl.createProgram()!
  gl.attachShader(program, vs)
  gl.attachShader(program, fs)
  gl.linkProgram(program)
  gl.useProgram(program)

  // Uniforms
  gl.uniform1i(gl.getUniformLocation(program, 'u_image'), 0)
  gl.uniform1i(gl.getUniformLocation(program, 'u_lut'),   1)
  gl.uniform1f(gl.getUniformLocation(program, 'u_lutSize'), lutSize)

  // Fullscreen quad
  const posBuffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1, -1,  1, -1,  -1,  1,
    -1,  1,  1, -1,   1,  1,
  ]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'a_position')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // Рендер в framebuffer
  const fb = gl.createFramebuffer()
  const outTex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, outTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, outTex, 0)

  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, imgTex)

  gl.viewport(0, 0, width, height)
  gl.drawArrays(gl.TRIANGLES, 0, 6)

  // Читаем результат обратно в data[]
  const result = new Uint8Array(width * height * 4)
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, result)

  // WebGL возвращает изображение перевёрнутым по Y — исправляем
  for (let y = 0; y < Math.floor(height / 2); y++) {
    const top = y * width * 4
    const bot = (height - 1 - y) * width * 4
    for (let x = 0; x < width * 4; x++) {
      const tmp = result[top + x]
      result[top + x] = result[bot + x]
      result[bot + x] = tmp
    }
  }

  // Копируем в исходный буфер
  for (let i = 0; i < data.length; i++) data[i] = result[i]

  // Cleanup
  gl.deleteTexture(imgTex)
  gl.deleteTexture(lutTex)
  gl.deleteTexture(outTex)
  gl.deleteFramebuffer(fb)
  gl.deleteProgram(program)
  ;(gl as unknown as { endFrameEXP?: () => void }).endFrameEXP?.()
}
```

---

#### Шаг 5: applyFlare — процедурные световые утечки

Для мобильного приложения flare рисуем прямо в пикселях через pixel manipulation (без Canvas). Алгоритм: screen blend = `result = 1 - (1 - src) * (1 - flare)` = аддитивный.

```typescript
type FlareType = 'none' | 'leak_warm' | 'leak_cool' | 'edge_burn' | 'streak'

function applyFlare(data: Uint8ClampedArray, width: number, height: number, flareType: FlareType): void {
  if (flareType === 'none') return

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4
      const nx = x / width   // 0..1
      const ny = y / height  // 0..1

      let fr = 0, fg = 0, fb = 0

      if (flareType === 'leak_warm') {
        // Оранжевая утечка из левого верхнего угла
        const dist = Math.sqrt(nx * nx + ny * ny)
        const intensity = Math.max(0, 1 - dist / 0.65)
        const glow = intensity * intensity * 0.55
        fr = 200 * glow
        fg = 140 * glow
        fb =  60 * glow

      } else if (flareType === 'leak_cool') {
        // Синяя утечка из правого нижнего угла
        const dx = 1 - nx, dy = 1 - ny
        const dist = Math.sqrt(dx * dx + dy * dy)
        const intensity = Math.max(0, 1 - dist / 0.70)
        const glow = intensity * intensity * 0.45
        fr =  60 * glow
        fg = 100 * glow
        fb = 200 * glow

      } else if (flareType === 'edge_burn') {
        // Тёмный виньет по краям (multiply, не screen)
        const cx = nx - 0.5, cy = ny - 0.5
        const dist = Math.sqrt(cx * cx + cy * cy)
        const t = Math.max(0, (dist - 0.30) / 0.22)
        const burn = t * t * 0.75
        // Multiply blend: result = src * (1 - burn)
        const i = idx
        data[i]     = clamp(data[i]     * (1 - burn))
        data[i + 1] = clamp(data[i + 1] * (1 - burn * 0.85))
        data[i + 2] = clamp(data[i + 2] * (1 - burn * 0.70))
        continue  // skip screen blend

      } else if (flareType === 'streak') {
        // Горизонтальная полоса света посередине
        const bandY = Math.abs(ny - 0.48)
        const intensity = Math.max(0, 1 - bandY / 0.06) * 0.18
        fr = 210 * intensity
        fg = 180 * intensity
        fb = 130 * intensity
      }

      // Screen blend: result = 255 - (255-src)*(255-flare)/255
      data[idx]     = clamp(255 - (255 - data[idx])     * (255 - fr) / 255)
      data[idx + 1] = clamp(255 - (255 - data[idx + 1]) * (255 - fg) / 255)
      data[idx + 2] = clamp(255 - (255 - data[idx + 2]) * (255 - fb) / 255)
    }
  }
}
```

---

### Файл 2: Найти камерный экран и добавить обработку

Найди файл с камерой (вероятно `src/screens/CameraScreen.tsx` или аналог). Добавь в него:

1. State: `selectedFlare: FlareType = 'none'`
2. При нажатии кнопки съёмки: `processPhoto(photoUri, preset, selectedFlare)` → получи URI обработанного фото
3. Показывай превью с обработанным URI
4. Добавь UI выбора флейра (кнопки в нижней панели)
5. Для превью в viewfinder (реалтайм) — используй простое CSS-like approach:
   - Параметры зерна, алго, и flare применяются только ПОСЛЕ съёмки (не в реалтайм)
   - Цветокоррекцию для preview viewfinder покажи через React Native `Image` с `tintColor` или просто текстом пресета

**ВАЖНО:** Не применяй `applyLUT` в реалтайм к видеопотоку — это слишком тяжело. LUT применяется только после capture к статичному фото.

---

### Файл 3: `src/lib/photoProcessor.ts` — полная функция processPhoto

```typescript
import * as FileSystem from 'expo-file-system'
import * as jpeg from 'jpeg-js'
import { decode as decodeBase64, encode as encodeBase64 } from 'base64-arraybuffer'
import { Asset } from 'expo-asset'
import { GLView } from 'expo-gl'
import type { FilmPreset } from '../constants/filmPresets'

export type FlareType = 'none' | 'leak_warm' | 'leak_cool' | 'edge_burn' | 'streak'

export async function processPhoto(
  sourceUri: string,
  preset: FilmPreset,
  flareType: FlareType = 'none',
): Promise<string> {
  // 1. Decode
  const { data, width, height } = await readImagePixels(sourceUri)

  // 2. Algo preset (pixel math)
  if (preset.algoType) {
    applyAlgo(data, preset.algoType)
  }

  // 3. Grain (pixel math)
  applyGrain(data, width, height, preset.grain)

  // 4. LUT (GPU via expo-gl) — только если есть .cube файл
  if (preset.cube) {
    await applyLUT(data, width, height, preset.cube)
  }

  // 5. Flare overlay
  if (flareType !== 'none') {
    applyFlare(data, width, height, flareType)
  }

  // 6. Encode & write
  return writeImagePixels(data, width, height)
}
```

---

## Порядок выполнения

1. Прочитай `src/constants/filmPresets.ts` — убедись что типы совпадают
2. Найди камерный экран (`CameraScreen`, `UploadScreen`, или аналог) — прочитай полностью
3. Найди где используется `expo-camera` — там и будет capture
4. Создай `src/lib/photoProcessor.ts` с полной реализацией (все функции выше)
5. Подключи `processPhoto` в камерном экране:
   - После `takePictureAsync()` → `const processedUri = await processPhoto(photo.uri, preset, flare)`
   - Используй `processedUri` для preview и загрузки в Supabase
6. Добавь UI флейра (5 кнопок: ∅ 🔥 ❄️ ◎ —) в bottom panel камерного экрана
7. Убедись что `Asset.fromModule(preset.cube).downloadAsync()` работает для .cube файлов
   - `.cube` файлы не являются стандартными ассетами Expo — может потребоваться добавить расширение в `metro.config.js`:
   ```js
   module.exports = {
     resolver: {
       assetExts: [...require('expo/metro-config').getDefaultConfig(__dirname).resolver.assetExts, 'cube'],
     },
   }
   ```
8. Протестируй: `expo start` → снять фото → применить Kodak пресет → проверить что цвета изменились
9. Сообщи список изменённых файлов

---

## Технические ограничения

- Не добавляй новые npm зависимости (все нужные уже есть)
- `expo-gl` версия ~16 использует WebGL ES2 (нет `TEXTURE_3D`) → LUT через 2D strip текстуру (уже учтено выше)
- `jpeg-js` работает синхронно → оберни вызовы в `requestAnimationFrame` или `setTimeout` если UI фризит
- `GLView.createContextAsync()` создаёт headless GL контекст — не требует рендеринга на экран
- Обработка 1080×1080px в JS займёт ~300-800ms на iPhone 12 / Pixel 9a — это нормально, покажи индикатор загрузки

---

## Критерии успеха

- [ ] Фото после съёмки обрабатывается и preview показывает результат
- [ ] Kodak пресет: тёплый сдвиг, T-grain зерно видно
- [ ] Cold пресет: холодный сдвиг, синеватое зерно
- [ ] HC B&W пресет: настоящий чёрно-белый с зерном
- [ ] Orthochrom: контрастный Ч/Б через R-канал
- [ ] leak_warm: оранжевое свечение в левом углу
- [ ] edge_burn: тёмный виньет
- [ ] LUT применяется (цвета соответствуют .cube файлу)
- [ ] Приложение не крашится при обработке
- [ ] Загрузка в Supabase работает с обработанным фото
