import { Hono } from "https://deno.land/x/hono@v3.7.2/mod.ts";
import { CSS, render } from "https://deno.land/x/gfm@0.2.5/mod.ts";
import { VERSION } from "./version.ts";
import { server } from "./server.ts";

const app = new Hono(server);

app.get("/", (ctx) => {
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

  return ctx.html(html);
});

app.get(
  "/server.ts",
  (ctx) =>
    ctx.redirect(`https://deno.land/x/speedtesting@${VERSION}/server.ts`, 307),
);
app.get(
  "/client.ts",
  (ctx) =>
    ctx.redirect(`https://deno.land/x/speedtesting@${VERSION}/client.ts`, 307),
);

// Start the speed test server and documentation server
Deno.serve(app.fetch);
