# AI Feature Risk Triage

A reference framework for assessing the risk of a proposed AI feature before it ships.

You describe a feature. It produces an assessment, a recommendation, and a list of what a human still has to decide. It does not approve anything, and it is not a compliance certification.

**Status: design specification and reference profile. The scoring engine is not built yet.** What is in this repo today is the questionnaire, the profile schema, the scoring rules, and two worked examples. See [Roadmap](#roadmap) for what is next and [Status](#status) for what has already changed my mind.

The restaurant scenario throughout is illustrative. It exists to show the framework doing something non-obvious, not to describe any real company or product.

![Assessment pipeline](docs/pipeline.svg)

---

## The problem it exists for

Most risk questionnaires produce the same report for every feature. Boxes get ticked, a severity gets picked from a dropdown, and the output satisfies a process without telling anyone anything they did not already know.

Two habits cause that.

**Severity gets asserted rather than derived.** Someone picks "High" because the feature feels important, and nothing connects that word to what actually happens when the feature is wrong. Once a rating is in a document it tends to stay there, and the reasoning behind it is rarely written down anywhere it can be checked later.

**The assessment inherits whatever the submitter claimed.** If someone answers "no, this does not touch sensitive data," that answer flows straight through to the conclusion, with no distinction between what was stated, what was inferred, and what nobody actually looked into.

This framework separates those three, and it makes severity something a team has to write down in advance rather than choose in the moment.

---

## Worked example

The scenario below is invented. Any resemblance to a real product is coincidental.

An example restaurant platform wants a diner-facing chatbot. Scan a QR code at the table, ask questions in free text, get answers from the restaurant's ingredient records. "Does the carbonara have nuts?" Servers get asked constantly and it slows down table turns.

It sounds benign. That is why it is the example.

The questionnaire surfaces the shape. Ingredient data in, no diner PII, but question text leaves the boundary to a third-party model. The model is generative rather than a constrained lookup. No human reviews anything, because it is real time at the table. It produces text and takes no action, which reads reassuring right up until the audience question, where the exposed party turns out to be the diner while the paying customer is the operator. Those are not the same person.

Then the dimensions that decide it. The worst realistic failure is a diner with a severe allergy being told a dish is safe when it is not. Detectability is close to zero, because nobody logs "the bot said it was fine" and you learn about it from an incident. Reversibility is zero once the food is eaten. Recourse is zero, because the diner has no way to know they were misinformed until they are already reacting.

The risk driver turns out not to be the model. It is menu data staleness. The kitchen runs out of pine nuts on a Saturday night, substitutes walnuts, and that substitution never reaches the record the bot reads. The model can be perfectly accurate against data that is wrong.

**Recommendation: do not ship as designed.** The condition is not better prompting. It is a change to the answer contract, so the bot can never affirm safety. It can confirm that a dish contains an allergen. For anything else it declines and routes to a server. That converts an unbounded generative risk into a bounded one, and it survives stale data, because the failure mode becomes an unnecessary handoff instead of a hospitalization.

**Open questions handed back to a human.** Who owns menu accuracy contractually. Whether the substitution workflow writes back to the ingredient record. What the operator agreement says about liability. Whether the diner is told they are talking to a model. None of those are answerable by a tool, and all of them have to be answered before anyone ships.

Run the same framework against a prep-quantity forecaster at the same company and it comes back low risk, ship it. Historical sales in, no PII, a manager approves every order, it recommends rather than orders, and a bad forecast shows up in inventory within a day and gets fixed on the next one.

Two features, one company, one framework, opposite answers. Something that flags everything is indistinguishable from something that flags nothing.

---

## Where this applies

The questionnaire does not change between these. The profile and the answers do.

**Resume screening assistant.** Ranks applicants against a role. Internal audience, no customer exposure, and it only produces a ranking rather than a decision, which makes it look low risk. The dimensions that bite are detectability, reversibility, and recourse: a model that systematically downranks a group produces output that looks entirely reasonable one candidate at a time, and the people affected never learn they were affected, so they cannot contest it. Severity is legal and ethical rather than physical, and detection requires auditing in aggregate, which nobody does by default. Likely recommendation: ship with mandatory sampled review, retained decision logs, and a stated appeal path.

**Support reply drafting.** Suggests a response, an agent edits and sends. Customer-facing text, third-party model, real customer data in the prompt. But a human reviews every output before it leaves, the agent is accountable for what they send, and a bad draft costs seconds. Human in the loop collapses most of the risk on its own. Likely recommendation: ship, with disclosure to agents that drafts are model-generated so they review rather than rubber-stamp.

**Automated invoice coding.** Assigns general ledger codes to incoming invoices without review. This one takes action rather than producing text, which is the dimension most teams underweight. Severity is moderate and financial, but reversibility is good and detectability is decent, since miscoded entries surface at reconciliation. The risk is concentrated in volume: one wrong code is nothing, ten thousand wrong codes is a restatement. Likely recommendation: ship with a confidence threshold that routes low-confidence items to a human, plus a monthly audit sample.

Notice what varies. The support tool is saved by human review. The invoice tool is saved by reversibility. The screening tool has neither, which is why it is the one that needs conditions despite looking the most harmless.

---

## The questionnaire

Seventeen dimensions in five groups. The questions are domain-neutral. What the answers mean is not, which is what the profile supplies.

### Group 1: Shape. What the system actually is.

| # | Dimension | What it establishes |
|---|---|---|
| 1 | Data exposure | What the model sees, where it came from, whether it leaves the trust boundary |
| 2 | Model behavior | Constrained or generative; can it produce output nobody anticipated |
| 3 | Autonomy | Produces output, or takes action |
| 4 | Audience and affected parties | Internal staff, business customer, end consumer, or a third party who never interacts with it |
| 5 | Exposure volume | Decisions per day, people affected per day, pilot or general availability |

### Group 2: Consequence. Feeds severity.

| # | Dimension | What it establishes |
|---|---|---|
| 6 | Failure mode | The worst realistic outcome when it is wrong |
| 7 | Reversibility | Whether the effect can be undone |
| 8 | Contestability and recourse | Whether the affected person can find out, object, and reach a human |

### Group 3: Likelihood. Feeds likelihood.

| # | Dimension | What it establishes |
|---|---|---|
| 9 | Input trust | Whether any input channel is open to a party with an incentive to manipulate it (conditional) |
| 10 | Upstream data dependency | Freshness, ownership, and accuracy of the data the system reasons over |
| 11 | Evaluation coverage | What it has been tested against, what the observed error rate is, what has not been tested |

### Group 4: Visibility. Feeds detectability.

| # | Dimension | What it establishes |
|---|---|---|
| 12 | Detectability | Whether you would know it was wrong, and how fast |
| 13 | Provenance | Whether you can reconstruct why it produced what it did |

### Group 5: Controls and governance.

| # | Dimension | What it establishes |
|---|---|---|
| 14 | Human in the loop | Reviewed always, sampled, or never |
| 15 | Disclosure | Whether the person knows AI is involved |
| 16 | Vendor and processing terms | Provider, training-on-input, retention, processing region, subprocessors (conditional on 1) |
| 17 | Accountable owner and escalation | Who owns the risk after this assessment, who reviews it, who can override a "do not ship" |

Dimensions 6 through 8 and 12 are where most tools stop asking and start guessing. They are the ones the severity calibration hangs on.

### Why it grew from ten to seventeen

The first draft had ten. Writing the allergen example broke four of them.

The risk driver in that example is stale menu data, and the original ten had no dimension that could have caught it. The framework would have missed, in its own showcase scenario, the exact thing the prose correctly identified. That produced dimension 10.

The same example takes free text from an anonymous diner, which is an untrusted channel into a generative model with access to a business record system, and nothing asked about that. That produced dimension 9.

The invoice scenario turns on volume, and the resume scenario turns on whether the affected person can contest the outcome. Neither was representable. Those produced dimensions 5 and 8.

The remaining three are structural. Dimension 11 exists because the original questionnaire promised a likelihood rating in its output while supplying no input that could derive one, which is precisely the failure this framework opens by criticizing. Dimension 16 exists because "data leaves the boundary" is not a risk statement until you know the contract it leaves under. Dimension 17 exists because an assessment with no named owner is a document, not a control.

Seventeen questions is a real cost, and long questionnaires get filled in badly or not at all. Two mitigations: dimensions 9 and 16 are conditional and only appear when an earlier answer triggers them, and the group structure means a reviewer who reads nothing else can read Group 2 and Group 4 and get most of the answer.

---

## Design decisions

**Bands, not scores.** Severity, likelihood, and detectability resolve to bands rather than a number out of 100. A composite score implies a precision the inputs do not support, and it invites the worst behavior in this category, which is tuning inputs until the number clears a threshold. The cost is real: bands are harder to trend over time and harder to put on a dashboard. That tradeoff is deliberate.

**It can say do not ship.** Always with conditions attached. Something that can only ever say "proceed with caution" is decoration, and something that says no without a path forward gets removed within a quarter. The allergen case is the shape: a clear no, plus a specific change that turns it into a yes.

**Unknown is a state, not a severity.** The obvious move is to treat anything unknown as high risk. That is safer on paper and wrong in practice, because it collapses "we checked and it is bad" into "nobody looked," and those need different responses. Every finding is tagged **stated**, **derived**, or **unknown**. The cost is that a team can proceed with unknowns outstanding, so unknowns surface in the recommendation as blocking or non-blocking rather than disappearing into a rating.

**Severity anchors are written in advance, by the team, in the profile.** Not chosen during the assessment. A profile has to state what each harm archetype means for that business before any feature is run through it. This is the part most questionnaires skip, and skipping it is why their severity ratings mean nothing.

**Undetectable severe harm escalates on its own.** This started as an accident of the scoring and is now a stated rule. Where the worst realistic failure is severe, detectability is low, and reversibility is low, the recommendation escalates regardless of how the other fourteen dimensions answer. Maximum severity with good detectability is a manageable feature. Maximum severity with no detectability is the one that ends up in a news story. Those are not the same risk and averaging them together hides the difference.

**Assessments expire.** An assessment is valid for twelve months or until a trigger event, whichever comes first. Trigger events: model or model version change, prompt or system instruction change, a new or changed data source, a change to vendor terms, an expansion of audience or volume, or any incident involving the feature. Without this, the artifact describes a system that no longer exists, and the audit record becomes archival rather than useful.

**Two extension points, not three.** The domain profile is swappable and the severity anchor source is swappable. Intake is not. Feature descriptions go in as YAML, one way in, no plugin layer for web forms and ticket systems. Every additional seam is a promise to maintain something nobody has asked for yet.

---

## How it is put together

The risk questions are domain-neutral. What makes a risk severe is not.

"Does a human review this before a customer sees it" is the same question at a restaurant platform, a bank, and a school district. But "the model was wrong" means a rounding error in one and a hospitalization in another. So the core carries the questionnaire and the scoring, and a domain profile supplies the rest:

- which data classes count as sensitive
- which obligations attach to them
- the harm archetypes, and what each severity band means for this business
- who "the customer" actually is, which is a more common source of error than it sounds

Two profiles ship. Restaurant is the vivid one, chosen because the allergen case makes the framework's reasoning visible. K-12 education software is the one written from direct experience: student data, an audience split three ways between district administrator, teacher, and student, and harm archetypes that are academic and reputational rather than physical. Two profiles, not one, because a single profile proves nothing about whether the seam works.

A profile for another industry is a YAML file and an afternoon of a team arguing about what severe means to them. That argument is the point; the file is just where it gets recorded.

### On severity anchors

Anchors are judgment, deliberately. A team encodes what "severe" means in their business, in advance, where it can be reviewed and disagreed with later.

Organizations with real incident history should anchor on it, and the profile interface is the place to plug that in. This repo does not ship anyone's incident data and does not depend on any external dataset, so it stands up with nothing configured.

---

## Where this sits against published standards

This framework is not a replacement for any of these, and it does not claim conformance with any of them. It is a triage step that runs earlier and faster than a formal assessment, and it is designed so its output can feed one. [`docs/crosswalk.md`](docs/crosswalk.md) maps each dimension to NIST AI RMF and the NIST Generative AI Profile, ISO/IEC 42001 and 23894, the OECD classification framework, and the EU AI Act, and it is explicit about where this framework does something those documents leave to the implementer.

The short version: the questionnaire sits almost entirely inside the NIST AI RMF **MAP** function. The thing it adds is the requirement that severity meaning is written down before any feature is assessed, which every one of those standards requires you to do and none of them tells you how to do.

---

## What is in the repo

```
README.md
LICENSE
core/
  questionnaire.yaml       the seventeen dimensions, with conditionals
  profile.schema.yaml      what a domain profile must supply
  scoring.md               band definitions and the escalation rules
docs/
  pipeline.svg
  crosswalk.md             mapping to NIST, ISO, OECD, EU AI Act
profiles/
  restaurant/profile.yaml
  k12-education/profile.yaml
examples/
  allergen-chatbot.yaml    high risk, obvious
  prep-forecaster.yaml     low risk, shows the framework discriminates
```

Two examples matter more than they look. One that screams and one that shrugs proves the tool discriminates.

---

## Roadmap

- [ ] `core/assess.py`, the orchestrator, plus `profile_interface.py` and `risk_data_interface.py`
- [ ] Scoring implementation and the escalation rule as a test
- [ ] Test suite and CI, including a regression test that the prep forecaster never comes back high
- [ ] `SKILL.md` so the assessment can be run conversationally rather than by editing YAML
- [ ] A third profile contributed by someone who is not me, which is the only real proof the seam works

---

## What this is not

Not a compliance certification, not a legal review, not a substitute for counsel. Not a gate, and it has no authority to approve anything. It produces an argument that a person then has to agree or disagree with, and the audit record exists so that person can reconstruct the reasoning later.

If it ever starts functioning as a rubber stamp, it has failed at the thing it was built for.

---

## Status

Early. The scoring bands have not been tested against real features.

Two things have shifted so far.

**Detectability is doing more work than severity.** I expected severity to dominate the recommendation. Working through the allergen case on paper, detectability turned out to matter more. Maximum severity with good detectability is a manageable feature. Maximum severity with no detectability is the one that ends up in a news story. That interaction was emergent from the scoring and is now an explicit escalation rule, which is where it should have been from the start.

**My own worked example broke my own questionnaire.** The risk driver in the allergen case is stale menu data, and the original ten dimensions had no way to represent it. The framework would have missed, in the scenario written to showcase it, the thing the prose correctly identified. Three more scenarios broke three more dimensions. That is how the questionnaire got to seventeen, and it is the strongest argument I have for why a framework needs worked examples before it needs code.

Whether any of it holds once real features run through it is an open question.

MIT licensed.
