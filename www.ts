import { CSS, render } from "https://deno.land/x/gfm@0.2.5/mod.ts";
import { VERSION } from "./version.ts";

// Start the speed test server if this module is called directly
if (import.meta.main) {
  // The first argumetn is an optional port number
  const port = Deno.args.length === 1 ? Number(Deno.args[0]) : 8001;
  Deno.serve({ port }, wwwHandler);
}

export function wwwHandler(request: Request): Response {
  const url = new URL(request.url);

  switch (url.pathname) {
    case "/":
      return indexHandler();
    case "/server.ts":
    case "/client.ts":
      return redirectHandler(url.pathname);
    default:
      return new Response(null, { status: 404 }); // Not Found
  }
}

function indexHandler(): Response {
  const markdown = Deno.readTextFileSync(
    new URL(import.meta.resolve("./README.md")),
  );
  const body = render(markdown);

  const html = `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        main {
          max-width: 800px;
          margin: 0 auto;
        }
        ${CSS}
      </style>
    </head>
    <body>
      <main data-color-mode="light" data-light-theme="light" data-dark-theme="dark" class="markdown-body">
        ${body}
      </main>
    </body>
  </html>
  `;

  return new Response(html, { headers: { "Content-type": "text/html" } });
}

function redirectHandler(pathname: string) {
  const path = `https://deno.land/x/speedtesting@${VERSION}${pathname}`;
  return new Response(`Redirecting to ${path}`, {
    headers: { "Location": path },
    status: 307,
  });
}
