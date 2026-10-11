import { goto } from "$app/navigation";

/** Close: back to where the person came from (the menu), else the camera. */
export function back(): void {
  if (history.length > 1) history.back();
  else void goto("/app/");
}
