import React, { useState } from 'react'
import { useConfigStore } from '../stores/configStore'

export default function AgeGate({ children }: { children: React.ReactNode }) {
    const { config, updateConfig } = useConfigStore()
    const [step, setStep] = useState<'age' | 'gender' | 'orientation'>('age')

    if (config.ageVerified && config.gender && config.orientation) {
        return <>{children}</>
    }

    const handleUnder18 = () => {
        window.location.href = 'https://youtu.be/e_04ZrNroTo?si=d3vdwTkJ-rYivd-Q'
    }

    const handleOver18 = () => {
        setStep('gender')
    }

    const setGender = (g: any) => {
        updateConfig({ gender: g })
        setStep('orientation')
    }

    const setOrientation = (o: any) => {
        updateConfig({ orientation: o, ageVerified: true })
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', color: 'white', fontFamily: 'Inter, sans-serif'
        }}>
            <div className="glass card animate-fade-in" style={{ padding: '3rem', maxWidth: '500px', width: '90%', textAlign: 'center' }}>
                <h1 style={{ fontSize: '2rem', marginBottom: '1.5rem', fontWeight: 900 }} className="text-gradient">
                    Welcome Pet
                </h1>

                {step === 'age' && (
                    <div className="animate-fade-in">
                        <p style={{ marginBottom: '2.5rem', opacity: 0.8, lineHeight: 1.6 }}>
                            This experience contains adult content and requires you to be at least 18 years of age to enter.
                        </p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                            <button
                                className="btn-glow"
                                style={{ padding: '12px 32px' }}
                                onClick={handleOver18}
                            >
                                I am 18+
                            </button>
                            <button
                                style={{
                                    padding: '12px 32px', background: 'transparent',
                                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px',
                                    color: 'white', cursor: 'pointer'
                                }}
                                onClick={handleUnder18}
                            >
                                Leave
                            </button>
                        </div>
                    </div>
                )}

                {step === 'gender' && (
                    <div className="animate-fade-in">
                        <p style={{ marginBottom: '2rem', opacity: 0.8 }}>Please select your gender:</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button className="btn-glow" onClick={() => setGender('male')}>Male</button>
                            <button className="btn-glow" onClick={() => setGender('female')}>Female</button>
                            <button className="btn-glow" onClick={() => setGender('other')}>Other / NB</button>
                        </div>
                    </div>
                )}

                {step === 'orientation' && (
                    <div className="animate-fade-in">
                        <p style={{ marginBottom: '2rem', opacity: 0.8 }}>What is your orientation?</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <button className="btn-glow" onClick={() => setOrientation('straight')}>Straight</button>
                            <button className="btn-glow" onClick={() => setOrientation('gay')}>Gay</button>
                            <button className="btn-glow" onClick={() => setOrientation('lesbian')}>Lesbian</button>
                            <button className="btn-glow" onClick={() => setOrientation('bisexual')}>Bisexual</button>
                        </div>
                        <p style={{ marginTop: '1.5rem', fontSize: '0.8rem', opacity: 0.5 }}>
                            This helps us tailor the content for your immersion.
                        </p>
                    </div>
                )}
            </div>

            <p style={{ marginTop: '2rem', fontSize: '0.75rem', opacity: 0.3 }}>
                By entering, you agree to our terms of service and privacy policy.
            </p>
        </div>
    )
}
