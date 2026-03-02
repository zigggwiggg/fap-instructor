/* ── Network & Device Utilities ── */

export type ConnectionQuality = 'fast' | 'medium' | 'slow' | 'offline'

/** Detect if the user's device is mobile */
export function isMobile(): boolean {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|webOS|BlackBerry/i.test(navigator.userAgent)
}

/** Detect if the device is a small phone (< 480px) */
export function isSmallPhone(): boolean {
    if (typeof window === 'undefined') return false
    return window.innerWidth <= 480
}

/** Get current connection quality based on Network Information API + fallbacks */
export function getConnectionQuality(): ConnectionQuality {
    if (typeof navigator === 'undefined') return 'fast'

    // Navigator offline check
    if (!navigator.onLine) return 'offline'

    // Use Network Information API if available
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection
    if (conn) {
        // effectiveType: 'slow-2g', '2g', '3g', '4g'
        const eff = conn.effectiveType
        if (eff === 'slow-2g' || eff === '2g') return 'slow'
        if (eff === '3g') return 'medium'
        if (eff === '4g') return 'fast'

        // downlink in Mbps
        if (conn.downlink !== undefined) {
            if (conn.downlink < 0.5) return 'slow'
            if (conn.downlink < 2) return 'medium'
            return 'fast'
        }

        // saveData flag
        if (conn.saveData) return 'slow'
    }

    return 'fast' // Default assumption
}

/** Should we prefer SD quality? (slow net OR mobile with data saver) */
export function shouldUseSD(): boolean {
    const quality = getConnectionQuality()
    if (quality === 'slow' || quality === 'offline') return true

    // Check for data saver mode
    const conn = (navigator as any).connection
    if (conn?.saveData) return true

    return false
}

/** Get recommended preload count based on network */
export function getPreloadCount(): number {
    const quality = getConnectionQuality()
    if (quality === 'slow') return 1
    if (quality === 'medium') return 2
    if (isMobile()) return 2
    return 3  // Desktop fast = 3 preloaded
}

/** Get recommended videos to fetch per niche based on network */
export function getPerNicheCount(): number {
    const quality = getConnectionQuality()
    if (quality === 'slow') return 10
    if (quality === 'medium') return 20
    return 30 // Desktop fast = 30 videos per fetch
}

/** Listen for connection quality changes */
export function onConnectionChange(callback: (quality: ConnectionQuality) => void): () => void {
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection

    function handler() {
        callback(getConnectionQuality())
    }

    if (conn) {
        conn.addEventListener('change', handler)
    }
    window.addEventListener('online', handler)
    window.addEventListener('offline', handler)

    return () => {
        if (conn) conn.removeEventListener('change', handler)
        window.removeEventListener('online', handler)
        window.removeEventListener('offline', handler)
    }
}
