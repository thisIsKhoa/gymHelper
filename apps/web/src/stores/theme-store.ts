import { useEffect } from 'react'
import { create } from 'zustand'

type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark'
  }

  const stored = window.localStorage.getItem('gymhelper-theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => set({ theme }),
  toggleTheme: () =>
    set((state) => ({
      theme: state.theme === 'dark' ? 'light' : 'dark',
    })),
}))

export function useApplyTheme() {
  const theme = useThemeStore((state) => state.theme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('gymhelper-theme', theme)
  }, [theme])
}
