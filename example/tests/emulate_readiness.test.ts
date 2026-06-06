import { describe, expect, test } from 'bun:test';

/**
 * Unit test for the emulator readiness detection logic.
 *
 * Validates that the onStdout callback in the emulate command:
 * 1. Logs the UI URL when "Emulator UI at" appears, but does NOT trigger init
 * 2. Triggers the init script ONLY when "All emulators ready" appears
 * 3. Never double-triggers init or UI logging
 *
 * This is the core logic fix from the race condition: init used to run
 * on "Emulator UI at" + a 1s setTimeout, but now runs only when the
 * Firebase CLI signals full readiness via "All emulators ready".
 */

type ReadinessState = {
  uiLogged: boolean;
  emulatorReady: boolean;
  uiUrl: string | undefined;
  initCalled: boolean;
  openCalled: boolean;
};

/**
 * Creates an onStdout callback with the same logic as the emulate command,
 * but with instrumented side effects so we can assert on them.
 */
const createReadinessCallback = (
  state: ReadinessState,
  options: {
    open?: boolean;
    init?: boolean;
    onOpenUrl?: (url: string) => void;
    onRunInit?: () => void;
  } = {}
) => {
  const { open = false, init = true, onOpenUrl, onRunInit } = options;

  return (data: string): void => {
    // Log the UI URL when it appears (for user convenience)
    if (!state.uiLogged && data.includes('Emulator UI at')) {
      const match = data.match(/http:\/\/[^\s/]+/);
      if (match) {
        const url = `${match[0]}/`;
        state.uiLogged = true;
        state.uiUrl = url;

        if (open) {
          state.openCalled = true;
          onOpenUrl?.(url);
        }
      }
    }

    // Trigger the init script only after ALL emulators (including functions)
    // have fully loaded and are ready to accept traffic.
    // Firebase CLI emits this signal after every emulator has started and
    // all function source has been compiled and loaded into the functions emulator.
    if (!state.emulatorReady && data.includes('All emulators ready')) {
      state.emulatorReady = true;

      if (init) {
        state.initCalled = true;
        onRunInit?.();
      }
    }
  };
};

describe('Emulator Readiness Detection', () => {
  test('does not trigger init on "Emulator UI at" alone', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const onStdout = createReadinessCallback(state);

    // Simulate Firebase CLI: UI starts first
    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');

    expect(state.uiLogged).toBe(true);
    expect(state.uiUrl).toBe('http://127.0.0.1:4000/');
    // Init must NOT be triggered by UI readiness alone
    expect(state.initCalled).toBe(false);
    expect(state.emulatorReady).toBe(false);
  });

  test('triggers init on "All emulators ready"', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const onStdout = createReadinessCallback(state);

    // Simulate Firebase CLI: all emulators ready signal
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');

    expect(state.emulatorReady).toBe(true);
    expect(state.initCalled).toBe(true);
    // UI was never logged (it may appear later, or not at all if UI is disabled)
    expect(state.uiLogged).toBe(false);
  });

  test('init is triggered AFTER "All emulators ready", not before', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const onStdout = createReadinessCallback(state);

    // Simulate full startup sequence:
    // 1. UI starts
    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');
    // Init must NOT be called yet (the race condition this fix prevents)
    expect(state.initCalled).toBe(false);

    // 2. Various emulator progress messages (functions loading, etc.)
    onStdout('i  emulators: Starting emulators: functions, firestore, auth');
    onStdout('i  functions: Watching "/path/to/dist/emulator" for Cloud Functions...');
    expect(state.initCalled).toBe(false);

    // 3. Finally, all emulators ready
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');
    expect(state.emulatorReady).toBe(true);
    expect(state.initCalled).toBe(true);

    // Verify ordering: UI was logged BEFORE init was called
    expect(state.uiLogged).toBe(true);
  });

  test('does not double-trigger init or UI logging', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const initCalls: number[] = [];
    const onStdout = createReadinessCallback(state, {
      onRunInit: () => initCalls.push(initCalls.length),
    });

    // First appearance of UI
    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');
    expect(state.uiLogged).toBe(true);
    expect(initCalls).toHaveLength(0);

    // First appearance of readiness
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');
    expect(state.emulatorReady).toBe(true);
    expect(initCalls).toHaveLength(1);

    // Duplicate messages (can happen with verbose logging or reconnection)
    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');
    expect(initCalls).toHaveLength(1); // Still only 1 init call
    expect(state.uiUrl).toBe('http://127.0.0.1:4000/'); // URL unchanged
  });

  test('triggers open when --open flag is set', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const openedUrls: string[] = [];
    const onStdout = createReadinessCallback(state, {
      open: true,
      onOpenUrl: (url) => openedUrls.push(url),
    });

    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');
    expect(state.openCalled).toBe(true);
    expect(openedUrls).toEqual(['http://127.0.0.1:4000/']);
    // Init still not called
    expect(state.initCalled).toBe(false);
  });

  test('respects --no-init flag', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const onStdout = createReadinessCallback(state, { init: false });

    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');

    expect(state.emulatorReady).toBe(true);
    expect(state.initCalled).toBe(false); // Init disabled
    expect(state.uiLogged).toBe(true);
  });

  test('handles partial match safely - "All emulators" without "ready" does not trigger', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const onStdout = createReadinessCallback(state);

    // "All emulators" alone is not the readiness signal
    onStdout('i  emulators: All emulators starting up...');

    expect(state.emulatorReady).toBe(false);
    expect(state.initCalled).toBe(false);

    // But "All emulators ready" (full phrase) does trigger
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');
    expect(state.emulatorReady).toBe(true);
    expect(state.initCalled).toBe(true);
  });

  test('handles readiness signal appearing before UI', () => {
    const state: ReadinessState = {
      uiLogged: false,
      emulatorReady: false,
      uiUrl: undefined,
      initCalled: false,
      openCalled: false,
    };

    const onStdout = createReadinessCallback(state);

    // Edge case: readiness signal appears first (e.g., UI is disabled or slow)
    onStdout('i  emulators: All emulators ready! It is now safe to connect your app.');
    expect(state.emulatorReady).toBe(true);
    expect(state.initCalled).toBe(true);

    // UI appears later
    onStdout('i  emulators: Emulator UI at http://127.0.0.1:4000');
    expect(state.uiLogged).toBe(true);
    // Init was already called, should not be called again
    expect(state.initCalled).toBe(true);
  });
});
