import { speedTestHandler } from "./server.ts";
import { wwwHandler } from "./www.ts";

Deno.serve(async (request: Request): Promise<Response> => {
  const serverResponse = await speedTestHandler(request);
  if (serverResponse.status !== 404) {
    return serverResponse;
  }
  return wwwHandler(request);
});
