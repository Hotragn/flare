// Photo-fit hooks for the photo screens (I1, H2, H3). Each loads its module on first use, so
// the entry bundles carry only these lines: the light check on the photo's load event, and
// the full-screen viewer on tap.
import { t } from "#lib/copy/index.ts";

export const lit = (e: Event) => {
  const img = e.currentTarget as HTMLImageElement; // currentTarget is null once the event is done
  import("./photo-light.ts").then((m) => m.light(img));
};
export const zoom = (e: Event) => {
  const b = e.currentTarget as HTMLElement;
  const img = b.querySelector("img");
  if (img) import("./photo-view.ts").then((m) => m.openPhoto(img, b, t("app.close")));
};
