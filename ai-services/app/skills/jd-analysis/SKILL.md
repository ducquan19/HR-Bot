# JD Analysis Skill

Trích xuất **grounding facts** từ Job Description cho Planning Agent.

## Triết lý

Skill này **chỉ trích facts** (deterministic, không gọi LLM). Việc suy luận và
sinh nội dung (competencies, weights, câu hỏi) là của LLM brain — xem thiết kế
hybrid trong `app/agents/planning_agent.py`.

## Tool

- `extract_requirements(jd_text, position)` → dict facts:
  - `required_skills`: skill xuất hiện trong JD
  - `min_years_experience`, `seniority_level`
  - `nice_to_have`
  - `domain`: backend / frontend / data / devops / ai (dùng cho problem bank)

## Khi nào dùng

Gọi **đầu tiên** trong workflow planning, trước khi đối chiếu CV.

## Input / Output

- Input: JD text thô (markdown hoặc plaintext) — không cần tiền xử lý.
- Output: structured dict facts. LLM tự quyết định competencies/câu hỏi từ facts này.
