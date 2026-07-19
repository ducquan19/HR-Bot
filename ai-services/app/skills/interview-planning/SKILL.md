# Interview Planning Skill

Cung cấp **grounding** cho Planning Agent khi may đo buổi phỏng vấn.

## Triết lý (hybrid)

Skill này **không sinh câu hỏi/topic/rubric** bằng template. LLM brain đọc trực
tiếp CV + JD markdown rồi tự sinh nội dung may đo. Tool chỉ lo phần dễ sai khi để
LLM tự làm.

## Tools

- `match_skills(cv_markdown, required_skills)` → `matched_skills`, `skill_gaps`,
  `match_score`. Đối chiếu deterministic → chống LLM "ảo giác" kỹ năng không có
  trong CV. **Gaps là điểm cần đào sâu khi phỏng vấn.**
- `search_problem_bank(domain, level)` → list bài coding ứng viên, mỗi bài có
  `test_cases` đã kiểm chứng (Code Assignment Agent sẽ chạy để chấm). LLM **chọn 1**
  và copy `test_cases` nguyên văn, chỉ sửa nhẹ statement nếu cần.

## Thứ tự gọi (trong planning workflow)

1. `extract_requirements` (skill jd-analysis) → facts JD
2. `match_skills` → matched / gaps
3. LLM tự xác định level từ CV
4. `search_problem_bank(domain, level)` → chọn bài coding
5. LLM sinh InterviewPlan đầy đủ → trả qua `response_format=InterviewPlan`

## Output

Không có `finalize_plan`. Plan cuối được model trả về dưới dạng structured output
(`InterviewPlan`) và MAF parse sẵn vào `result.value`.
