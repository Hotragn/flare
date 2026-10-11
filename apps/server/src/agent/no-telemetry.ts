// Mastra sends its own usage telemetry unless this is set. Imported before @mastra/core
// (ADR-0025: the agent calls nothing besides the relay, DigitalOcean when the hub is absent,
// and api.weather.gov for the weather tool).
process.env.MASTRA_TELEMETRY_DISABLED ??= "1";
