'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';

// A code held in front of the camera is seen many times a second; only act again after it has been out of view this long.
const REPEAT_GAP_MS = 3000;

type Controls = { stop: () => void };

/** Reads Code128 / QR codes from the phone camera. Falls back to a message when the camera is unavailable. */
export default function Scanner({ onCode, onClose }: { onCode: (code: string) => void; onClose: () => void }) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [problem, setProblem] = useState('');
    const onCodeRef = useRef(onCode);
    useEffect(() => { onCodeRef.current = onCode; });

    useEffect(() => {
        let controls: Controls | null = null;
        let cancelled = false;
        let lastCode = '';
        let lastAt = 0;

        const start = async () => {
            if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
                setProblem('This browser cannot open the camera here. Camera scanning needs a secure (https) page. You can type the code instead.');
                return;
            }
            try {
                const { BrowserMultiFormatReader } = await import('@zxing/browser');
                if (cancelled || !videoRef.current) return;
                const reader = new BrowserMultiFormatReader();
                const started = await reader.decodeFromConstraints(
                    { video: { facingMode: { ideal: 'environment' } } },
                    videoRef.current,
                    (result) => {
                        if (!result) return;
                        const text = result.getText().trim();
                        const now = Date.now();
                        const stillInView = text === lastCode && now - lastAt < REPEAT_GAP_MS;
                        lastCode = text;
                        lastAt = now;
                        if (!text || stillInView) return;
                        onCodeRef.current(text);
                    },
                );
                if (cancelled) started.stop();
                else controls = started;
            } catch (err) {
                const name = err instanceof Error ? err.name : '';
                setProblem(
                    name === 'NotAllowedError' || name === 'SecurityError'
                        ? 'Camera permission was denied. Allow camera access in your browser settings, or type the code instead.'
                        : 'Could not start the camera. You can type the code instead.',
                );
            }
        };
        void start();

        return () => {
            cancelled = true;
            controls?.stop();
        };
    }, []);

    return (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Point the camera at a barcode</p>
                <button type="button" onClick={onClose} aria-label="Close camera" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted"><X size={16} /></button>
            </div>
            {problem ? (
                <p className="text-sm text-muted-foreground py-6 text-center">{problem}</p>
            ) : (
                <video ref={videoRef} muted playsInline className="w-full max-h-72 rounded-xl bg-black object-cover" />
            )}
        </div>
    );
}
