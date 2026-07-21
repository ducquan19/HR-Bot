"""Behavior tests for TopicCoverage.

Tracks which interview topics have been covered, hands out the next topic in
plan order, and — under time pressure — drops remaining topics while recording
what was skipped (for inspector/HR transparency).
"""

from app.agents.interview.domain.plan_models import InterviewPlan, InterviewTopic
from app.agents.interview.domain.topic_coverage import TopicCoverage


def _plan(*titles: str) -> InterviewPlan:
    return InterviewPlan(
        summary="x",
        interview_topics=[InterviewTopic(title=t, questions=["q"]) for t in titles],
    )


def test_starts_with_all_topics_uncovered():
    coverage = TopicCoverage(_plan("A", "B"))

    assert coverage.all_covered() is False
    assert coverage.next_topic().title == "A"


def test_mark_covered_advances_and_completes():
    coverage = TopicCoverage(_plan("A", "B"))

    coverage.mark_covered("A")
    assert coverage.next_topic().title == "B"
    assert coverage.all_covered() is False

    coverage.mark_covered("B")
    assert coverage.next_topic() is None
    assert coverage.all_covered() is True


def test_drop_remaining_records_skipped_and_completes():
    coverage = TopicCoverage(_plan("A", "B", "C"))
    coverage.mark_covered("A")

    dropped = coverage.drop_remaining()

    assert [t.title for t in dropped] == ["B", "C"]
    assert coverage.next_topic() is None
    assert coverage.all_covered() is True
