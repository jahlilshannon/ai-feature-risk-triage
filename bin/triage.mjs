#!/usr/bin/env node
/* triage: run AI Feature Risk Triage from the command line or CI.

   triage assess <spec.yaml...>   score, write the report, risk map, badge and lock file
   triage check  <spec.yaml...>   fail if any assessment is missing, expired, or stale
   triage options                 list every dimension and its valid answers

   The lock file is the point. It records fingerprints of the things the
   framework names as reassessment triggers (model, prompt, data sources,
   vendor, the answers themselves, and the scoring rules). `check` recomputes
   them, so an assessment goes stale in CI the moment the system it
   describes changes, instead of quietly describing a system that no
   longer exists. No dependencies beyond Node 18+. */

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const T = require(path.join(ROOT, "docs", "triage.js"));

/* ---------- a small YAML subset: maps, lists, inline lists, scalars ---------- */
export function parseYaml(text) {
  const lines = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const noComment = raw.replace(/(^|\s)#.*$/, "");
    if (!noComment.trim()) return;
    if (/\t/.test(raw.match(/^\s*/)[0])) throw new Error("line " + (i + 1) + ": use spaces, not tabs");
    lines.push({ indent: raw.match(/^ */)[0].length, text: noComment.trim(), n: i + 1 });
  });
  const scalar = s => {
    s = s.trim();
    if (/^".*"$/.test(s) || /^'.*'$/.test(s)) return s.slice(1, -1);
    if (/^\[.*\]$/.test(s)) return s.slice(1, -1).split(",").map(x => x.trim()).filter(Boolean).map(scalar);
    if (s === "true") return true;
    if (s === "false") return false;
    if (s === "null" || s === "~") return null;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return s;
  };
  let i = 0;
  function block(indent) {
    if (i >= lines.length) return null;
    if (lines[i].text.startsWith("- ") || lines[i].text === "-") {
      const arr = [];
      while (i < lines.length && lines[i].indent === indent && lines[i].text.startsWith("-")) {
        arr.push(scalar(lines[i].text.replace(/^-\s*/, "")));
        i++;
      }
      return arr;
    }
    const obj = {};
    while (i < lines.length && lines[i].indent === indent) {
      const ln = lines[i];
      const m = ln.text.match(/^([A-Za-z0-9_.\-]+):(?:\s+(.*))?$/);
      if (!m) throw new Error("line " + ln.n + ": expected \"key: value\", got \"" + ln.text + "\"");
      i++;
      if (m[2] !== undefined && m[2] !== "" && m[2] !== ">" && m[2] !== "|") { obj[m[1]] = scalar(m[2]); continue; }
      if (m[2] === ">" || m[2] === "|") {
        const parts = [];
        while (i < lines.length && lines[i].indent > ln.indent) { parts.push(lines[i].text); i++; }
        obj[m[1]] = parts.join(m[2] === ">" ? " " : "\n");
        continue;
      }
      if (i < lines.length && lines[i].indent > ln.indent) obj[m[1]] = block(lines[i].indent);
      else if (i < lines.length && lines[i].indent === ln.indent && lines[i].text.startsWith("-")) obj[m[1]] = block(ln.indent);
      else obj[m[1]] = null;
    }
    if (i < lines.length && lines[i].indent > indent) throw new Error("line " + lines[i].n + ": unexpected indentation");
    return obj;
  }
  const out = block(lines.length ? lines[0].indent : 0) || {};
  if (i < lines.length) throw new Error("line " + lines[i].n + ": could not parse");
  return out;
}

/* ---------- fingerprints ---------- */
const sha = s => createHash("sha256").update(s).digest("hex").slice(0, 16);
const RULES_FP = sha(T.score.toString() + JSON.stringify({ P: T.PROFILES, W: T.W, M: T.MAXW, D: T.DIMS.map(d => [d.id, d.opts]) }));
const list = v => v == null ? [] : Array.isArray(v) ? v : [v];

export function loadSpec(file) {
  const spec = parseYaml(fs.readFileSync(file, "utf8"));
  spec.answers = spec.answers || {};
  if (!spec.name) throw new Error(file + ": missing \"name\"");
  if (!spec.profile) throw new Error(file + ": missing \"profile\" (one of " + Object.keys(T.PROFILES).join(", ") + ")");
  const problems = T.validate(spec.answers, spec.profile);
  if (problems.length) throw new Error(file + ":\n  " + problems.join("\n  "));
  return spec;
}

export function fingerprints(spec, specFile) {
  const sys = spec.system || {}, dir = path.dirname(specFile), fp = {};
  fp["answers"] = sha(JSON.stringify(Object.keys(spec.answers).sort().map(k => [k, spec.answers[k]])) + spec.profile);
  fp["scoring rules"] = RULES_FP;
  if (sys.model) fp["model"] = String(sys.model);       // plain values, so check can say what changed
  if (sys.vendor) fp["vendor"] = String(sys.vendor);
  list(sys.prompt).forEach(p => {
    const f = path.resolve(dir, p);
    fp["prompt: " + p] = fs.existsSync(f) ? sha(fs.readFileSync(f)) : "missing";
  });
  list(sys.data_sources).forEach(d => {
    const f = path.resolve(dir, String(d));
    fp["data source: " + d] = fs.existsSync(f) && fs.statSync(f).isFile() ? sha(fs.readFileSync(f)) : sha(String(d));
  });
  return fp;
}

/* ---------- commands ---------- */
const tty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => tty ? "\x1b[" + code + "m" + s + "\x1b[0m" : s;
const VCOL = { ship: 32, conditions: 33, no: 31 };
const base = f => path.basename(f).replace(/\.(ya?ml)$/i, "");
const today = () => new Date().toISOString().slice(0, 10);

export function assess(specFile, opts) {
  const spec = loadSpec(specFile);
  const date = opts.date || today();
  const expires = T.addMonths(date, 12);
  const r = T.score(spec.answers, spec.profile);
  const p = T.pathToYes(spec.answers, spec.profile);
  const fp = fingerprints(spec, specFile);
  const name = base(specFile);
  fs.mkdirSync(opts.out, { recursive: true });
  const tripwires = Object.keys(fp).filter(k => k !== "answers" && k !== "scoring rules")
    .map(k => k === "model" || k === "vendor" ? k + ": " + fp[k] : k);
  fs.writeFileSync(path.join(opts.out, name + ".md"),
    T.toMarkdown(spec, r, p, { date, expires, assessor: spec.assessor, tripwires: tripwires.concat(["the answers in " + path.basename(specFile), "the scoring rules"]) }) + "\n");
  fs.writeFileSync(path.join(opts.out, name + ".map.svg"), T.riskMapSVG(r, p) + "\n");
  fs.writeFileSync(path.join(opts.out, name + ".badge.svg"), T.badgeSVG(r, expires) + "\n");
  const lock = {
    spec: path.relative(opts.lockBase || process.cwd(), specFile).split(path.sep).join("/"),
    name: spec.name, assessed: date, expires, assessor: spec.assessor || null,
    questionnaire: "2.0", verdict: r.verdict,
    bands: r.sev == null ? null : { severity: T.SEVERITY[r.sev], likelihood: T.LIKELIHOOD[r.lk], detectability: T.DETECT[r.dt] },
    rules_fired: r.rules.map(x => x[0]),
    fingerprints: fp
  };
  fs.writeFileSync(path.join(opts.out, name + ".lock.json"), JSON.stringify(lock, null, 2) + "\n");
  return { spec, r, p, lock, name };
}

export function check(specFile, opts) {
  const name = base(specFile), lockFile = path.join(opts.out, name + ".lock.json");
  const reasons = [];
  let spec;
  try { spec = loadSpec(specFile); } catch (e) { return { name, reasons: [e.message] }; }
  if (!fs.existsSync(lockFile)) return { name, reasons: ["never assessed (no " + lockFile + ")"] };
  const lock = JSON.parse(fs.readFileSync(lockFile, "utf8"));
  const now = opts.today || today();
  if (now >= lock.expires) reasons.push("expired on " + lock.expires + " (assessments last 12 months)");
  const fp = fingerprints(spec, specFile), old = lock.fingerprints || {};
  Object.keys(old).forEach(k => {
    if (!(k in fp)) reasons.push(k + " removed");
    else if (fp[k] !== old[k]) reasons.push(k === "model" || k === "vendor"
      ? k + " changed: " + old[k] + " -> " + fp[k]
      : k.includes(":") ? k.replace(": ", " changed: ") : k + " changed");
  });
  Object.keys(fp).forEach(k => { if (!(k in old)) reasons.push("new " + k); });
  return { name, reasons, lock };
}

function printAssessment({ spec, r, p, name }, out) {
  const v = c(VCOL[r.vkey] + ";1", r.verdict);
  console.log("\n" + c(1, spec.name) + "  " + c(2, "(" + T.PROFILES[spec.profile].label + ")"));
  console.log("  " + v + (r.sev != null ? c(2, "   severity " + T.SEVERITY[r.sev] + " / likelihood " + T.LIKELIHOOD[r.lk] + " / detectability " + T.DETECT[r.dt]) : ""));
  r.rules.forEach(([t]) => console.log("  " + c(31, "! ") + t));
  if (p.steps.length) {
    console.log("  " + c(1, "Path to yes"));
    p.steps.forEach((st, i) => {
      console.log("    " + (i + 1) + ". reaches " + c(VCOL[st.to], st.verdict) + " by changing:");
      st.changes.forEach(ch => console.log("       " + String(ch.n).padStart(2, "0") + " " + ch.fromLabel + c(2, " -> ") + ch.toLabel));
    });
  }
  if (p.ceiling) console.log("    " + c(2, p.ceiling));
  if (r.blocking.length) console.log("  " + c(33, r.blocking.length + " blocking open question" + (r.blocking.length > 1 ? "s" : "")));
  console.log("  " + c(2, "-> " + path.join(out, name) + ".{md,map.svg,badge.svg,lock.json}"));
}

function usage(code) {
  console.log(`Usage:
  triage assess <spec.yaml...> [--out assessments] [--date YYYY-MM-DD]
  triage check  <spec.yaml...> [--out assessments] [--today YYYY-MM-DD]
  triage options

A spec is a small YAML file: name, profile, optional system (model, vendor,
prompt files, data sources) and answers to the questionnaire. Run
"triage options" for every valid answer. See examples/ for complete specs.`);
  process.exit(code);
}

function main(argv) {
  const [cmd, ...rest] = argv;
  const opts = { out: "assessments" }, files = [];
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === "--out") opts.out = rest[++i];
    else if (rest[i] === "--date") opts.date = rest[++i];
    else if (rest[i] === "--today") opts.today = rest[++i];
    else if (rest[i] === "-h" || rest[i] === "--help") usage(0);
    else files.push(rest[i]);
  }
  if (cmd === "options") {
    T.DIMS.forEach(d => {
      console.log(c(1, String(d.n).padStart(2, "0") + " " + d.id) + (d.multi ? c(2, " (list)") : "") + (d.conditional ? c(2, " (only when data leaves the boundary)") : ""));
      if (d.archetype) Object.entries(T.PROFILES).forEach(([pk, pv]) => console.log("     " + c(2, pk + ": ") + Object.keys(pv.archetypes).join(", ")));
      else console.log("     " + d.opts.map(o => o[0]).join(", "));
    });
    return 0;
  }
  if (!["assess", "check"].includes(cmd) || !files.length) usage(cmd ? 2 : 0);
  if (cmd === "assess") {
    let failed = 0;
    files.forEach(f => {
      try { printAssessment(assess(f, opts), opts.out); }
      catch (e) { failed++; console.error(c(31, "error: ") + e.message); }
    });
    console.log("");
    return failed ? 1 : 0;
  }
  let stale = 0;
  const gha = !!process.env.GITHUB_ACTIONS;
  files.forEach(f => {
    const res = check(f, opts);
    if (!res.reasons.length) {
      console.log(c(32, "ok    ") + res.name + c(2, "  " + res.lock.verdict + ", expires " + res.lock.expires));
      return;
    }
    stale++;
    console.log(c(31, "STALE ") + res.name);
    res.reasons.forEach(x => {
      console.log("      " + x);
      if (gha) console.log("::error file=" + f + ",title=Risk assessment is stale::" + x + ". Re-run: npx triage assess " + f);
    });
  });
  if (stale) console.log("\n" + stale + " assessment" + (stale > 1 ? "s are" : " is") + " stale. Reassess, review the diff in the report, and commit the new lock file.");
  return stale ? 1 : 0;
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main(process.argv.slice(2)));
}
