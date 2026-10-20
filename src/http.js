import { setTimeout as delay } from "node:timers/promises";

// One bounded retry for transient transport/server failures; never retry credentials or bad input.
export async function fetchWithRetry(url, options = {}, { fetchImpl = fetch, timeoutMs = 20_000 } = {}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const timeout = AbortSignal.timeout(timeoutMs);
      const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
      const response = await fetchImpl(url, { ...options, signal });
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        await response.body?.cancel();
        await delay(250);
        continue;
      }
      return response;
    } catch (error) {
      if (attempt === 1 || options.signal?.aborted) throw error;
      await delay(250);
    }
  }
}
