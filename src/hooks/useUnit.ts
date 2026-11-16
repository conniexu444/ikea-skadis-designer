import { useSyncExternalStore } from 'react'

export type Unit = 'cm' | 'in'

const UNIT_KEY = 'pegboard-unit'
const listeners = new Set<() => void>()
let current: Unit = (() => {
  try { return localStorage.getItem(UNIT_KEY) === 'in' ? 'in' : 'cm' } catch { return 'cm' }
})()

export function setUnit(next: Unit) {
  current = next
  try { localStorage.setItem(UNIT_KEY, next) } catch { /* storage unavailable */ }
  listeners.forEach(listener => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export const useUnit = () => useSyncExternalStore(subscribe, () => current)
