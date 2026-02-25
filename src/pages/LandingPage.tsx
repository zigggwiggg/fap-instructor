import { useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useConfigStore } from '../stores/configStore'
import { fetchNiches, type RedGifsNiche } from '../services/redgifs'

// Helper component for section headers
const SectionHeader = ({ title }: { title: string }) => (
    <h2
        style={{
            fontSize: '1.25rem',
            fontWeight: 700,
            marginBottom: '1rem',
            color: 'var(--color-accent-secondary)',
            borderBottom: '1px solid var(--color-border)',
            paddingBottom: '0.5rem',
            marginTop: '1.5rem',
        }}
    >
        {title}
    </h2>
)

// Helper component for input groups
const InputRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div style={{ marginBottom: '1rem' }}>
        <label
            style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                marginBottom: '0.5rem',
            }}
        >
            {label}
        </label>
        {children}
    </div>
)

export default function LandingPage() {
    const navigate = useNavigate()
    const { config, updateConfig, updateTasks } = useConfigStore()

    // Local state for tags input
    const [tagsInput, setTagsInput] = useState(config.tags.join(', '))
    const [niches, setNiches] = useState<RedGifsNiche[]>([])
    const [nichesLoading, setNichesLoading] = useState(false)
    const [nichesError, setNichesError] = useState('')
    const [nicheSearch, setNicheSearch] = useState('')

    // Fetch categories on mount
    useEffect(() => {
        setNichesLoading(true)
        fetchNiches()
            .then((data) => {
                setNiches(data.sort((a, b) => a.name.localeCompare(b.name)))
                setNichesLoading(false)
            })
            .catch((err) => {
                setNichesError((err as Error).message)
                setNichesLoading(false)
            })
    }, [])

    const toggleNicheTag = (name: string) => {
        const tag = name.toLowerCase()
        const current = config.tags
        if (current.includes(tag)) {
            updateConfig({ tags: current.filter((t) => t !== tag) })
        } else {
            updateConfig({ tags: [...current, tag] })
        }
        // Keep text input in sync
        const updated = config.tags.includes(tag)
            ? config.tags.filter((t) => t !== tag)
            : [...config.tags, tag]
        setTagsInput(updated.join(', '))
    }

    const handleStart = () => {
        // Merge custom text tags with the already-selected category tags
        const textTags = tagsInput
            .split(',')
            .map((t) => t.trim().toLowerCase())
            .filter((t) => t.length > 0)

        // Combine: config.tags (from category checkboxes) + any extra text tags, deduplicated
        const allTags = [...new Set([...config.tags, ...textTags])]
        updateConfig({ tags: allTags.length > 0 ? allTags : ['nsfw'] })
        navigate('/play')
    }

    const renderTaskSection = (category: keyof typeof config.tasks, labels: Record<string, string>) => {
        return (
            <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ fontSize: '0.9rem', color: 'var(--color-accent)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {category}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {Object.entries(labels).map(([key, label]) => (
                        <label
                            key={key}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                color: config.tasks[category][key]
                                    ? 'var(--color-text-primary)'
                                    : 'var(--color-text-muted)',
                            }}
                        >
                            <input
                                type="checkbox"
                                checked={!!config.tasks[category][key]}
                                onChange={(e) => updateTasks(category, key, e.target.checked)}
                                style={{ accentColor: 'var(--color-accent)', cursor: 'pointer' }}
                            />
                            {label}
                        </label>
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div
            style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '3rem 1rem',
                position: 'relative',
                overflowX: 'hidden',
            }}
        >
            {/* ── Background Effects ── */}
            <div
                style={{
                    position: 'fixed',
                    width: '800px',
                    height: '800px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.1) 0%, transparent 60%)',
                    top: '-20%',
                    right: '-10%',
                    pointerEvents: 'none',
                    filter: 'blur(100px)',
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: 'fixed',
                    width: '700px',
                    height: '700px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(225, 29, 72, 0.08) 0%, transparent 60%)',
                    bottom: '-10%',
                    left: '-10%',
                    pointerEvents: 'none',
                    filter: 'blur(120px)',
                    zIndex: 0,
                }}
            />

            <div className="animate-fade-in" style={{ zIndex: 1, width: '100%', maxWidth: '800px' }}>
                {/* ── Header ── */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1
                        style={{
                            fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
                            fontWeight: 900,
                            letterSpacing: '-0.04em',
                            lineHeight: 1,
                            marginBottom: '1rem',
                            textShadow: '0 0 40px rgba(139, 92, 246, 0.3)',
                        }}
                    >
                        <span className="text-gradient">Create a game</span>
                    </h1>
                    <p
                        style={{
                            fontSize: '1.1rem',
                            color: 'var(--color-text-secondary)',
                            maxWidth: '500px',
                            margin: '0 auto',
                            lineHeight: 1.6,
                        }}
                    >
                        Tweak your desired settings below to create any desired experience.
                    </p>
                </div>

                {/* ── Configuration Form ── */}
                <div className="glass card" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* 1. Game Duration */}
                    <SectionHeader title="Game Duration" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <InputRow label="Minimum Game Duration (min)">
                            <input
                                type="number"
                                min="1"
                                value={config.gameDurationMin}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    updateConfig({ gameDurationMin: val, gameDurationMax: Math.max(config.gameDurationMax, val) })
                                }}
                                className="config-input"
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }}
                            />
                        </InputRow>
                        <InputRow label="Maximum Game Duration (min)">
                            <input
                                type="number"
                                min="1"
                                value={config.gameDurationMax}
                                onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    updateConfig({ gameDurationMax: val, gameDurationMin: Math.min(config.gameDurationMin, val) })
                                }}
                                className="config-input"
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }}
                            />
                        </InputRow>
                    </div>

                    {/* 2. Media */}
                    <SectionHeader title="Media" />

                    {/* Category & Tag Picker — unified */}
                    <InputRow label="Categories & Tags">
                        <div style={{
                            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)',
                            background: 'rgba(0,0,0,0.2)', overflow: 'hidden',
                        }}>
                            {/* Search + Select All row */}
                            <div style={{ display: 'flex', gap: '8px', padding: '8px 10px', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
                                <input
                                    type="text"
                                    value={nicheSearch}
                                    onChange={(e) => setNicheSearch(e.target.value)}
                                    placeholder="Search categories..."
                                    style={{ flex: 1, padding: '6px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '0.8rem' }}
                                />
                                <button
                                    onClick={() => {
                                        const visible = niches.filter((n) => n.name.toLowerCase().includes(nicheSearch.toLowerCase()))
                                        const visibleTags = visible.map((n) => n.name.toLowerCase())
                                        const allSelected = visibleTags.every((t) => config.tags.includes(t))
                                        if (allSelected) {
                                            // Deselect all visible
                                            const remaining = config.tags.filter((t) => !visibleTags.includes(t))
                                            updateConfig({ tags: remaining })
                                            setTagsInput(remaining.join(', '))
                                        } else {
                                            // Select all visible
                                            const merged = [...new Set([...config.tags, ...visibleTags])]
                                            updateConfig({ tags: merged })
                                            setTagsInput(merged.join(', '))
                                        }
                                    }}
                                    style={{
                                        padding: '5px 12px', fontSize: '0.7rem', fontWeight: 600,
                                        background: 'rgba(139, 92, 246, 0.2)', color: 'var(--color-accent)',
                                        border: '1px solid rgba(139, 92, 246, 0.3)', borderRadius: '4px',
                                        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s',
                                    }}
                                >
                                    {niches.filter((n) => n.name.toLowerCase().includes(nicheSearch.toLowerCase())).every((n) => config.tags.includes(n.name.toLowerCase()))
                                        ? 'Clear All' : 'Select All'}
                                </button>
                            </div>

                            {/* Niche Grid */}
                            <div style={{
                                maxHeight: '220px', overflowY: 'auto', padding: '8px',
                                display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '4px',
                            }}>
                                {nichesLoading && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', gridColumn: '1 / -1' }}>Loading categories...</p>}
                                {nichesError && <p style={{ color: 'var(--color-danger)', fontSize: '0.8rem', gridColumn: '1 / -1' }}>Error: {nichesError}</p>}
                                {niches
                                    .filter((n) => n.name.toLowerCase().includes(nicheSearch.toLowerCase()))
                                    .map((niche) => {
                                        const isSelected = config.tags.includes(niche.name.toLowerCase())
                                        return (
                                            <label
                                                key={niche.name}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
                                                    fontSize: '0.8rem', padding: '4px 6px', borderRadius: '4px',
                                                    background: isSelected ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                                                    color: isSelected ? 'var(--color-accent)' : 'var(--color-text-muted)',
                                                    transition: 'all 0.15s',
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleNicheTag(niche.name)}
                                                    style={{ accentColor: 'var(--color-accent)', width: '14px', height: '14px', flexShrink: 0 }}
                                                />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {niche.name}
                                                </span>
                                                {niche.gifs > 0 && (
                                                    <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                                                        {niche.gifs > 999 ? `${(niche.gifs / 1000).toFixed(0)}k` : niche.gifs}
                                                    </span>
                                                )}
                                            </label>
                                        )
                                    })}
                            </div>

                            {/* Selected tags + custom input */}
                            <div style={{ borderTop: '1px solid var(--color-border)', padding: '8px 10px' }}>
                                {config.tags.length > 0 && (
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                                        {config.tags.map((tag) => (
                                            <span
                                                key={tag}
                                                onClick={() => toggleNicheTag(tag)}
                                                style={{
                                                    fontSize: '0.75rem', padding: '3px 10px', borderRadius: '12px', cursor: 'pointer',
                                                    background: 'rgba(139, 92, 246, 0.2)', color: 'var(--color-accent)',
                                                    border: '1px solid rgba(139, 92, 246, 0.3)', transition: 'all 0.15s'
                                                }}
                                            >
                                                {tag} ✕
                                            </span>
                                        ))}
                                    </div>
                                )}
                                <input
                                    type="text"
                                    value={tagsInput}
                                    onChange={(e) => setTagsInput(e.target.value)}
                                    placeholder="Add custom tags (comma-separated), e.g. teasing, joi"
                                    style={{ width: '100%', padding: '7px 10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: '4px', color: 'white', fontSize: '0.8rem' }}
                                />
                            </div>
                        </div>
                    </InputRow>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
                        <InputRow label="Media Type">
                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                {(['gifs', 'pictures', 'videos'] as const).map((type) => (
                                    <label key={type} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem' }}>
                                        <input
                                            type="checkbox"
                                            checked={config.mediaTypes[type as keyof typeof config.mediaTypes]}
                                            onChange={(e) => updateConfig({ mediaTypes: { ...config.mediaTypes, [type]: e.target.checked } })}
                                            style={{ accentColor: 'var(--color-accent)', width: '18px', height: '18px' }}
                                        />
                                        <span style={{ textTransform: 'capitalize' }}>{type}</span>
                                    </label>
                                ))}
                            </div>
                        </InputRow>
                    </div>

                    <InputRow label={`Slide Duration: ${config.slideDuration}s`}>
                        <input
                            type="range"
                            min="3" max="60"
                            value={config.slideDuration}
                            onChange={(e) => updateConfig({ slideDuration: parseInt(e.target.value) })}
                            style={{ width: '100%', accentColor: 'var(--color-accent)' }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                            <span>3s</span><span>10s</span><span>30s</span><span>60s</span>
                        </div>
                    </InputRow>

                    {/* 3. Stroke */}
                    <SectionHeader title="Stroke" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <InputRow label="Minimum Stroke Speed (per sec)">
                            <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                value={config.strokeSpeedMin}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0.1
                                    updateConfig({ strokeSpeedMin: val, strokeSpeedMax: Math.max(config.strokeSpeedMax, val) })
                                }}
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }}
                            />
                        </InputRow>
                        <InputRow label="Maximum Stroke Speed (per sec)">
                            <input
                                type="number"
                                step="0.01"
                                min="0.1"
                                value={config.strokeSpeedMax}
                                onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0.1
                                    updateConfig({ strokeSpeedMax: val, strokeSpeedMin: Math.min(config.strokeSpeedMin, val) })
                                }}
                                style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }}
                            />
                        </InputRow>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        <input
                            type="checkbox"
                            checked={config.enableGripAdjustments}
                            onChange={(e) => updateConfig({ enableGripAdjustments: e.target.checked })}
                            style={{ accentColor: 'var(--color-accent-secondary)', width: '18px', height: '18px' }}
                        />
                        Enable grip adjustments
                    </label>

                    <InputRow label="Starting Grip Strength">
                        <select
                            value={config.startingGripStrength}
                            onChange={(e) => updateConfig({ startingGripStrength: e.target.value })}
                            style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', color: 'white', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', outline: 'none' }}
                        >
                            <option value="Light">Light</option>
                            <option value="Normal">Normal</option>
                            <option value="Tight">Tight</option>
                        </select>
                    </InputRow>

                    {/* 4. Game Finale */}
                    <SectionHeader title="Game Finale" />
                    <InputRow label={`Probability of an orgasm: ${config.finaleOrgasmProb}%`}>
                        <input type="range" min="0" max="100" value={config.finaleOrgasmProb} onChange={(e) => updateConfig({ finaleOrgasmProb: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
                    </InputRow>
                    <InputRow label={`Probability to be denied an orgasm: ${config.finaleDeniedProb}%`}>
                        <input type="range" min="0" max="100" value={config.finaleDeniedProb} onChange={(e) => updateConfig({ finaleDeniedProb: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
                    </InputRow>
                    <InputRow label={`Probability of a ruined orgasm: ${config.finaleRuinedProb}%`}>
                        <input type="range" min="0" max="100" value={config.finaleRuinedProb} onChange={(e) => updateConfig({ finaleRuinedProb: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
                    </InputRow>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '-8px' }}>Values automatically normalize at execution time.</p>


                    {/* 5. Edging */}
                    <SectionHeader title="Edging" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <InputRow label="Minimum Edges">
                            <input type="number" min="0" value={config.edgesMin} onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                updateConfig({ edgesMin: val, edgesMax: Math.max(config.edgesMax, val) })
                            }} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }} />
                        </InputRow>
                        <InputRow label="Maximum Edges">
                            <input type="number" min="0" value={config.edgesMax} onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                updateConfig({ edgesMax: val, edgesMin: Math.min(config.edgesMin, val) })
                            }} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }} />
                        </InputRow>
                    </div>
                    <InputRow label={`Edge Cooldown: ${config.edgeCooldown}s`}>
                        <input type="range" min="5" max="60" value={config.edgeCooldown} onChange={(e) => updateConfig({ edgeCooldown: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent)' }} />
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>Duration to rest before the game continues.</p>
                    </InputRow>


                    {/* 6. Ruined Orgasms */}
                    <SectionHeader title="Ruined Orgasms" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <InputRow label="Minimum Ruined Orgasms">
                            <input type="number" min="0" value={config.ruinedOrgasmsMin} onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                updateConfig({ ruinedOrgasmsMin: val, ruinedOrgasmsMax: Math.max(config.ruinedOrgasmsMax, val) })
                            }} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }} />
                        </InputRow>
                        <InputRow label="Maximum Ruined Orgasms">
                            <input type="number" min="0" value={config.ruinedOrgasmsMax} onChange={(e) => {
                                const val = parseInt(e.target.value) || 0
                                updateConfig({ ruinedOrgasmsMax: val, ruinedOrgasmsMin: Math.min(config.ruinedOrgasmsMin, val) })
                            }} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }} />
                        </InputRow>
                    </div>

                    {/* 7. Post Orgasm Torture */}
                    <SectionHeader title="Post Orgasm Torture" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1rem' }}>
                        <input
                            type="checkbox"
                            checked={config.enablePostOrgasmTorture}
                            onChange={(e) => updateConfig({ enablePostOrgasmTorture: e.target.checked })}
                            style={{ accentColor: 'var(--color-accent-secondary)', width: '18px', height: '18px' }}
                        />
                        Enable Post Orgasm Torture
                    </label>
                    {config.enablePostOrgasmTorture && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <InputRow label="Minimum Time (sec)">
                                <input type="number" min="1" value={config.postOrgasmMin} onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    updateConfig({ postOrgasmMin: val, postOrgasmMax: Math.max(config.postOrgasmMax, val) })
                                }} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }} />
                            </InputRow>
                            <InputRow label="Maximum Time (sec)">
                                <input type="number" min="1" value={config.postOrgasmMax} onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    updateConfig({ postOrgasmMax: val, postOrgasmMin: Math.min(config.postOrgasmMin, val) })
                                }} style={{ width: '100%', padding: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'white' }} />
                            </InputRow>
                        </div>
                    )}


                    {/* 8. Tasks */}
                    <SectionHeader title="Tasks" />
                    <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: '1.5rem', background: 'rgba(0,0,0,0.2)' }}>

                        {renderTaskSection('speed', {
                            doubleStrokes: 'Double Strokes',
                            halvedStrokes: 'Halved Strokes',
                            teasingStrokes: 'Teasing Strokes',
                            randomStrokeSpeeds: 'Random Stroke Speeds',
                            accelerationCycles: 'Acceleration Cycles',
                            randomBeat: 'Random Beat',
                            redLightGreenLight: 'Red Light Green Light',
                            clusterStrokes: 'Cluster Strokes'
                        })}

                        {renderTaskSection('style', {
                            dominant: 'Dominant Hand',
                            nonDominant: 'Non-Dominant Hand',
                            headOnly: 'Head Only',
                            shaftOnly: 'Shaft Only',
                            overhandGrip: 'Overhand Grip'
                        })}

                        {renderTaskSection('cbt', {
                            ballSlaps: 'Ball Slaps',
                            bindCockAndBalls: 'Bind Cock And Balls',
                            rubberBands: 'Rubber Bands',
                            clothespins: 'Clothespins',
                            icyHot: 'Icy/Hot Element',
                            toothpaste: 'Toothpaste',
                            icePlay: 'Ice Play',
                            ballSqueeze: 'Ball Squeeze',
                            headPalming: 'Head Palming',
                            scratching: 'Scratching',
                            flicking: 'Flicking',
                            breathPlay: 'Breath Play'
                        })}

                        {renderTaskSection('cei', {
                            eatCum: 'Eat Cum (CEI)',
                            precum: 'Precum (CEI)'
                        })}

                        {renderTaskSection('anal', {
                            buttPlug: 'Butt Plug'
                        })}

                        {renderTaskSection('misc', {
                            pickYourPoison: 'Pick Your Poison'
                        })}

                        <InputRow label={`Task Frequency: ${config.taskFrequency}s`}>
                            <input type="range" min="5" max="60" value={config.taskFrequency} onChange={(e) => updateConfig({ taskFrequency: parseInt(e.target.value) })} style={{ width: '100%', accentColor: 'var(--color-accent-secondary)' }} />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                                <span>5s</span><span>15s</span><span>30s</span><span>60s</span>
                            </div>
                        </InputRow>

                    </div>

                    <button
                        className="btn-glow animate-pulse-glow"
                        onClick={handleStart}
                        style={{ fontSize: '1.2rem', padding: '18px 24px', marginTop: '2rem', width: '100%' }}
                    >
                        START GAME
                    </button>

                    {/* Version Badge */}
                    <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '4px' }}>
                            v{/* @ts-expect-error injected by vite */}
                            {__APP_VERSION__}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
