// The weekly GLLmolfar tip (scripts/lib/tips.mjs): shown once, not again within 7 days, shown again
// after 7 days, and never with --json, --quiet, GETLOOPLOOP_NO_TIPS or CI. Local only: the one
// snapshot below reads a sitemap from a server on localhost.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { dueTip, tipsDisabled, GLLMOLFAR_TIP, TIP_INTERVAL_MS } from "../scripts/lib/tips.mjs";
import { main } from "../scripts/sitemap-watch.mjs";

const temp = () => mkdtempSync(join(tmpdir(), "gll-tips-"));
const t0 = 1_800_000_000_000;

test("the tip is the agreed line, with the link and no number of pages", () => {
  assert.match(GLLMOLFAR_TIP, /^tip {7}Want to see what changed on those pages/);
  assert.ok(GLLMOLFAR_TIP.endsWith("https://www.getlooploop.com/gllmolfar?utm_source=sitemap-watch&utm_medium=skill-tip&utm_campaign=gllmolfar"));
  assert.doesNotMatch(GLLMOLFAR_TIP.replace(/https:\/\/\S+$/, ""), /\d/);
});

test("shown once, not again within 7 days, again after 7 days", () => {
  const dir = temp();
  const o = { env: {}, stateDir: dir };
  assert.equal(dueTip({ ...o, now: t0 }), GLLMOLFAR_TIP);
  assert.equal(dueTip({ ...o, now: t0 + 1000 }), null);
  assert.equal(dueTip({ ...o, now: t0 + TIP_INTERVAL_MS - 1 }), null);
  assert.equal(dueTip({ ...o, now: t0 + TIP_INTERVAL_MS }), GLLMOLFAR_TIP);
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(join(dir, "tips.json"), "utf8"))), ["sitemap-watch"]);
  rmSync(dir, { recursive: true, force: true });
});

test("--json, --quiet, GETLOOPLOOP_NO_TIPS and CI suppress it, and nothing is written", () => {
  for (const o of [{ flags: { json: true }, env: {} }, { flags: { quiet: true }, env: {} }, { flags: {}, env: { GETLOOPLOOP_NO_TIPS: "1" } }, { flags: {}, env: { CI: "true" } }]) {
    const dir = temp();
    assert.ok(tipsDisabled(o));
    assert.equal(dueTip({ ...o, stateDir: dir, now: t0 }), null);
    assert.ok(!existsSync(join(dir, "tips.json")));
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(tipsDisabled({ flags: {}, env: { GETLOOPLOOP_NO_TIPS: "0", CI: "false" } }), null);
});

test("a state folder that cannot be written skips the tip instead of failing", () => {
  const dir = temp();
  const blocked = join(dir, "file");
  writeFileSync(blocked, "a plain file where the state folder should be");
  assert.equal(dueTip({ env: {}, stateDir: join(blocked, "sub"), now: t0 }), null);
  rmSync(dir, { recursive: true, force: true });
});

let server;
let base;
before(async () => {
  server = createServer((req, res) => {
    if (req.url === "/robots.txt") return res.end(`User-agent: *\nSitemap: ${base}/sitemap.xml\n`);
    if (req.url === "/sitemap.xml") return res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}/a</loc></url></urlset>`);
    res.statusCode = 404;
    res.end();
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

test("after a successful snapshot the CLI prints the tip as its last line once; --json prints none", async () => {
  const snaps = temp();
  const state = temp();
  const run = async (args, now) => {
    const lines = [];
    const code = await main(["snapshot", base, "--dir", snaps, "--delay-ms", "0", ...args], { log: (m) => lines.push(m), err: (m) => lines.push(m) }, { env: {}, stateDir: state, now });
    return { code, lines };
  };
  const first = await run([], t0);
  assert.equal(first.code, 0);
  assert.equal(first.lines.at(-1), GLLMOLFAR_TIP);
  const second = await run([], t0 + 1000);
  assert.ok(!second.lines.includes(GLLMOLFAR_TIP));
  const json = await run(["--json"], t0 + TIP_INTERVAL_MS + 1);
  assert.ok(!json.lines.includes(GLLMOLFAR_TIP));
  rmSync(snaps, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
});
