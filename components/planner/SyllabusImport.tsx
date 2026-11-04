'use client';

import { useEffect, useRef, useState } from 'react';
import { FileUp, ClipboardPaste, ListOrdered, Library, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  plannerApi,
  type ParsedChapter,
  type PreviewResult,
  type TemplateListItem,
} from '@/lib/plannerApi';
import { getErrorMessage } from '@/lib/error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export type ImportPreview = PreviewResult & {
  title?: string;
  medium?: string;
  sourceTemplateId?: string;
};

interface SyllabusImportProps {
  subjectId: string;
  onPreview: (r: ImportPreview) => void;
}

// True while the calling tab is mounted; results arriving after unmount must be dropped.
function useMountedRef() {
  const ref = useRef(true);
  useEffect(() => {
    ref.current = true;
    return () => {
      ref.current = false;
    };
  }, []);
  return ref;
}

type TabKey = 'pdf' | 'paste' | 'quick' | 'library';

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const MAX_PASTE_CHARS = 20000;

export function SyllabusImport({ subjectId, onPreview }: SyllabusImportProps) {
  const [tab, setTab] = useState<TabKey>('pdf');
  const [libraryAvailable, setLibraryAvailable] = useState(false);

  // Library is only offered when the server flag is on (404 otherwise): probe silently.
  useEffect(() => {
    let cancelled = false;
    plannerApi
      .listLibraryTemplates({})
      .then(() => {
        if (!cancelled) setLibraryAvailable(true);
      })
      .catch(() => {
        /* flag off or unavailable: library tab stays hidden */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const tabs: { key: TabKey; label: string; icon: typeof FileUp }[] = [
    { key: 'pdf', label: 'Upload textbook PDF', icon: FileUp },
    { key: 'paste', label: 'Paste a list', icon: ClipboardPaste },
    { key: 'quick', label: 'Quick start', icon: ListOrdered },
    ...(libraryAvailable ? [{ key: 'library' as const, label: 'Maharashtra library', icon: Library }] : []),
  ];

  return (
    <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'pdf' && <PdfTab subjectId={subjectId} onPreview={onPreview} />}
      {tab === 'paste' && <PasteTab subjectId={subjectId} onPreview={onPreview} />}
      {tab === 'quick' && <QuickTab onPreview={onPreview} />}
      {tab === 'library' && libraryAvailable && <LibraryTab subjectId={subjectId} onPreview={onPreview} />}
    </div>
  );
}

function PdfTab({ subjectId, onPreview }: SyllabusImportProps) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useMountedRef();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSelect = (f: File | null) => {
    setFileError(null);
    if (!f) {
      setFile(null);
      return;
    }
    const looksPdf = f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
    if (!looksPdf) {
      setFile(null);
      setFileError('Please choose a PDF file.');
      return;
    }
    if (f.size > MAX_PDF_BYTES) {
      setFile(null);
      setFileError('This PDF is larger than 25 MB. Please choose a smaller file.');
      return;
    }
    setFile(f);
  };

  const run = async () => {
    if (!file || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await plannerApi.previewPdf(subjectId, file);
      if (mounted.current) onPreview(r);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not read this PDF'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Upload the textbook and we will read its contents page to list the chapters. You can edit everything before saving.
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        disabled={busy}
        onChange={(e) => onSelect(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-foreground hover:file:bg-muted/70"
      />
      {fileError && <p className="text-sm text-destructive">{fileError}</p>}
      {file && !fileError && (
        <p className="text-xs text-muted-foreground">
          {file.name} · {(file.size / (1024 * 1024)).toFixed(1)} MB
        </p>
      )}
      <Button onClick={() => void run()} disabled={!file || busy}>
        {busy && <Loader2 size={14} className="animate-spin" />}
        {busy ? 'Reading…' : 'Read chapters'}
      </Button>
    </div>
  );
}

function PasteTab({ subjectId, onPreview }: SyllabusImportProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const mounted = useMountedRef();
  const tooLong = text.length > MAX_PASTE_CHARS;

  const run = async () => {
    if (busyRef.current || !text.trim() || tooLong) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await plannerApi.previewPaste(subjectId, text);
      if (mounted.current) onPreview(r);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not read this list'));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Paste the chapter list, one chapter per line. Numbers and page numbers are fine.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={8}
        disabled={busy}
        placeholder={'1. Real Numbers\n2. Polynomials\n3. Linear Equations'}
        className="w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
      />
      <div className="flex items-center justify-between gap-3">
        <Button onClick={() => void run()} disabled={busy || !text.trim() || tooLong}>
          {busy && <Loader2 size={14} className="animate-spin" />}
          {busy ? 'Reading…' : 'Read list'}
        </Button>
        <span className={`text-xs ${tooLong ? 'text-destructive' : 'text-muted-foreground'}`}>
          {text.length.toLocaleString()} / {MAX_PASTE_CHARS.toLocaleString()}
        </span>
      </div>
    </div>
  );
}

function QuickTab({ onPreview }: { onPreview: SyllabusImportProps['onPreview'] }) {
  const [count, setCount] = useState('12');
  const n = Number(count);
  const valid = count.trim() !== '' && Number.isInteger(n) && n >= 1 && n <= 60;

  const build = () => {
    if (!valid) return;
    const chapters: ParsedChapter[] = Array.from({ length: n }, (_, i) => ({
      number: i + 1,
      name: `Chapter ${i + 1}`,
      term: null,
      startPage: null,
      endPage: null,
      weight: 1,
      needsReview: false,
    }));
    onPreview({ chapters, warnings: [] });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Not sure of the names yet? Start with numbered chapters and rename them later.
      </p>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={1}
          max={60}
          value={count}
          onChange={(e) => setCount(e.target.value)}
          className="w-24"
          aria-label="Number of chapters"
        />
        <Button onClick={build} disabled={!valid}>
          Create chapters
        </Button>
      </div>
      {!valid && <p className="text-sm text-destructive">Enter a whole number from 1 to 60.</p>}
    </div>
  );
}

function LibraryTab({ subjectId, onPreview }: SyllabusImportProps) {
  const [items, setItems] = useState<TemplateListItem[] | null>(null);
  const [board, setBoard] = useState('');
  const [medium, setMedium] = useState('');
  const [standard, setStandard] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adoptingId, setAdoptingId] = useState<string | null>(null);
  const adoptingRef = useRef(false);
  const mounted = useMountedRef();

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      plannerApi
        .listLibraryTemplates({
          board: board.trim() || undefined,
          medium: medium.trim() || undefined,
          standardLabel: standard.trim() || undefined,
          subjectName: subjectName.trim() || undefined,
        })
        .then((r) => {
          if (!cancelled) setItems(r);
        })
        .catch((err) => {
          if (!cancelled) toast.error(getErrorMessage(err, 'Could not load the library'));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [board, medium, standard, subjectName]);

  const adopt = async (id: string) => {
    if (adoptingRef.current) return;
    adoptingRef.current = true;
    setAdoptingId(id);
    try {
      const t = await plannerApi.adoptTemplate(subjectId, id);
      if (!mounted.current) return;
      onPreview({
        chapters: t.chapters,
        warnings: [],
        title: t.title,
        medium: t.medium,
        sourceTemplateId: t.sourceTemplateId,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not use this template'));
    } finally {
      adoptingRef.current = false;
      setAdoptingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Input placeholder="Board" value={board} onChange={(e) => setBoard(e.target.value)} aria-label="Board" />
        <Input placeholder="Medium" value={medium} onChange={(e) => setMedium(e.target.value)} aria-label="Medium" />
        <Input placeholder="Class" value={standard} onChange={(e) => setStandard(e.target.value)} aria-label="Class" />
        <Input
          placeholder="Subject"
          value={subjectName}
          onChange={(e) => setSubjectName(e.target.value)}
          aria-label="Subject"
        />
      </div>
      {loading && !items ? (
        <div className="h-24 rounded-xl bg-muted animate-pulse" />
      ) : !items || items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No templates match these filters.</p>
      ) : (
        <ul className="divide-y divide-border/50 rounded-xl border border-border/50 max-h-80 overflow-y-auto">
          {items.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{t.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {t.board} · {t.standardLabel} · {t.subjectName} · {t.medium} · {t.chapterCount}{' '}
                  {t.chapterCount === 1 ? 'chapter' : 'chapters'}
                </p>
              </div>
              <Button size="sm" variant="outline" disabled={adoptingId !== null} onClick={() => void adopt(t.id)}>
                {adoptingId === t.id && <Loader2 size={12} className="animate-spin" />}
                Use this
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
