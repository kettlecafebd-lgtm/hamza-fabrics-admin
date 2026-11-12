import { createApp } from './app.js';

let server;

export function start() {
  const { app, deps } = createApp();
  const port = Number(process.env.PORT) || deps.env.PORT;
  server = app.listen(port, '0.0.0.0', () => {
    deps.logger.info(`hamza-backend listening on :${port} — chat media mode: url-only`);
    deps.logger.info(`legacy blob writes: ${deps.env.ENABLE_LEGACY_BLOB_WRITES ? 'ENABLED (deprecated!)' : 'disabled'}`);
  });
  return { server, deps };
}

const isMain = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const { deps } = start();

  // Render/Railway/Fly send SIGTERM on deploy. Drain, then exit.
  const shutdown = (signal) => {
    deps.logger.info(`${signal} received — draining connections`);
    // Reference the module-level `server`, which start() assigns.
    const active = server;
    if (!active) process.exit(0);
    active.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
