import { processWithRetry } from './consumer';

describe('processWithRetry', () => {
  it('retries until the handler succeeds', async () => {
    const fn = jest.fn().mockRejectedValueOnce(new Error('boom')).mockRejectedValueOnce(new Error('boom')).mockResolvedValue(undefined);
    expect(await processWithRetry(fn, 3, 1)).toEqual({ ok: true, attempts: 3 });
  });
  it('gives up after max attempts and reports the last error', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('still broken'));
    const res = await processWithRetry(fn, 3, 1);
    expect(res.ok).toBe(false); expect(res.attempts).toBe(3); expect(fn).toHaveBeenCalledTimes(3);
    expect(res.error?.message).toBe('still broken');
  });
});
