# Scoring

Bands, not scores. Three axes resolved separately and never averaged into one number.

## Axes

**Severity** comes from the profile, not from the assessment. The profile defines what each band means for each harm archetype in that business. The assessment picks the harm archetype (dimension 6) and the profile supplies the band.

| Band | Meaning |
|---|---|
| Negligible | Absorbed in normal operations |
| Moderate | Costs money or time, contained, no lasting effect on a person |
| Serious | Lasting effect on a person, a legal exposure, or a material financial loss |
| Severe | Physical harm, a rights violation, or an existential business consequence |

**Likelihood** derives from dimensions 2, 5, 9, 10, 11. Open generation, untrusted freeform input, weak upstream data freshness, absent evaluation, and high volume all push it up.

| Band | Meaning |
|---|---|
| Rare | Would require several things to go wrong at once |
| Occasional | Expected a few times a year at current volume |
| Frequent | Expected weekly or more at current volume |

**Detectability** derives from dimensions 12 and 13, and is inverted: low detectability is worse.

| Band | Meaning |
|---|---|
| High | Caught automatically or by a reviewer before effect |
| Moderate | Caught within a business cycle, before compounding |
| Low | Found by a complaint, an audit, or an incident |

## Escalation rules

These override the band combination. They exist because averaging hides the interaction.

1. **Undetectable severe harm.** Severity Severe AND Detectability Low AND Reversibility partially_reversible or worse. Recommendation escalates to *do not ship as designed*, regardless of every other answer.

2. **No recourse on an affected third party.** Audience includes `third_party_no_interaction` AND contestability `can_discover` is no or unknown. Escalates one band and adds a blocking open question.

3. **Volume amplification.** Where severity is Moderate or above and rollout stage is general_availability and detectability is Low, treat likelihood as one band higher than derived.

4. **Unaccountable review.** Where `human_in_loop` is `every_output_reviewed` but `reviewer_accountable` is no or unknown, the review does not count as a mitigating control until that is resolved.

## Unknowns

Unknown is not a severity. It is recorded as its own state and surfaced in the recommendation as blocking or non-blocking.

An unknown is **blocking** when resolving it either way would change the recommendation band. It is **non-blocking** when it would not. That test is the whole rule, and it is why unknowns are not collapsed into "assume the worst": collapsing loses the distinction between "we checked and it is bad" and "nobody looked," and those need different responses from different people.

## Output

1. **Assessment.** Dimension by dimension, each finding tagged stated, derived, or unknown.
2. **Risk profile.** Severity, likelihood, and detectability per applicable harm archetype, plus any escalation rule that fired and why.
3. **Recommendation.** Ship, ship with conditions, or do not ship as designed. Conditions are specific changes, not "be careful."
4. **Open questions.** What a human has to resolve, split into blocking and non-blocking, each with a suggested owner.
5. **Audit record.** Date, questionnaire version, profile version, assessor, expiry date, and the reassessment triggers.
