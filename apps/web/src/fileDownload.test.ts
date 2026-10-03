import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadFile } from './fileDownload';

describe('downloadFile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('clicks a temporary download link and revokes the object URL later', () => {
    const createObjectURL = vi.fn(() => 'blob:mruos-test');
    const revokeObjectURL = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        expect(document.body.contains(this)).toBe(true);
        expect(this.download).toBe('mruos-plan.json');
      });
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    vi.useFakeTimers();

    downloadFile('mruos-plan.json', 'application/json', '{"version":1}');

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="mruos-plan.json"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mruos-test');
    vi.useRealTimers();
  });
});
