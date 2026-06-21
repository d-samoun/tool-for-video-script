'use client';

import { useEffect, useRef, useState } from 'react';

const API = 'http://localhost:8000';

const KHMER_VOICES = [
  { short_name: 'km-KH-SreymomNeural', gender: 'Female', label: 'Sreymom', khmer: 'ស្រីម៉ម' },
  { short_name: 'km-KH-PisethNeural',  gender: 'Male',   label: 'Piseth',  khmer: 'ពិសិទ្ធ' },
];

const PRESETS = [
  { label: 'Normal',      khmer: 'ធម្មតា',     rate: 0,   pitch: 0,   volume: 0 },
  { label: 'Calm',        khmer: 'សម្រាន់',    rate: -15, pitch: -5,  volume: -5 },
  { label: 'Energetic',   khmer: 'រស់រវើក',   rate: 20,  pitch: 10,  volume: 10 },
  { label: 'News',        khmer: 'ព័ត៌មាន',   rate: 5,   pitch: 0,   volume: 5 },
  { label: 'Story',       khmer: 'រឿង',       rate: -10, pitch: 5,   volume: 0 },
];

const LANG_FILTERS = [
  { label: 'ខ្មែរ', value: 'km' },
  { label: 'EN',    value: 'en' },
  { label: 'All',   value: '' },
];

interface Voice { name: string; short_name: string; gender: string; locale: string; language: string; }
interface GroupedVoices { [locale: string]: Voice[]; }

function fmt(v: number, unit: string) {
  return v >= 0 ? `+${v}${unit}` : `${v}${unit}`;
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  color: string;
  leftLabel: string;
  rightLabel: string;
  onChange: (v: number) => void;
}

function Slider({ label, value, min, max, unit, color, leftLabel, rightLabel, onChange }: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
        <span style={{
          fontSize: 12, fontWeight: 700, minWidth: 52, textAlign: 'right',
          color: value === 0 ? 'var(--text-muted)' : color,
          background: value !== 0 ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
          padding: '2px 8px', borderRadius: 6,
          border: value !== 0 ? `1px solid color-mix(in srgb, ${color} 25%, transparent)` : '1px solid transparent',
          transition: 'all 0.2s ease',
        }}>
          {fmt(value, unit)}
        </span>
      </div>
      <div style={{ position: 'relative', height: 28, display: 'flex', alignItems: 'center' }}>
        {/* track */}
        <div style={{
          position: 'absolute', left: 0, right: 0, height: 4,
          background: 'rgba(255,255,255,0.06)', borderRadius: 4,
        }} />
        {/* fill */}
        <div style={{
          position: 'absolute', left: 0, width: `${pct}%`, height: 4,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          borderRadius: 4, transition: 'width 0.1s',
        }} />
        <input
          type="range" min={min} max={max} value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            position: 'absolute', left: 0, right: 0, width: '100%',
            opacity: 0, cursor: 'pointer', height: 28, margin: 0,
          }}
        />
        {/* thumb */}
        <div style={{
          position: 'absolute', left: `calc(${pct}% - 8px)`,
          width: 16, height: 16, borderRadius: '50%',
          background: `linear-gradient(135deg, ${color}, ${color}bb)`,
          boxShadow: `0 0 8px ${color}66`,
          border: '2px solid rgba(255,255,255,0.2)',
          pointerEvents: 'none', transition: 'left 0.1s',
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)' }}>
        <span>{leftLabel}</span><span>{rightLabel}</span>
      </div>
    </div>
  );
}

export default function Home() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [voiceSearch, setVoiceSearch] = useState('');
  const [langFilter, setLangFilter] = useState('km');
  const [selectedVoice, setSelectedVoice] = useState('km-KH-SreymomNeural');

  const [text, setText] = useState('');
  const [rate, setRate]     = useState(0);
  const [pitch, setPitch]   = useState(0);
  const [volume, setVolume] = useState(0);
  const [activePreset, setActivePreset] = useState('Normal');

  const [generating, setGenerating] = useState(false);
  const [audioUrl, setAudioUrl]         = useState<string | null>(null);
  const [audioFilename, setAudioFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    fetch(`${API}/voices`)
      .then(r => r.json())
      .then((data: Voice[]) => { setVoices(data); setLoadingVoices(false); })
      .catch(() => setLoadingVoices(false));
  }, []);

  const applyPreset = (p: typeof PRESETS[0]) => {
    setRate(p.rate); setPitch(p.pitch); setVolume(p.volume);
    setActivePreset(p.label);
  };

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setGenerating(true); setError(null); setAudioUrl(null);
    try {
      const res = await fetch(`${API}/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text, voice: selectedVoice,
          rate: fmt(rate, '%'), pitch: fmt(pitch, 'Hz'), volume: fmt(volume, '%'),
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.detail || 'Failed'); }
      const data = await res.json();
      setAudioUrl(`${API}${data.audio_url}`);
      setAudioFilename(data.filename);
      setTimeout(() => audioRef.current?.play(), 100);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally { setGenerating(false); }
  };

  const handleDownload = () => {
    if (!audioUrl || !audioFilename) return;
    const a = document.createElement('a'); a.href = audioUrl; a.download = audioFilename; a.click();
  };

  const filteredVoices = voices.filter(v => {
    const matchLang = langFilter ? v.locale.toLowerCase().startsWith(langFilter) : true;
    const q = voiceSearch.toLowerCase();
    return matchLang && (!q || v.short_name.toLowerCase().includes(q) || v.locale.toLowerCase().includes(q));
  });
  const grouped: GroupedVoices = filteredVoices.reduce((acc, v) => {
    (acc[v.locale] ||= []).push(v); return acc;
  }, {} as GroupedVoices);

  const isKhmer = selectedVoice.startsWith('km-KH');
  const selectedObj = voices.find(v => v.short_name === selectedVoice);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div className="bg-gradient-mesh" />

      {/* ── Header ── */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '13px 22px',
        borderBottom: '1px solid var(--border-color)',
        background: 'rgba(7,9,14,0.85)', backdropFilter: 'blur(16px)',
        flexShrink: 0, zIndex: 10,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10,
          background: 'linear-gradient(135deg,#a855f7,#06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 16, color: '#fff', letterSpacing: -1,
        }}>D</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, letterSpacing: 0.3 }}>DAI Dubber Pro</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Edge TTS · Microsoft Neural Voices</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{
            padding: '3px 10px', borderRadius: 20, fontSize: 11,
            background: 'rgba(16,185,129,0.12)', color: 'var(--accent-emerald)',
            border: '1px solid rgba(16,185,129,0.2)',
          }}>
            {loadingVoices ? 'Loading…' : `${voices.length} voices`}
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left: text + generate ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 18, gap: 14, overflow: 'auto' }}>

          {/* Khmer quick-select */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 12,
            background: 'rgba(168,85,247,0.06)',
            border: '1px solid rgba(168,85,247,0.15)',
          }}>
            <span style={{ fontSize: 22 }}>🇰🇭</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>សំឡេងខ្មែរ</span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 4 }}>
              {KHMER_VOICES.map(v => {
                const on = selectedVoice === v.short_name;
                return (
                  <button key={v.short_name} onClick={() => setSelectedVoice(v.short_name)} style={{
                    padding: '5px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${on ? '#a855f7' : 'var(--border-color)'}`,
                    background: on ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.04)',
                    color: on ? '#c084fc' : 'var(--text-primary)',
                    fontWeight: on ? 700 : 400, transition: 'all 0.15s',
                  }}>
                    <span style={{ fontFamily: "'Kantumruy Pro',sans-serif" }}>{v.khmer}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 6 }}>{v.gender[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Textarea */}
          <div className="glass-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {isKhmer ? 'អត្ថបទ — Text' : 'Text to Speak'}
              </span>
              {isKhmer && (
                <span style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 4,
                  background: 'rgba(168,85,247,0.1)', color: 'var(--accent-purple)',
                  border: '1px solid rgba(168,85,247,0.2)',
                }}>Khmer font</span>
              )}
            </div>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={isKhmer ? 'វាយឬបិទភ្ជាប់អត្ថបទខ្មែរនៅទីនេះ…' : 'Type or paste text here…'}
              style={{
                width: '100%', minHeight: 140, resize: 'vertical',
                background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border-color)',
                borderRadius: 8, color: 'var(--text-primary)', padding: 12,
                fontSize: isKhmer ? 16 : 14, lineHeight: isKhmer ? 2.1 : 1.7,
                fontFamily: isKhmer ? "'Kantumruy Pro', var(--font-sans)" : 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{text.length} chars</span>
              <button className="btn-secondary" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => setText('')}>Clear</button>
            </div>
          </div>

          {/* Generate button */}
          <button
            className="btn-action"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 0', fontSize: 14 }}
            disabled={generating || !text.trim()}
            onClick={handleGenerate}
          >
            {generating
              ? <><div className="spinner" />{isKhmer ? ' កំពុងបង្កើត…' : ' Generating…'}</>
              : isKhmer ? 'បង្កើតសំឡេង' : 'Generate Speech'
            }
          </button>

          {error && (
            <div style={{
              padding: '9px 13px', borderRadius: 8, fontSize: 13,
              background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)',
              color: 'var(--accent-rose)',
            }}>{error}</div>
          )}

          {audioUrl && (
            <div className="glass-panel" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {isKhmer ? 'លទ្ធផល — Output' : 'Output'}
              </span>
              <audio ref={audioRef} controls src={audioUrl} style={{ width: '100%' }} />
              <button className="btn-secondary" style={{ alignSelf: 'flex-start', fontSize: 12 }} onClick={handleDownload}>
                {isKhmer ? 'ទាញយក MP3' : 'Download MP3'}
              </button>
            </div>
          )}
        </div>

        {/* ── Center: Voice Customization ── */}
        <div style={{
          width: 280, borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'rgba(10,14,24,0.6)',
        }}>
          {/* Voice card */}
          <div style={{
            padding: 16, borderBottom: '1px solid var(--border-color)',
            background: 'linear-gradient(160deg, rgba(168,85,247,0.08) 0%, transparent 100%)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
              Selected Voice
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Avatar */}
              <div style={{
                width: 46, height: 46, borderRadius: 14, flexShrink: 0,
                background: selectedObj?.gender === 'Female'
                  ? 'linear-gradient(135deg,#ec4899,#a855f7)'
                  : 'linear-gradient(135deg,#06b6d4,#6366f1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, boxShadow: selectedObj?.gender === 'Female'
                  ? '0 4px 16px rgba(236,72,153,0.3)'
                  : '0 4px 16px rgba(6,182,212,0.3)',
              }}>
                {selectedObj?.gender === 'Female' ? '👩' : '👨'}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', truncate: 'ellipsis' }}>
                  {selectedVoice.split('-').slice(2).join('-')}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {selectedObj?.locale} · {selectedObj?.gender}
                </div>
              </div>
            </div>
          </div>

          {/* Sliders */}
          <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 18, overflow: 'auto', flex: 1 }}>

            {/* Presets */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                Style Presets
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PRESETS.map(p => {
                  const on = activePreset === p.label;
                  return (
                    <button key={p.label} onClick={() => applyPreset(p)} style={{
                      padding: '5px 11px', borderRadius: 7, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      border: `1px solid ${on ? '#a855f7' : 'var(--border-color)'}`,
                      background: on ? 'rgba(168,85,247,0.15)' : 'rgba(255,255,255,0.03)',
                      color: on ? '#c084fc' : 'var(--text-secondary)',
                      fontWeight: on ? 600 : 400, transition: 'all 0.15s',
                    }}>
                      {isKhmer ? p.khmer : p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div style={{ borderTop: '1px solid var(--border-color)' }} />

            <Slider
              label={isKhmer ? 'ល្បឿន — Speed' : 'Speed'}
              value={rate} min={-50} max={100} unit="%" color="#06b6d4"
              leftLabel="Slow" rightLabel="Fast"
              onChange={v => { setRate(v); setActivePreset(''); }}
            />
            <Slider
              label={isKhmer ? 'សំឡេង — Pitch' : 'Pitch'}
              value={pitch} min={-50} max={50} unit="Hz" color="#ec4899"
              leftLabel="Deep" rightLabel="High"
              onChange={v => { setPitch(v); setActivePreset(''); }}
            />
            <Slider
              label={isKhmer ? 'កម្រិតសំឡេង — Volume' : 'Volume'}
              value={volume} min={-50} max={50} unit="%" color="#f59e0b"
              leftLabel="Quiet" rightLabel="Loud"
              onChange={v => { setVolume(v); setActivePreset(''); }}
            />

            <button className="btn-secondary" style={{ fontSize: 11, padding: '5px 0', justifyContent: 'center' }}
              onClick={() => { setRate(0); setPitch(0); setVolume(0); setActivePreset('Normal'); }}>
              Reset to Normal
            </button>
          </div>
        </div>

        {/* ── Right: Voice library ── */}
        <div style={{
          width: 260, display: 'flex', flexDirection: 'column', overflow: 'hidden',
          background: 'rgba(7,9,14,0.5)',
        }}>
          <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid var(--border-color)', flexShrink: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
              Voice Library
            </div>
            <div style={{ display: 'flex', gap: 5, marginBottom: 9 }}>
              {LANG_FILTERS.map(f => {
                const on = langFilter === f.value;
                return (
                  <button key={f.value} onClick={() => { setLangFilter(f.value); setVoiceSearch(''); }} style={{
                    padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                    border: `1px solid ${on ? '#a855f7' : 'var(--border-color)'}`,
                    background: on ? 'rgba(168,85,247,0.14)' : 'rgba(255,255,255,0.03)',
                    color: on ? '#c084fc' : 'var(--text-muted)',
                    fontWeight: on ? 600 : 400, transition: 'all 0.15s',
                  }}>{f.label}</button>
                );
              })}
            </div>
            <input type="text" placeholder="Search…" value={voiceSearch}
              onChange={e => setVoiceSearch(e.target.value)}
              style={{ width: '100%', fontSize: 12 }} />
          </div>

          <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 8 }}>
            {loadingVoices ? (
              <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                <div className="spinner" style={{ margin: '0 auto 10px' }} />
                Loading voices…
              </div>
            ) : (
              Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([locale, lvs]) => (
                <div key={locale}>
                  <div style={{
                    padding: '5px 14px', fontSize: 10, fontWeight: 700,
                    letterSpacing: 1.2, textTransform: 'uppercase',
                    color: locale === 'km-KH' ? '#a855f7' : 'var(--text-muted)',
                    background: locale === 'km-KH' ? 'rgba(168,85,247,0.05)' : 'rgba(255,255,255,0.02)',
                  }}>
                    {locale === 'km-KH' ? '🇰🇭 ' : ''}{locale}
                  </div>
                  {lvs.map(voice => {
                    const active = voice.short_name === selectedVoice;
                    return (
                      <div key={voice.short_name} onClick={() => setSelectedVoice(voice.short_name)}
                        style={{
                          padding: '7px 14px', cursor: 'pointer',
                          borderLeft: `2px solid ${active ? '#a855f7' : 'transparent'}`,
                          background: active ? 'rgba(168,85,247,0.07)' : 'transparent',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={e => { if (!active) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                      >
                        <div style={{ fontSize: 13, color: active ? '#c084fc' : 'var(--text-primary)', fontWeight: active ? 600 : 400 }}>
                          {voice.short_name.replace(`${voice.locale}-`, '')}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
                          {voice.gender}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
