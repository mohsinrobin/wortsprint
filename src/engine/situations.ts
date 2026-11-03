// Situation selection. Bundled words carry hand-written situations; words the
// user imports fall back to reusable templates built from their meaning.
import type { Word } from '../types';
import { senses, splitTopLevel } from '../data/parse';
import { hashString } from './rng';

const TEMPLATES: Record<string, string[]> = {
  noun: [
    "You are describing your day to a German friend and need the word for '{m}'.",
    "You point at it in a shop and want to name it in German: '{m}'.",
    "A sign is missing its label. It should name '{m}' in German.",
    "Your German colleague asks what you are looking for. You are looking for '{m}'.",
  ],
  verb: [
    "Your friend asks what you plan to do this afternoon. You want to say: '{m}'.",
    "You explain your daily routine. One thing you do is '{m}'.",
    "You see someone doing it right now and want to name the action: '{m}'.",
    "In a German class the teacher acts it out without words: '{m}'.",
  ],
  adjective: [
    "You want to describe something in one word as '{m}'.",
    "A friend shows you a photo and asks how it looks. Your answer: '{m}'.",
    "You are writing a short review and need the word for '{m}'.",
  ],
  adverb: [
    "You want to say when, where or how something happens: '{m}'.",
    "In a conversation you need the small word that means '{m}'.",
    "You are giving directions or details and need the word for '{m}'.",
  ],
  pronoun: [
    "You are talking about someone or something and need the word for '{m}'.",
    "In a short conversation you need the little word that means '{m}'.",
  ],
  other: [
    "You need the German word that means '{m}'.",
    "A friend asks you how to say '{m}' in German.",
  ],
};

const TEMPLATES_BN: Record<string, string[]> = {
  noun: [
    "তুমি এক জার্মান বন্ধুকে তোমার দিনের কথা বলছ, আর '{m}' বোঝাতে শব্দটি দরকার।",
    "দোকানে জিনিসটার দিকে আঙুল দেখিয়ে তুমি জার্মানে এর নাম বলতে চাও: '{m}'।",
    "তোমার জার্মান সহকর্মী জানতে চায় তুমি কী খুঁজছ। তুমি খুঁজছ '{m}'।",
  ],
  verb: [
    "বন্ধু জানতে চায় আজ বিকেলে তুমি কী করবে। তুমি বলতে চাও: '{m}'।",
    "তুমি তোমার প্রতিদিনের রুটিন বলছ। একটা কাজ হলো '{m}'।",
    "কেউ এখনই কাজটা করছে, আর তুমি কাজটার নাম বলতে চাও: '{m}'।",
  ],
  adjective: [
    "তুমি কোনো কিছুকে এক শব্দে '{m}' বলে বর্ণনা করতে চাও।",
    "বন্ধু একটা ছবি দেখিয়ে জানতে চায় কেমন লাগছে। তোমার উত্তর: '{m}'।",
  ],
  adverb: [
    "কখন, কোথায় বা কীভাবে কিছু ঘটে তা বলতে চাও: '{m}'।",
    "কথার মাঝে তোমার '{m}' অর্থের ছোট শব্দটি দরকার।",
  ],
  pronoun: ["কারও বা কিছুর কথা বলতে গিয়ে তোমার '{m}' অর্থের শব্দটি দরকার।"],
  other: ["'{m}' অর্থের জার্মান শব্দটি কী?", "বন্ধু জানতে চায় জার্মানে '{m}' কীভাবে বলে।"],
};

export function templateSituations(word: Word, lang: 'en' | 'bn' = 'en'): string[] {
  const useBn = lang === 'bn' && !!word.bn;
  const table = useBn ? TEMPLATES_BN : TEMPLATES;
  const list = table[word.pos] ?? table.other;
  const s = useBn ? splitTopLevel(word.bn!) : senses(word.en);
  return list.map((t, i) => t.replace('{m}', s[i % Math.max(1, s.length)] ?? word.en));
}

/** Rotate through a word's situations so repeated attempts see new contexts. */
export function pickSituation(word: Word, attemptNo: number, lang: 'en' | 'bn' = 'en'): string {
  const list = word.situations?.length ? word.situations : templateSituations(word, lang);
  const offset = hashString(word.id) % list.length;
  return list[(offset + attemptNo) % list.length];
}
