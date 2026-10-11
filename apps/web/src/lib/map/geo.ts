// Small spherical-earth helpers. Accurate to well under 1 m at the 3 km scale we use.
import type { LatLon } from "@flare/shared/icd/map";

export const EARTH_RADIUS_M = 6_371_008.8;
const RAD = Math.PI / 180;

/** Great-circle distance in metres (haversine). */
export function distanceM(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Initial bearing from a to b in degrees, 0 = north, clockwise, in [0, 360). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const φ1 = a.lat * RAD;
  const φ2 = b.lat * RAD;
  const Δλ = (b.lon - a.lon) * RAD;
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/** Point reached from `a` after `m` metres on bearing `deg`. */
export function destination(a: LatLon, deg: number, m: number): LatLon {
  const δ = m / EARTH_RADIUS_M;
  const θ = deg * RAD;
  const φ1 = a.lat * RAD;
  const λ1 = a.lon * RAD;
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * Math.sin(δ) * Math.cos(φ1), Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2));
  return { lat: φ2 / RAD, lon: ((λ2 / RAD + 540) % 360) - 180 };
}

/**
 * Shortest distance in metres from point p to the segment a-b. Uses a local
 * equirectangular projection centred on a, which is exact enough below 10 km.
 */
export function distanceToSegmentM(p: LatLon, a: LatLon, b: LatLon): number {
  const k = Math.cos(a.lat * RAD);
  const toXY = (q: LatLon) =>
    [(q.lon - a.lon) * RAD * k * EARTH_RADIUS_M, (q.lat - a.lat) * RAD * EARTH_RADIUS_M] as const;
  const [px, py] = toXY(p);
  const [bx, by] = toXY(b);
  const len2 = bx * bx + by * by;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Smallest signed difference b - a between two bearings, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = ((((b - a) % 360) + 540) % 360) - 180;
  return d === -180 ? 180 : d;
}

/** Round to 5 decimals (about 1.1 m), the pack's coordinate precision. */
export function round5(x: number): number {
  return Math.round(x * 1e5) / 1e5;
}

/** Round to 4 decimals (about 11 m). Street points only: they name a street, nothing more. */
export function round4(x: number): number {
  return Math.round(x * 1e4) / 1e4;
}
