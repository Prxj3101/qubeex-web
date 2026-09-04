// Lightweight markdown rendering for AI chat replies — same subset/approach
// as the Blackboard AI Chat panel's own renderer (bold, code, italic, lists,
// headings-as-bold). Duplicated here rather than imported from the Blackboard
// page file to avoid pulling that large, teacher-only file into the admin
// bundle just for this one helper.
import React from 'react';

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
    const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\n]+\*)/g;
    const out: React.ReactNode[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    let n = 0;
    while ((m = pattern.exec(text)) !== null) {
        if (m.index > last) out.push(text.slice(last, m.index));
        const tok = m[0];
        const key = `${keyPrefix}-i${n++}`;
        if (tok.startsWith('**')) {
            out.push(<strong key={key} className="font-semibold">{tok.slice(2, -2)}</strong>);
        } else if (tok.startsWith('`')) {
            out.push(<code key={key} className="px-1 py-0.5 rounded bg-black/10 dark:bg-white/10 text-[11px] font-mono">{tok.slice(1, -1)}</code>);
        } else {
            out.push(<em key={key}>{tok.slice(1, -1)}</em>);
        }
        last = m.index + tok.length;
    }
    if (last < text.length) out.push(text.slice(last));
    return out;
}

export function MiniMarkdown({ text }: { text: string }) {
    const lines = text.split('\n');
    const blocks: React.ReactNode[] = [];
    let paragraph: string[] = [];
    let list: { ordered: boolean; items: string[] } | null = null;

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        const key = `p${blocks.length}`;
        blocks.push(<p key={key}>{renderInline(paragraph.join(' '), key)}</p>);
        paragraph = [];
    };
    const flushList = () => {
        if (!list) return;
        const key = `l${blocks.length}`;
        const items = list.items.map((it, i) => <li key={`${key}-${i}`}>{renderInline(it, `${key}-${i}`)}</li>);
        blocks.push(list.ordered
            ? <ol key={key} className="list-decimal pl-4 space-y-0.5">{items}</ol>
            : <ul key={key} className="list-disc pl-4 space-y-0.5">{items}</ul>);
        list = null;
    };

    for (const raw of lines) {
        const line = raw.trimEnd();
        if (!line.trim()) { flushParagraph(); flushList(); continue; }

        const heading = line.match(/^#{1,6}\s+(.*)$/);
        const ordered = line.match(/^\s*\d+[.)]\s+(.*)$/);
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);

        if (heading) {
            flushParagraph(); flushList();
            const key = `h${blocks.length}`;
            blocks.push(<p key={key} className="font-semibold mt-1">{renderInline(heading[1], key)}</p>);
        } else if (ordered || bullet) {
            flushParagraph();
            const isOrdered = !!ordered;
            const item = (ordered ?? bullet)![1];
            if (list && list.ordered !== isOrdered) flushList();
            if (!list) list = { ordered: isOrdered, items: [] };
            list.items.push(item);
        } else {
            flushList();
            paragraph.push(line.trim());
        }
    }
    flushParagraph();
    flushList();

    return <div className="space-y-1.5">{blocks}</div>;
}
