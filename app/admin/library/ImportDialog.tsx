'use client';

import { useRef, useState } from 'react';
import { Download, FileSpreadsheet, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { getErrorMessage } from '@/lib/error';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pill, PrimaryButton, SecondaryButton } from '@/app/admin/payroll/_components/ui';

interface PreviewRow { row: number; ok: boolean; errors: string[]; data?: { title: string; copies: number } }
interface Preview { rows: PreviewRow[]; total: number; valid: number }

const TEMPLATE = 'Title,Author,ISBN,Category,Language,Shelf,Price,Copies\nWings of Fire,A. P. J. Abdul Kalam,9788173711466,Biography,English,A2,250,3\n';
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };
const SHOWN_PROBLEMS = 50;

export default function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: (range: { firstCode: string; lastCode: string }) => void }) {
    const fileRef = useRef<HTMLInputElement>(null);
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<Preview | null>(null);
    const [busy, setBusy] = useState(false);

    const form = (f: File) => { const body = new FormData(); body.append('file', f); return body; };

    const choose = async (f: File | null) => {
        setFile(f);
        setPreview(null);
        if (!f) return;
        setBusy(true);
        try {
            const res = await api.post('/admin/library/import/preview', form(f), MULTIPART);
            setPreview(res.data.data as Preview);
        } catch (err) {
            toast.error(getErrorMessage(err, 'Could not read this file'));
            setFile(null);
            if (fileRef.current) fileRef.current.value = '';
        } finally {
            setBusy(false);
        }
    };

    const commit = async () => {
        if (!file) return;
        setBusy(true);
        try {
            const res = await api.post('/admin/library/import/commit', form(file), MULTIPART);
            toast.success(`Imported ${res.data.data.books} books (${res.data.data.copies} copies)`);
            onDone({ firstCode: res.data.data.firstCode as string, lastCode: res.data.data.lastCode as string });
        } catch (err) {
            toast.error(getErrorMessage(err, 'Import failed'));
        } finally {
            setBusy(false);
        }
    };

    const downloadTemplate = () => {
        const url = URL.createObjectURL(new Blob([TEMPLATE], { type: 'text/csv' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = 'library-books-template.csv';
        a.click();
        URL.revokeObjectURL(url);
    };

    const problems = preview?.rows.filter((r) => !r.ok) ?? [];
    const canImport = !!preview && preview.total > 0 && preview.valid === preview.total && !busy;

    return (
        <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
            <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Import books</DialogTitle>
                    <DialogDescription>Upload an Excel or CSV file. Only Title is required. Each book gets as many copies as its Copies column says (default 1), and every copy gets its own barcode.</DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                    <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => void choose(e.target.files?.[0] ?? null)} />
                    <SecondaryButton type="button" onClick={() => fileRef.current?.click()} disabled={busy}><Upload size={14} />{file ? 'Choose another file' : 'Choose file'}</SecondaryButton>
                    <SecondaryButton type="button" onClick={downloadTemplate}><Download size={14} />Download template</SecondaryButton>
                    {file && <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><FileSpreadsheet size={14} />{file.name}</span>}
                    {busy && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
                </div>

                {preview && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            <Pill tone="muted">{preview.total} rows</Pill>
                            <Pill tone="green">{preview.valid} ready</Pill>
                            {problems.length > 0 && <Pill tone="red">{problems.length} need fixing</Pill>}
                        </div>
                        {problems.length > 0 && (
                            <div className="rounded-xl border border-border max-h-64 overflow-y-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-muted/50 sticky top-0"><tr><th className="text-left px-3 py-2 w-16">Row</th><th className="text-left px-3 py-2">Problem</th></tr></thead>
                                    <tbody>
                                        {problems.slice(0, SHOWN_PROBLEMS).map((r) => (
                                            <tr key={r.row} className="border-t border-border/60"><td className="px-3 py-1.5">{r.row}</td><td className="px-3 py-1.5">{r.errors.join(' · ')}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                                {problems.length > SHOWN_PROBLEMS && <p className="text-xs text-muted-foreground px-3 py-2">…and {problems.length - SHOWN_PROBLEMS} more.</p>}
                            </div>
                        )}
                        {problems.length > 0 && <p className="text-xs text-muted-foreground">Fix these rows in your file and choose it again. Nothing is imported until every row is valid.</p>}
                        {preview.total === 0 && <p className="text-sm text-muted-foreground">No books were found in this file.</p>}
                    </div>
                )}

                <PrimaryButton onClick={() => void commit()} disabled={!canImport} className="h-9 px-5 w-fit">
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Import {preview?.valid ?? 0} books
                </PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}
