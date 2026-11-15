import { useEffect, useState } from 'react'
import type { ToastMessage } from '../hooks/usePlanner'

export function Toast({ message }: { message: ToastMessage | null }) {
  const [hiddenId, setHiddenId] = useState<number | null>(null)
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setHiddenId(message.id), 2600)
    return () => clearTimeout(timer)
  }, [message])
  const show = message !== null && message.id !== hiddenId
  return <div className={`toast ${show ? 'show' : ''}`} role="status" aria-live="polite">{message?.text}</div>
}
