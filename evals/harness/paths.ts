// Where eval inputs live. Lab files are read in place and never copied (lab/ is read-only).
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { EVALS_DIR } from "./report.ts";

export const REPO_DIR = resolve(EVALS_DIR, "..");

/** lab/ sits in the main checkout; worktrees find it through git's common dir. */
export function labDir(): string | null {
  if (process.env.FLARE_LAB_DIR) return process.env.FLARE_LAB_DIR;
  const local = join(REPO_DIR, "lab");
  if (existsSync(local)) return local;
  try {
    const common = execFileSync("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], {
      cwd: REPO_DIR,
      encoding: "utf8",
    }).trim();
    const lab = join(dirname(common), "lab");
    return existsSync(lab) ? lab : null;
  } catch {
    return null;
  }
}

export const readJson = <T>(p: string): T => JSON.parse(readFileSync(p, "utf8")) as T;
export const dataset = <T>(name: string): T => readJson<T>(join(EVALS_DIR, "datasets", name));
