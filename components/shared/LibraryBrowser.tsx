'use client';

import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Search } from 'lucide-react';
import api from '@/lib/api';

interface MyLoan { id: string; title: string; dueAt: string; renewals: number; overdue: boolean }
interface MyFine { id: string; kind: 'LATE' | 'LOST' | 'DAMAGED'; amountPaise: number; collectedVia: 'LIBRARIAN' | 'FEES' }
interface BookItem { id: string; title: string; author: string | null; category: string | null; shelf: string | null; language: string | null; total: number; available: number }

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateLabel = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/** Read-only library view for students and teachers: my issued books, and a catalogue search. */
export default function LibraryBrowser({ base }: { base: '/student/library' | '/teacher/library' }) {
    const [mine, setMine] = useState<{ loans: MyLoan[]; fines: MyFine[] } | null>(null);
    const [mineError, setMineError] = useState(false);
    const [text, setText] = useState('');
    const [query, setQuery] = useState('');
    const [books, setBooks] = useState<{ query: string; items: BookItem[] } | null>(null);
    const [searchError, setSearchError] = useState(false);

    useEffect(() => {
        let live = true;
        api.get(`${base}/my-loans`)
            .then((res) => { if (live) setMine(res.data.data as { loans: MyLoan[]; fines: MyFine[] }); })
            .catch(() => { if (live) setMineError(true); });
        return () => { live = false; };
    }, [base]);

    useEffect(() => { const t = setTimeout(() => setQuery(text.trim()), 300); return () => clearTimeout(t); }, [text]);

    useEffect(() => {
        let live = true;
        api.get(`${base}/books`, { params: { q: query || undefined, pageSize: 30 } })
            .then((res) => { if (live) { setBooks({ query, items: res.data.data.items as BookItem[] }); setSearchError(false); } })
            .catch(() => { if (live) setSearchError(true); });
        return () => { live = false; };
    }, [base, query]);

    const searching = !books || books.query !== query;

    return (
        <div className="max-w-3xl mx-auto space-y-6 px-1 pb-10">
            <div>
                <h1 className="text-xl font-bold">Library</h1>
                <p className="text-muted-foreground text-[13px]">Your books and the library catalogue</p>
            </div>

            <section className="space-y-2">
                <h2 className="text-sm font-bold">My books</h2>
                {mineError ? <p className="text-sm text-muted-foreground">Could not load your books. Please try again later.</p>
                    : !mine ? <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    : mine.loans.length === 0 ? <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-4">You have no books issued right now.</p>
                    : (
                        <ul className="rounded-2xl border border-border bg-card divide-y divide-border/60">
                            {mine.loans.map((l) => (
                                <li key={l.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{l.title}</p>
                                        <p className="text-xs text-muted-foreground">Due {dateLabel(l.dueAt)}{l.renewals ? ` · renewed ${l.renewals}×` : ''}</p>
                                    </div>
                                    {l.overdue && <span className="text-[11px] font-semibold rounded-full bg-red-500/10 text-red-500 px-2 py-0.5">Overdue</span>}
                                </li>
                            ))}
                        </ul>
                    )}
                {mine && mine.fines.length > 0 && (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-1">
                        <p className="text-sm font-semibold">Library fines</p>
                        {mine.fines.map((f) => (
                            <p key={f.id} className="text-xs">{f.kind.charAt(0) + f.kind.slice(1).toLowerCase()} fine {rupees(f.amountPaise)} · {f.collectedVia === 'FEES' ? 'shown in your fees' : 'pay at the library'}</p>
                        ))}
                    </div>
                )}
            </section>

            <section className="space-y-2">
                <h2 className="text-sm font-bold">Find a book</h2>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Search by title, author, subject or ISBN" aria-label="Search the library"
                        className="w-full h-10 pl-8 pr-3 rounded-xl border border-border bg-background text-sm focus:outline-none focus:border-foreground/30" />
                </div>
                {searchError ? <p className="text-sm text-muted-foreground">Could not search the library right now.</p>
                    : searching ? <Loader2 size={16} className="animate-spin text-muted-foreground" />
                    : books.items.length === 0 ? <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-border p-4">{query ? 'No books match your search.' : 'The library has no books yet.'}</p>
                    : (
                        <ul className="rounded-2xl border border-border bg-card divide-y divide-border/60">
                            {books.items.map((b) => (
                                <li key={b.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                                    <BookOpen size={16} className="text-muted-foreground shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-semibold truncate">{b.title}</p>
                                        <p className="text-xs text-muted-foreground truncate">{[b.author, b.category, b.shelf && `Shelf ${b.shelf}`].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${b.available > 0 ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                                        {b.available > 0 ? `${b.available} available` : 'All copies out'}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    )}
            </section>
        </div>
    );
}
