// Builds the bundled collections from data/raw/*.txt.
//   node scripts/build-data.mjs          → public/collections/*.json (merges data/situations)
//   node scripts/build-data.mjs --jobs   → also writes data/situation-jobs/* for situation writing
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parseText, slugify } from '../src/data/parse.ts';

const COLLECTIONS = [
  { id: 'a1', file: 'a1.txt', name: 'A1 Vocabulary', description: 'Goethe A1 word list' },
  { id: 'a2', file: 'a2.txt', name: 'A2 Vocabulary', description: 'Goethe A2 word list' },
  { id: 'b1', file: 'b1.txt', name: 'B1 Vocabulary', description: 'Goethe B1 word list' },
  { id: 'extra', file: 'extra.txt', name: 'Extra Vocabulary', description: 'Extended word list' },
];
const POS_CODE = { noun: 'n', verb: 'v', adjective: 'adj', adverb: 'adv', pronoun: 'pr', other: 'x' };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Proportional interleave so every 20-word level mixes word types. */
function interleave(buckets) {
  const total = buckets.reduce((n, b) => n + b.length, 0);
  const taken = buckets.map(() => 0);
  const out = [];
  while (out.length < total) {
    let best = -1;
    let bestScore = Infinity;
    buckets.forEach((b, i) => {
      if (taken[i] >= b.length) return;
      const score = (taken[i] + 0.5) / b.length;
      if (score < bestScore) {
        bestScore = score;
        best = i;
      }
    });
    out.push(buckets[best][taken[best]++]);
  }
  return out;
}

const writeJobs = process.argv.includes('--jobs');
mkdirSync('public/collections', { recursive: true });
if (writeJobs) mkdirSync('data/situation-jobs', { recursive: true });

const index = [];
for (const c of COLLECTIONS) {
  const { entries, issues } = parseText(readFileSync(`data/raw/${c.file}`, 'utf8'));
  if (issues.length) console.warn(`${c.id}: ${issues.length} issues`, issues.slice(0, 5));

  const seen = new Map();
  const withIds = entries.map((e) => {
    let id = `${c.id}-${POS_CODE[e.pos]}-${slugify(e.lemma)}`;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    if (n > 1) id += `-${n}`;
    return { id, ...e };
  });

  const rand = mulberry32([...c.id].reduce((h, ch) => h * 31 + ch.charCodeAt(0), 7));
  const byPos = new Map();
  for (const w of withIds) byPos.set(w.pos, [...(byPos.get(w.pos) ?? []), w]);
  const ordered = interleave([...byPos.values()].map((b) => shuffle(b, rand)));

  let situations = {};
  const sitDir = 'data/situations';
  if (existsSync(sitDir)) {
    for (const f of readdirSync(sitDir).filter((f) => f.startsWith(`${c.id}-`) && f.endsWith('.json'))) {
      Object.assign(situations, JSON.parse(readFileSync(`${sitDir}/${f}`, 'utf8')));
    }
  }

  const words = ordered.map((w, order) => ({
    ...w,
    collectionId: c.id,
    order,
    ...(situations[w.id]?.length ? { situations: situations[w.id] } : {}),
  }));
  const missing = words.filter((w) => !w.situations).length;
  const json = JSON.stringify(words);
  writeFileSync(`public/collections/${c.id}.json`, json);
  const version = createHash('sha1').update(json).digest('hex').slice(0, 12);
  index.push({ id: c.id, name: c.name, description: c.description, count: words.length, version });
  console.log(`${c.id}: ${words.length} words, ${missing} without situations`);

  if (writeJobs) {
    const CHUNK = 400;
    for (let i = 0; i * CHUNK < words.length; i++) {
      const slice = words.slice(i * CHUNK, (i + 1) * CHUNK).map((w) => ({ id: w.id, de: w.de, pos: w.pos, en: w.en }));
      writeFileSync(`data/situation-jobs/${c.id}-${i + 1}.json`, JSON.stringify(slice, null, 1));
    }
  }
}
writeFileSync('public/collections/index.json', JSON.stringify(index, null, 2));
