// Vocabulary parsing: the "Wort, der — meaning" list format, pipe format,
// CSV and JSON. Self-contained (type imports only) so the Node build script
// can import it directly.
import type { Article, Pos } from '../types';

export interface ParsedEntry {
  de: string;
  lemma: string;
  article?: Article;
  variants: string[];
  pos: Pos;
  en: string;
  bn?: string;
  situations?: string[];
}

export interface ParseIssue {
  line: number;
  text: string;
  reason: string;
}

export interface ParseResult {
  entries: ParsedEntry[];
  issues: ParseIssue[];
}

const ARTICLES: Article[] = ['der', 'die', 'das'];

/** Expand optional "(...)" groups: "Disko(thek)" → ["Disko", "Diskothek"]. */
export function expandOptional(s: string): string[] {
  const m = s.match(/\(([^()]*)\)/);
  if (!m || m.index === undefined) return [s.replace(/\s+/g, ' ').trim()];
  const before = s.slice(0, m.index);
  const after = s.slice(m.index + m[0].length);
  const out = [...expandOptional(before + after), ...expandOptional(before + m[1] + after)];
  return [...new Set(out.filter(Boolean))];
}

/** Split on commas that are not inside parentheses. */
export function splitTopLevel(s: string, sep = ','): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === sep && depth === 0) {
      parts.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts.filter(Boolean);
}

export function detectPos(header: string): Pos | null {
  const h = header.toLowerCase();
  if (h.includes('pronoun')) return 'pronoun';
  if (h.includes('noun')) return 'noun';
  if (h.includes('adjective')) return 'adjective';
  if (h.includes('adverb')) return 'adverb';
  if (h.includes('verb')) return 'verb';
  return null;
}

const isAbbrev = (t: string) => /\.$/.test(t) || t === 'pl';

/** Parse the German side of an entry. `posHint` decides how articles are read. */
export function parseGerman(raw: string, posHint?: Pos): Omit<ParsedEntry, 'en' | 'bn' | 'situations'> {
  const text = raw.replace(/﻿/g, '').trim();
  const tokens = splitTopLevel(text);
  let article: Article | undefined;
  let forms = tokens;

  // "Apfel, der" list style
  const last = tokens[tokens.length - 1]?.toLowerCase();
  if (tokens.length > 1 && ARTICLES.includes(last as Article) && posHint !== 'pronoun') {
    article = last as Article;
    forms = tokens.slice(0, -1);
  } else if (posHint !== 'pronoun') {
    // "der Apfel" style
    const m = text.match(/^(der|die|das)\s+(\S.*)$/i);
    if (m && /^[A-ZÄÖÜ]/.test(m[2])) {
      article = m[1].toLowerCase() as Article;
      forms = splitTopLevel(m[2]);
    }
  }

  forms = forms.filter((t) => !isAbbrev(t));
  if (forms.length === 0) forms = [tokens[0]];

  const pos: Pos = article ? 'noun' : posHint && posHint !== 'noun' ? posHint : guessPos(forms[0]);
  const expanded = forms.flatMap(expandOptional);
  const variants = new Set<string>();
  for (const f of expanded) {
    variants.add(article ? `${article} ${f}` : f);
    // Reflexive verbs: also accept the verb without "sich".
    if (!article && /^sich\s+/.test(f)) variants.add(f.replace(/^sich\s+/, ''));
  }

  const lemma = expandOptional(forms[0])[0];
  const de = article ? `${article} ${forms.join(', ')}` : forms.join(', ');
  return { de, lemma, article, variants: [...variants], pos };
}

function guessPos(form: string): Pos {
  if (/^(sich\s+)?[a-zäöüß]+(en|ern|eln)$/.test(form) && form.length > 4) return 'verb';
  if (/^[A-ZÄÖÜ]/.test(form)) return 'noun';
  return 'other';
}

/** Split a line into German and meaning parts for the list / pipe formats. */
function splitLine(line: string): string[] | null {
  if (line.includes('|')) return line.split('|').map((s) => s.trim());
  if (line.includes('\t')) return line.split('\t').map((s) => s.trim());
  const dash = line.match(/^(.+?)\s+[—–]\s+(.+)$/) ?? line.match(/^(.+?)\s+-\s+(.+)$/);
  if (dash) return [dash[1].trim(), dash[2].trim()];
  return null;
}

/**
 * Parse free text: section headers ("A1 Noun"), "Wort, der — meaning",
 * "der Apfel | apple | আপেল", tab separated, or "Wort - meaning".
 */
export function parseText(text: string): ParseResult {
  const entries: ParsedEntry[] = [];
  const issues: ParseIssue[] = [];
  let pos: Pos | undefined;
  const lines = text.replace(/﻿/g, '').split(/\r?\n/);
  lines.forEach((rawLine, i) => {
    const line = rawLine.trim();
    if (!line || /^[-=_*#\s]+$/.test(line)) return;
    const parts = splitLine(line);
    if (!parts) {
      const p = detectPos(line);
      if (p) pos = p;
      else issues.push({ line: i + 1, text: line, reason: 'No separator (use "|" or "—")' });
      return;
    }
    const [de, en, bn] = parts;
    if (!de || !en) {
      issues.push({ line: i + 1, text: line, reason: 'Missing German word or meaning' });
      return;
    }
    entries.push({ ...parseGerman(de, pos), en, bn: bn || undefined });
  });
  return { entries, issues };
}

/** Minimal RFC-4180 CSV reader. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/﻿/g, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const HEADER_ALIASES: Record<string, string> = {
  german: 'de', deutsch: 'de', de: 'de', word: 'de', wort: 'de',
  english: 'en', en: 'en', meaning: 'en', translation: 'en',
  bengali: 'bn', bangla: 'bn', bn: 'bn',
  type: 'pos', pos: 'pos', 'part of speech': 'pos',
};

export function parseCsv(text: string): ParseResult {
  const rows = readCsv(text);
  const entries: ParsedEntry[] = [];
  const issues: ParseIssue[] = [];
  if (!rows.length) return { entries, issues: [{ line: 1, text: '', reason: 'File is empty' }] };

  let cols: Record<string, number> = { de: 0, en: 1, bn: 2 };
  let start = 0;
  const header = rows[0].map((c) => HEADER_ALIASES[c.trim().toLowerCase()]);
  if (header.includes('de') && header.includes('en')) {
    cols = {};
    header.forEach((h, idx) => h && (cols[h] = idx));
    start = 1;
  }
  for (let r = start; r < rows.length; r++) {
    const row = rows[r];
    const de = row[cols.de]?.trim();
    const en = row[cols.en]?.trim();
    const bn = cols.bn !== undefined ? row[cols.bn]?.trim() : undefined;
    const posRaw = cols.pos !== undefined ? row[cols.pos]?.trim() : undefined;
    if (!de || !en) {
      issues.push({ line: r + 1, text: row.join(', '), reason: !de ? 'Missing German word' : 'Missing meaning' });
      continue;
    }
    if (/^\d+([.,]\d+)?$/.test(de)) {
      issues.push({ line: r + 1, text: row.join(', '), reason: 'German column looks like a number' });
      continue;
    }
    const pos = posRaw ? (detectPos(posRaw) ?? undefined) : undefined;
    entries.push({ ...parseGerman(de, pos), en, bn: bn || undefined });
  }
  return { entries, issues };
}

export function parseJson(text: string): ParseResult {
  const issues: ParseIssue[] = [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { entries: [], issues: [{ line: 1, text: '', reason: `Invalid JSON: ${(e as Error).message}` }] };
  }
  const list = Array.isArray(data) ? data : (data as { words?: unknown[] })?.words;
  if (!Array.isArray(list)) return { entries: [], issues: [{ line: 1, text: '', reason: 'Expected an array of words' }] };
  const entries: ParsedEntry[] = [];
  list.forEach((item, i) => {
    const o = item as Record<string, unknown>;
    const de = String(o.de ?? o.german ?? o.word ?? '').trim();
    const en = String(o.en ?? o.english ?? o.meaning ?? '').trim();
    if (!de || !en) {
      issues.push({ line: i + 1, text: JSON.stringify(item).slice(0, 80), reason: 'Needs "german" and "english" fields' });
      return;
    }
    const bn = String(o.bn ?? o.bengali ?? '').trim() || undefined;
    const pos = typeof o.pos === 'string' ? (detectPos(o.pos) ?? (o.pos as Pos)) : undefined;
    const situations = Array.isArray(o.situations) ? o.situations.map(String) : undefined;
    entries.push({ ...parseGerman(de, pos), en, bn, situations });
  });
  return { entries, issues };
}

export function parseAny(text: string, filename = ''): ParseResult {
  const t = text.trim();
  if (filename.endsWith('.json') || t.startsWith('[') || t.startsWith('{')) return parseJson(t);
  const firstLine = t.split(/\r?\n/)[0] ?? '';
  const looksCsv = filename.endsWith('.csv') || (/[,;]/.test(firstLine) && !/[|—–\t]/.test(firstLine) && /,.*,|;/.test(firstLine));
  return looksCsv ? parseCsv(t) : parseText(t);
}

/** Split an English meaning string into individual senses. */
export function senses(en: string): string[] {
  return splitTopLevel(en.replace(/;/g, ','))
    .map((s) => s.toLowerCase().replace(/^to\s+/, '').replace(/\s*\([^)]*\)\s*/g, ' ').trim())
    .filter(Boolean);
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
