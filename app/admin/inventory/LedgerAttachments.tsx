'use client';
/* eslint-disable @next/next/no-img-element -- Attachment previews preserve uploaded image dimensions. */
import { useState } from 'react';
import { Paperclip, Download, ExternalLink, X } from 'lucide-react';
import { toast } from 'sonner';
import { Field } from '@/app/admin/payroll/_components/ui';
import { PendingAttachmentChip } from '@/components/shared/PendingAttachmentChip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
export type LedgerFile = { url: string; name: string; type: string; size: number };
export function ledgerPayload(payload: unknown, files: File[]) {
 if (!files.length) return payload;
 const data = new FormData(); data.append('payload', JSON.stringify(payload)); files.forEach(file => data.append('files', file)); return data;
}
export function LedgerFilePicker({ files, onChange, disabled, existing = [] }: { files: File[]; onChange: (files: File[]) => void; disabled: boolean; existing?: LedgerFile[] }) {
 return <Field label="Attachments (optional)"><fieldset disabled={disabled}><label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border/50 px-3 py-2 text-xs"><Paperclip size={14} />Attach photo or document<input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt" className="hidden" onChange={e => {
  const next = [...files, ...Array.from(e.target.files || [])]; e.target.value = '';
  if (next.length + existing.length > 5) { toast.error('Attach up to 5 files'); return; }
  if (next.reduce((sum, f) => sum + f.size, 0) + existing.reduce((sum, f) => sum + f.size, 0) > 25 * 1024 * 1024) { toast.error('Attachments must total 25 MB or less'); return; }
  for (const file of next) { const max = file.type.startsWith('image/') ? 5 : file.type === 'application/pdf' ? 10 : 15; if (!file.size || file.size > max * 1024 * 1024) { toast.error(`${file.name}: maximum ${max} MB`); return; } }
  onChange(next);
 }} /></label><div className="mt-2 flex flex-wrap gap-2">{files.map((file, index) => <PendingAttachmentChip key={`${file.name}_${index}`} file={file} onRemove={() => onChange(files.filter((_, i) => i !== index))} />)}</div></fieldset><p className="mt-1 text-[11px] text-muted-foreground">Up to 5 files, 25 MB total. Photos 5 MB, PDFs 10 MB, documents 15 MB each.</p></Field>;
}
export function LedgerAttachmentList({ attachments, onRemove }: { attachments: LedgerFile[]; onRemove?: (url: string) => void }) {
 const [preview, setPreview] = useState<LedgerFile | null>(null);
 return <><div className="flex flex-wrap gap-2">{attachments.map(file => <div key={file.url} className="inline-flex items-center rounded-lg border border-border/40"><button type="button" className="flex items-center gap-1.5 px-2 py-1.5 text-xs hover:text-primary" onClick={() => setPreview(file)}><Paperclip size={12} /><span className="max-w-48 truncate">{file.name}</span></button>{onRemove && <button type="button" aria-label={`Remove ${file.name}`} className="px-2" onClick={() => onRemove(file.url)}><X size={12} /></button>}</div>)}</div><Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null); }}><DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col bg-card"><DialogHeader><DialogTitle>Ledger attachment</DialogTitle><DialogDescription>{preview?.name}</DialogDescription></DialogHeader><div className="flex-1 min-h-0 overflow-auto">{preview && <>{preview.type.startsWith('image/') ? <img src={preview.url} alt={preview.name} className="w-full max-h-[60vh] object-contain" /> : preview.type === 'application/pdf' ? <iframe src={preview.url} title={preview.name} className="w-full h-[60vh]" /> : <p className="text-sm">Open this document to view it.</p>}</>}</div>{preview && <div className="shrink-0 flex gap-3 text-xs"><a href={preview.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><ExternalLink size={13} />Open</a><a href={preview.url} download={preview.name} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1"><Download size={13} />Download</a></div>}</DialogContent></Dialog></>;
}
