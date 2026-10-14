'use client';

import { X, Download } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
    url: string | null;
    type: string | null;
    name: string | null;
    onClose: () => void;
}

export default function AttachmentPreviewModal({ url, type, name, onClose }: Props) {
    if (!url) return null;

    const isImage = type === 'image' || (type?.startsWith('image/') ?? false);
    const isPdf = type === 'pdf' || type === 'application/pdf' || (name?.toLowerCase().endsWith('.pdf') ?? false);

    return (
        <AnimatePresence>
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
                onClick={onClose}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="relative max-w-4xl w-full mx-4"
                    onClick={e => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between mb-2">
                        <p className="text-white text-sm font-semibold truncate max-w-[60%]">{name ?? 'Attachment'}</p>
                        <div className="flex items-center gap-2">
                            <a
                                href={url}
                                download={name ?? true}
                                className="flex items-center gap-1.5 h-8 px-3 rounded-xl text-xs font-semibold text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                <Download size={12} /> Download
                            </a>
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                            >
                                <X size={15} />
                            </button>
                        </div>
                    </div>

                    {isImage && (
                        <img
                            src={url}
                            alt={name ?? 'Attachment'}
                            className="w-full rounded-2xl object-contain max-h-[80vh]"
                        />
                    )}

                    {isPdf && (
                        <iframe
                            src={url}
                            title={name ?? 'PDF'}
                            className="w-full rounded-2xl border-0 bg-white"
                            style={{ height: '80vh' }}
                        />
                    )}

                    {!isImage && !isPdf && (
                        <div className="flex flex-col items-center justify-center bg-white/10 rounded-2xl p-12 gap-4" data-admin-surface="">
                            <p className="text-white/70 text-sm">Preview not available for this file type.</p>
                            <a
                                href={url}
                                download={name ?? true}
                                className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
                                style={{ background: 'linear-gradient(135deg, #E8876A 0%, #DA7756 40%, #C06040 100%)' }}
                            >
                                <Download size={14} /> Download File
                            </a>
                        </div>
                    )}
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
