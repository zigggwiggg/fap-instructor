/* ── Stats Page (Placeholder) ── */

import { useNavigate } from 'react-router-dom'
import { useTaskStore } from '../stores/taskStore'

export default function StatsPage() {
    const navigate = useNavigate()
    const { actionHistory } = useTaskStore()

    const completed = actionHistory.filter((h) => h.result.completed).length
    const skipped = actionHistory.filter((h) => h.result.skipped).length
    const totalDuration = actionHistory.reduce((sum, h) => sum + h.result.duration, 0)

    const stats = [
        { label: 'Tasks Completed', value: completed, color: 'var(--color-success)' },
        { label: 'Tasks Skipped', value: skipped, color: 'var(--color-danger)' },
        { label: 'Total Time', value: `${Math.floor(totalDuration / 60)}m ${totalDuration % 60}s`, color: 'var(--color-accent)' },
        { label: 'Completion Rate', value: completed + skipped > 0 ? `${Math.round((completed / (completed + skipped)) * 100)}%` : '0%', color: 'var(--color-accent-tertiary)' },
    ]

    return (
        <div
            style={{
                minHeight: '100vh',
                padding: '2rem',
                maxWidth: '800px',
                margin: '0 auto',
            }}
        >
            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h1
                    style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                    }}
                >
                    <span className="text-gradient">Session Stats</span>
                </h1>
                <button
                    onClick={() => navigate('/')}
                    style={{
                        background: 'none',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        color: 'var(--color-text-secondary)',
                        padding: '8px 16px',
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-accent)'
                        e.currentTarget.style.color = 'var(--color-text-primary)'
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--color-border)'
                        e.currentTarget.style.color = 'var(--color-text-secondary)'
                    }}
                >
                    ← Back
                </button>
            </div>

            {/* ── Stats Grid ── */}
            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '16px',
                    marginBottom: '2rem',
                }}
            >
                {stats.map((stat) => (
                    <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
                        <p
                            style={{
                                fontSize: '2rem',
                                fontWeight: 800,
                                fontFamily: 'var(--font-mono)',
                                color: stat.color,
                                marginBottom: '4px',
                            }}
                        >
                            {stat.value}
                        </p>
                        <p
                            style={{
                                fontSize: '0.75rem',
                                color: 'var(--color-text-muted)',
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                fontWeight: 600,
                            }}
                        >
                            {stat.label}
                        </p>
                    </div>
                ))}
            </div>

            {/* ── History Table ── */}
            {actionHistory.length > 0 && (
                <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                    <div
                        style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--color-border)',
                        }}
                    >
                        <h2
                            style={{
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: 'var(--color-text-primary)',
                            }}
                        >
                            Task History
                        </h2>
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                        {[...actionHistory].reverse().map((entry, i) => (
                            <div
                                key={i}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '12px 20px',
                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                    fontSize: '0.85rem',
                                }}
                            >
                                <div>
                                    <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
                                        {entry.action.label}
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '0.65rem',
                                            color: 'var(--color-text-muted)',
                                            marginLeft: '8px',
                                            textTransform: 'uppercase',
                                        }}
                                    >
                                        {entry.action.category}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span
                                        style={{
                                            fontFamily: 'var(--font-mono)',
                                            fontSize: '0.75rem',
                                            color: 'var(--color-text-muted)',
                                        }}
                                    >
                                        {entry.result.duration}s
                                    </span>
                                    <span
                                        style={{
                                            fontSize: '0.65rem',
                                            fontWeight: 700,
                                            color: entry.result.completed
                                                ? 'var(--color-success)'
                                                : 'var(--color-danger)',
                                        }}
                                    >
                                        {entry.result.completed ? '✓' : '✗'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Empty state ── */}
            {actionHistory.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                    <p style={{ fontSize: '2rem', marginBottom: '1rem' }}>📊</p>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        No session data yet. Start a session to see your stats!
                    </p>
                    <button
                        className="btn-glow"
                        onClick={() => navigate('/play')}
                        style={{ marginTop: '1rem' }}
                    >
                        Start Session →
                    </button>
                </div>
            )}
        </div>
    )
}
