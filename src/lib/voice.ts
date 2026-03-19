let synth: SpeechSynthesis | null = null;

function getSynth(): SpeechSynthesis | null {
  if (typeof window === 'undefined') return null;
  if (!synth) synth = window.speechSynthesis;
  return synth;
}

export function speak(text: string, enabled: boolean): void {
  if (!enabled) return;
  const s = getSynth();
  if (!s) return;

  // Cancel any ongoing speech
  s.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  // Try to use an English voice
  const voices = s.getVoices();
  const englishVoice = voices.find(v => v.lang.startsWith('en') && v.localService);
  if (englishVoice) utterance.voice = englishVoice;

  s.speak(utterance);
}

export function stopSpeaking(): void {
  const s = getSynth();
  if (s) s.cancel();
}
