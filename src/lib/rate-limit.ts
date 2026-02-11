export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendInBatches<T>(
  items: T[],
  batchSize: number,
  delayMs: number,
  sendFn: (item: T) => Promise<void>
): Promise<{ sent: number; failed: number }> {
  const batches = chunk(items, batchSize);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i++) {
    const results = await Promise.allSettled(
      batches[i].map((item) => sendFn(item))
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        sent++;
      } else {
        failed++;
        console.error("Send failed:", result.reason);
      }
    }

    if (i < batches.length - 1) {
      await sleep(delayMs);
    }
  }

  return { sent, failed };
}
