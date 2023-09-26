# speedtesting

Fast speed test server and client for Deno runtime. Measures latency, download
speed and upload speed.

To use this software,
[install Deno](https://docs.deno.com/runtime/manual/getting_started/installation).

## Running the server

Run the following command:

```
deno run -A https://speedtesting.deno.dev/server.ts
```

Congratulation, you now have a running speed test server! You can specify a
custom port number:

```
deno run -A https://speedtesting.deno.dev/server.ts 1234
```

## Running the client

To run a speed test against the default speed test server, run:

```
deno run -A https://speedtesting.deno.dev/client.ts
```

That command will measure latency, download speed and upload speed against
`https://speedtesting.deno.dev` server.

You can set following flags to customize the execution:

- `server`: speed test server URL (defaults to `https://speedtesting.deno.dev`)
- `pingCount`: how many pings to do to measure latency (defaults to 100)
- `downloadMegabytes`: how many megabytes of data to download during download
  test (defaults to 100)
- `uploadMegabytes`: how many megabytes of data to upload during upload test
  (defaults to 100)
- `deadlineSeconds`: maximum execution timeout for each subtest (defaults to 30
  seconds)

## Deno module

Speed test server and client are published as Deno modules at
[https://deno.land/x/speedtesting](https://deno.land/x/speedtesting).

As such, both server and client may be used programatically within Deno
environment outside of CLI.

## Source code

Source code is available at
[https://github.com/karelklima/speedtesting](https://github.com/karelklima/speedtesting).

## License

[MIT License](./LICENSE)

Copyright © 2021-present [Karel Klima](https://karelklima.com)
