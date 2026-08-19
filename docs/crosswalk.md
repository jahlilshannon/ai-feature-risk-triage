# Crosswalk to published standards

This framework does not claim conformance with any standard below. It is a triage step that runs earlier and cheaper than a formal assessment, and it is built so its output can feed one. This page exists so a reader can see where it sits, and so the claim "this adds something" can be checked rather than asserted.

Standards state and dates below were verified in August 2026. Several commonly cited facts in this space are out of date, and the ones that changed are flagged.

---

## The documents

| Document | What it is | Why it matters here |
|---|---|---|
| **NIST AI RMF 1.0** (NIST AI 100-1, Jan 2023) | Voluntary lifecycle risk framework: four functions, GOVERN, MAP, MEASURE, MANAGE, plus seven trustworthiness characteristics | The reference vocabulary in the US. Everything in this questionnaire lives inside MAP |
| **NIST Generative AI Profile** (NIST AI 600-1, Jul 2024) | Twelve named generative-AI risks | The closest published analogue to this framework's harm archetypes |
| **ISO/IEC 42001:2023** | Certifiable AI management system standard (AIMS) | Separates risk *to the organization* from impact *on individuals and society*. That two-axis split is better than a single severity axis and this framework should adopt it |
| **ISO/IEC 23894:2023** | AI risk management guidance, ISO 31000 adapted to AI | The process companion: identify, analyze, evaluate, treat, monitor |
| **OECD Framework for the Classification of AI Systems** (2022) | Five dimensions: People and Planet, Economic Context, Data and Input, AI Model, Task and Output | The closest peer, because it is explicitly a classification instrument rather than a management system |
| **EU AI Act** (Reg. (EU) 2024/1689, as amended) | Binding EU law, risk-tiered | The only binding instrument here, and the only one where getting the dates wrong is costly |

### On NIST AI RMF versioning

NIST states that AI RMF 1.0 is being revised under the White House AI Action Plan. No draft, version number, or date has been published. There is no "AI RMF 2.0" to cite.

### On the EU AI Act timeline

**Regulation (EU) 2026/1744**, the Digital Omnibus on AI, was adopted 8 July 2026 and entered into force 27 July 2026. It changed the timeline materially:

| Obligation | Status |
|---|---|
| Prohibited practices (Art. 5), AI literacy (Art. 4) | In force since 2 Feb 2025 |
| GPAI model obligations, governance, penalties | In force since 2 Aug 2025 |
| Transparency obligations (Art. 50) | In force since 2 Aug 2026 |
| Synthetic-content marking for pre-existing systems | 2 Dec 2026 |
| Annex III high-risk systems | **2 Dec 2027** (deferred from 2 Aug 2026) |
| Annex I high-risk (safety component of regulated products) | **2 Aug 2028** (deferred from 2 Aug 2027) |

Cite the [European Commission regulatory framework page](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai) or [EUR-Lex](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202601744). Do not cite artificialintelligenceact.eu, whose implementation timeline still shows the superseded pre-omnibus dates.

---

## Dimension mapping

| # | Dimension | NIST AI RMF | ISO/IEC 42001 | OECD | EU AI Act relevance |
|---|---|---|---|---|---|
| 1 | Data exposure | MAP 2, MAP 3 | AI risk assessment; data controls | Data and Input | Data governance; GDPR interface |
| 2 | Model behavior | MAP 2.3, MEASURE 2 | AI system impact assessment | AI Model | GPAI obligations |
| 3 | Autonomy | MAP 3.4 | Impact assessment | Task and Output | Autonomy is a high-risk indicator |
| 4 | Audience and affected parties | MAP 1.1, MAP 3.3 | Impact on individuals and society | People and Planet | Deployer vs affected-person duties |
| 5 | Exposure volume | MAP 5.1 | Risk criteria | Economic Context | Scale informs tiering |
| 6 | Failure mode | MAP 5.1, MEASURE 2.6 | Risk analysis | People and Planet | Health, safety, fundamental rights |
| 7 | Reversibility | MAP 5.1 | Risk analysis | Task and Output | Considered in tiering |
| 8 | Contestability and recourse | GOVERN 5, MANAGE 4.3 | Impact on individuals | People and Planet | Right to explanation, Art. 86 |
| 9 | Input trust | MEASURE 2.7 (security and resilience) | Security controls | AI Model | Robustness and cybersecurity (Art. 15) |
| 10 | Upstream data dependency | MAP 2.3, MEASURE 2.8 | Data quality | Data and Input | Data and data governance (Art. 10) |
| 11 | Evaluation coverage | MEASURE 1, MEASURE 2 | Performance evaluation | AI Model | Accuracy and testing (Art. 15) |
| 12 | Detectability | MEASURE 3, MANAGE 4.1 | Monitoring and measurement | Task and Output | Post-market monitoring (Art. 72) |
| 13 | Provenance | MEASURE 2.9 (explainable) | Documented information | AI Model | Record-keeping and logging (Art. 12) |
| 14 | Human in the loop | GOVERN 3.2, MANAGE 4 | Operational controls | People and Planet | Human oversight (Art. 14) |
| 15 | Disclosure | MEASURE 2.8 (transparent) | Transparency | People and Planet | Transparency (Art. 50), in force 2 Aug 2026 |
| 16 | Vendor and processing terms | MAP 4, GOVERN 6 (third party) | Supplier controls | Economic Context | Value chain, provider vs deployer |
| 17 | Accountable owner and escalation | GOVERN 2, GOVERN 4 | Leadership, roles, responsibilities | Economic Context | Deployer obligations |

### Coverage honesty

The questionnaire maps almost entirely to **MAP**. It touches MEASURE only where the answer is documentary rather than empirical, and it touches GOVERN only at dimension 17. It does not implement MANAGE at all.

That is a limitation, not an oversight. Triage is a pre-build activity. MEASURE requires a system that exists and MANAGE requires an incident process. A framework claiming to cover all four functions from a YAML file describing a feature that has not been built would be doing the thing this repo opens by criticizing.

### Harm archetypes against NIST AI 600-1

The Generative AI Profile names twelve risks: CBRN information or capabilities; confabulation; dangerous, violent, or hateful content; data privacy; environmental impacts; harmful bias or homogenization; human-AI configuration; information integrity; information security; intellectual property; obscene, degrading, or abusive content; value chain and component integration.

A domain profile's harm archetypes should be checkable against that list. The restaurant profile's physical-harm archetype is a domain-specific instance of confabulation with a safety consequence. Any profile that cannot map its archetypes to at least a few of the twelve is probably missing archetypes.

---

## What this framework adds

Every document above requires that risk be assessed against criteria. None of them tells you how to establish the criteria, and in practice that is where assessments fail. ISO/IEC 23894 says to establish risk criteria. NIST AI RMF MAP 5 says to characterize impact. The EU AI Act assumes a tier is determinable. All of them leave "what does severe mean for us" to the implementer, and the implementer decides it in the meeting, under time pressure, about a feature someone has already built.

The contribution here is narrow and specific: **severity meaning is written into the profile before any feature is assessed, by the team, where it can be reviewed and disagreed with later.** Plus the evidence tagging, so a reader can tell which findings the submitter asserted, which the framework derived, and which nobody checked.

Neither is novel research. Both are things that get skipped.

---

## Sources

- [NIST AI RMF 1.0 (AI 100-1)](https://nvlpubs.nist.gov/nistpubs/ai/nist.ai.100-1.pdf)
- [NIST Generative AI Profile (AI 600-1)](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf)
- [ISO/IEC 42001:2023](https://www.iso.org/standard/42001)
- [ISO/IEC 23894:2023](https://www.iso.org/standard/77304.html)
- [OECD Framework for the Classification of AI Systems](https://www.oecd.org/en/publications/oecd-framework-for-the-classification-of-ai-systems_cb6d9eca-en.html)
- [Regulation (EU) 2026/1744, Digital Omnibus on AI](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202601744)
- [European Commission, AI regulatory framework](https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai)
