/* ── Task Display Component ── */

import { useTaskStore } from '../stores/taskStore'
import { useEffect, useState } from 'react'

export default function TaskDisplay() {
    const { currentAction, isExecuting, completeAction } = useTaskStore()
    const [timeLeft, setTimeLeft] = useState(0)
    const [isVisible, setIsVisible] = useState(false)

    // Animate in when a new action appears
    useEffect(() => {
        if (currentAction) {
            setIsVisible(false)
            requestAnimationFrame(() => {
                requestAnimationFrame(() => setIsVisible(true))
            })
        } else {
            setIsVisible(false)
        }
    }, [currentAction])

    // Countdown timer for active tasks
    useEffect(() => {
        if (!isExecuting || !currentAction) return

        setTimeLeft(30) // 30 second timer per task
        const interval = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(interval)
                    completeAction({ completed: true, skipped: false, duration: 30 })
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(interval)
    }, [currentAction, isExecuting, completeAction])

    if (!currentAction) {
        return null
    }

    return (
        <div
            className="card glass"
            style={{
                position: 'relative',
                overflow: 'hidden',
                opacity: isVisible ? 1 : 0,
                transform: isVisible ? 'translateY(0)' : 'translateY(16px)',
                transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                padding: '0.75rem',
                backgroundColor: 'rgba(10, 10, 10, 0.75)'
            }}
        >
            {/* ── Progress bar ── */}
            <div
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, var(--color-accent), var(--color-accent-secondary))',
                    width: `${(timeLeft / 30) * 100}%`,
                    transition: 'width 1s linear',
                    borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                }}
            />

            {/* ── Category Badge ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span
                    style={{
                        fontSize: '0.55rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: 'var(--color-accent)',
                        background: 'var(--color-accent-glow)',
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                    }}
                >
                    {currentAction.category}
                </span>
                <span
                    style={{
                        fontSize: '0.6rem',
                        color: 'var(--color-text-muted)',
                        fontFamily: 'var(--font-mono)',
                    }}
                >
                    {timeLeft}s
                </span>
            </div>

            {/* ── Action Content ── */}
            <h3
                style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    marginBottom: '2px',
                    color: 'var(--color-text-primary)',
                    lineHeight: 1.2
                }}
            >
                {currentAction.label}
            </h3>
            <p
                style={{
                    fontSize: '0.7rem',
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.3,
                    marginBottom: '8px',
                }}
            >
                {currentAction.description}
            </p>

        </div>
    )
}
