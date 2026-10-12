// Photo-fit hooks for the photo screens (I1, H2, H3). The light check (on the photo's load
// event) and the full-screen viewer (on tap) live in photo-light.ts, loaded on first use, so
// the entry bundles carry only these lines.
import { t } from "#lib/copy/index.ts";

const more = () => import("./photo-light.ts");
export const lit = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement; // currentTarget is null once the event is done
  more().then((m) => m.light(img));
};
export const zoom = (e: Event) => {
  const b = e.currentTarget as HTMLElement;
  const img = b.querySelector("img");
  if (img) more().then((m) => m.openPhoto(img, b, t("app.close")));
};
