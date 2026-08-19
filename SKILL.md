---
name: ai-feature-risk-triage
description: Run a structured risk triage on a proposed AI or ML feature before it is built or shipped, producing an evidence-tagged assessment, a severity/likelihood/detectability profile, a ship recommendation with conditions, and the open questions a human still has to answer. Use this whenever someone describes an AI feature, model integration, chatbot, agent, automated decision system, or LLM-powered workflow and asks whether it is safe to build, what could go wrong, what the risks are, whether it needs review, or how to get it approved. Also use it for AI governance questions, responsible AI reviews, pre-launch risk checks, AI intake forms, model risk assessments, and any request to evaluate the risk of automating a decision. Use it even when the person has not used the word "risk" and is simply proposing a feature, because unassessed features are the failure mode this exists to prevent.
---

# AI Feature Risk Triage

Assess a proposed AI feature and produce a documented recommendation. You do not approve anything. You assemble evidence, state a view, and hand back what a human must decide.

## Before you start

Load `core/questionnaire.yaml` for the dimensions and `core/scoring.md` for the bands and escalation rules. Select a domain profile from `profiles/`. If none fits the user's industry, say so, use the closest, and flag every severity judgment as low confidence rather than pretending the profile fits.

## The core discipline: tag every finding

Each finding is one of three things and you must never blur them:

- **stated** The user told you this directly.
- **derived** You concluded it from what they said. Say what you concluded it from.
- **unknown** Nobody has checked. This is a legitimate and common answer.

Tagging is the point of the framework. An assessment where everything reads as established fact is the failure mode this replaces. If you find yourself writing a confident finding you cannot trace to a user statement, it is derived, and if you cannot trace it at all, it is unknown.

Do not resolve unknowns by guessing plausible answers. A guessed answer that reads as stated is worse than an honest gap, because the gap would have been investigated.

## Workflow

**1. Get the feature description.** What it does, who uses it, what data it touches, what happens when it is wrong. If the user has a YAML file, read it. If they described it in conversation, work from that.

**2. Walk the questionnaire.** Do not interrogate. Answer what you can from what they already said and tag those `stated` or `derived`. Then ask about the gaps in one batch, prioritizing dimensions 6, 7, 8, 10, and 12, because those decide the outcome. Dimensions 9 and 16 only apply if their conditions are met.

Two questions people routinely answer wrongly, so probe both:

- *Who is affected* is not the same as *who sees the output*. Ask both separately. In resume screening, a recruiter sees the ranking and a candidate lives with it.
- *The model being accurate* is not the same as *the answer being right*. Ask how a change in the real world reaches the record the system reads, and how long that takes. Stale upstream data is the most commonly missed risk driver in this whole framework.

**3. Score.** Severity from the profile's anchors for the applicable harm archetype, never from your own sense of how important the feature is. Likelihood from dimensions 2, 5, 9, 10, 11. Detectability from 12 and 13. Then check every escalation rule in `core/scoring.md` and state which fired.

**4. Produce the output.** Use this structure exactly:

```
# Risk triage: <feature name>
Profile: <profile> | Questionnaire v<version> | Assessed <date> | Expires <date>

## Recommendation
<Ship | Ship with conditions | Do not ship as designed>
<One paragraph on why. If conditions, they are specific changes, not "be careful.">

## Risk profile
Harm archetype: <archetype>
Severity: <band> | Likelihood: <band> | Detectability: <band>
Escalation rules fired: <rule and why, or none>

## Assessment
<Dimension by dimension. Each finding tagged [stated], [derived], or [unknown].>

## Open questions
Blocking: <resolving these either way would change the recommendation>
Non-blocking: <worth answering, would not change the band>
<Each with a suggested owner.>

## Reassessment
Expires <date>, or on: <applicable triggers>
```

**5. Do not soften the recommendation.** "Do not ship as designed" is a real output and it always comes with the specific change that would turn it into a yes. A framework that can only ever say "proceed with caution" is decoration. If the answer is ship, say ship, and do not manufacture conditions to look thorough.

## Where the framework is weakest

Say so when it applies. Severity anchors are judgment written in advance by a team, so a profile written by someone with no incident history is a guess in a nicer format. Likelihood inputs are weak pre-build, because evaluation coverage is usually unknown before anything exists. And the framework covers pre-build triage only: it does not do post-market monitoring, incident response, or ongoing measurement.

Recommending a formal assessment under NIST AI RMF, ISO/IEC 42001, or the EU AI Act where one is actually required is a valid output. See `docs/crosswalk.md`. This is a triage step that runs before those, not a substitute for them.

## What this is not

Not a compliance certification, not a legal review, not a gate. It produces an argument a person then agrees or disagrees with. If it starts functioning as a rubber stamp, it has failed.
