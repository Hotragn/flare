// Reads the bot's setup from Telegram: getMe and getWebhookInfo (INT3). Read-only, but it
// still calls Telegram, so without --yes it prints the two calls and stops.
// Usage: npm run telegram:status            (dry run)
//        npm run telegram:status -- --yes   (calls getMe and getWebhookInfo)
import { callBot, describeCall, formatStatus, hasYes, loadVars } from "./telegram-lib.ts";

const vars = loadVars();
console.log(describeCall("getMe", {}));
console.log(describeCall("getWebhookInfo", {}));
const token = vars.TELEGRAM_BOT_TOKEN ?? "";
if (!/^\d+:[\w-]{30,}$/.test(token)) {
  console.error("problem: TELEGRAM_BOT_TOKEN missing or wrong shape");
  process.exit(1);
}
if (!hasYes(process.argv.slice(2))) {
  console.log("\nDry run. Nothing was sent. Add -- --yes to ask Telegram.");
  process.exit(0);
}
const [me, info] = await Promise.all([callBot(token, "getMe", {}), callBot(token, "getWebhookInfo", {})]);
console.log(`\n${formatStatus(me, info)}`);
