// CLI output: one line to stdout (server code bans console.*; CLIs print counts only).
export const out = (s: string): void => {
  process.stdout.write(`${s}\n`);
};
