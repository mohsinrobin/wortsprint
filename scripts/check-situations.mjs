// Validates situation files for one job chunk.
//   node scripts/check-situations.mjs a1-1
// Reads data/situation-jobs/<chunk>.json and every data/situations/<chunk>-p*.json.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const chunk = process.argv[2];
if (!chunk) {
  console.error('usage: node scripts/check-situations.mjs <chunk>');
  process.exit(2);
}
const job = JSON.parse(readFileSync(`data/situation-jobs/${chunk}.json`, 'utf8'));
const dir = 'data/situations';
const merged = {};
if (existsSync(dir)) {
  for (const f of readdirSync(dir).filter((f) => f.startsWith(`${chunk}-p`) && f.endsWith('.json'))) {
    try {
      Object.assign(merged, JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')));
    } catch (e) {
      console.log(`INVALID JSON in ${f}: ${e.message}`);
    }
  }
}

const problems = [];
const ids = new Set(job.map((w) => w.id));
for (const id of Object.keys(merged)) if (!ids.has(id)) problems.push(`unknown id ${id}`);

for (const w of job) {
  const s = merged[w.id];
  if (!Array.isArray(s)) {
    problems.push(`${w.id}: missing`);
    continue;
  }
  if (s.length !== 3) problems.push(`${w.id}: has ${s.length} situations, needs 3`);
  const english = w.en.toLowerCase();
  const forms = w.de
    .replace(/^(der|die|das)\s+/, '')
    .split(/,\s*/)
    .map((f) => f.replace(/[()]/g, '').replace(/^sich\s+/, '').trim().toLowerCase())
    .filter((f) => f.length >= 3 && !english.includes(f));
  s.forEach((text, i) => {
    if (typeof text !== 'string' || text.length < 15) problems.push(`${w.id}[${i}]: too short`);
    else if (text.length > 260) problems.push(`${w.id}[${i}]: too long (${text.length} chars)`);
    else {
      const lower = text.toLowerCase();
      for (const f of forms) {
        const re = new RegExp(`(^|[^a-zäöüß])${f.replace(/[.*+?^${}|[\]\\]/g, '\\$&')}([^a-zäöüß]|$)`);
        if (re.test(lower)) problems.push(`${w.id}[${i}]: contains the German answer "${f}"`);
      }
    }
  });
}

const done = job.filter((w) => Array.isArray(merged[w.id]) && merged[w.id].length === 3).length;
console.log(`${chunk}: ${done}/${job.length} words complete, ${problems.length} problems`);
problems.slice(0, 60).forEach((p) => console.log('  ' + p));
process.exit(problems.length ? 1 : 0);
