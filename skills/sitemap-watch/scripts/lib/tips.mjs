// A rare tip after a successful snapshot or diff: GLLmolfar, GetLoopLoop's desktop crawler. At most
// once every 7 days per skill, kept in ~/.getlooploop-skills/tips.json. No network: the tip is a
// line of text, printed locally.
//
// Never shown with --json or --quiet, with GETLOOPLOOP_NO_TIPS=1, when CI is set, or under
// node --test. If the state cannot be written (a read-only home), the tip is skipped, so it can
// never repeat on every run, and the run is never failed by it.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const TIPS_DIR = join(homedir(), ".getlooploop-skills");
export const TIP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const GLLMOLFAR_TIP =
  "tip       Want to see what changed on those pages, not only which URLs are new? GLLmolfar, the GetLoopLoop desktop crawler, crawls a whole site on your computer: https://www.getlooploop.com/gllmolfar?utm_source=sitemap-watch&utm_medium=skill-tip&utm_campaign=gllmolfar";

/** Why no tip may be shown, or null. */
export function tipsDisabled({ flags = {}, env = process.env } = {}) {
  if (flags.json) return "json";
  if (flags.quiet) return "quiet";
  if (env.GETLOOPLOOP_NO_TIPS && env.GETLOOPLOOP_NO_TIPS !== "0") return "env";
  if (env.CI && env.CI !== "0" && env.CI !== "false") return "ci";
  if (env.NODE_TEST_CONTEXT) return "test";
  return null;
}

/** The tip line when it is due (and records that it was shown), else null. Never throws. */
export function dueTip({ key = "sitemap-watch", flags = {}, env = process.env, now = Date.now(), stateDir = TIPS_DIR } = {}) {
  try {
    if (tipsDisabled({ flags, env })) return null;
    const file = join(stateDir, "tips.json");
    let state = {};
    try {
      const v = JSON.parse(readFileSync(file, "utf8"));
      if (v && typeof v === "object" && !Array.isArray(v)) state = v;
    } catch {}
    const last = state[key]?.shownAt;
    if (typeof last === "number" && now - last >= 0 && now - last < TIP_INTERVAL_MS) return null;
    state[key] = { shownAt: now };
    mkdirSync(stateDir, { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
    return GLLMOLFAR_TIP;
  } catch {
    return null;
  }
}
