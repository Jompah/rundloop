import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test wake-lock.ts which accesses globals (navigator.wakeLock, document)
// Reset module state between tests by using dynamic import with vi.resetModules

describe('isWakeLockSupported', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns true when navigator.wakeLock exists', async () => {
    Object.defineProperty(globalThis, 'window', { value: {}, configurable: true });
    Object.defineProperty(globalThis.navigator, 'wakeLock', {
      value: { request: vi.fn() },
      configurable: true,
    });

    const { isWakeLockSupported } = await import('../wake-lock');
    expect(isWakeLockSupported()).toBe(true);
  });

  it('returns false in SSR environment', async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error -- simulating SSR
    delete globalThis.window;

    const { isWakeLockSupported } = await import('../wake-lock');
    expect(isWakeLockSupported()).toBe(false);

    // Restore
    Object.defineProperty(globalThis, 'window', { value: originalWindow, configurable: true });
  });
});

describe('acquireWakeLock', () => {
  let mockRelease: ReturnType<typeof vi.fn>;
  let mockSentinel: { addEventListener: ReturnType<typeof vi.fn>; release: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    mockRelease = vi.fn();
    mockSentinel = {
      addEventListener: vi.fn(),
      release: mockRelease,
    };
  });

  afterEach(() => {
    // Clean up navigator.wakeLock
    if ('wakeLock' in navigator) {
      Object.defineProperty(navigator, 'wakeLock', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('returns true when wake lock is acquired successfully', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn().mockResolvedValue(mockSentinel) },
      configurable: true,
    });

    const { acquireWakeLock } = await import('../wake-lock');
    const result = await acquireWakeLock();

    expect(result).toBe(true);
    expect(mockSentinel.addEventListener).toHaveBeenCalledWith('release', expect.any(Function));
  });

  it('returns false when Wake Lock API is not supported', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: undefined,
      configurable: true,
    });

    const { acquireWakeLock } = await import('../wake-lock');
    const result = await acquireWakeLock();

    expect(result).toBe(false);
  });

  it('returns false when request throws an error', async () => {
    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn().mockRejectedValue(new Error('Not allowed')) },
      configurable: true,
    });

    const { acquireWakeLock } = await import('../wake-lock');
    const result = await acquireWakeLock();

    expect(result).toBe(false);
  });
});

describe('releaseWakeLock', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if ('wakeLock' in navigator) {
      Object.defineProperty(navigator, 'wakeLock', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('releases an active wake lock', async () => {
    const mockRelease = vi.fn();
    const mockSentinel = {
      addEventListener: vi.fn(),
      release: mockRelease,
    };

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: vi.fn().mockResolvedValue(mockSentinel) },
      configurable: true,
    });

    const { acquireWakeLock, releaseWakeLock } = await import('../wake-lock');
    await acquireWakeLock();
    releaseWakeLock();

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('handles release when no wake lock is active', async () => {
    const { releaseWakeLock } = await import('../wake-lock');
    // Should not throw
    expect(() => releaseWakeLock()).not.toThrow();
  });
});

describe('setupVisibilityReacquire', () => {
  let listeners: Map<string, Function[]>;
  let mockDocument: { visibilityState: string; addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    listeners = new Map();
    mockDocument = {
      visibilityState: 'hidden',
      addEventListener: vi.fn((event: string, handler: Function) => {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(handler);
      }),
      removeEventListener: vi.fn((event: string, handler: Function) => {
        const handlers = listeners.get(event);
        if (handlers) {
          const idx = handlers.indexOf(handler);
          if (idx >= 0) handlers.splice(idx, 1);
        }
      }),
    };
    // @ts-expect-error -- minimal document mock for Node environment
    globalThis.document = mockDocument;
  });

  afterEach(() => {
    if ('wakeLock' in navigator) {
      Object.defineProperty(navigator, 'wakeLock', {
        value: undefined,
        configurable: true,
      });
    }
  });

  it('re-acquires wake lock when page becomes visible', async () => {
    const mockSentinel = {
      addEventListener: vi.fn(),
      release: vi.fn(),
    };
    const mockRequest = vi.fn().mockResolvedValue(mockSentinel);

    Object.defineProperty(navigator, 'wakeLock', {
      value: { request: mockRequest },
      configurable: true,
    });

    const { setupVisibilityReacquire } = await import('../wake-lock');

    const cleanup = setupVisibilityReacquire();

    // Simulate visibilitychange to 'visible'
    mockDocument.visibilityState = 'visible';
    const handlers = listeners.get('visibilitychange') || [];
    for (const handler of handlers) {
      handler();
    }

    // Wait for async handler
    await new Promise((r) => setTimeout(r, 10));

    expect(mockRequest).toHaveBeenCalledWith('screen');

    cleanup();
  });

  it('returns cleanup function that removes event listener', async () => {
    const { setupVisibilityReacquire } = await import('../wake-lock');
    const cleanup = setupVisibilityReacquire();

    cleanup();

    expect(mockDocument.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
  });
});
