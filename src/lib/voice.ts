let synth: SpeechSynthesis | null = null;
let iosUnlocked = false;

function getSynth(): SpeechSynthesis | null {
  if (synth) return synth;
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    synth = window.speechSynthesis;
  } else if (typeof globalThis !== 'undefined' && (globalThis as unknown as { speechSynthesis?: SpeechSynthesis }).speechSynthesis) {
    synth = (globalThis as unknown as { speechSynthesis: SpeechSynthesis }).speechSynthesis;
  }
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

/**
 * Unlock iOS Safari audio context by speaking a silent utterance.
 * Must be called on a user gesture (e.g., "Start Run" button tap).
 * Idempotent -- only runs once.
 */
export function unlockIOSAudio(): void {
  if (iosUnlocked) return;
  const s = getSynth();
  if (!s) return;

  const utterance = new SpeechSynthesisUtterance('');
  utterance.volume = 0;
  s.speak(utterance);
  iosUnlocked = true;
}

/**
 * Reset speechSynthesis state after iOS Safari backgrounding.
 * Call on visibilitychange when document becomes visible.
 */
export function ensureSpeechReady(): void {
  const s = getSynth();
  if (s) s.cancel();
}
