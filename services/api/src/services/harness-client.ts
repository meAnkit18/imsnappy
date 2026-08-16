import { randomUUID } from "node:crypto";
import type { RunRequest, StreamEvent } from "@imsnappy/contracts";
import type { ApiConfig } from "../config.js";

export async function streamHarnessRun(
  config: ApiConfig,
  request: RunRequest,
  onEvent: (event: StreamEvent) => Promise<void>,
): Promise<void> {
  const response = await fetch(`${config.harnessBaseUrl}/internal/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-imsnappy-service-token": config.internalServiceToken,
      "x-request-id": randomUUID(),
    },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(10 * 60 * 1000),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Harness request failed with status ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let pending = "";

  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    pending += decoder.decode(chunk.value, { stream: true });
    const records = pending.split("\n\n");
    pending = records.pop() ?? "";
    for (const record of records) {
      const data = record
        .split("\n")
        .find((line) => line.startsWith("data:"))
        ?.slice(5)
        .trim();
      if (!data) continue;
      await onEvent(JSON.parse(data) as StreamEvent);
    }
  }
}
