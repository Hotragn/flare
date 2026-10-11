// Sets the Telegram webhook (contracts/telegram.md 1, INT3). Waits for the founder's yes:
// without --yes it prints the call it would make, with the token and secret hidden.
// Run only after the live test in lab/ (docs/engineering/05-device-checklist.md): polling
// and the webhook can't both run.
// Usage: npm run telegram:webhook            (dry run)
//        npm run telegram:webhook -- --yes   (calls setWebhook)
import { callBot, describeCall, hasYes, loadVars, webhookPlan } from "./telegram-lib.ts";

const vars = loadVars();
const plan = webhookPlan(vars);
console.log(describeCall(plan.method, plan.params));
for (const p of plan.problems) console.error(`problem: ${p}`);

if (!hasYes(process.argv.slice(2))) {
  console.log("\nDry run. Nothing was sent. Add -- --yes after the founder approves.");
  process.exit(plan.problems.length ? 1 : 0);
}
if (plan.problems.length) {
  console.error("\nRefusing to call setWebhook until the problems above are fixed.");
  process.exit(1);
}
await callBot(vars.TELEGRAM_BOT_TOKEN as string, plan.method, plan.params);
console.log("\nsetWebhook: ok. Check with npm run telegram:status -- --yes");
