// SEO for the five prerendered website pages: canonical URLs, Open Graph, and the JSON-LD
// SoftwareApplication record. The site is prerendered, so the origin is fixed at build time:
// the production server from openapi.yaml `servers`, or SITE_ORIGIN when building elsewhere.
import { t } from "#lib/copy/index.ts";

export const ORIGIN = (import.meta.env.SITE_ORIGIN as string | undefined) ?? "https://flare-outside.onrender.com";

export const OG_IMAGE = { path: "/site/og-image-1200x630.png", width: 1200, height: 630 };

export type SitePage = { path: "/" | "/how/" | "/privacy/" | "/accessibility/" | "/run/"; title: string; desc: string };

export const PAGES: readonly SitePage[] = [
  { path: "/", title: t("og.site.title"), desc: t("og.site.desc") },
  { path: "/how/", title: t("og.how.title"), desc: t("og.how.desc") },
  { path: "/privacy/", title: t("og.privacy.title"), desc: t("og.privacy.desc") },
  { path: "/accessibility/", title: t("og.access.title"), desc: t("og.access.desc") },
  { path: "/run/", title: t("og.run.title"), desc: t("og.run.desc") },
];

export const page = (path: SitePage["path"]): SitePage => {
  const p = PAGES.find((x) => x.path === path);
  if (!p) throw new Error(`seo: unknown page ${path}`);
  return p;
};

/** schema.org SoftwareApplication (Google rich results need name, offers, and a category). */
export function softwareApplication(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: t("app.name"),
    description: t("og.site.desc"),
    url: `${ORIGIN}/`,
    image: `${ORIGIN}${OG_IMAGE.path}`,
    applicationCategory: "SocialNetworkingApplication",
    operatingSystem: "iOS 16.4 or later, Android, any modern browser",
    browserRequirements: "Requires JavaScript. Works offline after the first visit.",
    isAccessibleForFree: true,
    license: "https://www.gnu.org/licenses/agpl-3.0.html",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    accessibilityFeature: ["highContrastDisplay", "largePrint", "audioDescription", "alternativeText"],
  };
}

/** JSON for a `<script type="application/ld+json">` block; `<` is escaped so text can't close the tag. */
export const ldJson = (v: unknown) => JSON.stringify(v).replace(/</g, "\\u003c");
