import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { narrowScreenQuery, useMediaQuery } from './useMediaQuery';

describe('useMediaQuery', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the screen as it changes', () => {
    let matches = true;
    const listeners = new Set<() => void>();
    vi.stubGlobal('matchMedia', (query: string) => ({
      get matches() {
        return query === narrowScreenQuery && matches;
      },
      addEventListener: (_type: string, listener: () => void) =>
        listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) =>
        listeners.delete(listener),
    }));
    const { result } = renderHook(() => useMediaQuery(narrowScreenQuery));
    expect(result.current).toBe(true);

    act(() => {
      matches = false;
      listeners.forEach((listener) => listener());
    });
    expect(result.current).toBe(false);
  });

  it('assumes a wide screen without matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    const { result } = renderHook(() => useMediaQuery(narrowScreenQuery));

    expect(result.current).toBe(false);
  });
});
