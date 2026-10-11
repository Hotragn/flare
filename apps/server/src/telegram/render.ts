// What a gathering's group post says, by state (contracts/telegram.md 3 and 5).
// Pure functions: same row and count in, same text and keyboard out.
import type { Keyboard } from "./api.ts";
import { t } from "./copy.ts";
import type { PostRow, TelegramPlain } from "./store.ts";

export type PostView = { need: number; until: string | null };

/** Adds query parameters before the `#k=` fragment, which must stay last. */
export function withQuery(link: string, params: Record<string, string>): string {
  const u = new URL(link);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

export function clock(iso: string | Date, tz: string): string {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz })
    .format(new Date(iso))
    .replace(/\u202f/g, " ");
}

const stepName = (row: PostRow, plain: TelegramPlain, step: number | null): string => {
  const s = row.plan_steps?.find((x) => x.step === step);
  return (s && plain.step_names?.[s.place]) ?? plain.place;
};

function planLines(row: PostRow, plain: TelegramPlain): string[] {
  if (row.kind !== "plan" || !row.plan_steps) return [];
  return [...row.plan_steps]
    .sort((a, b) => a.step - b.step)
    .map((s) => t("bot.plan.step", { k: s.step, step: plain.step_names?.[s.place] ?? s.place, min: s.minutes }));
}

/** Buttons while answers are open: I'm in, Add a condition, Open in Flare. */
export function openKeyboard(gatheringId: string, link: string): Keyboard {
  return {
    inline_keyboard: [
      [{ text: t("invite.yes"), callback_data: `y:${gatheringId}` }],
      [{ text: t("invite.condition"), callback_data: `c:${gatheringId}` }],
      [{ text: t("bot.post.open"), url: withQuery(link, { via: "tg" }) }],
    ],
  };
}
export const linkKeyboard = (text: string, url: string): Keyboard => ({ inline_keyboard: [[{ text, url }]] });

export type Rendered = { text: string; keyboard: Keyboard | null };

/** The post's caption and keyboard for the gathering's state now. */
export function renderPost(row: PostRow, view: PostView | null, smaller = false): Rendered {
  const plain = row.plain as TelegramPlain;
  const open = linkKeyboard(t("bot.post.open"), withQuery(plain.link, { via: "tg" }));
  if (row.state === "gone") {
    return { text: row.ended === "thanks_for_coming" ? t("outside.thanks") : t("gone.title"), keyboard: null };
  }
  if (row.state === "lit") return { text: litLine(row), keyboard: open };
  const ember = row.state === "ember";
  const place = ember && row.ember_choice ? (plain.ember_places?.[row.ember_choice] ?? plain.place) : plain.place;
  let needLine = t("bot.post.need", { n: Math.max(1, view?.need ?? 1) });
  if (ember) needLine = t("bot.post.ember");
  if (smaller) needLine = t("bot.post.smaller", { step: stepName(row, plain, row.current_step) });
  const lines = [plain.invite, `${plain.host} · ${place}`, ...planLines(row, plain), needLine];
  if (view?.until) lines.push(t("bot.post.until", { time: clock(view.until, row.tz) }));
  return { text: lines.join("\n"), keyboard: openKeyboard(row.id, plain.link) };
}

/** "It's lit. {host} is at {place}." for Flares; "It's on: {step} at {time}." for Plans. */
export function litLine(row: PostRow): string {
  const plain = row.plain as TelegramPlain;
  if (row.kind === "plan" && row.start_at)
    return t("push.planOn", { step: stepName(row, plain, row.current_step), time: clock(row.start_at, row.tz) });
  return t("lit.notice", { host: plain.host, spot: plain.place });
}

/** The notifying message sent with Ember (phones buzz; the edit alone is silent). */
export function emberLine(row: PostRow): string {
  const plain = row.plain as TelegramPlain;
  if (row.kind === "plan") return t("bot.post.smaller", { step: stepName(row, plain, row.current_step) });
  const bench = (row.ember_choice && plain.ember_places?.[row.ember_choice]) || plain.place;
  return t("push.ember", { bench });
}
