/* AI Feature Risk Triage: the engine.
   One file, loaded by the website (as window.Triage) and by the CLI
   (bin/triage.mjs, via require). The rules live here once, so the page
   and the command line cannot disagree. Mirrors core/questionnaire.yaml
   and core/scoring.md. No dependencies. MIT licensed. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.Triage = factory();
})(typeof self !== "undefined" ? self : this, function () {
"use strict";

const PROFILES = {
  restaurant: {
    label: "Restaurant platform",
    archetypes: {
      physical_harm:  { label:"Physical harm (allergen, foodborne)", severity:3 },
      legal_exposure: { label:"Legal exposure (wage, payment, disclosure)", severity:2 },
      financial_loss: { label:"Financial loss (forecasting, ordering, pricing)", severity:1 },
      reputational:   { label:"Reputational (public-facing output is wrong)", severity:1 }
    },
    sensitive: "Payment data, wage and scheduling data, health inspection records, supplier terms, customer contact data, allergen and ingredient data.",
    audienceNote: "The paying customer is the operator. The diner is the end consumer. Conflating them is the most common error in this domain."
  },
  k12: {
    label: "K-12 education software",
    archetypes: {
      academic_consequence:    { label:"Academic consequence (placement, intervention, grading)", severity:2 },
      student_data_disclosure: { label:"Student data disclosure", severity:2 },
      disparate_impact:        { label:"Disparate impact across student groups", severity:3 },
      operational_disruption:  { label:"Operational disruption (scheduling, rostering)", severity:1 }
    },
    sensitive: "Student records, assessment data, IEP and intervention records, family contact data, staff employment data.",
    audienceNote: "The paying customer is the district. The teacher is the operator. The student is the affected party and never chose to be there."
  }
};

const SEVERITY    = ["Negligible","Moderate","Serious","Severe"];
const LIKELIHOOD  = ["Rare","Occasional","Frequent"];
const DETECT      = ["High","Moderate","Low"];

const GROUPS = [
  { id:"shape",       title:"Shape",       feeds:"what the system actually is" },
  { id:"consequence", title:"Consequence", feeds:"feeds severity" },
  { id:"likelihood",  title:"Likelihood",  feeds:"feeds likelihood" },
  { id:"visibility",  title:"Visibility",  feeds:"feeds detectability" },
  { id:"controls",    title:"Controls and governance", feeds:"" }
];

const DIMS = [
  { n:1,  id:"data_exposure", group:"shape", q:"Does any of the data the model sees leave your trust boundary?",
    help:"List what is actually in the prompt and the context window. “No PII” is not an answer.",
    establishes:"What the model sees, where it came from, whether it leaves the trust boundary",
    opts:[["no","No, everything stays inside"],["yes_metadata_only","Yes, metadata only"],["yes_content","Yes, content leaves"]] },
  { n:2,  id:"model_behavior", group:"shape", q:"Is the output constrained, or can the model produce something nobody anticipated?",
    establishes:"Constrained or generative; can it produce output nobody anticipated",
    opts:[["constrained_lookup","Constrained lookup"],["constrained_generation","Constrained generation"],["open_generation","Open generation"],["agentic_multistep","Agentic, multi-step"]] },
  { n:3,  id:"autonomy", group:"shape", q:"Does it produce output for a person, or take action in a system?",
    establishes:"Produces output, or takes action",
    opts:[["produces_output","Produces output only"],["recommends_action","Recommends an action"],["takes_action_reversible","Takes action, reversible"],["takes_action_irreversible","Takes action, irreversible"]] },
  { n:4,  id:"audience", group:"shape", q:"Who is affected by the output?", multi:true,
    help:"Not the same question as who sees it. Select everyone the output lands on.",
    establishes:"Internal staff, business customer, end consumer, or a third party who never interacts with it",
    opts:[["internal_staff","Internal staff"],["business_customer","Business customer"],["end_consumer","End consumer"],["third_party_no_interaction","Third party who never interacts with it"]] },
  { n:5,  id:"exposure_volume", group:"shape", q:"What stage is the rollout, and at what volume?",
    help:"Volume is a likelihood multiplier, not a severity one. One miscoded invoice is nothing. Ten thousand is a restatement.",
    establishes:"Decisions per day, people affected per day, pilot or general availability",
    opts:[["prototype","Prototype"],["limited_pilot","Limited pilot"],["staged_rollout","Staged rollout"],["general_availability","General availability"]] },

  { n:6,  id:"failure_mode", group:"consequence", q:"What is the worst realistic outcome when this is wrong?",
    help:"Not the worst conceivable one. Pick the harm archetype the profile defines.",
    establishes:"The worst realistic outcome when it is wrong", archetype:true, opts:[] },
  { n:7,  id:"reversibility", group:"consequence", q:"Once the wrong output has had its effect, can the effect be undone?",
    establishes:"Whether the effect can be undone",
    opts:[["trivially_reversible","Trivially reversible"],["reversible_with_effort","Reversible with effort"],["partially_reversible","Partially reversible"],["irreversible","Irreversible"]] },
  { n:8,  id:"contestability", group:"consequence", q:"Can the affected person find out, object, and reach a human who can change it?",
    help:"Distinct from reversibility. A system can be perfectly reversible and completely uncontestable.",
    establishes:"Whether the affected person can find out, object, and reach a human",
    opts:[["yes","Yes, there is a stated appeal path"],["partial","Partially, no formal path"],["no","No, they never find out"]] },

  { n:9,  id:"input_trust", group:"likelihood", q:"Who can put text into this, and does any of them have an incentive to manipulate it?",
    conditional:"Shown because data leaves the trust boundary",
    establishes:"Whether any input channel is open to a party with an incentive to manipulate it",
    opts:[["all_inputs_trusted","All inputs come from trusted parties"],["untrusted_input_constrained","Untrusted input, constrained format"],["untrusted_input_freeform","Untrusted free-form input"]] },
  { n:10, id:"upstream_data", group:"likelihood", q:"How fresh is the data this system reasons over, and who owns its accuracy?",
    help:"A model can be perfectly accurate against data that is wrong. Ask how a change in the real world reaches the record the system reads.",
    establishes:"Freshness, ownership, and accuracy of the data the system reasons over",
    opts:[["realtime","Real time, owned"],["daily","Daily, owned"],["weekly_or_worse","Weekly or worse"],["no_defined_sla","No defined freshness SLA"]] },
  { n:11, id:"evaluation_coverage", group:"likelihood", q:"What has it been tested against, and what error rate was observed?",
    help:"“Unknown” is the honest and common answer before anything is built. Record it rather than skipping it.",
    establishes:"What it has been tested against, the observed error rate, what has not been tested",
    opts:[["ongoing_eval","Tested, with ongoing evaluation"],["tested_once","Tested once at build"],["minimal","Minimal or ad hoc testing"],["none","Not tested"]] },

  { n:12, id:"detectability", group:"visibility", q:"If it produced a wrong output right now, how would you find out?",
    establishes:"Whether you would know it was wrong, and how fast",
    opts:[["automated_immediate","Automated, immediately"],["automated_delayed","Automated, on a delay"],["human_review_catches","A human reviewer catches it"],["user_complaint_only","Only if a user complains"],["incident_only","Only from an incident"],["no_mechanism","No mechanism at all"]] },
  { n:13, id:"provenance", group:"visibility", q:"Six months from now, can you reconstruct why it produced a specific output?",
    establishes:"Whether you can reconstruct why it produced what it did",
    opts:[["full_reconstruction","Full reconstruction"],["partial","Partial"],["output_only","Output logged only"],["nothing_retained","Nothing retained"]] },

  { n:14, id:"human_in_loop", group:"controls", q:"Does a human review output before it has effect?",
    help:"A reviewer with no accountability and no time produces rubber-stamping, which scores as review and functions as none.",
    establishes:"Reviewed always, sampled, or never",
    opts:[["every_output_accountable","Every output, reviewer is accountable"],["every_output_unaccountable","Every output, but nobody is accountable"],["sampled_review","Sampled review"],["exception_review_only","Exceptions only"],["no_review","No review"]] },
  { n:15, id:"disclosure", group:"controls", q:"Does the person receiving the output know an AI system produced it?",
    establishes:"Whether the person knows AI is involved",
    opts:[["explicit_disclosure","Explicitly disclosed"],["discoverable","Discoverable if they look"],["not_disclosed","Not disclosed"]] },
  { n:16, id:"vendor_terms", group:"controls", q:"Who processes this data, under what terms?",
    conditional:"Shown because data leaves the trust boundary",
    establishes:"Provider, training-on-input, retention, processing region, subprocessors",
    opts:[["reviewed_no_training","Reviewed contract, no training on inputs"],["reviewed_retention_unclear","Reviewed, but retention is unclear"],["standard_terms_unreviewed","Standard terms, nobody reviewed them"],["unknown","Unknown"]] },
  { n:17, id:"accountable_owner", group:"controls", q:"After this assessment is filed, who owns the risk?",
    help:"A named person, not a team. An assessment with no owner is a document, not a control.",
    establishes:"Who owns the risk, who reviews it, who can override a “do not ship”",
    opts:[["named_owner_cadence","Named owner with a review cadence"],["named_owner_no_cadence","Named owner, no review cadence"],["team_only","A team, nobody specific"],["nobody","Nobody yet"]] }
];

const PRESETS = {
  allergen: { _profile:"restaurant",
    data_exposure:"yes_content", model_behavior:"open_generation", autonomy:"produces_output",
    audience:["business_customer","end_consumer"], exposure_volume:"general_availability",
    failure_mode:"physical_harm", reversibility:"irreversible", contestability:"no",
    input_trust:"untrusted_input_freeform", upstream_data:"no_defined_sla", evaluation_coverage:"none",
    detectability:"incident_only", provenance:"output_only",
    human_in_loop:"no_review", disclosure:"not_disclosed", vendor_terms:"standard_terms_unreviewed",
    accountable_owner:"nobody" },
  forecaster: { _profile:"restaurant",
    data_exposure:"no", model_behavior:"constrained_generation", autonomy:"recommends_action",
    audience:["internal_staff","business_customer"], exposure_volume:"staged_rollout",
    failure_mode:"financial_loss", reversibility:"trivially_reversible", contestability:"yes",
    upstream_data:"daily", evaluation_coverage:"tested_once",
    detectability:"automated_delayed", provenance:"full_reconstruction",
    human_in_loop:"every_output_accountable", disclosure:"explicit_disclosure",
    accountable_owner:"named_owner_cadence" }
};


/* ---------------- scoring ---------------- */
const W = {
  model_behavior:      { constrained_lookup:0, constrained_generation:1, open_generation:2, agentic_multistep:3 },
  exposure_volume:     { prototype:0, limited_pilot:1, staged_rollout:2, general_availability:3 },
  input_trust:         { all_inputs_trusted:0, untrusted_input_constrained:1, untrusted_input_freeform:2 },
  upstream_data:       { realtime:0, daily:1, weekly_or_worse:2, no_defined_sla:3 },
  evaluation_coverage: { ongoing_eval:0, tested_once:1, minimal:2, none:3 },
  detectability:       { automated_immediate:0, automated_delayed:1, human_review_catches:1, user_complaint_only:3, incident_only:4, no_mechanism:4 },
  provenance:          { full_reconstruction:0, partial:1, output_only:2, nothing_retained:3 },
  reversibility:       { trivially_reversible:0, reversible_with_effort:1, partially_reversible:2, irreversible:3 }
};
const MAXW = { model_behavior:3, exposure_volume:3, input_trust:2, upstream_data:3, evaluation_coverage:3, detectability:4, provenance:3 };

function score(a, profileKey) {
  const P = PROFILES[profileKey];
  const unknowns = visibleDims(a).filter(d => {
    const v = a[d.id];
    return d.multi ? !(v && v.length) : !v;
  });

  // severity from the profile anchor
  let sev = null;
  if (a.failure_mode && P.archetypes[a.failure_mode]) sev = P.archetypes[a.failure_mode].severity;

  // likelihood
  const lkKeys = ["model_behavior","exposure_volume","input_trust","upstream_data","evaluation_coverage"];
  let lkPts = 0, lkMax = 0;
  lkKeys.forEach(k => {
    if (k === "input_trust" && !conditionalsActive(a)) return;
    lkMax += MAXW[k];
    if (a[k] != null && W[k][a[k]] != null) lkPts += W[k][a[k]];
  });
  const lkPct = lkMax ? lkPts / lkMax : 0;
  let lk = lkPct >= 0.60 ? 2 : lkPct >= 0.33 ? 1 : 0;

  // detectability (inverted: higher points = worse = "Low")
  let dtPts = 0, dtMax = MAXW.detectability + MAXW.provenance;
  ["detectability","provenance"].forEach(k => { if (a[k] != null && W[k][a[k]] != null) dtPts += W[k][a[k]]; });
  const dtPct = dtPts / dtMax;
  let dt = dtPct >= 0.60 ? 2 : dtPct >= 0.30 ? 1 : 0;

  // rule 4: unaccountable review is not a mitigating control
  const rules = [], conditions = [];
  if (a.human_in_loop === "every_output_unaccountable") {
    rules.push(["Unaccountable review","Every output is reviewed but nobody is accountable for what they approve. The review does not count as a mitigating control until that is resolved."]);
    if (dt < 2) dt = Math.min(2, dt + 1);
  }

  // rule 3: volume amplification
  if (sev != null && sev >= 1 && a.exposure_volume === "general_availability" && dt === 2 && lk < 2) {
    lk = Math.min(2, lk + 1);
    rules.push(["Volume amplification","Moderate-or-worse severity at general availability with low detectability. Likelihood is treated as one band higher than derived."]);
  }

  // rule 2: no recourse on an affected third party
  const aud = a.audience || [];
  let escalated = false;
  if ((aud.includes("third_party_no_interaction") || aud.includes("end_consumer")) && (a.contestability === "no" || !a.contestability)) {
    rules.push(["No recourse on an affected party","The output lands on someone who cannot find out it happened or object to it. Escalated one band, with a blocking open question."]);
    escalated = true;
  }

  // rule 1: undetectable severe harm
  const revBad = a.reversibility === "partially_reversible" || a.reversibility === "irreversible";
  let verdict, vkey;
  // Provenance helps you reconstruct a failure afterwards; it does not
  // notice one in time. So logging alone cannot clear rule 1: it also
  // fires when dimension 12 says the only detection is a complaint, an
  // incident, or nothing, whatever the blended detectability band says.
  const lateOnly = ["user_complaint_only","incident_only","no_mechanism"].includes(a.detectability);
  const rule1 = (sev === 3 && revBad && (dt === 2 || lateOnly));
  if (rule1) rules.unshift(["Undetectable severe harm","Severity is Severe, the effect cannot be fully undone, and nothing would notice a wrong output before it has its effect. This escalates regardless of how the other dimensions answer."]);

  if (sev == null) { verdict = "Cannot assess"; vkey = "conditions"; }
  else if (rule1) { verdict = "Do not ship as designed"; vkey = "no"; }
  else if (sev >= 2 || escalated || lk === 2 || dt === 2 || a.human_in_loop === "no_review") { verdict = "Ship with conditions"; vkey = "conditions"; }
  else { verdict = "Ship"; vkey = "ship"; }

  // conditions derived from the weak dimensions
  if (a.upstream_data === "no_defined_sla" || a.upstream_data === "weekly_or_worse")
    conditions.push("Define a freshness SLA and a named owner for the upstream data, and document how a real-world change reaches the record the system reads.");
  if (a.input_trust === "untrusted_input_freeform" && (a.model_behavior === "open_generation" || a.model_behavior === "agentic_multistep"))
    conditions.push("Bound the answer contract so an untrusted free-form input cannot elicit an unbounded generative response. Constrain what the system is permitted to affirm.");
  if (dt === 2)
    conditions.push("Add a detection mechanism before general availability. Right now a wrong output is found by incident or complaint, which is too late to be a control.");
  if (a.provenance === "nothing_retained" || a.provenance === "output_only")
    conditions.push("Log inputs, model and prompt version, and outputs with a stated retention period, so a specific output can be reconstructed later.");
  if (a.contestability === "no" || a.contestability === "partial")
    conditions.push("Give the affected person a stated route to find out an AI system was involved and reach a human who can change the outcome.");
  if (a.human_in_loop === "no_review" && sev != null && sev >= 2)
    conditions.push("Introduce review proportionate to the severity band, with a reviewer who is accountable for what they approve.");
  if (a.human_in_loop === "every_output_unaccountable")
    conditions.push("Name who is accountable for approved output, and give the reviewer enough time that review is not rubber-stamping.");
  if (a.evaluation_coverage === "none" || a.evaluation_coverage === "minimal")
    conditions.push("Establish an evaluation set and an observed error rate before rollout widens. Untested is not the same as working.");
  if (a.vendor_terms === "standard_terms_unreviewed" || a.vendor_terms === "unknown")
    conditions.push("Have someone read the processing terms: training on inputs, retention period, processing region, and subprocessors.");
  if (a.disclosure === "not_disclosed" && (aud.includes("end_consumer") || aud.includes("third_party_no_interaction")))
    conditions.push("Disclose that an AI system is involved to the person receiving the output.");
  if (a.accountable_owner === "nobody" || a.accountable_owner === "team_only")
    conditions.push("Name a person who owns this risk, a review cadence, and who can override a do-not-ship.");

  // open questions
  const blocking = [], nonBlocking = [];
  unknowns.forEach(d => {
    const decisive = ["failure_mode","reversibility","contestability","upstream_data","detectability"].includes(d.id);
    const line = "Dimension " + d.n + ": " + d.q;
    (decisive ? blocking : nonBlocking).push(line);
  });
  if (escalated && !blocking.some(b => b.includes("Dimension 8")))
    blocking.push("Who is accountable for the affected party's recourse, and what is the stated appeal path?");

  return { sev, lk, dt, verdict, vkey, rules, conditions, blocking, nonBlocking, unknowns };
}

/* ---------------- helpers ---------------- */
function conditionalsActive(a) {
  return !!a.data_exposure && a.data_exposure !== "no";
}
function visibleDims(a) {
  return DIMS.filter(d => !d.conditional || conditionalsActive(a));
}
function archetypeOpts(profileKey) {
  const p = PROFILES[profileKey];
  return Object.entries(p.archetypes).map(([k, v]) => [k, v.label]);
}
function optionLabel(dimId, value, profileKey) {
  const d = DIMS.find(x => x.id === dimId);
  if (!d) return String(value);
  const opts = d.archetype ? archetypeOpts(profileKey) : d.opts;
  const hit = opts.find(o => o[0] === value);
  return hit ? hit[1] : String(value);
}

/* Check a set of answers against the questionnaire. Returns a list of
   human-readable problems; an empty list means the answers are valid. */
function validate(a, profileKey) {
  const problems = [];
  if (!PROFILES[profileKey]) {
    problems.push("Unknown profile \"" + profileKey + "\". Valid: " + Object.keys(PROFILES).join(", "));
    return problems;
  }
  Object.keys(a).forEach(k => {
    const d = DIMS.find(x => x.id === k);
    if (!d) { problems.push("Unknown dimension \"" + k + "\". Valid: " + DIMS.map(x => x.id).join(", ")); return; }
    const valid = (d.archetype ? archetypeOpts(profileKey) : d.opts).map(o => o[0]);
    const vals = d.multi ? (Array.isArray(a[k]) ? a[k] : [a[k]]) : [a[k]];
    if (!d.multi && Array.isArray(a[k])) { problems.push(k + " takes one value, got a list"); return; }
    vals.forEach(v => {
      if (!valid.includes(v)) problems.push(k + ": \"" + v + "\" is not an option. Valid: " + valid.join(", "));
    });
  });
  return problems;
}

/* ---------------- path to yes ----------------
   The framework says "do not ship" always comes with the change that
   turns it into a yes. This searches for it instead of leaving it to
   prose: the smallest set of design changes that moves the verdict up
   one tier, preferring the least ambitious change at each size.

   Only design levers are searched. Facts about the world are not:
   the harm archetype comes from the profile, and audience and
   reversibility describe what happens, not what you chose. */
const VERDICT_RANK = { no: 0, conditions: 1, ship: 2 };
const LEVER_COST = {
  model_behavior:      W.model_behavior,
  exposure_volume:     W.exposure_volume,
  input_trust:         W.input_trust,
  upstream_data:       W.upstream_data,
  evaluation_coverage: W.evaluation_coverage,
  detectability:       W.detectability,
  provenance:          W.provenance,
  contestability:      { yes: 0, partial: 1, no: 2 },
  human_in_loop:       { every_output_accountable: 0, sampled_review: 1, exception_review_only: 2, every_output_unaccountable: 2, no_review: 3 }
};
const LEVER_HINT = {
  model_behavior:      "Narrow what the model is allowed to say. A bounded answer contract is a design change, not a prompt tweak.",
  exposure_volume:     "Hold the rollout at a smaller stage until the other conditions are met.",
  input_trust:         "Constrain the input channel so outsiders cannot send free-form text.",
  upstream_data:       "Give the data a freshness SLA and a named owner.",
  evaluation_coverage: "Build an evaluation set and measure an error rate.",
  detectability:       "Add a way to notice a wrong output before an incident tells you.",
  provenance:          "Log inputs, model and prompt version, and outputs.",
  contestability:      "Give the affected person a route to find out and reach a human.",
  human_in_loop:       "Put an accountable reviewer in front of the output."
};

function combinations(items, k, start, prefix, out) {
  if (prefix.length === k) { out.push(prefix.slice()); return; }
  for (let i = start; i < items.length; i++) {
    prefix.push(items[i]);
    combinations(items, k, i + 1, prefix, out);
    prefix.pop();
  }
}

function pathToYes(a, profileKey, maxChanges) {
  maxChanges = maxChanges || 3;
  const base = score(a, profileKey);
  const out = { from: base.vkey, steps: [] };
  if (base.sev == null) return out;
  const levers = Object.keys(LEVER_COST).filter(k => {
    if (!(k in a)) return false;                       // unknowns are questions, not levers
    if (k === "input_trust" && !conditionalsActive(a)) return false;
    const cur = LEVER_COST[k][a[k]];
    return cur != null && Object.values(LEVER_COST[k]).some(w => w < cur);
  });
  let current = a, currentRank = VERDICT_RANK[base.vkey];
  while (currentRank < 2) {
    let best = null;
    for (let size = 1; size <= maxChanges && !best; size++) {
      const combos = [];
      combinations(levers, size, 0, [], combos);
      combos.forEach(dims => {
        // every strictly better option for each chosen dimension
        const choices = dims.map(k => Object.entries(LEVER_COST[k])
          .filter(([, w]) => w < LEVER_COST[k][current[k]]).map(([v]) => v));
        const walk = (i, acc) => {
          if (i === dims.length) {
            const trial = Object.assign({}, current, acc);
            const r = score(trial, profileKey);
            if (VERDICT_RANK[r.vkey] > currentRank) {
              const effort = dims.reduce((s, k) => s + (LEVER_COST[k][current[k]] - LEVER_COST[k][acc[k]]), 0);
              if (!best || effort < best.effort) best = { dims, acc: Object.assign({}, acc), r, effort };
            }
            return;
          }
          choices[i].forEach(v => { acc[dims[i]] = v; walk(i + 1, acc); });
          delete acc[dims[i]];
        };
        walk(0, {});
      });
    }
    if (!best) {
      const sevNow = score(current, profileKey).sev;
      out.ceiling = currentRank === 1
        ? (sevNow >= 2
          ? "Ship with conditions is the ceiling. Severity comes from the profile's anchor for this harm archetype, not from design, so the conditions are the price of building it."
          : "No combination of up to " + maxChanges + " design changes reaches Ship. Work through the conditions instead.")
        : "No combination of up to " + maxChanges + " design changes clears the escalation. The feature needs a different shape, not a better control.";
      break;
    }
    out.steps.push({
      to: best.r.vkey,
      verdict: best.r.verdict,
      result: best.r,
      changes: best.dims.map(k => ({
        dim: k,
        n: DIMS.find(d => d.id === k).n,
        from: current[k], to: best.acc[k],
        fromLabel: optionLabel(k, current[k], profileKey),
        toLabel: optionLabel(k, best.acc[k], profileKey),
        hint: LEVER_HINT[k]
      }))
    });
    current = Object.assign({}, current, best.acc);
    currentRank = VERDICT_RANK[best.r.vkey];
  }
  return out;
}

/* ---------------- visuals ----------------
   Both renderers return SVG strings, so the site and the CLI draw the
   same picture. Colours are passed in; the site passes CSS variables,
   the CLI passes fixed hex values. */
const HEX = {
  page: "#fcfcfb", ink: "#0b0b0b", ink2: "#52514e", ink3: "#6f6e69", line: "#e2e0da",
  good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b", accent: "#2a78d6"
};
const CSSVARS = {
  page: "var(--card)", ink: "var(--ink)", ink2: "var(--ink-2)", ink3: "var(--ink-3)", line: "var(--line)",
  good: "var(--good)", warning: "var(--warning)", serious: "var(--serious)", critical: "var(--critical)", accent: "var(--accent)"
};
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* Severity (rows) against detectability (columns). The top-right cell is
   where rule 1 lives: severe harm nobody would notice. The dot is the
   feature; the arrows are its path to yes. */
function riskMapSVG(result, path, opts) {
  opts = opts || {};
  const C = opts.palette || HEX;
  const W0 = 460, H0 = 330, gx = 118, gy = 22, cw = 104, ch = 62;
  const zone = (sev, dt) => {
    const s = sev + dt;                                   // 0..5
    return s >= 5 ? C.critical : s >= 4 ? C.serious : s >= 2 ? C.warning : C.good;
  };
  const cx = dt => gx + dt * cw + cw / 2;
  const cy = sev => gy + (3 - sev) * ch + ch / 2;
  const P = [];
  P.push('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W0 + " " + H0 + '" role="img" aria-labelledby="rmT rmD" font-family="-apple-system,BlinkMacSystemFont,Segoe UI,Helvetica,Arial,sans-serif">');
  P.push('<title id="rmT">Risk map</title>');
  const pos = result && result.sev != null ? SEVERITY[result.sev] + " severity, " + DETECT[result.dt] + " detectability" : "not placed";
  P.push('<desc id="rmD">Severity against detectability. Feature is at ' + esc(pos) + (path && path.steps.length ? ", with a path to " + esc(path.steps[path.steps.length - 1].verdict) : "") + '.</desc>');
  P.push('<defs><marker id="rmA" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" style="fill:' + C.ink + '"/></marker>');
  P.push('<pattern id="rmH" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" style="fill:' + C.critical + ';opacity:.35"/></pattern></defs>');
  for (let sev = 0; sev < 4; sev++) {
    for (let dt = 0; dt < 3; dt++) {
      const x = gx + dt * cw, y = gy + (3 - sev) * ch;
      P.push('<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="5" style="fill:' + zone(sev, dt) + ';opacity:.16"/>');
      if (sev === 3 && dt === 2) {
        P.push('<rect x="' + (x + 1) + '" y="' + (y + 1) + '" width="' + (cw - 2) + '" height="' + (ch - 2) + '" rx="5" style="fill:url(#rmH)"/>');
        P.push('<text x="' + (x + cw - 8) + '" y="' + (y + 15) + '" text-anchor="end" font-size="10" font-weight="600" style="fill:' + C.critical + '">RULE 1</text>');
      }
    }
    P.push('<text x="' + (gx - 10) + '" y="' + (cy(sev) + 4) + '" text-anchor="end" font-size="12" style="fill:' + C.ink2 + '">' + SEVERITY[sev] + "</text>");
  }
  for (let dt = 0; dt < 3; dt++) {
    P.push('<text x="' + cx(dt) + '" y="' + (gy + 4 * ch + 18) + '" text-anchor="middle" font-size="12" style="fill:' + C.ink2 + '">' + DETECT[dt] + "</text>");
  }
  P.push('<text x="' + (gx + 1.5 * cw) + '" y="' + (gy + 4 * ch + 38) + '" text-anchor="middle" font-size="11" font-weight="600" letter-spacing=".08em" style="fill:' + C.ink3 + '">DETECTABILITY (WORSE TO THE RIGHT)</text>');
  P.push('<text transform="translate(16 ' + (gy + 2 * ch) + ') rotate(-90)" text-anchor="middle" font-size="11" font-weight="600" letter-spacing=".08em" style="fill:' + C.ink3 + '">SEVERITY</text>');
  if (result && result.sev != null) {
    // jitter within the cell by likelihood so the dot says something too
    const lkOff = l => (l - 1) * 16;
    let px = cx(result.dt) + lkOff(result.lk), py = cy(result.sev);
    const pts = [[px, py, result]];
    if (path) path.steps.forEach(st => pts.push([cx(st.result.dt) + lkOff(st.result.lk), cy(st.result.sev), st.result]));
    for (let i = 1; i < pts.length; i++) {
      const [x1, y1] = pts[i - 1], [x2, y2] = pts[i];
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      P.push('<line x1="' + (x1 + dx / len * 14) + '" y1="' + (y1 + dy / len * 14) + '" x2="' + (x2 - dx / len * 14) + '" y2="' + (y2 - dy / len * 14) + '" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#rmA)" style="stroke:' + C.ink + '"/>');
    }
    pts.forEach(([x, y, r], i) => {
      const col = r.vkey === "ship" ? C.good : r.vkey === "no" ? C.critical : C.warning;
      P.push('<circle cx="' + x + '" cy="' + y + '" r="' + (i === 0 ? 11 : 9) + '" stroke-width="3" style="fill:' + col + ';stroke:' + C.page + '"/>');
      P.push('<text x="' + x + '" y="' + (y + (i === 0 ? 27 : 24)) + '" text-anchor="middle" font-size="10.5" font-weight="650" style="fill:' + C.ink + '">' + (i === 0 ? "NOW" : "STEP " + i) + "</text>");
    });
  } else {
    P.push('<text x="' + (gx + 1.5 * cw) + '" y="' + (gy + 2 * ch) + '" text-anchor="middle" font-size="13" style="fill:' + C.ink3 + '">Answer dimension 6 to place the feature</text>');
  }
  P.push("</svg>");
  return P.join("");
}

/* A README badge, like a coverage badge, except it goes stale. */
function badgeSVG(result, expires, opts) {
  opts = opts || {};
  const left = "AI risk";
  const verdict = result.sev == null ? "unassessed" : result.verdict.toLowerCase();
  const right = opts.stale ? "stale, reassess" : verdict + (expires ? " · exp " + expires.slice(0, 7) : "");
  const col = opts.stale ? "#6f6e69" : result.vkey === "ship" ? "#0a7f0a" : result.vkey === "no" ? "#c22f2f" : "#b7790b";
  const tw = s => Math.round(s.length * 6.4 + 14);
  const lw = tw(left), rw = tw(right), w = lw + rw;
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="20" role="img" aria-label="' + esc(left + ": " + right) + '">' +
    "<title>" + esc(left + ": " + right) + "</title>" +
    '<clipPath id="bc"><rect width="' + w + '" height="20" rx="3"/></clipPath><g clip-path="url(#bc)">' +
    '<rect width="' + lw + '" height="20" fill="#2b2b2a"/><rect x="' + lw + '" width="' + rw + '" height="20" fill="' + col + '"/></g>' +
    '<g fill="#fff" font-family="Verdana,DejaVu Sans,sans-serif" font-size="11">' +
    '<text x="' + lw / 2 + '" y="14" text-anchor="middle">' + esc(left) + "</text>" +
    '<text x="' + (lw + rw / 2) + '" y="14" text-anchor="middle">' + esc(right) + "</text></g></svg>";
}

/* ---------------- markdown ---------------- */
function addMonths(iso, m) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + m);
  return d.toISOString().slice(0, 10);
}

function toMarkdown(spec, r, path, meta) {
  meta = meta || {};
  const a = spec.answers || {}, P = PROFILES[spec.profile], L = [];
  const date = meta.date || "(date)", expires = meta.expires || "(date + 12 months)";
  L.push("# Risk triage: " + (spec.name || "(name this feature)"), "");
  L.push("Profile: " + P.label + " | Questionnaire v2.0 | Assessed " + date + " | Expires " + expires + (meta.assessor ? " | Assessor: " + meta.assessor : ""), "");
  L.push("## Recommendation", "", "**" + r.verdict + "**", "");
  L.push("## Path to yes", "");
  if (!path || !path.steps.length) {
    L.push(r.vkey === "ship" ? "Already at Ship. No conditions manufactured to look thorough." : (path && path.ceiling) || "Answer dimension 6 first.");
  } else {
    path.steps.forEach((st, i) => {
      L.push("**Step " + (i + 1) + ": reaches " + st.verdict + "** with " + st.changes.length + " change" + (st.changes.length > 1 ? "s" : "") + ":", "");
      st.changes.forEach(c => L.push("- Dimension " + c.n + ": " + c.fromLabel + " -> " + c.toLabel + ". " + c.hint));
      L.push("");
    });
    if (path.ceiling) L.push(path.ceiling);
  }
  L.push("");
  L.push("## Risk profile", "");
  L.push("- Harm archetype: " + (a.failure_mode ? P.archetypes[a.failure_mode].label : "not established"));
  L.push("- Severity: " + (r.sev == null ? "unknown" : SEVERITY[r.sev]));
  L.push("- Likelihood: " + (r.sev == null ? "unknown" : LIKELIHOOD[r.lk]));
  L.push("- Detectability: " + (r.sev == null ? "unknown" : DETECT[r.dt]), "");
  L.push("Escalation rules fired: " + (r.rules.length ? "" : "none"));
  r.rules.forEach(([t, d]) => L.push("- **" + t + ".** " + d));
  L.push("", "## Assessment", "");
  visibleDims(a).forEach(d => {
    const val = a[d.id];
    let tag, text;
    if (d.multi ? (val && val.length) : val) {
      tag = "stated";
      text = (d.multi ? val : [val]).map(v => optionLabel(d.id, v, spec.profile)).join(", ");
      if (spec.notes && spec.notes[d.id]) text += ". " + spec.notes[d.id];
    } else { tag = "unknown"; text = "not answered"; }
    L.push("- **" + String(d.n).padStart(2, "0") + " " + d.establishes + "** [" + tag + "] " + text);
  });
  L.push("", "Severity band is [derived] from the profile's anchor for the selected harm archetype. Likelihood and detectability bands are [derived] from the dimensions listed in core/scoring.md.", "");
  L.push("## Conditions", "");
  if (r.conditions.length) r.conditions.forEach(c => L.push("- " + c)); else L.push("None.");
  L.push("", "## Open questions", "");
  if (r.blocking.length) { L.push("**Blocking** (resolving these either way would change the recommendation):", ""); r.blocking.forEach(q => L.push("- " + q)); L.push(""); }
  if (r.nonBlocking.length) { L.push("**Non-blocking:**", ""); r.nonBlocking.forEach(q => L.push("- " + q)); L.push(""); }
  if (!r.blocking.length && !r.nonBlocking.length) L.push("None outstanding.");
  L.push("", "## Reassessment", "");
  if (meta.tripwires && meta.tripwires.length) {
    L.push("Expires " + expires + ". Tripwires recorded in the lock file; `triage check` fails if any of these change:", "");
    meta.tripwires.forEach(t => L.push("- " + t));
    L.push("");
  }
  L.push("Also reassess on: a change to vendor terms or retention or processing region, an expansion of audience or a material increase in volume, or any incident involving this feature.", "");
  L.push("---", "", "Generated by AI Feature Risk Triage. Not a compliance certification, not a legal review, not a gate.");
  return L.join("\n");
}

return {
  PROFILES, SEVERITY, LIKELIHOOD, DETECT, GROUPS, DIMS, PRESETS, W, MAXW, LEVER_COST,
  conditionalsActive, visibleDims, archetypeOpts, optionLabel, validate,
  score, pathToYes, riskMapSVG, badgeSVG, toMarkdown, addMonths, HEX, CSSVARS
};
});
