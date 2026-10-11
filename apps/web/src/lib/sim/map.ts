// Virtual Fairlane map: MapLibre on OpenStreetMap raster tiles, friends and gatherings as
// GeoJSON circles. Loaded only by the /sim/ page (dynamic import), never by the app.
import "maplibre-gl/dist/maplibre-gl.css";
import type { Feature, FeatureCollection } from "geojson";
import { type GeoJSONSource, Map as MlMap, NavigationControl, setWorkerUrl } from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import { positionAt, type Replay, STATUS, stateAt } from "./replay.ts";

export const TILE_HOST = "https://tile.openstreetmap.org";

const STATE_COLOR: Record<string, string> = {
  kindling: "#e8a33d",
  lit: "#f2c14e",
  ember: "#d4552b",
  gone: "#8a8f98",
  deleted: "#8a8f98",
};
const TYPE_COLOR: Record<string, string> = {
  keen: "#2f6fdf",
  lazy: "#8e5bd8",
  conditional: "#1f9e89",
  bench: "#c2410c",
  lowvision: "#db2777",
  planner: "#15803d",
};

type FC = FeatureCollection;
const fc = (features: Feature[]): FC => ({ type: "FeatureCollection", features });
const pt = (lat: number, lon: number, properties: Record<string, unknown>): Feature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lon, lat] },
  properties,
});

export type SimMap = { draw(tick: number): void; idle(): Promise<void>; destroy(): void };

export function createSimMap(el: HTMLElement, r: Replay): Promise<SimMap> {
  setWorkerUrl(workerUrl);
  const [[s, w], [n, e]] = r.bounds;
  const map = new MlMap({
    container: el,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [`${TILE_HOST}/{z}/{x}/{y}.png`],
          tileSize: 256,
          maxzoom: 19,
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.6 } }],
    },
    bounds: [
      [w, s],
      [e, n],
    ],
    fitBoundsOptions: { padding: 30 },
    attributionControl: { compact: false },
    canvasContextAttributes: { preserveDrawingBuffer: true },
    fadeDuration: 0,
  });
  map.addControl(new NavigationControl({ showCompass: false }), "top-right");

  const gatherData = (t: number): FC =>
    fc(
      r.gatherings.flatMap((g) => {
        const st = stateAt(g, t);
        if (!st || st.state === "deleted") return [];
        const where = st.state === "lit" || st.state === "gone" ? (g.meet ?? g.spot) : g.spot;
        const out = [pt(where[0], where[1], { color: STATE_COLOR[st.state] ?? "#888", state: st.state, kind: g.kind })];
        if (st.state === "ember")
          for (const c of g.ember_candidates) out.push(pt(c[0], c[1], { color: STATE_COLOR.ember, state: "bench" }));
        return out;
      }),
    );
  const friendData = (tick: number): FC => {
    const f = r.frames[Math.min(r.frames.length - 1, Math.round(tick))];
    return fc(
      r.friends.map((fr, i) => {
        const [lat, lon] = positionAt(r, i, tick);
        const status = Number(f?.s[i] ?? 0);
        return pt(lat, lon, {
          color: TYPE_COLOR[fr.type] ?? "#333",
          moving: status !== STATUS.home ? 1 : 0,
          there: status === STATUS.there ? 1 : 0,
        });
      }),
    );
  };

  return new Promise((resolve) => {
    map.on("load", () => {
      map.addSource("gatherings", { type: "geojson", data: gatherData(0) });
      map.addSource("friends", { type: "geojson", data: friendData(0) });
      map.addLayer({
        id: "gathering-glow",
        type: "circle",
        source: "gatherings",
        filter: ["!=", ["get", "state"], "bench"],
        paint: {
          "circle-radius": ["match", ["get", "state"], "lit", 26, "ember", 18, 14],
          "circle-color": ["get", "color"],
          "circle-opacity": 0.28,
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "ember-benches",
        type: "circle",
        source: "gatherings",
        filter: ["==", ["get", "state"], "bench"],
        paint: {
          "circle-radius": 5,
          "circle-color": "#fff",
          "circle-stroke-color": ["get", "color"],
          "circle-stroke-width": 2,
        },
      });
      map.addLayer({
        id: "friends",
        type: "circle",
        source: "friends",
        paint: {
          "circle-radius": ["case", ["==", ["get", "moving"], 1], 5.5, 3.5],
          "circle-color": ["get", "color"],
          "circle-opacity": ["case", ["==", ["get", "moving"], 1], 1, 0.55],
          "circle-stroke-color": "#fff",
          "circle-stroke-width": ["case", ["==", ["get", "there"], 1], 2, 1],
        },
      });
      const sm: SimMap = {
        draw(tick) {
          (map.getSource("friends") as GeoJSONSource).setData(friendData(tick));
          (map.getSource("gatherings") as GeoJSONSource).setData(gatherData(tick * r.tick_s));
        },
        idle: () =>
          new Promise((res) => {
            const to = setTimeout(res, 5000); // tiles that never come should not stop an export
            map.once("idle", () => {
              clearTimeout(to);
              res();
            });
            map.triggerRepaint();
          }),
        destroy: () => map.remove(),
      };
      resolve(sm);
    });
  });
}

export { STATE_COLOR, TYPE_COLOR };
