// Full-screen photo (photo-fit fix): tap the photo to see all of it. A native <dialog> opened
// with showModal() gives the focus trap, Escape and the top layer; a 44 px close button; focus
// goes back to the photo that opened it. Loaded lazily on the first tap, so the entry bundles
// don't carry it. Plain DOM, no Svelte runtime. The same display filter as the small photo.

import { t } from "#lib/copy/index.ts";

export function openPhoto(small: HTMLImageElement, from: HTMLElement): void {
  const alt = small.alt || from.getAttribute("aria-label") || "";
  const d = document.createElement("dialog");
  d.className = "photo-view";
  d.setAttribute("aria-label", alt);
  d.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:#000;color:#fff;display:grid;place-items:center";
  const img = document.createElement("img");
  img.src = small.currentSrc || small.src;
  img.alt = alt;
  img.style.cssText = "max-width:100%;max-height:100%;object-fit:contain;display:block";
  img.style.filter = small.style.filter;
  const x = document.createElement("button");
  x.type = "button";
  x.setAttribute("aria-label", t("app.close"));
  x.style.cssText =
    "position:absolute;top:calc(env(safe-area-inset-top,0px) + 8px);right:10px;width:44px;height:44px;border-radius:50%;border:0;background:rgb(255 255 255 / .2);color:#fff;font:700 22px/1 system-ui;display:grid;place-items:center";
  x.textContent = "×";
  x.onclick = () => d.close();
  d.onclick = (e) => {
    if (e.target === d || e.target === img) d.close();
  };
  d.onclose = () => {
    d.remove();
    from.focus({ preventScroll: true });
  };
  d.append(img, x);
  document.body.append(d);
  d.showModal();
  x.focus();
}
