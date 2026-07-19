"""Competency theo CÔNG THỨC (thay chia đều) + chuẩn hoá weight.

Trọng số phải: must-have nặng hơn nice-to-have, gap nặng hơn skill đã có, và TỔNG
luôn đúng 100 dù LLM trả số lệch. Test thuần, không network.
"""

from app.agents.planning import agent as A


def _weight(comps, name):
    return next(c["weight"] for c in comps if c["name"] == name)


def test_renormalize_forces_sum_100():
    comps = [{"name": "a", "weight": 3}, {"name": "b", "weight": 1}]
    out = A._renormalize(comps)
    assert sum(c["weight"] for c in out) == 100
    assert _weight(out, "a") > _weight(out, "b")


def test_renormalize_empty_is_empty():
    assert A._renormalize([]) == []


def test_normalize_competencies_dedupes_and_caps_six():
    comps = [{"name": f"c{i}", "weight": 10} for i in range(8)]
    comps.append({"name": "C0", "weight": 99})  # trùng 'c0' (khác hoa/thường)
    out = A._normalize_competencies(comps)
    assert len(out) == 6                      # cắt còn 6
    names = [c["name"] for c in out]
    assert len(names) == len(set(n.lower() for n in names))  # không trùng
    assert sum(c["weight"] for c in out) == 100


def test_skeleton_weights_gap_and_mandatory_higher():
    # 'kafka' là gap + must-have → phải nặng nhất; 'docker' chỉ là required.
    comps = A._competency_skeleton(
        required_skills=["python", "kafka", "docker"],
        skill_gaps=["kafka"],
        mandatory_skills=["python", "kafka"],
    )
    assert sum(c["weight"] for c in comps) == 100
    assert _weight(comps, "kafka") > _weight(comps, "python")
    assert _weight(comps, "python") > _weight(comps, "docker")


def test_skeleton_empty_falls_back_to_core():
    comps = A._competency_skeleton([], [])
    assert comps == [{"name": "Core role competency", "weight": 100}]
