# WortSprint design

The app has two themes. The learner picks one in Settings, and the choice is saved per device (`src/lib/look.ts`). Each theme is a complete world with its own fonts, palette, Home hero, Library cards, logo and Learn card. The game screens share one layout and take their colours and type from the theme.

- **Schulheft** (default): a German school exercise book that a teacher has marked. The learner writes in royal-blue fountain-pen ink, and the teacher corrects in red and green pen. Most of this document describes Schulheft.
- **Fahrplan**: a German railway station. Navy departure boards, signal yellow and condensed DIN-style type (Barlow Semi Condensed). The level is the destination, the stage is the platform ("Gleis"), and the six stages are the stops on the line. There is no handwriting in this theme.

Theme-specific pieces live in `src/looks/`. Palettes live in `src/index.css`, under `:root` for Schulheft and `[data-look='bahn']` for Fahrplan, each with a dark variant.

## Themes

Light and dark use the same colour names. Each colour is a CSS variable in `src/index.css`, and `tailwind.config.js` maps the names onto those variables. The theme is chosen per device: Light, Dark or Same as device (`src/lib/theme.ts`). A small script in `index.html` applies it before the first paint, so the page never flashes the wrong theme.

- **Light:** grey-white recycled paper (Umweltpapier). It glares less than pure white, and the ink is deep blue-grey rather than black.
- **Dark:** the same exercise book at night. Deep blue-black paper, ink lifted to a soft periwinkle, and pen colours lightened so they glow rather than shout.

Never hard-code a colour. Add a variable to both themes.

## World

- **Paper:** 5 mm squared paper (Rechenkästchen) covers the page background. Cards are white sheets on top of it, with a soft real shadow.
- **Ink:** `blue` (Königsblau) is used for the learner's writing and for primary actions.
- **Teacher's pens:** `pen` marks corrections, grades and the Boss stage. `ok` is the green tick.
- **Highlighter:** `marker`, used only for hints and the Speed challenge.
- **Text:** `ink` for body text, `pencil` for secondary text. Never use grey on coloured fills.
- **Articles:** `der`, `die` and `das` have their own colours, deliberately not the correction red or green.

## Type

- **Jost:** all UI and German words. It is the free version of Futura (Paul Renner, Germany, 1927), the geometric type of German primers and Bauhaus print.
- **Caveat:** everything handwritten: answers, grades, tallies, counts, labels like "noun". It writes a flagged 1 and a crossed 7, as German handwriting does.
- No uppercase tracking labels, and no small label above a heading.

## Signature moment

Correcting a typed answer: the learner's ink gets a red line struck through it, and the right answer is written beneath it in red. Pen strokes draw themselves (`src/components/marks.tsx`, using Motion). Everything else stays still or uses a short fade.

## Recurring objects

- **Grades:** German grades 1–6 (`gradeFor`), circled in red. The dashboard shows them as a report card (Zeugnis).
- **Combo:** shown as a Strichliste of tally marks in groups of five.
- **Learn cards:** shown as a Karteikarte, an index card with a red header rule and ruled lines.
- **Collections:** shown as exercise books with a coloured cover and a white name label.
- **Boss result:** a rubber stamp ("Bestanden!" / "Nochmal!"). Confetti only when the Boss is passed or a session earns grade 1.
- **Icons:** Phosphor only. Never emoji.

## Sound and touch

Sounds are soft mallet tones for right answers and a pen scratch for corrections. Learn cards make a paper flip, and the timer ticks like wood (`src/lib/sfx.ts`). Phones that support it give a light vibration on right and wrong answers.

## Mutprobe

The challenge section ("test of courage"): 50 fixed hard-mode tests of 20 words, mixed from A1 up to Extra as the numbers rise (`npm run challenges` rebuilds `src/data/challenges.json`). No learning step, no hints, Hard timers, three lives. A "Ready" meter shows how many of the words the learner knows; below 60% it warns but never locks. In Schulheft it is an exam sheet in red ink; in Fahrplan an express line on the departure board.

Typed answers are checked against every word: another word with the same main meaning and part of speech counts as right ("billig" for "günstig"). When a word the learner knows shares a meaning, a letter clue ("g _ _ _ _ _ _ (7)") shows which word is wanted.
