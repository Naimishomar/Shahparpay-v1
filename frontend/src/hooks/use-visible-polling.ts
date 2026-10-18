import { useEffect, useRef } from "react"

/**
 * Runs `load` now, then every `intervalMs` while the tab is visible, and once
 * more when the tab comes back. A hidden tab makes no requests at all, which is
 * where most polling traffic went.
 */
export function useVisiblePolling(load: () => void, intervalMs: number, enabled = true, runNow = true) {
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => {
    if (!enabled) return
    if (runNow) loadRef.current()
    const tick = () => { if (document.visibilityState === "visible") loadRef.current() }
    const timer = window.setInterval(tick, intervalMs)
    document.addEventListener("visibilitychange", tick)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener("visibilitychange", tick)
    }
  }, [intervalMs, enabled, runNow])
}
