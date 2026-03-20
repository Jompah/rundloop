import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock SpeechSynthesisUtterance
class MockUtterance {
  text = '';
  volume = 1;
  rate = 1;
  pitch = 1;
  voice = null;
  constructor(text: string = '') {
    this.text = text;
  }
}

const mockSpeak = vi.fn();
const mockCancel = vi.fn();
const mockGetVoices = vi.fn(() => []);

beforeEach(() => {
  vi.resetModules();
  mockSpeak.mockClear();
  mockCancel.mockClear();
  mockGetVoices.mockClear();

  vi.stubGlobal('SpeechSynthesisUtterance', MockUtterance);
  vi.stubGlobal('speechSynthesis', {
    speak: mockSpeak,
    cancel: mockCancel,
    getVoices: mockGetVoices,
  });
  // Ensure window.speechSynthesis is available
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'speechSynthesis', {
      value: { speak: mockSpeak, cancel: mockCancel, getVoices: mockGetVoices },
      writable: true,
      configurable: true,
    });
  }
});

describe('unlockIOSAudio', () => {
  it('calls speechSynthesis.speak with a silent utterance (volume 0)', async () => {
    const { unlockIOSAudio } = await import('../voice');
    unlockIOSAudio();

    expect(mockSpeak).toHaveBeenCalledTimes(1);
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance).toBeInstanceOf(MockUtterance);
    expect(utterance.volume).toBe(0);
    expect(utterance.text).toBe('');
  });

  it('is idempotent - does not call speak a second time', async () => {
    const { unlockIOSAudio } = await import('../voice');
    unlockIOSAudio();
    unlockIOSAudio();

    expect(mockSpeak).toHaveBeenCalledTimes(1);
  });
});

describe('ensureSpeechReady', () => {
  it('calls speechSynthesis.cancel() to reset broken state', async () => {
    const { ensureSpeechReady } = await import('../voice');
    ensureSpeechReady();

    expect(mockCancel).toHaveBeenCalled();
  });
});

describe('speak', () => {
  it('calls speechSynthesis.speak with the given text when enabled', async () => {
    const { speak } = await import('../voice');
    speak('Hello runner', true);

    // cancel is called first (to clear previous), then speak
    expect(mockCancel).toHaveBeenCalled();
    expect(mockSpeak).toHaveBeenCalled();
    const utterance = mockSpeak.mock.calls[0][0];
    expect(utterance.text).toBe('Hello runner');
  });

  it('does not speak when not enabled', async () => {
    const { speak } = await import('../voice');
    speak('Hello runner', false);

    expect(mockSpeak).not.toHaveBeenCalled();
  });
});

describe('stopSpeaking', () => {
  it('calls speechSynthesis.cancel()', async () => {
    const { stopSpeaking } = await import('../voice');
    stopSpeaking();

    expect(mockCancel).toHaveBeenCalled();
  });
});
