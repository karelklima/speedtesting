import { parse } from "https://deno.land/std@0.202.0/flags/mod.ts";

const defaultClientOptions = {
  server: "https://speedtesting.deno.dev",
  pingCount: 100,
  downloadMegabytes: 100,
  uploadMegabytes: 100,
  deadlineSeconds: 30,
};

type SpeedTestClientOptions = typeof defaultClientOptions;

// Start the speed test server if this module is called directly
if (import.meta.main) {
  // The first argument is an optional port number
  const flags = parse(Deno.args);
  const options = Object.keys(defaultClientOptions).reduce((acc, key) => {
    if (flags[key]) {
      acc[key] = key === "server" ? flags[key] : Number(flags[key]);
    }
    return acc;
  }, {} as Record<string, unknown>);
  const result = await speedTestClient(options as SpeedTestClientOptions);
  console.log("SPEED TEST RESULT", result);
}

/**
 * Speed test client. Measures latency, download speed and upload speed
 * agains a predefined speed test server.
 */
export async function speedTestClient(
  options: Partial<SpeedTestClientOptions>,
) {
  const config = {
    ...defaultClientOptions,
    ...options,
  };

  console.log("SPEED TEST CONFIGURATION");
  console.log(config);

  const server = config.server;
  const deadlineMs = config.deadlineSeconds * 1000;

  const latencyResult = await deadline(
    testLatency(
      config.server,
      config.pingCount,
    ),
    deadlineMs,
  );
  const downloadResult = await deadline(
    testDownload(
      server,
      config.downloadMegabytes,
    ),
    deadlineMs,
  );
  const uploadResult = await deadline(
    testUpload(
      server,
      config.uploadMegabytes,
    ),
    deadlineMs,
  );

  return {
    latency: latencyResult,
    download: downloadResult,
    upload: uploadResult,
  };
}

/**
 * Latency measurement test that gauges latency using sending WebSocket
 * messages between client and server. Average latency equals to average
 * roundtrip of the messages.
 */
function testLatency(server: string, pingCount: number) {
  console.log("Measuring latency");
  return new Promise((resolve, _reject) => {
    const socket = new WebSocket(`${server}/ws`);

    let start = 0;
    let counter = 0;

    socket.addEventListener("message", (event) => {
      if (event.data === "pong") {
        counter++;
        if (counter >= pingCount) {
          const durationMs = performance.now() - start;
          const latencyMs = durationMs / pingCount;
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

    socket.addEventListener("error", (event) => {
      console.error(event);
      resolve({ ok: false });
    });
  });
}

/**
 * Test download speed by requesting the speed test server to send
 * chunks of data. Time to receive the data is measured for each chunk.
 */
async function testDownload(
  server: string,
  downloadMegabytes: number,
) {
  console.log("Measuring download speed");
  let durationMs = 0;
  for (let i = 0; i < downloadMegabytes; i++) {
    const params = new URLSearchParams({
      nocache: crypto.randomUUID(),
      size: "1024",
    });
    const start = performance.now();
    await fetch(`${server}/download?${params.toString()}`);
    const partialDuration = performance.now() - start;
    durationMs += partialDuration;
  }
  const downloadSpeedMbps = downloadMegabytes * 8 / durationMs * 1000;
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
async function testUpload(
  server: string,
  uploadMegabytes: number,
) {
  console.log("Measuring upload speed");
  let durationMs = 0;

  const dataChunk = new Uint8Array(1 << 20); // 1 MB

  for (let i = 0; i < uploadMegabytes; i++) {
    const params = new URLSearchParams({
      nocache: crypto.randomUUID(),
    });
    const start = performance.now();
    await fetch(`${server}/upload?${params.toString()}`, {
      method: "POST",
      body: dataChunk,
    });
    const partialDuration = performance.now() - start;
    durationMs += partialDuration;
  }
  const uploadSpeedMbps = uploadMegabytes * 8 / durationMs * 1000;
  return {
    ok: true,
    durationMs,
    uploadMegabytes,
    uploadSpeedMbps,
  };
}

/**
 * Helper function to limit execution time of tests
 */
function deadline<T>(promise: T, ms: number) {
  const stop = new Promise((resolve, _reject) => {
    setTimeout(() => resolve({ ok: false, deadline: true }), ms);
  });
  return Promise.race([promise, stop]);
}
