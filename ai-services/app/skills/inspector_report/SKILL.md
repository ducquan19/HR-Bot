# Inspector Report Skill

Converts a `ScoreCard` (structured output from the Inspector/Judge LLM) into a
**professional bilingual PDF report** and a **markdown copy**.

## Philosophy (hybrid — same as Planning/Assignment)

- **LLM = reasoning:** reads `evaluation_brief` + transcript + coding result
  → scores each competency, writes rationale with evidence → returns `ScoreCard`.
- **Skill = deterministic rendering:** this module takes the numbers and text in
  `ScoreCard` and renders charts + PDF. No LLM involved, no hallucination possible.
- **Integrity = deterministic:** risk level computed from `proctor_events`, not LLM.

---

## Module layout

```
inspector_report/
├── scripts/
│   ├── charts.py        ← renders PNG charts (matplotlib Agg, brand emerald theme)
│   └── pdf_builder.py   ← assembles PDF (fpdf2, DejaVu font, bilingual EN/VI)
└── __init__.py          ← exports: build_pdf, build_markdown
```

### `scripts/charts.py` — PNG charts (theme: brand emerald, DejaVu font)

| Function | Used for | Description |
| --- | --- | --- |
| `overall_gauge(score, label)` | both tracks | Semicircle dial: 4 colour bands + needle. |
| `competency_radar(labels, scores)` | both tracks | Spider/radar chart of competency magnitudes. |
| `score_breakdown_barh(items)` | both tracks | Horizontal bars ranked by score + weight label. |
| `coding_dimensions(dims)` | **tech** | Vertical bars: Correctness, Code Quality, Problem-Solving, Communication. |
| `test_pass_donut(passed, total)` | **tech** (if tests) | Donut showing automated test pass rate. |

Colour scale: <2.0 red · 2.0–3.0 amber · 3.0–4.0 teal · ≥4.0 emerald.

### `scripts/pdf_builder.py` — professional PDF + markdown

**Design contract:**
- Every chart is sandwiched: **section title** above + **caption box** below.
  A bare chart without accompanying text is never allowed.
- Two fixed templates (section order never changes):

  **Tech:**  
  header → badge → KPI strip → Overall Score (gauge) → Executive Summary →  
  Competency Profile (radar + bars) → **Coding Assessment** (coding dims + donut) →  
  Strengths & Concerns → Competency Detail (table) → Interview Integrity → Next Steps

  **Non-Tech:**  
  same as Tech minus the Coding Assessment section.

- **Bilingual:** English primary (bold, larger) · Vietnamese secondary (italic, muted).
- Section titles: `EN TITLE` + `Vietnamese subtitle` + thin rule.
- Caption boxes: light-gray background + left emerald accent strip + EN + VI text.
- Recommendation badge: coloured pill (EN label) + VI sub-label beneath.
- KPI strip: Total Score · Competencies Assessed · Integrity (3 boxes).
- Competency table: striped rows, score colour-coded, evidence quoted in-cell.

## Public API

```python
from app.skills.inspector_report import build_pdf, build_markdown

pdf_bytes = build_pdf(scorecard, integrity_summary)   # → bytes
md_str    = build_markdown(scorecard, integrity_summary)  # → str
```

## Demo / offline verification

```bash
cd ai-services
python -m app.test.inspector.demo_report
# Writes: app/test/inspector/_out/tech.pdf + nontech.pdf (+ .md)
```

## How Inspector Agent uses this skill

`app/agents/inspector/agent.py` → `run_inspector_agent(EvaluationRequest)`:
1. Derive `track` (tech/nontech) from assignment.
2. LLM scores → `ScoreCard` JSON (JSON-in-prompt + retry — avoids `response_format` which Gemma truncates).
3. Compute `IntegritySummary` deterministically from `proctor_events`.
4. Call `build_pdf(sc, integrity)` + `build_markdown(sc, integrity)` → `EvaluationResponse`.

ai-services is stateless — returns PDF as base64; backend saves the file.
