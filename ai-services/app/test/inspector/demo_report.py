"""Demo offline (không gọi LLM): dựng ScoreCard mẫu → render PDF + markdown.

Chạy: python -m app.test.inspector.demo_report
Xuất ra app/test/inspector/_out/{tech,nontech}.pdf + .md
"""

from pathlib import Path

from app.agents.inspector.agent import _summarize_integrity
from app.agents.inspector.domain import report as R
from app.schemas.evaluation import (
    CodingEval,
    CompetencyScore,
    IntegritySummary,
    Recommendation,
    ScoreCard,
    Track,
)

_OUT = Path(__file__).resolve().parent / "_out"
_OUT.mkdir(parents=True, exist_ok=True)


def _tech() -> ScoreCard:
    return ScoreCard(
        candidate_name="Nguyễn Minh Tuấn",
        position="Senior AI Engineer",
        track=Track.tech,
        overall_score=4.1,
        recommendation=Recommendation.hire,
        headline="Ứng viên kỹ thuật vững, tư duy hệ thống tốt; còn lỗ hổng về giao tiếp khi code.",
        summary=(
            "Ứng viên thể hiện nền tảng ML và kỹ thuật backend chắc chắn, giải "
            "quyết bài toán sliding-window đúng và tối ưu O(n). Tư duy thiết kế hệ "
            "thống nổi bật khi mô tả pipeline phục vụ mô hình. Điểm trừ là diễn đạt "
            "khi code còn ngắn, ít giải thích lựa chọn. Phù hợp vị trí Senior với "
            "kèm cặp nhẹ về communication."
        ),
        competencies=[
            CompetencyScore(name="Kỹ thuật nền tảng", score=4.6, weight=0.30,
                            rationale="Nắm vững cấu trúc dữ liệu, độ phức tạp, giải đúng O(n).",
                            evidence="giải thích rõ vì sao dùng hash map cho cửa sổ trượt"),
            CompetencyScore(name="Tư duy hệ thống", score=4.3, weight=0.25,
                            rationale="Mô tả pipeline serving rõ ràng, có cân nhắc trade-off."),
            CompetencyScore(name="Giải quyết vấn đề", score=4.0, weight=0.20,
                            rationale="Tiếp cận bài toán có hệ thống, kiểm thử biên đầy đủ."),
            CompetencyScore(name="Giao tiếp", score=3.2, weight=0.15,
                            rationale="Trả lời đúng nhưng ngắn, ít chủ động giải thích."),
            CompetencyScore(name="Hiểu yêu cầu JD", score=3.8, weight=0.10,
                            rationale="Kinh nghiệm khớp tốt với yêu cầu vị trí."),
        ],
        strengths=[
            "Nền tảng thuật toán và ML chắc, code sạch.",
            "Tư duy thiết kế hệ thống vượt kỳ vọng cho level.",
        ],
        concerns=[
            "Giao tiếp khi trình bày code còn cộc, cần khai thác thêm.",
            "Chưa chủ động nêu giả định trước khi giải.",
        ],
        red_flags=[],
        coding_eval=CodingEval(
            correctness=4.5, code_quality=3.8, problem_solving=4.2, communication=3.2,
            tests_passed=9, tests_total=10,
            notes="Lời giải đúng, tối ưu; thiếu một test biên chuỗi rỗng ở lần chạy đầu.",
        ),
        next_steps="Mời vòng phỏng vấn hệ thống với team lead; xác nhận kỹ năng giao tiếp.",
    )


def _nontech() -> ScoreCard:
    return ScoreCard(
        candidate_name="Nguyễn Thị Uyên",
        position="Marketing Executive",
        track=Track.nontech,
        overall_score=3.4,
        recommendation=Recommendation.lean_hire,
        headline="Tư duy thị trường tốt, giao tiếp cuốn hút; cần củng cố phân tích số liệu.",
        summary=(
            "Ứng viên có cảm quan thương hiệu và khả năng kể chuyện thuyết phục, "
            "đề xuất chiến dịch sáng tạo bám insight. Phần phân tích số liệu và đo "
            "lường hiệu quả còn ở mức cơ bản. Phù hợp vai trò executive với hỗ trợ "
            "về data."
        ),
        competencies=[
            CompetencyScore(name="Tư duy thị trường", score=4.0, weight=0.25,
                            rationale="Phân tích đối thủ và phân khúc khá sắc."),
            CompetencyScore(name="Giao tiếp & thuyết phục", score=4.2, weight=0.25,
                            rationale="Trình bày cuốn hút, lập luận mạch lạc."),
            CompetencyScore(name="Sáng tạo nội dung", score=3.6, weight=0.20,
                            rationale="Ý tưởng chiến dịch mới mẻ, bám insight khách hàng."),
            CompetencyScore(name="Phân tích số liệu", score=2.4, weight=0.20,
                            rationale="Lúng túng khi đọc chỉ số ROI/CAC, cần đào tạo."),
            CompetencyScore(name="Phán đoán tình huống", score=3.3, weight=0.10,
                            rationale="Xử lý tình huống khủng hoảng truyền thông ở mức ổn."),
        ],
        strengths=["Kể chuyện thương hiệu thuyết phục.", "Nhạy bén xu hướng thị trường."],
        concerns=["Phân tích định lượng còn yếu.", "Chưa quen công cụ đo lường."],
        red_flags=[],
        coding_eval=None,
        next_steps="Cho bài test phân tích số liệu marketing trước khi quyết định.",
    )


def main() -> None:
    clean = _summarize_integrity([])
    flagged = IntegritySummary(
        total_violations=4, high_severity_count=1,
        counts_by_kind={"tab_switch": 2, "second_monitor": 1, "look_away": 1},
        risk="high", note="Phát hiện màn hình phụ và nhiều lần chuyển tab.",
    )
    for name, sc, integ in [("tech", _tech(), flagged), ("nontech", _nontech(), clean)]:
        (_OUT / f"{name}.pdf").write_bytes(R.build_pdf(sc, integ))
        (_OUT / f"{name}.md").write_text(R.build_markdown(sc, integ), encoding="utf-8")
        print(f"  wrote {name}.pdf + {name}.md")
    print("OK — demo reports written to", _OUT)


if __name__ == "__main__":
    main()
