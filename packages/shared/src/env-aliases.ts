// Short names the founder used in .env, mapped to the names the code reads. The canonical
// name wins when both are set. Values are never printed or logged.
export const ENV_ALIASES: Record<string, string> = {
  ELEVENLABS: "ELEVENLABS_API_KEY",
  TINKER: "TINKER_API_KEY",
  GEMINI: "GEMINI_API_KEY",
};

/** Copies alias values onto their canonical names, in place, when the canonical one is empty. */
export function applyEnvAliases(vars: Record<string, string | undefined>): Record<string, string | undefined> {
  for (const [alias, name] of Object.entries(ENV_ALIASES)) {
    if (!vars[name] && vars[alias]) vars[name] = vars[alias];
  }
  return vars;
}
