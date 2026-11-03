// German pronunciation through the browser's built-in speech synthesis.
export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, '').split(',')[0]);
    u.lang = 'de-DE';
    u.rate = 0.9;
    const voice = synth.getVoices().find((v) => v.lang.startsWith('de'));
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* not supported */
  }
}
