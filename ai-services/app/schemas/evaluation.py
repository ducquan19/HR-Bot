"""Schemas cho Inspector (Judge) Agent — chấm điểm buổi phỏng vấn + sinh report.

Triết lý giống Planning/Assignment: LLM chỉ lo phần *reasoning* (chấm điểm, lý
giải bằng evidence) và trả về một ``ScoreCard`` có cấu trúc; phần *facts* định
lượng để vẽ biểu đồ chính là các con số trong ScoreCard đó — code render chart
là deterministic (không gọi LLM). Integrity (chống gian lận) được tính
deterministic từ proctor_events, KHÔNG để LLM bịa.
"""

from enum import Enum

from pydantic import BaseModel, Field


class Track(str, Enum):
    """Loại vai trò → quyết định bộ biểu đồ trong report."""

    tech = "tech"        # role viết code → thêm coding chart
    nontech = "nontech"  # role phi kỹ thuật → radar năng lực là chart chủ đạo


class Recommendation(str, Enum):
    """Khuyến nghị tuyển dụng (thang 5 mức, ánh xạ màu badge trong report)."""

    strong_hire = "strong_hire"
    hire = "hire"
    lean_hire = "lean_hire"
    no_hire = "no_hire"
    strong_no_hire = "strong_no_hire"


class CompetencyScore(BaseModel):
    """Một năng lực được chấm, kèm trọng số ưu tiên và evidence."""

    name: str = Field(
        description="Tên năng lực, NGẮN GỌN (≤ ~22 ký tự) để hiển thị đẹp trên chart"
    )
    score: float = Field(ge=0, le=5, description="Điểm 0..5")
    weight: float = Field(
        default=0.0, ge=0, le=1, description="Trọng số ưu tiên 0..1 (từ evaluation_brief)"
    )
    rationale: str = Field(description="1-2 câu lý do, bám sát evidence quan sát được")
    evidence: str | None = Field(
        default=None, description="Trích dẫn/diễn giải ngắn từ transcript hoặc code"
    )


class CodingEval(BaseModel):
    """Đánh giá phần coding — CHỈ cho track tech. Các trục dùng để vẽ chart."""

    correctness: float = Field(ge=0, le=5, description="Tính đúng đắn của lời giải")
    code_quality: float = Field(ge=0, le=5, description="Chất lượng/độ sạch của code")
    problem_solving: float = Field(ge=0, le=5, description="Tư duy giải quyết vấn đề")
    communication: float = Field(ge=0, le=5, description="Giải thích/diễn đạt khi code")
    tests_passed: int | None = Field(default=None, description="Số test pass (nếu có)")
    tests_total: int | None = Field(default=None, description="Tổng test (nếu có)")
    notes: str = Field(default="", description="Nhận xét ngắn về phần coding")


class ScoreCard(BaseModel):
    """Structured output của Inspector/Judge Agent — nguồn dữ liệu cho report.

    ``candidate_name``/``position``/``track`` sẽ được ghi đè deterministic từ
    request sau khi parse (không tin LLM cho mấy trường định danh này)."""

    candidate_name: str = Field(default="Candidate")
    position: str = Field(default="")
    track: Track = Field(default=Track.tech)
    overall_score: float = Field(
        ge=0, le=5, description="Điểm tổng 0..5 (cân theo trọng số các năng lực)"
    )
    recommendation: Recommendation = Field(description="Khuyến nghị tuyển dụng")
    headline: str = Field(description="MỘT câu kết luận súc tích về ứng viên")
    summary: str = Field(description="Tóm tắt điều hành 3-5 câu cho HR")
    competencies: list[CompetencyScore] = Field(
        min_length=3, description="≥ 3 năng lực, bám theo evaluation_brief"
    )
    strengths: list[str] = Field(default_factory=list, description="Điểm mạnh (bullet)")
    concerns: list[str] = Field(default_factory=list, description="Điểm cần lưu ý")
    red_flags: list[str] = Field(
        default_factory=list, description="Cảnh báo nghiêm trọng (nếu có)"
    )
    coding_eval: CodingEval | None = Field(
        default=None, description="Chỉ điền cho track tech; null cho nontech"
    )
    next_steps: str | None = Field(
        default=None, description="Đề xuất bước tiếp theo cho HR (vòng sau, lưu ý...)"
    )


class IntegritySummary(BaseModel):
    """Tóm tắt liêm chính buổi thi — tính DETERMINISTIC từ proctor_events."""

    total_violations: int = 0
    high_severity_count: int = 0
    counts_by_kind: dict[str, int] = Field(default_factory=dict)
    risk: str = Field(default="clean", description="clean | low | medium | high")
    note: str = ""


class EvaluationRequest(BaseModel):
    """Payload backend gửi sang Inspector Agent khi kết thúc phỏng vấn."""

    interview_id: str
    candidate_name: str = "Candidate"
    position: str = ""
    language: str = Field(
        default="en",
        description="Ngôn ngữ report ('en' | 'vi') — HR chọn ở UI khi tạo interview",
    )
    track: str | None = Field(
        default=None,
        description="'tech' | 'nontech'. Bỏ trống → suy ra từ assignment.type",
    )
    evaluation_brief: str = Field(
        default="", description="Tiêu chí chấm điểm do Planning Agent sinh ra"
    )
    interview_brief: str = Field(
        default="", description="Bối cảnh ứng viên (tùy chọn, giúp chấm chính xác hơn)"
    )
    transcript: list[dict] = Field(
        default_factory=list, description="conversation_history: [{role, content}]"
    )
    assignment: dict | None = Field(default=None, description="Bài tập đã sinh")
    assignment_result: dict | None = Field(
        default=None, description="Bài làm + kết quả của ứng viên"
    )
    last_run_result: dict | None = Field(
        default=None, description="Kết quả chạy code gần nhất"
    )
    proctor_events: list[dict] = Field(
        default_factory=list, description="Tín hiệu chống gian lận trong phiên"
    )


class EvaluationResponse(BaseModel):
    """Kết quả Inspector trả về backend.

    ai-services KHÔNG giữ DB/đĩa: trả PDF dưới dạng base64 để backend tự lưu.
    ``report`` là dict có cấu trúc (scorecard + integrity + meta) để lưu DB/hiển
    thị; ``report_markdown`` là bản markdown; ``pdf_base64`` là PDF đã render."""

    interview_id: str
    report: dict
    report_markdown: str = ""
    pdf_base64: str = ""
    source: str = Field(default="inspector-agent", description="'inspector-agent' | 'mock'")
