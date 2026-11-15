'use client';

import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';
import { Printer } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PrimaryButton } from '@/app/admin/payroll/_components/ui';

export interface Label { code: string; caption: string }

function Barcode({ value }: { value: string }) {
    const ref = useRef<SVGSVGElement>(null);
    useEffect(() => {
        if (!ref.current) return;
        try {
            JsBarcode(ref.current, value, { format: 'CODE128', height: 40, fontSize: 12, margin: 0, displayValue: true });
        } catch {
            // A value Code128 cannot encode simply shows no bars.
        }
    }, [value]);
    return <svg ref={ref} className="max-w-full" />;
}

/** Preview of barcode labels with a Print button. Printing goes through a clean popup page, so only the labels print. */
export default function LabelSheet({ labels, title, onClose }: { labels: Label[]; title: string; onClose: () => void }) {
    const gridRef = useRef<HTMLDivElement>(null);

    const print = () => {
        if (!gridRef.current) return;
        const win = window.open('', '_blank', 'width=800,height=900');
        if (!win) return;
        const doc = win.document;
        doc.title = title;
        const style = doc.createElement('style');
        style.textContent = '@page{margin:8mm}body{font-family:Arial,sans-serif;margin:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:4mm}.label{border:1px dashed #999;padding:3mm;text-align:center;break-inside:avoid}.cap{font-size:10px;margin-bottom:2mm;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}svg{max-width:100%}';
        doc.head.appendChild(style);
        const grid = doc.createElement('div');
        grid.className = 'grid';
        gridRef.current.querySelectorAll('[data-label]').forEach((node) => {
            const wrap = doc.createElement('div');
            wrap.className = 'label';
            const cap = doc.createElement('div');
            cap.className = 'cap';
            cap.textContent = node.getAttribute('data-caption') ?? '';
            wrap.appendChild(cap);
            const svg = node.querySelector('svg');
            if (svg) wrap.appendChild(doc.importNode(svg, true));
            grid.appendChild(wrap);
        });
        doc.body.appendChild(grid);
        win.focus();
        win.print();
    };

    return (
        <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="sm:max-w-3xl bg-card max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{labels.length} label{labels.length === 1 ? '' : 's'}. Print on plain paper or a label sheet, then stick them on the books or cards.</DialogDescription>
                </DialogHeader>
                <div ref={gridRef} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {labels.map((l) => (
                        <div key={l.code} data-label data-caption={l.caption} className="rounded-lg border border-dashed border-border p-2 text-center">
                            <p className="text-[11px] truncate mb-1">{l.caption}</p>
                            <Barcode value={l.code} />
                        </div>
                    ))}
                </div>
                <PrimaryButton onClick={print} className="h-9 px-5 w-fit"><Printer size={14} /> Print</PrimaryButton>
            </DialogContent>
        </Dialog>
    );
}
