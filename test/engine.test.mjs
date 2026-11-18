import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { parseYaml, loadSpec, assess, check } from "../bin/triage.mjs";

const require = createRequire(import.meta.url);
const T = require("../docs/triage.js");
const spec = f => loadSpec(new URL("../examples/" + f, import.meta.url).pathname);

test("allergen chatbot: do not ship, rule 1 fires", () => {
  const s = spec("allergen-chatbot.yaml");
  const r = T.score(s.answers, s.profile);
  assert.equal(r.vkey, "no");
  assert.equal(r.rules[0][0], "Undetectable severe harm");
});

test("prep forecaster never comes back high", () => {
  const s = spec("prep-forecaster.yaml");
  const r = T.score(s.answers, s.profile);
  assert.equal(r.vkey, "ship");
  assert.ok(r.sev < 2, "severity must stay below Serious");
  assert.equal(r.rules.length, 0);
});

test("the framework discriminates: same company, opposite answers", () => {
  const a = spec("allergen-chatbot.yaml"), f = spec("prep-forecaster.yaml");
  assert.notEqual(T.score(a.answers, a.profile).vkey, T.score(f.answers, f.profile).vkey);
});

test("logging alone cannot clear undetectable severe harm", () => {
  const s = spec("allergen-chatbot.yaml");
  const r = T.score({ ...s.answers, provenance: "full_reconstruction" }, s.profile);
  assert.equal(r.vkey, "no");
});

test("path to yes for the allergen bot is a detection mechanism, and Ship is out of reach", () => {
  const s = spec("allergen-chatbot.yaml");
  const p = T.pathToYes(s.answers, s.profile);
  assert.equal(p.steps.length, 1);
  assert.equal(p.steps[0].to, "conditions");
  assert.deepEqual(p.steps[0].changes.map(c => c.dim), ["detectability"]);
  assert.match(p.ceiling, /ceiling/);
});

test("path to yes never touches facts about the world", () => {
  for (const f of fs.readdirSync(new URL("../examples/", import.meta.url)).filter(x => x.endsWith(".yaml"))) {
    const s = spec(f);
    for (const st of T.pathToYes(s.answers, s.profile).steps)
      for (const c of st.changes) assert.ok(!["failure_mode", "audience", "reversibility"].includes(c.dim), f + " changed " + c.dim);
  }
});

test("every path-to-yes step actually reaches the verdict it claims", () => {
  for (const f of fs.readdirSync(new URL("../examples/", import.meta.url)).filter(x => x.endsWith(".yaml"))) {
    const s = spec(f);
    let cur = { ...s.answers };
    for (const st of T.pathToYes(s.answers, s.profile).steps) {
      st.changes.forEach(c => { cur[c.dim] = c.to; });
      assert.equal(T.score(cur, s.profile).vkey, st.to, f);
    }
  }
});

test("validation names the bad value and the valid ones", () => {
  const p = T.validate({ detectability: "vibes" }, "restaurant");
  assert.match(p[0], /vibes.*automated_immediate/);
});

test("yaml subset parser", () => {
  const y = parseYaml("name: x\nlist: [a, b]\nmap:\n  k: \"no\"\n  n: 3\nitems:\n  - one\n  - two\ntext: >\n  folded\n  line\n");
  assert.deepEqual(y, { name: "x", list: ["a", "b"], map: { k: "no", n: 3 }, items: ["one", "two"], text: "folded line" });
});

test("lock file goes stale when the prompt, model, or date changes", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "triage-"));
  fs.writeFileSync(path.join(dir, "p.txt"), "be careful");
  const f = path.join(dir, "bot.yaml");
  fs.writeFileSync(f, "name: Bot\nprofile: restaurant\nsystem:\n  model: m-1\n  prompt: p.txt\nanswers:\n  failure_mode: reputational\n");
  const out = path.join(dir, "out");
  assess(f, { out, date: "2026-01-01" });
  assert.deepEqual(check(f, { out, today: "2026-06-01" }).reasons, []);
  assert.match(check(f, { out, today: "2027-01-01" }).reasons.join(), /expired/);
  fs.writeFileSync(path.join(dir, "p.txt"), "be very careful");
  assert.match(check(f, { out, today: "2026-06-01" }).reasons.join(), /prompt changed/);
  fs.writeFileSync(f, fs.readFileSync(f, "utf8").replace("m-1", "m-2"));
  assert.match(check(f, { out, today: "2026-06-01" }).reasons.join(), /model changed: m-1 -> m-2/);
});

test("renderers produce well-formed SVG", () => {
  const s = spec("allergen-chatbot.yaml");
  const r = T.score(s.answers, s.profile), p = T.pathToYes(s.answers, s.profile);
  for (const svg of [T.riskMapSVG(r, p), T.badgeSVG(r, "2027-11-18")]) {
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.equal((svg.match(/<text/g) || []).length, (svg.match(/<\/text>/g) || []).length);
  }
});
