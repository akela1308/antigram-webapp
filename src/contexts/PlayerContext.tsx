import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

export interface Track {
  id: string
  name: string
  src: string
}

function publicAsset(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`
}

const TRACKS: Track[] = [
  {
    id: '1',
    name: 'Faded Polaroid',
    src: publicAsset(`music/${encodeURIComponent('Faded Polaroid.mp3')}`),
  },
  {
    id: '2',
    name: 'Midnight at Caffè Noir',
    src: publicAsset(`music/${encodeURIComponent('Midnight at Caffè Noir.mp3')}`),
  },
  {
    id: '3',
    name: 'Reel of Rain',
    src: publicAsset(`music/${encodeURIComponent('Reel of Rain.mp3')}`),
  },
  {
    id: '4',
    name: 'Sepia Keybook',
    src: publicAsset(`music/${encodeURIComponent('Sepia Keybook.mp3')}`),
  },
  {
    id: '5',
    name: 'App',
    src: publicAsset(`music/${encodeURIComponent('APP.mp3')}`),
  },
  {
    id: '6',
    name: 'Value',
    src: publicAsset(`music/${encodeURIComponent('VALUE.mp3')}`),
  },
]

interface PlayerContextType {
  tracks: Track[]
  currentIndex: number
  isPlaying: boolean
  isLoading: boolean
  play: () => Promise<void>
  pause: () => Promise<void>
  toggle: () => Promise<void>
  next: () => Promise<void>
  prev: () => Promise<void>
}

const PlayerContext = createContext<PlayerContextType | null>(null)

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const currentIndexRef = useRef(0)

  useEffect(() => {
    currentIndexRef.current = currentIndex
  }, [currentIndex])

  useEffect(() => {
    return () => {
      const audio = audioRef.current
      if (!audio) return
      audio.pause()
      audio.src = ''
      audioRef.current = null
    }
  }, [])

  const loadAndPlay = useCallback(async (index: number) => {
    setIsLoading(true)

    const previousAudio = audioRef.current
    if (previousAudio) {
      previousAudio.pause()
      previousAudio.src = ''
      previousAudio.load()
    }

    const audio = new Audio(TRACKS[index].src)
    audio.preload = 'auto'
    audio.loop = false
    audio.addEventListener('ended', () => {
      const nextIndex = (index + 1) % TRACKS.length
      setCurrentIndex(nextIndex)
      void loadAndPlay(nextIndex)
    })
    audio.addEventListener('error', () => {
      setIsLoading(false)
      setIsPlaying(false)
    })

    audioRef.current = audio
    setCurrentIndex(index)

    try {
      await audio.play()
      setIsPlaying(true)
    } catch (error) {
      console.error('[MiniPlayer] play failed:', error)
      setIsPlaying(false)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const play = useCallback(async () => {
    const audio = audioRef.current
    if (audio) {
      setIsLoading(true)
      try {
        await audio.play()
        setIsPlaying(true)
      } catch (error) {
        console.error('[MiniPlayer] play failed:', error)
        setIsPlaying(false)
      } finally {
        setIsLoading(false)
      }
      return
    }

    await loadAndPlay(currentIndexRef.current)
  }, [loadAndPlay])

  const pause = useCallback(async () => {
    const audio = audioRef.current
    if (audio) {
      audio.pause()
      setIsPlaying(false)
    }
  }, [])

  const toggle = useCallback(async () => {
    if (isPlaying) {
      await pause()
      return
    }
    await play()
  }, [isPlaying, pause, play])

  const next = useCallback(async () => {
    const index = (currentIndexRef.current + 1) % TRACKS.length
    await loadAndPlay(index)
  }, [loadAndPlay])

  const prev = useCallback(async () => {
    const index = (currentIndexRef.current - 1 + TRACKS.length) % TRACKS.length
    await loadAndPlay(index)
  }, [loadAndPlay])

  return (
    <PlayerContext.Provider
      value={{
        tracks: TRACKS,
        currentIndex,
        isPlaying,
        isLoading,
        play,
        pause,
        toggle,
        next,
        prev,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const ctx = useContext(PlayerContext)
  if (!ctx) throw new Error('usePlayer must be inside PlayerProvider')
  return ctx
}
