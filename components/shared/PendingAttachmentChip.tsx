'use client';

import { useEffect, useState } from 'react';
import { X, FileText, FileSpreadsheet, FileType, Paperclip, Video } from 'lucide-react';

function getFileIcon(name: string) {
    if (name.endsWith('.pdf')) return <FileText size={14} className="text-red-500" />;
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) return <FileSpreadsheet size={14} className="text-emerald-600" />;
    if (name.endsWith('.docx') || name.endsWith('.doc')) return <FileType size={14} className="text-blue-500" />;
    return <Paperclip size={14} className="text-muted-foreground" />;
}

// A picked-but-not-yet-uploaded File — shows an image thumbnail, a video icon, or a
// file-type icon, since there's no server URL to preview from yet.
export function PendingAttachmentChip({ file, onRemove }: { file: File; onRemove: () => void }) {
    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');
    const [objectUrl, setObjectUrl] = useState<string | null>(null);

    useEffect(() => {
        if (!isImage) return;
        const url = URL.createObjectURL(file);
        setObjectUrl(url);
        return () => URL.revokeObjectURL(url);
    }, [file, isImage]);

    if (isImage) {
        return (
            <div className="relative group w-16 h-16 rounded-lg overflow-hidden border border-border/50 shrink-0">
                {objectUrl && <img src={objectUrl} alt={file.name} className="w-full h-full object-cover" />}
                <button type="button" onClick={onRemove}
                    className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white transition-all">
                    <X size={9} />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center gap-1 text-[11px] bg-muted/50 border border-border/50 rounded-lg px-2 py-0.5">
            {isVideo ? <Video size={12} className="text-muted-foreground" /> : getFileIcon(file.name.toLowerCase())}
            <span className="text-foreground max-w-[120px] truncate">{file.name}</span>
            <button type="button" onClick={onRemove} className="text-muted-foreground hover:text-foreground ml-0.5">
                <X size={10} />
            </button>
        </div>
    );
}
