/* ── Instruction History Panel ── */

import { useState } from 'react'

export interface HistoryEntry {
    id: number
    time: string
    text: string
    type: 'task' | 'notification' | 'edge' | 'ruin' | 'system'
}

interface InstructionHistoryProps {
    entries: HistoryEntry[]
    visible: boolean
}

export default function InstructionHistory({ entries, visible }: InstructionHistoryProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    if (!visible || entries.length === 0) return null

    const displayEntries = isExpanded ? entries : entries.slice(-4)

    const getTypeColor = (type: HistoryEntry['type']) => {
        switch (type) {
            case 'edge': return '#fbbf24'
            case 'ruin': return '#ef4444'
            case 'task': return '#8b5cf6'
            case 'system': return '#06b6d4'
            default: return 'rgba(255,255,255,0.6)'
        }
    }

    const getTypeIcon = (type: HistoryEntry['type']) => {
        switch (type) {
            case 'edge': return '⚡'
            case 'ruin': return '💀'
            case 'task': return '📋'
            case 'system': return '⚙️'
            default: return '💬'
        }
    }

    return (
        <div
            style={{
                background: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderRadius: '10px',
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                width: '220px',
                transition: 'all 0.3s ease',
            }}
        >
            {/* Header */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', cursor: 'pointer',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.03)',
                }}
            >
                <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    📜 History ({entries.length})
                </span>
                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)' }}>
                    {isExpanded ? '▲' : '▼'}
                </span>
            </div>

            {/* Entries */}
            <div style={{
                maxHeight: isExpanded ? '300px' : '140px',
                overflowY: 'auto',
                padding: '4px 0',
                transition: 'max-height 0.3s ease',
            }}>
                {displayEntries.map((entry) => (
                    <div
                        key={entry.id}
                        style={{
                            display: 'flex', gap: '6px', padding: '3px 8px',
                            alignItems: 'flex-start',
                            borderLeft: `2px solid ${getTypeColor(entry.type)}`,
                            marginLeft: '4px',
                            transition: 'all 0.2s',
                        }}
                    >
                        <span style={{ fontSize: '0.55rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            {entry.time}
                        </span>
                        <span style={{ fontSize: '0.6rem', flexShrink: 0 }}>
                            {getTypeIcon(entry.type)}
                        </span>
                        <span style={{
                            fontSize: '0.65rem', color: getTypeColor(entry.type),
                            lineHeight: 1.3, wordBreak: 'break-word',
                        }}>
                            {entry.text}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    )
}
