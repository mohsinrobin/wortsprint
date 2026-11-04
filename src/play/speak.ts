// German pronunciation through the browser's built-in speech synthesis.
export function speak(text: string) {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, '').split(',')[0]);
    u.lang = 'de-DE';
    u.rate = 0.9;
    // Prefer a voice that runs on the device: some browsers send the text
    // to their maker's servers for online voices.
    const german = synth.getVoices().filter((v) => v.lang.startsWith('de'));
    const voice = german.find((v) => v.localService) ?? german[0];
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    /* not supported */
  }
}
