# WortSprint — German Vocabulary Memory Game

Recognize → Recall → Type → Repeat → Master.

A memory-training game for your own German vocabulary. Everything runs locally in the
browser: no login, no paid API. Words and progress are stored in IndexedDB, so they survive
refreshes.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine unit tests
npm run build      # production build in dist/
```

## Your vocabulary

On first start the app installs your four lists from `data/raw/` (A1, A2, B1, Extra:
5,895 words, each with 3 hand-written real-life situations). Each collection is split into
levels of 20 words that mix nouns, verbs, adjectives and adverbs in a fixed order.

Add more words in **Library → Import words**:

```
der Apfel | apple | আপেল
Apfel, der — apple
german,english,bengali     (CSV with header)
[{"german": "der Apfel", "english": "apple", "bengali": "আপেল"}]   (JSON)
```

Words can be added, edited and deleted per collection (**Collection → words tab**).
**Settings → Backup** exports and restores everything as JSON.

Add `?profile=name` to the URL to keep a separate set of data (e.g. a second learner).

## How a level works

1. **Learn** – meet the words in groups of 5, then a quick check.
2. **Recognize** – German → meaning (4 choices, 8 s).
3. **Reverse** – meaning → German (4 choices, 7 s).
4. **Recall** – type the German word from its meaning (12 s). Nouns need der/die/das.
5. **Situations** – read a real-life situation, type the word (15 s).
6. **Memory Boss** – mixed timed test, each word once. Pass with ≥85 % overall and
   ≥80 % typing to unlock the next level.

A level is **mastered** when the boss is passed, stage accuracy is ≥85 % (typing ≥80 %), all
words were tested by typing, and no weak words remain. Each level also has a **Speed
Challenge** (5 s per word, combos and multipliers, hardest words return at the end).

## Memory engine (`src/engine/`)

Pure, seeded and unit-tested (`engine.test.ts`):

- `srs.ts` – memory strength, states (New → Learning/Weak → Familiar → Strong → Mastered) and
  spaced intervals of 1, 3, 7, 14, 30 and 60 days. A miss lowers strength (more for strong
  words) and makes the word due again.
- `session.ts` – a missed word returns after 3–5 other questions; a slow correct answer comes
  back once later; the same word is never shown twice in a row. In reviews a missed word
  steps down one format first (e.g. typing → multiple choice), then returns to the harder one.
- `answer.ts` – case-insensitive, accepts ae/oe/ue/ss for ä/ö/ü/ß, requires noun articles,
  optional typo tolerance (same first letter, 1–2 edits), recognises synonyms from your list.
- `questions.ts` – distractors come only from your own words and never share a meaning with
  the answer.

Situations: `data/situations/*.json` (hand-written), merged by `npm run data`
(`scripts/build-data.mjs`); `node scripts/check-situations.mjs <chunk>` validates them.
Imported words without situations use templates (English, or Bengali when the meaning
language is Bengali).
