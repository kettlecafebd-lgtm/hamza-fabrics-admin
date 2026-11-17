import { createApp } from './app.js';

let server;

export function start() {
  const { app, deps } = createApp();
  const port = Number(process.env.PORT) || deps.env.PORT;
  server = app.listen(port, '0.0.0.0', () => {
    // Two boot lines, not one per request: this is the shape of the log volume
    // we want in Supabase (rare, high-signal).
    deps.logger.info(
      `hamza-backend listening on :${port} — media driver: ${deps.mediaStorage.driver}` +
        ` (direct upload ${deps.env.MEDIA_DIRECT_UPLOAD_ENABLED ? 'on' : 'off'})`,
    );
    if (deps.env.ENABLE_LEGACY_BLOB_WRITES) {
      deps.logger.warn('legacy blob writes are ENABLED (deprecated: reintroduces Postgres egress)');
    }
    for (const warning of deps.env.MEDIA_STORAGE_WARNINGS || []) {
      deps.logger.warn(`media storage: ${warning}`);
    }
    if (deps.mediaStorage.driver === 'supabase') {
      deps.logger.warn(
        'Supabase Storage is still the active media driver — this is the source of the storage egress ' +
          'and log-ingestion charges. Configure R2_* and remove MEDIA_STORAGE_DRIVER=supabase.',
      );
    }
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
