# Flare brand files

Start with [docs/brand/03-brand-book.md](../docs/brand/03-brand-book.md).

| Folder | Contents |
| --- | --- |
| logo/ | Mark, wordmark, lockups, state marks (SVG) |
| icon/ | App icon masters (SVG) |
| icons/ | 16 UI icons, 24 px grid, currentColor |
| export/ | PNG, ICO and splash exports, social images, contact sheet |
| texture/ | Paper grain |
| tokens/ | tokens.css and tokens.json |
| fonts/ | Fraunces and Atkinson Hyperlegible Next (WOFF2, OFL) |
| tools/ | Source: palette.mjs, build.mjs, contrast.mjs |

Rebuild everything:

```bash
cd brand/tools && npm ci && npm run build && npm run contrast
```
