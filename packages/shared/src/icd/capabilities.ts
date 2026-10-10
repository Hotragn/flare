// ICD-8: runtime capability detection (work package ODAI), used by frontend and PWA to pick
// features (SRS-COMP-2, SRS-AI-5). Frozen v1. Never reads device model strings.

export type Capabilities = {
  secureContext: boolean;
  standalone: boolean; // display-mode: standalone (Home Screen app)
  camera: "live" | "file-only" | "none";
  offscreenCanvas: boolean;
  geolocation: boolean;
  orientation: "needs-permission" | "available" | "none";
  speech: boolean;
  vibrate: boolean;
  switchHaptic: boolean; // <input type=checkbox switch> exists (iOS 17.4+)
  webgl2: boolean;
  push: "available" | "needs-install" | "none"; // iOS needs the Home Screen app (16.4+)
  share: boolean;
  shareFiles: boolean;
  serviceWorker: boolean;
  storagePersisted: boolean | null;
};

export interface CapabilityProbe {
  /** Passive checks only; no prompts. Under 20 ms. */
  detect(): Capabilities;
  /** Frame-time probe for the flame shader gate: true if ≥ 50 fps over 60 frames (ADR-0003). */
  shaderOk(canvas: HTMLCanvasElement): Promise<boolean>;
}
