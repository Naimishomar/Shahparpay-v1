import util from 'node:util';

/**
 * Keeps the last MAX console lines in memory so the admin portal can show live
 * server logs without SSH. Imported first in index.js so it sees every line.
 * ponytail: per process and lost on restart; ship to CloudWatch if history beyond the last restart matters.
 */
const MAX = 2000;
const lines = [];
let seq = 0;
const ANSI = /\x1b\[[0-9;]*m/g;

for (const level of ['log', 'info', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    const text = util.format(...args).replace(ANSI, '');
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      lines.push({ seq: ++seq, at: Date.now(), level: level === 'info' ? 'log' : level, line: line.slice(0, 2000) });
    }
    if (lines.length > MAX) lines.splice(0, lines.length - MAX);
  };
}

/** Lines after `since` (a seq the caller already has), oldest first. */
export const readLogs = (since = 0) => lines.filter((l) => l.seq > since);
