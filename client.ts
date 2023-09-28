import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";
import { z } from "https://deno.land/x/zod@v3.22.2/mod.ts";

const PositiveIntegerSchema = z.coerce.number().int().positive();
const SpeedTestOptionsSchema = z.object({
  server: z.string().url().default("https://speedtesting.deno.dev"),
  pingCount: PositiveIntegerSchema.default(100),
  downloadMegabytes: PositiveIntegerSchema.default(50),
  uploadMegabytes: PositiveIntegerSchema.default(50),
  deadlineSeconds: PositiveIntegerSchema.default(30),
});

export type SpeedTestOptions = z.input<typeof SpeedTestOptionsSchema>;
type SpeedTestConfig = z.infer<typeof SpeedTestOptionsSchema>;

// Definition of tests contained in the main speed test
const TESTS = {
  latency: testLatency,
  download: testDownload,
  upload: testUpload,
};

// Convenience type of the cumulative result of the speed test
export type ErrorTestSubResult = { ok: false; error: string };
export type SpeedTestResult = {
  [K in keyof typeof TESTS]:
    | Awaited<ReturnType<typeof TESTS[K]>>
    | ErrorTestSubResult;
};

/**
 * Speed test client. Measures latency, download speed and upload speed
 * agains a predefined speed test server.
 */
export async function speedTest(options: SpeedTestOptions) {
  const config = SpeedTestOptionsSchema.parse(options);

  console.log("SPEED TEST CONFIGURATION");
  console.log(config);

  const deadlineMs = config.deadlineSeconds * 1000;

  const result = {} as Record<string, unknown>;
  for (const testName of Object.keys(TESTS)) {
    try {
      const testFunction = TESTS[testName as keyof typeof TESTS];
      const testResult = await deadline(testFunction(config), deadlineMs);
      result[testName] = testResult;
    } catch (err) {
      result[testName] = {
        ok: false,
        error: err?.message ?? err,
      };
    }
  }

  return result as SpeedTestResult;
}

/**
 * Latency measurement test that gauges latency using sending WebSocket
 * messages between client and server. Average latency equals to average
 * roundtrip of the messages.
 */
function testLatency({ server, pingCount }: SpeedTestConfig) {
  console.log("Measuring latency");

  type LatencyResponse = {
    ok: true;
    durationMs: number;
    latencyMs: number;
    pingCount: number;
  };
  return new Promise<LatencyResponse>((resolve, reject) => {
    const socket = new WebSocket(`${server}/ws`);

    let start = 0;
    let counter = 0;

    socket.addEventListener("message", (event) => {
      if (event.data === "pong") {
        counter++;
        if (counter === pingCount) {
          const durationMs = performance.now() - start;
          const latencyMs = durationMs / pingCount;
          socket.close();
          resolve({
            ok: true,
            durationMs,
            latencyMs,
            pingCount,
          });
        } else {
          socket.send("ping"); // ping and wait for response
        }
      }
    });

    socket.addEventListener("open", (_event) => {
      start = performance.now(); // start measuring
      socket.send("ping");
    });

    socket.addEventListener("error", (event: Event) => {
      reject(new Error((event as ErrorEvent).message));
    });
  });
}

/**
 * Test download speed by requesting the speed test server to send
 * chunks of data. Time to receive the data is measured for each chunk.
 */
async function testDownload({ server, downloadMegabytes }: SpeedTestConfig) {
  console.log("Measuring download speed");
  const size = 1 << 4; // 16 ~ Number of 64 KB chunks to download = 1 MB per iteration
  let durationMs = 0;
  for (let i = 0; i < downloadMegabytes; i++) {
    const start = performance.now();
    await fetch(`${server}/download/${size}?nocache=${crypto.randomUUID()}`);
    const partialDuration = performance.now() - start;
    durationMs += partialDuration;
  }
  const downloadSpeedMbps = calculateMbps(downloadMegabytes, durationMs);
  return {
    ok: true,
    durationMs,
    downloadMegabytes,
    downloadSpeedMbps,
  };
}

/**
 * Test upload speed by sending chunks of data to speed test server.
 * Time to server aknowledging the upload is measured for each chunk.
 */
async function testUpload({ server, uploadMegabytes }: SpeedTestConfig) {
  console.log("Measuring upload speed");
  let durationMs = 0;

  const dataChunk = new Uint8Array(1 << 20); // 1 MB

  for (let i = 0; i < uploadMegabytes; i++) {
    const start = performance.now();
    await fetch(`${server}/upload?nocache=${crypto.randomUUID()}`, {
      method: "POST",
      body: dataChunk,
    });
    const partialDuration = performance.now() - start;
    durationMs += partialDuration;
  }
  const uploadSpeedMbps = calculateMbps(uploadMegabytes, durationMs);
  return {
    ok: true,
    durationMs,
    uploadMegabytes,
    uploadSpeedMbps,
  };
}

/**
 * Helper function to calculate network speed in megabits per second
 */
function calculateMbps(megabytes: number, milliseconds: number) {
  const megabits = megabytes << 3;
  const seconds = milliseconds / 1000;
  return megabits / seconds;
}

/**
 * Helper function to limit execution time of tests
 */
function deadline<T>(promise: T, ms: number): Promise<T> {
  const stop = new Promise<T>((_resolve, reject) => {
    setTimeout(() => reject(new Error("Deadline reached")), ms);
  });
  return Promise.race([promise, stop]);
}

// Start the speed test server if this module is called directly
if (import.meta.main) {
  // The first argument is an optional port number
  const flags = parse(Deno.args);
  try {
    const result = await speedTest(flags as SpeedTestOptions);
    console.log("SPEED TEST RESULT", result);
    Deno.exit();
  } catch (err) {
    console.log("SPEED TEST FAILED");
    console.error(err.message ?? err);
    Deno.exit(1);
  }
}
