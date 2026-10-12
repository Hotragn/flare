// Photo-fit hooks for the photo screens (I1, H2, H3). Each loads its module on first use, so
// the entry bundles carry only these lines: the light check on the photo's load event, and
// the full-screen viewer on tap.
export const lit = (e: Event) => import("./photo-light.ts").then((m) => m.light(e.currentTarget as HTMLImageElement));
export const zoom = (e: Event) => {
  const b = e.currentTarget as HTMLElement;
  const img = b.querySelector("img");
  if (img) import("./photo-view.ts").then((m) => m.openPhoto(img, b));
};
