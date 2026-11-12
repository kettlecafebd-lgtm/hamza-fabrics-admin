const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 };

export function createLogger({ level = 'info', scope = 'hamza-backend', sink = console } = {}) {
  const threshold = LEVELS[level] ?? LEVELS.info;

  const write = (name, stream, args) => {
    if (LEVELS[name] < threshold) return;
    const line = `[${scope}] ${name.toUpperCase()}`;
    stream.call(console, line, ...args);
  };

  return {
    debug: (...args) => write('debug', sink.log ?? sink.debug ?? console.log, args),
    info: (...args) => write('info', sink.info ?? console.log, args),
    warn: (...args) => write('warn', sink.warn ?? console.warn, args),
    error: (...args) => write('error', sink.error ?? console.error, args),
    child(childScope) {
      return createLogger({ level, scope: `${scope}:${childScope}`, sink });
    },
  };
}

export default createLogger;
