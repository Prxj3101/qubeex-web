'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ExternalLink, FileText, FileSpreadsheet, FileType, Paperclip } from 'lucide-react';

interface Attachment {
    url: string;
    name: string;
    type: string; // MIME type or 'image' / 'file'
}

async function downloadFile(url: string, name: string) {
    try {
        const res = await fetch(url);
        const blob = await res.blob();
        const objUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objUrl;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
    } catch {
        window.open(url, '_blank', 'noopener,noreferrer');
    }
}

function getFileIcon(name: string, type: string) {
    if (type === 'image' || type.startsWith('image/')) return null;
    if (name?.endsWith('.pdf') || type === 'application/pdf') return <FileText size={16} className="text-red-500" />;
    if (name?.endsWith('.xlsx') || name?.endsWith('.xls')) return <FileSpreadsheet size={16} className="text-emerald-600" />;
    if (name?.endsWith('.docx') || name?.endsWith('.doc')) return <FileType size={16} className="text-blue-500" />;
    return <Paperclip size={16} className="text-muted-foreground" />;
}

function isImage(type: string, name?: string) {
    return type === 'image' || type.startsWith('image/') ||
        (name ? /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name) : false);
}

function isPdf(type: string, name?: string) {
    return type === 'pdf' || type === 'application/pdf' || (name?.toLowerCase().endsWith('.pdf') ?? false);
}

function isVideo(type: string, name?: string) {
    return type === 'video' || type.startsWith('video/') ||
        (name ? /\.(mp4|webm|mov|avi)$/i.test(name) : false);
}

type ModalKind = 'image' | 'video' | 'pdf';

// ── Fullscreen modal (image + video + PDF) ────────────────────────────────────

function PreviewModal({ url, name, kind, onClose }: {
    url: string; name: string; kind: ModalKind; onClose: () => void;
}) {
    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
                onClick={onClose}>
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="relative max-w-4xl w-full mx-4 flex flex-col gap-2"
                    onClick={e => e.stopPropagation()}>

                    <div className="flex items-center justify-between">
                        <p className="text-white text-sm font-semibold truncate max-w-[60%]">{name}</p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => downloadFile(url, name)}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}>
                                <Download size={12} /> Download
                            </button>
                            {kind === 'pdf' && (
                                <a href={url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 h-8 px-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all">
                                    <ExternalLink size={12} /> Open
                                </a>
                            )}
                            <button onClick={onClose}
                                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all">
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {kind === 'image' && (
                        <img src={url} alt={name} className="w-full rounded-2xl object-contain max-h-[80vh]" />
                    )}
                    {kind === 'video' && (
                        <video
                            src={url}
                            controls
                            autoPlay
                            className="w-full rounded-2xl max-h-[80vh] bg-black"
                            onClick={e => e.stopPropagation()}
                        />
                    )}
                    {kind === 'pdf' && (
                        <iframe src={url} title={name} className="w-full rounded-2xl border-0 bg-white" style={{ height: '80vh' }} />
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AttachmentPreview({
    attachment,
    dark = false,
    compact = false,
}: {
    attachment: Attachment;
    dark?: boolean;
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const { url, name, type } = attachment;
    const isImg    = isImage(type, name);
    const isVid    = isVideo(type, name);
    const isPdfFile = isPdf(type, name);

    if (isImg) {
        return (
            <>
                <div
                    className={`relative group cursor-pointer overflow-hidden rounded-xl border transition-all hover:opacity-90 ${compact ? 'max-w-[180px]' : 'max-w-[260px]'} ${dark ? 'border-white/20' : 'border-border/50'}`}
                    onClick={() => setOpen(true)}>
                    <img
                        src={url}
                        alt={name}
                        className="w-full object-cover"
                        style={{ maxHeight: compact ? '120px' : '180px' }}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <span className="opacity-0 group-hover:opacity-100 text-white text-[10px] font-semibold bg-black/50 px-2 py-1 rounded-lg transition-all">
                            Click to expand
                        </span>
                    </div>
                </div>
                {open && <PreviewModal url={url} name={name} kind="image" onClose={() => setOpen(false)} />}
            </>
        );
    }

    if (isVid) {
        return (
            <>
                <div
                    className={`relative group cursor-pointer overflow-hidden rounded-xl border transition-all ${compact ? 'max-w-[220px]' : 'max-w-[320px]'} ${dark ? 'border-white/20' : 'border-border/50'}`}
                    onClick={() => setOpen(true)}>
                    <video
                        src={url}
                        className="w-full object-cover bg-black"
                        style={{ maxHeight: compact ? '120px' : '180px' }}
                        muted
                        preload="metadata"
                    />
                    {/* Play overlay */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-all">
                        <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                            <svg viewBox="0 0 24 24" className="w-5 h-5 text-gray-800 fill-current ml-0.5">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        </div>
                    </div>
                    <p className={`absolute bottom-1.5 left-2 text-[10px] font-medium truncate max-w-[80%] ${dark ? 'text-white/80' : 'text-white'}`}>{name}</p>
                </div>
                {open && <PreviewModal url={url} name={name} kind="video" onClose={() => setOpen(false)} />}
            </>
        );
    }

    // PDF or other file — clickable chip opens modal for PDFs, download for others
    const icon = getFileIcon(name, type);
    return (
        <>
            <div
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer ${dark ? 'border-white/20 bg-white/10 text-white hover:bg-white/20' : 'border-border/50 bg-muted/40 text-foreground hover:bg-muted/70'}`}
                onClick={() => isPdfFile ? setOpen(true) : downloadFile(url, name)}>
                <span className="shrink-0">{icon}</span>
                <span className="truncate max-w-[140px]">{name}</span>
                {!isPdfFile && (
                    <div className="flex items-center gap-1 ml-auto shrink-0">
                        <a href={url} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center transition-all ${dark ? 'hover:bg-white/20 text-white/70' : 'hover:bg-muted text-muted-foreground hover:text-primary'}`}>
                            <ExternalLink size={11} />
                        </a>
                    </div>
                )}
            </div>
            {open && isPdfFile && <PreviewModal url={url} name={name} kind="pdf" onClose={() => setOpen(false)} />}
        </>
    );
}
