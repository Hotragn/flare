// Sunset from the NOAA Solar Calculator equations (after Meeus, "Astronomical Algorithms").
// Source: https://gml.noaa.gov/grad/solcalc/calcdetails.html (the NOAA_Solar_Calculations
// spreadsheet). Apparent sunset: zenith 90.833° (refraction plus the sun's radius).
import type { LatLon } from "@flare/shared/icd/map";

const RAD = Math.PI / 180;
const sin = (d: number) => Math.sin(d * RAD);
const cos = (d: number) => Math.cos(d * RAD);
const tan = (d: number) => Math.tan(d * RAD);

/** Sun declination (degrees) and equation of time (minutes) at a Julian century. */
function solar(jc: number): { decl: number; eqTime: number } {
  const L0 = (280.46646 + jc * (36000.76983 + jc * 0.0003032)) % 360;
  const M = 357.52911 + jc * (35999.05029 - 0.0001537 * jc);
  const e = 0.016708634 - jc * (0.000042037 + 0.0000001267 * jc);
  const C =
    sin(M) * (1.914602 - jc * (0.004817 + 0.000014 * jc)) +
    sin(2 * M) * (0.019993 - 0.000101 * jc) +
    sin(3 * M) * 0.000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * jc;
  const appLong = trueLong - 0.00569 - 0.00478 * sin(omega);
  const meanObliq = 23 + (26 + (21.448 - jc * (46.815 + jc * (0.00059 - jc * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * cos(omega);
  const decl = Math.asin(sin(obliq) * sin(appLong)) / RAD;
  const y = tan(obliq / 2) ** 2;
  const eqTime =
    (4 / RAD) *
    (y * sin(2 * L0) -
      2 * e * sin(M) +
      4 * e * y * sin(M) * cos(2 * L0) -
      0.5 * y * y * sin(4 * L0) -
      1.25 * e * e * sin(2 * M));
  return { decl, eqTime };
}

const julianCentury = (ms: number) => (ms / 86_400_000 + 2440587.5 - 2451545) / 36525;

/**
 * Sunset at `at` on the local solar day containing `day` (day boundaries from longitude, so
 * no time zone is needed). Returns an Invalid Date when the sun does not set that day.
 */
export function sunset(at: LatLon, day: Date): Date {
  // Local solar date: shift by longitude (15° per hour), then take that calendar day's 00:00 UTC.
  const solarMs = day.getTime() + (at.lon / 15) * 3_600_000;
  const d = new Date(solarMs);
  const midnightUtc = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  // Start from local solar noon, then refine twice at the computed sunset time.
  let minutes = 720 - 4 * at.lon;
  for (let i = 0; i < 3; i++) {
    const { decl, eqTime } = solar(julianCentury(midnightUtc + minutes * 60_000));
    const cosHa = cos(90.833) / (cos(at.lat) * cos(decl)) - tan(at.lat) * tan(decl);
    if (cosHa < -1 || cosHa > 1) return new Date(Number.NaN);
    const ha = Math.acos(cosHa) / RAD;
    minutes = 720 - 4 * at.lon - eqTime + 4 * ha;
  }
  return new Date(midnightUtc + Math.round(minutes * 60_000));
}
