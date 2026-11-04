function normalizeChapterName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/^\p{Nd}+\s*[.)]\s*/u, '')
    .trim();
}

/**
 * Carries existing chapter ids onto incoming rows. Each existing id is used at most once.
 * 1) exact match on normalised name; 2) if both lists have equal length, pair the
 * still-unmatched rows by index; 3) otherwise the row has no id (a new chapter).
 */
export function matchChapterIds<T extends { name: string }>(
  existing: Array<{ id: string; name: string }>,
  incoming: T[],
): Array<T & { id?: string }> {
  const ids: Array<string | undefined> = incoming.map(() => undefined);
  const used = new Set<number>();

  incoming.forEach((row, i) => {
    const key = normalizeChapterName(row.name);
    const j = existing.findIndex((e, idx) => !used.has(idx) && normalizeChapterName(e.name) === key);
    if (j >= 0) {
      used.add(j);
      ids[i] = existing[j].id;
    }
  });

  if (existing.length === incoming.length) {
    incoming.forEach((_, i) => {
      if (ids[i] === undefined && !used.has(i)) {
        used.add(i);
        ids[i] = existing[i].id;
      }
    });
  }

  return incoming.map((row, i) => {
    const id = ids[i];
    return id === undefined ? { ...row } : { ...row, id };
  });
}
