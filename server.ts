import {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.202.0/http/http_status.ts";
import { Hono, HTTPException } from "https://deno.land/x/hono@v3.7.2/mod.ts";
import { VERSION } from "./version.ts";

// Dummy chunk of data to send in download response
const DATA_CHUNK_SIZE = 1 << 16; // 64 KB
const DATA_CHUNK = new Uint8Array(DATA_CHUNK_SIZE);

// Download ReadableStream inner queue size
const HIGH_WATER_MARK = DATA_CHUNK_SIZE << 3; // 512 KB

// Enforce upload limit to prevent taking down the speed test server
const MAX_UPLOAD_LIMIT = 1 << 20; // 1 MB

export const server = new Hono();

/**
 * WebSocket endpoint - sends "pong" message when "ping" message is received
 * to allow for latency calculation
 */
server.get("/ws", (ctx) => {
  if (ctx.req.header("upgrade") !== "websocket") {
    throw new HTTPException(Status.BadRequest);
  }

  const { socket, response } = Deno.upgradeWebSocket(ctx.req.raw);

  socket.addEventListener("message", (event) => {
    if (event.data === "ping") {
      socket.send("pong");
    }
  });

  return response;
});

/**
 * Download endpoint - sends content of required size to clients.
 * Content size is specified using `size` URL param and should contain
 * the number of 64 KB chunks to be sent to client.
 */
server.get("/download/:size{[1-9][0-9]*}", (ctx) => {
  const chunkCount = Number(ctx.req.param().size);
  const contentLength = chunkCount * DATA_CHUNK_SIZE;
  let enqueuedChunks = 0;

  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(DATA_CHUNK);
      enqueuedChunks++;
      if (enqueuedChunks === chunkCount) {
        controller.close();
      }
    },
    autoAllocateChunkSize: DATA_CHUNK_SIZE,
  }, {
    highWaterMark: HIGH_WATER_MARK, // let the controller buffer chunks upfront
  });

  ctx.header("Content-Length", String(contentLength));
  return ctx.body(body);
});

/**
 * Upload endpoint - accepts incoming data and returns number of KBs read
 */
server.post("/upload", async (ctx) => {
  let readBytes = 0;

  const sink = new WritableStream<Uint8Array>({
    write(chunk) {
      readBytes += chunk.length;
      if (readBytes > MAX_UPLOAD_LIMIT) {
        throw new HTTPException(Status.BadRequest);
      }
    },
  });

  await ctx.req.raw.body?.pipeTo(sink); // wait to fully download the content

  return ctx.text(`${readBytes >> 10}`); // total content read in KB
});

/**
 * Status endpoint - returns system information about the speed test server
 */
server.get("/status", (ctx) => {
  const status = {
    status: "OK",
    version: {
      speedtest: VERSION,
      ...Deno.version,
    },
    memoryUsage: Deno.memoryUsage(),
  };

  return ctx.json(status);
});

/**
 * Error handler
 */
server.onError((err) => {
  const status: Status = err instanceof HTTPException
    ? err.status
    : Status.InternalServerError;
  return new Response(`${status} ${STATUS_TEXT[status]}`, { status });
});

// Start the speed test server if this module is called directly
if (import.meta.main) {
  console.log("SPEED TEST SERVER");
  // The first argument is an optional port number
  const port = Deno.args.length === 1 ? Number(Deno.args[0]) : 8000;
  if (!Number.isInteger(port)) {
    console.error(`Invalid port number specified: "${Deno.args[0]}"`);
    Deno.exit(1);
  }
  Deno.serve({ port }, server.fetch);
}
