from pydantic import BaseModel, Field


class TestCase(BaseModel):
    label: str
    inputs: list
    expected: object


class InterviewPlan(BaseModel):
    """Output của Planning Agent — 3 "golden brief" bằng ngôn ngữ tự nhiên.

    Thiết kế narrative-centric: Planning Agent đọc CV+JD một lần, làm hết phần
    nặng (đọc-hiểu CV, đối chiếu JD), rồi cô đọng thành các brief markdown súc
    tích. Mỗi brief được inject thẳng vào prompt của agent hạ nguồn → con đó
    KHÔNG phải tự đọc lại CV thô (tiết kiệm context window, nội dung đã golden).

    Mỗi brief là một khối markdown đầy đủ, tự chứa (có heading/bullet), không
    phải structured fields — các agent đọc trực tiếp.
    """

    interview_brief: str = Field(
        description=(
            "Brief markdown cho Interview Agent: bối cảnh ứng viên, năng lực cần "
            "đánh giá theo ưu tiên, các chủ đề & câu hỏi may đo theo CV."
        )
    )
    evaluation_brief: str = Field(
        description=(
            "Brief markdown cho Inspector Agent: tiêu chí chấm điểm cụ thể, có "
            "thể quan sát được, trọng số/ưu tiên, các tín hiệu cần để ý."
        )
    )
    assignment_brief: str = Field(
        description=(
            "Brief markdown CHUNG cho Code Assignment Agent. Mở đầu bằng một khối "
            "ASSIGNMENT DIRECTIVE (tiếng Anh, máy đọc được) gợi ý loại bài "
            "(coding | cognitive), mode (dsa | project), bật/tắt AI assistant và "
            "độ khó; phần sau mô tả bài may đo theo level ứng viên. Artifact cụ "
            "thể (đề code hoặc câu hỏi) do Assignment Agent sinh khi vào phỏng vấn."
        )
    )
    duration_minutes: int = Field(
        default=45, ge=5, description="Tổng thời lượng buổi phỏng vấn (phút)."
    )
    source: str = Field(
        default="planning-agent",
        description="Origin of the plan: 'planning-agent' or 'mock'",
    )


class PlanRequest(BaseModel):
    """Payload the backend sends to the planning agent (ai-services).

    Cả JD lẫn CV đều là *markdown thô* (CV gốc là PDF được convert sang Markdown
    ở backend — bước convert nằm ngoài phạm vi service này). LLM brain đọc trực
    tiếp markdown; không yêu cầu backend parse sẵn thành structured fields.

    Yêu cầu tối thiểu với markdown:
      - UTF-8, giữ đúng thứ tự đọc (convert không làm xáo trộn cột).
      - Lý tưởng có heading sections (Experience / Skills / Education) — giúp cả
        LLM lẫn heuristic tool chính xác hơn, nhưng KHÔNG bắt buộc.
    """

    jd_text: str = Field(description="Job description ở dạng markdown")
    cv_markdown: str = Field(description="CV đã convert sang markdown")
    position: str | None = Field(default=None, description="Tên vị trí tuyển dụng")
    special_requirements: str | None = Field(
        default=None, description="Yêu cầu đặc biệt từ HR (focus areas)"
    )
