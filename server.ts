import { VERSION } from "./version.ts";

// Start the speed test server if this module is called directly
if (import.meta.main) {
  console.log("SPEED TEST SERVER");
  // The first argumetn is an optional port number
  const port = Deno.args.length === 1 ? Number(Deno.args[0]) : 8000;
  Deno.serve({ port }, speedTestHandler);
}

/**
 * Main router / handler of the speed test server requests
 */
export async function speedTestHandler(request: Request): Promise<Response> {
  const url = new URL(request.url);

  try {
    switch (url.pathname) {
      case "/ws":
        return wsHandler(request);
      case "/download":
        return downloadHandler(request);
      case "/upload": {
        const uploadResponse = await uploadHandler(request);
        return uploadResponse;
      }
      case "/status":
        return statusHandler(request);
      default:
        return statusResponse(404); // Not Found
    }
  } catch (_err) {
    // If an error is caught here, it is likely that validation of incoming request failed
    return statusResponse(400); // Bad Request
  }
}

/**
 * WebSocket endpoint - sends "pong" message when "ping" message is received
 * to allow for latency calculation
 */
function wsHandler(request: Request): Response {
  assert(request.headers.get("upgrade") === "websocket");

  const { socket, response } = Deno.upgradeWebSocket(request);

  socket.addEventListener("message", (event) => {
    if (event.data === "ping") {
      socket.send("pong");
    }
  });

  return response;
}

// Dummy chunk of data to send in response
const dataChunk = new Uint8Array(1 << 10); // 1 KB

/**
 * Download endpoint - sends content of required size to clients.
 * Content size is specified using `size` URL param and should contain
 * the number of KB to be sent to client.
 */
function downloadHandler(request: Request): Response {
  assert(request.method === "GET");
  const size = Number.parseInt(new URL(request.url).searchParams.get("size")!);
  assert(size > 0);

  let remainingBlocks = size;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(dataChunk);
      remainingBlocks--;
      if (remainingBlocks <= 0) {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-length": `${size << 10}` },
  });
}

// Enforce upload limit to prevent taking down the speed test server
const MAX_UPLOAD_LIMIT = 1 << 20; // 1 MB

/**
 * Upload endpoint - accepts incoming data and returns number of KBs read
 */
async function uploadHandler(request: Request): Promise<Response> {
  assert(request.method === "POST");

  let readBytes = 0;
  const sink = new WritableStream<Uint8Array>({
    write(chunk) {
      readBytes += chunk.length;
      if (readBytes > MAX_UPLOAD_LIMIT) {
        throw new Error();
      }
    },
  });

  await request.body?.pipeTo(sink);

  return new Response(`${readBytes >> 10}`);
}

/**
 * Status endpoint - returns system information about the speed test server
 */
function statusHandler(request: Request): Response {
  assert(request.method === "GET");

  const status = {
    status: "OK",
    version: {
      speedtest: VERSION,
      ...Deno.version,
    },
    memoryUsage: Deno.memoryUsage(),
  };

  return Response.json(status);
}

function statusResponse(status: number) {
  return new Response(null, { status });
}

function assert(expression: unknown): asserts expression {
  if (!expression) {
    throw Error();
  }
}
