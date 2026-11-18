# Risk triage: Diner allergen chatbot

Profile: Restaurant platform | Questionnaire v2.0 | Assessed 2026-11-18 | Expires 2027-11-18 | Assessor: Example Team

## Recommendation

**Do not ship as designed**

## Path to yes

**Step 1: reaches Ship with conditions** with 1 change:

- Dimension 12: Only from an incident -> Automated, on a delay. Add a way to notice a wrong output before an incident tells you.

Ship with conditions is the ceiling. Severity comes from the profile's anchor for this harm archetype, not from design, so the conditions are the price of building it.

## Risk profile

- Harm archetype: Physical harm (allergen, foodborne)
- Severity: Severe
- Likelihood: Frequent
- Detectability: Low

Escalation rules fired: 
- **Undetectable severe harm.** Severity is Severe, the effect cannot be fully undone, and nothing would notice a wrong output before it has its effect. This escalates regardless of how the other dimensions answer.
- **No recourse on an affected party.** The output lands on someone who cannot find out it happened or object to it. Escalated one band, with a blocking open question.

## Assessment

- **01 What the model sees, where it came from, whether it leaves the trust boundary** [stated] Yes, content leaves
- **02 Constrained or generative; can it produce output nobody anticipated** [stated] Open generation
- **03 Produces output, or takes action** [stated] Produces output only
- **04 Internal staff, business customer, end consumer, or a third party who never interacts with it** [stated] Business customer, End consumer
- **05 Decisions per day, people affected per day, pilot or general availability** [stated] General availability
- **06 The worst realistic outcome when it is wrong** [stated] Physical harm (allergen, foodborne). A diner with a severe allergy is told a dish is safe when it is not.
- **07 Whether the effect can be undone** [stated] Irreversible
- **08 Whether the affected person can find out, object, and reach a human** [stated] No, they never find out
- **09 Whether any input channel is open to a party with an incentive to manipulate it** [stated] Untrusted free-form input
- **10 Freshness, ownership, and accuracy of the data the system reasons over** [stated] No defined freshness SLA. Kitchen substitutions on a busy night never reach the ingredient record the bot reads.
- **11 What it has been tested against, the observed error rate, what has not been tested** [stated] Not tested
- **12 Whether you would know it was wrong, and how fast** [stated] Only from an incident
- **13 Whether you can reconstruct why it produced what it did** [stated] Output logged only
- **14 Reviewed always, sampled, or never** [stated] No review
- **15 Whether the person knows AI is involved** [stated] Not disclosed
- **16 Provider, training-on-input, retention, processing region, subprocessors** [stated] Standard terms, nobody reviewed them
- **17 Who owns the risk, who reviews it, who can override a “do not ship”** [stated] Nobody yet

Severity band is [derived] from the profile's anchor for the selected harm archetype. Likelihood and detectability bands are [derived] from the dimensions listed in core/scoring.md.

## Conditions

- Define a freshness SLA and a named owner for the upstream data, and document how a real-world change reaches the record the system reads.
- Bound the answer contract so an untrusted free-form input cannot elicit an unbounded generative response. Constrain what the system is permitted to affirm.
- Add a detection mechanism before general availability. Right now a wrong output is found by incident or complaint, which is too late to be a control.
- Log inputs, model and prompt version, and outputs with a stated retention period, so a specific output can be reconstructed later.
- Give the affected person a stated route to find out an AI system was involved and reach a human who can change the outcome.
- Introduce review proportionate to the severity band, with a reviewer who is accountable for what they approve.
- Establish an evaluation set and an observed error rate before rollout widens. Untested is not the same as working.
- Have someone read the processing terms: training on inputs, retention period, processing region, and subprocessors.
- Disclose that an AI system is involved to the person receiving the output.
- Name a person who owns this risk, a review cadence, and who can override a do-not-ship.

## Open questions

**Blocking** (resolving these either way would change the recommendation):

- Who is accountable for the affected party's recourse, and what is the stated appeal path?


## Reassessment

Expires 2027-11-18. Tripwires recorded in the lock file; `triage check` fails if any of these change:

- model: example-vendor/general-chat-2026-05
- vendor: example-vendor, standard API terms
- prompt: prompts/allergen-chatbot.txt
- data source: menu_ingredients_db
- the answers in allergen-chatbot.yaml
- the scoring rules

Also reassess on: a change to vendor terms or retention or processing region, an expansion of audience or a material increase in volume, or any incident involving this feature.

---

Generated by AI Feature Risk Triage. Not a compliance certification, not a legal review, not a gate.
