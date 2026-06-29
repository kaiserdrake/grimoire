import fs from 'fs';
import path from 'path';

// File logging is opt-in and DISABLED by default. Enable it by setting
// FILE_LOGGING_ENABLED=true in the environment. When enabled, all console
// output is also appended (with a timestamp + level) to a log file on the
// persistent /data volume. Console output to stdout/stderr is preserved either
// way, so `docker logs` keeps working regardless of this setting.
const isEnabled = () =>
  String(process.env.FILE_LOGGING_ENABLED || '').trim().toLowerCase() === 'true';

const LOG_FILE = process.env.LOG_FILE || '/data/logs/grimoire.log';

const serialize = (arg) => {
  if (typeof arg === 'string') return arg;
  if (arg instanceof Error) return arg.stack || arg.message;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
};

// Wraps a console method so its output is also written to the log file.
const tee = (level, original, stream) => (...args) => {
  original(...args);
  try {
    const line = args.map(serialize).join(' ');
    stream.write(`${new Date().toISOString()} [${level}] ${line}\n`);
  } catch {
    // Never let logging break the app.
  }
};

// Installs file logging if enabled. Safe to call once at startup; a no-op when
// the setting is disabled.
export const initLogging = () => {
  if (!isEnabled()) return;

  let stream;
  try {
    fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
    stream = fs.createWriteStream(LOG_FILE, { flags: 'a' });
  } catch (err) {
    console.error(`File logging disabled: could not open log file ${LOG_FILE}: ${err.message}`);
    return;
  }

  console.log   = tee('INFO',  console.log.bind(console),   stream);
  console.info  = tee('INFO',  console.info.bind(console),  stream);
  console.warn  = tee('WARN',  console.warn.bind(console),  stream);
  console.error = tee('ERROR', console.error.bind(console), stream);
  console.debug = tee('DEBUG', console.debug.bind(console), stream);

  console.log(`File logging enabled → ${LOG_FILE}`);
};
