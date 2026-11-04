// Builds the 50 fixed "Mutprobe" challenges from the bundled lists.
// Each has 20 words mixed from A1, A2, B1 and Extra, getting harder as the
// number rises. The lists are fixed (seeded), so Mutprobe 17 is the same
// for everyone and on every retry. Run: npm run challenges
import fs from 'node:fs';

const TIERS = ['a1', 'a2', 'b1', 'extra'];
// Words per tier for each band of ten challenges (each row sums to 20).
const BANDS = [
  [14, 6, 0, 0],
  [6, 9, 5, 0],
  [2, 6, 9, 3],
  [0, 4, 10, 6],
  [0, 2, 8, 10],
];
const COUNT = 50;
const SIZE = 20;
const SEED = 0x4d757470; // "Mutp"

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const r = rng(SEED);
const seenLemma = new Set();
const pools = Object.fromEntries(
  TIERS.map((id) => {
    const words = JSON.parse(fs.readFileSync(`public/collections/${id}.json`, 'utf8'));
    // Pronouns are grammar, not vocabulary; every word has hand-written situations.
    const ok = words.filter((w) => w.pos !== 'pronoun' && w.pos !== 'other' && w.situations?.length).sort((a, b) => a.id.localeCompare(b.id));
    return [id, shuffle(ok, r)];
  }),
);

function take(tier) {
  const pool = pools[tier];
  while (pool.length) {
    const w = pool.shift();
    const key = w.lemma.toLowerCase();
    if (seenLemma.has(key)) continue;
    seenLemma.add(key);
    return w.id;
  }
  throw new Error(`ran out of ${tier} words`);
}

const challenges = [];
for (let i = 0; i < COUNT; i++) {
  const band = BANDS[Math.floor(i / 10)];
  const ids = [];
  band.forEach((n, t) => {
    for (let k = 0; k < n; k++) ids.push(take(TIERS[t]));
  });
  if (ids.length !== SIZE) throw new Error('bad band');
  challenges.push(ids);
}

fs.writeFileSync('src/data/challenges.json', JSON.stringify({ version: 1, challenges }) + '\n');
console.log(`wrote ${challenges.length} challenges`);
