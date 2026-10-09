'use client';

// Speaker button on the board toolbar. Opens upward and holds two separate controls:
// the chalk & eraser sounds, and the narration (the board reading out what is written).
import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Volume2, VolumeX, Volume1, Eraser, Mic } from 'lucide-react';

export type SoundChannel = { volume: number; muted: boolean };

function Row({ icon, label, value, onChange }: {
    icon: React.ReactNode; label: string; value: SoundChannel; onChange: (v: SoundChannel) => void;
}) {
    const silent = value.muted || value.volume === 0;
    return (
        <div className="flex items-center gap-2.5">
            <span className="w-6 flex justify-center text-white/60 shrink-0">{icon}</span>
            <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-white/80 leading-none mb-1.5">{label}</p>
                <input type="range" min={0} max={100} value={silent ? 0 : Math.round(value.volume * 100)}
                    onChange={e => onChange({ volume: Number(e.target.value) / 100, muted: false })}
                    className="w-full accent-pink-300 h-1 cursor-pointer" aria-label={`${label} volume`} />
            </div>
            <button type="button" onClick={() => onChange({ ...value, muted: !value.muted })}
                title={silent ? 'Unmute' : 'Mute'}
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${silent ? 'text-white/40 hover:text-white' : 'text-pink-200 bg-pink-400/20'}`}>
                {silent ? <VolumeX size={14} /> : value.volume < 0.5 ? <Volume1 size={14} /> : <Volume2 size={14} />}
            </button>
        </div>
    );
}

export function SoundMenu({ chalk, voice, onChalk, onVoice }: {
    chalk: SoundChannel; voice: SoundChannel;
    onChalk: (v: SoundChannel) => void; onVoice: (v: SoundChannel) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [open]);

    const allSilent = (chalk.muted || chalk.volume === 0) && (voice.muted || voice.volume === 0);
    return (
        <div ref={ref} className="relative shrink-0">
            <button type="button" title="Sound" onClick={() => setOpen(o => !o)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${open ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}>
                {allSilent ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
                        transition={{ duration: 0.14 }}
                        className="absolute bottom-full right-0 mb-3 w-60 rounded-2xl border border-white/10 p-3 flex flex-col gap-3 cursor-default"
                        style={{ background: 'rgba(0,0,0,0.92)' }}
                        onMouseDown={e => e.stopPropagation()}>
                        <Row icon={<Eraser size={14} />} label="Chalk & eraser" value={chalk} onChange={onChalk} />
                        <Row icon={<Mic size={14} />} label="Narration (reads what you write)" value={voice} onChange={onVoice} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
