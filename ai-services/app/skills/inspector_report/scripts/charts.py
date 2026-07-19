"""Bộ render biểu đồ cho Inspector report — matplotlib, trả PNG bytes.

Đây là phần "tool vẽ" của Judge Agent: deterministic (KHÔNG gọi LLM). Tham số
vào là các con số trong ``ScoreCard`` mà LLM đã chấm — nên report đẹp *và* chính
xác là nhờ điểm số đúng, không phải nhờ LLM tự bịa toạ độ.

Theme thống nhất (palette xanh emerald của GreenTemis, font DejaVu để hiện được
tiếng Việt, thang màu theo điểm) để mọi biểu đồ trong một report — và giữa các
report — trông đồng bộ, cao cấp.

Bộ chart:
- ``overall_gauge``        : đồng hồ bán nguyệt cho điểm tổng (cả 2 track).
- ``competency_radar``     : radar/mạng nhện magnitude năng lực (chủ đạo nontech).
- ``score_breakdown_barh`` : bar ngang xếp hạng năng lực (cả 2 track).
- ``coding_dimensions``    : bar các trục coding (chỉ track tech).
- ``test_pass_donut``      : donut tỉ lệ pass test (tech, nếu có test).
"""

import io
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless: không cần display

import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib import font_manager  # noqa: E402
from matplotlib.patches import Circle, Wedge  # noqa: E402

# ── Palette (đồng bộ với report PDF) ──────────────────────────────────────────
INK = "#0f172a"          # slate-900 — chữ chính
MUTED = "#64748b"        # slate-500 — chữ phụ
GRID = "#e2e8f0"         # slate-200 — lưới / track nền của bar
ACCENT = "#10b981"       # emerald-500 — brand
ACCENT_DARK = "#047857"  # emerald-700
WHITE = "#ffffff"

# Thang màu theo điểm (0..max): đỏ → hổ phách → teal → emerald.
_SCALE = [(0.40, "#ef4444"), (0.60, "#f59e0b"), (0.80, "#14b8a6"), (1.01, "#10b981")]

# Font DejaVu bundle trong repo (đủ glyph tiếng Việt) — đồng bộ với pdf.py.
_FONT_DIR = Path(__file__).resolve().parents[3] / "infra" / "fonts"
_FONT_FAMILY = "DejaVu Sans"
_FONTS_REGISTERED = False


def _ensure_fonts() -> None:
    global _FONTS_REGISTERED
    if _FONTS_REGISTERED:
        return
    for fn in (
        "DejaVuSans.ttf",
        "DejaVuSans-Bold.ttf",
        "DejaVuSans-Oblique.ttf",
        "DejaVuSans-BoldOblique.ttf",
    ):
        p = _FONT_DIR / fn
        if p.exists():
            font_manager.fontManager.addfont(str(p))
    _FONTS_REGISTERED = True


def _theme() -> None:
    _ensure_fonts()
    plt.rcParams.update(
        {
            "font.family": _FONT_FAMILY,
            "text.color": INK,
            "axes.edgecolor": GRID,
            "axes.labelcolor": INK,
            "xtick.color": MUTED,
            "ytick.color": MUTED,
            "figure.facecolor": WHITE,
            "axes.facecolor": WHITE,
            "savefig.facecolor": WHITE,
        }
    )


def _score_color(score: float, max_score: float = 5.0) -> str:
    r = (score / max_score) if max_score else 0.0
    for thr, col in _SCALE:
        if r < thr:
            return col
    return _SCALE[-1][1]


def _wrap(label: str, width: int = 13) -> str:
    """Ngắt nhãn dài thành tối đa 2 dòng cho gọn quanh radar/trục."""
    words = str(label).split()
    if not words:
        return ""
    lines, cur = [], ""
    for w in words:
        cand = (cur + " " + w).strip()
        if len(cand) > width and cur:
            lines.append(cur)
            cur = w
        else:
            cur = cand
    lines.append(cur)
    return "\n".join(lines[:2])


def _png(fig, dpi: int = 200) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=dpi, bbox_inches="tight", pad_inches=0.12)
    plt.close(fig)
    buf.seek(0)
    return buf.getvalue()


# ── Charts ────────────────────────────────────────────────────────────────────
def overall_gauge(score: float, *, max_score: float = 5.0, label: str = "") -> bytes:
    """Đồng hồ bán nguyệt: 4 cung màu theo thang điểm + kim chỉ + số lớn ở giữa."""
    _theme()
    fig, ax = plt.subplots(figsize=(5.0, 3.1))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_xlim(-1.2, 1.2)
    ax.set_ylim(-0.5, 1.12)

    r_out, r_in = 1.0, 0.66
    for a, b, col in [(0.0, 0.4, "#ef4444"), (0.4, 0.6, "#f59e0b"),
                      (0.6, 0.8, "#14b8a6"), (0.8, 1.0, "#10b981")]:
        ax.add_patch(
            Wedge((0, 0), r_out, 180 * (1 - b), 180 * (1 - a),
                  width=r_out - r_in, facecolor=col, edgecolor=WHITE, linewidth=2)
        )

    frac = max(0.0, min(1.0, score / max_score if max_score else 0.0))
    ang = np.pi * (1 - frac)
    ax.plot([0, 0.82 * np.cos(ang)], [0, 0.82 * np.sin(ang)],
            color=INK, lw=3, solid_capstyle="round", zorder=5)
    ax.add_patch(Circle((0, 0), 0.05, color=INK, zorder=6))

    ax.text(0, -0.06, f"{score:.1f}", ha="center", va="top",
            fontsize=33, fontweight="bold", color=INK)
    ax.text(0, -0.34, f"/ {max_score:.0f}", ha="center", va="top",
            fontsize=10, color=MUTED)
    if label:
        ax.text(0, 1.06, label, ha="center", va="bottom",
                fontsize=12.5, fontweight="bold", color=ACCENT_DARK)
    return _png(fig)


def competency_radar(
    labels: list[str], scores: list[float], *, max_score: float = 5.0,
    title: str | None = None,
) -> bytes:
    """Radar/mạng nhện magnitude năng lực. Cần ≥ 3 trục để thành đa giác."""
    _theme()
    n = len(labels)
    if n < 3:  # radar 2 trục vô nghĩa — đệm cho đủ 3
        labels = list(labels) + [""] * (3 - n)
        scores = list(scores) + [0.0] * (3 - n)
        n = 3
    angles = np.linspace(0, 2 * np.pi, n, endpoint=False).tolist()
    vals = list(scores)
    a_c, v_c = angles + angles[:1], vals + vals[:1]

    fig, ax = plt.subplots(figsize=(5.4, 5.4), subplot_kw={"polar": True})
    ax.set_theta_offset(np.pi / 2)
    ax.set_theta_direction(-1)
    ax.set_ylim(0, max_score)
    rings = list(range(1, int(max_score) + 1))
    ax.set_yticks(rings)
    ax.set_yticklabels([str(r) for r in rings], color=MUTED, fontsize=8)
    ax.set_xticks(angles)
    ax.set_xticklabels([_wrap(l) for l in labels], fontsize=10, color=INK)
    ax.tick_params(axis="x", pad=12)
    ax.grid(color=GRID, linewidth=1)
    ax.spines["polar"].set_color(GRID)
    ax.set_axisbelow(True)

    ax.plot(a_c, v_c, color=ACCENT_DARK, linewidth=2.4, zorder=4)
    ax.fill(a_c, v_c, color=ACCENT, alpha=0.22, zorder=3)
    ax.scatter(angles, vals, color=ACCENT_DARK, s=30, zorder=5)
    if title:
        ax.set_title(title, color=INK, fontsize=13, fontweight="bold", pad=22)
    return _png(fig)


def score_breakdown_barh(
    items: list[dict], *, max_score: float = 5.0, title: str | None = None,
    language: str = "en",
) -> bytes:
    """Bar ngang xếp hạng năng lực (cao → thấp). items: {name, score, weight}."""
    _theme()
    wt_lbl = "tr.số" if str(language).lower().startswith("vi") else "wt."
    items = sorted(items, key=lambda x: x.get("score", 0.0))
    names = [_wrap(i.get("name", ""), 26).replace("\n", " ") for i in items]
    scores = [float(i.get("score", 0.0)) for i in items]
    colors = [_score_color(s, max_score) for s in scores]

    fig, ax = plt.subplots(figsize=(7.4, 0.52 * len(items) + 1.0))
    y = np.arange(len(items))
    ax.barh(y, [max_score] * len(items), color=GRID, height=0.52, zorder=1)
    ax.barh(y, scores, color=colors, height=0.52, zorder=2)

    ax.set_yticks(y)
    ax.set_yticklabels(names, fontsize=10)
    ax.set_xlim(0, max_score)
    ax.set_xticks(range(0, int(max_score) + 1))
    for sp in ("top", "right", "left"):
        ax.spines[sp].set_visible(False)
    ax.spines["bottom"].set_color(GRID)
    ax.tick_params(length=0)
    ax.set_axisbelow(True)

    for yi, it in zip(y, items):
        s = float(it.get("score", 0.0))
        ax.text(min(s + 0.1, max_score), yi, f"{s:.1f}", va="center", ha="left",
                fontsize=9.5, color=INK, fontweight="bold")
        w = it.get("weight") or 0.0
        if w:
            ax.text(0.06, yi + 0.34, f"{wt_lbl} {w:.0%}", va="center", ha="left",
                    fontsize=7.5, color=MUTED)
    if title:
        ax.set_title(title, color=INK, fontsize=12.5, fontweight="bold",
                     loc="left", pad=10)
    return _png(fig)


def coding_dimensions(
    dims: dict[str, float], *, max_score: float = 5.0, title: str | None = None,
) -> bytes:
    """Bar dọc các trục đánh giá coding (track tech). dims: {tên_trục: điểm}."""
    _theme()
    names = [_wrap(k, 11) for k in dims]
    scores = [float(v) for v in dims.values()]
    colors = [_score_color(s, max_score) for s in scores]

    fig, ax = plt.subplots(figsize=(6.6, 3.7))
    x = np.arange(len(names))
    ax.bar(x, [max_score] * len(names), color=GRID, width=0.56, zorder=1)
    ax.bar(x, scores, color=colors, width=0.56, zorder=2)

    ax.set_xticks(x)
    ax.set_xticklabels(names, fontsize=9.5)
    ax.set_ylim(0, max_score + 0.1)
    ax.set_yticks(range(0, int(max_score) + 1))
    for sp in ("top", "right"):
        ax.spines[sp].set_visible(False)
    for sp in ("left", "bottom"):
        ax.spines[sp].set_color(GRID)
    ax.tick_params(length=0)
    ax.set_axisbelow(True)
    ax.yaxis.grid(True, color=GRID, linewidth=0.8)

    for xi, s in zip(x, scores):
        ax.text(xi, s + 0.12, f"{s:.1f}", ha="center", va="bottom",
                fontsize=10, color=INK, fontweight="bold")
    if title:
        ax.set_title(title, color=INK, fontsize=12.5, fontweight="bold",
                     loc="left", pad=10)
    return _png(fig)


def test_pass_donut(
    passed: int, total: int, *, title: str | None = None, language: str = "en",
) -> bytes:
    """Donut tỉ lệ pass test (track tech, nếu có test)."""
    _theme()
    pass_lbl = "test đạt" if str(language).lower().startswith("vi") else "test pass"
    total = max(int(total), 0)
    passed = max(min(int(passed), total), 0)
    frac = (passed / total) if total else 0.0
    col = _score_color(frac * max(total, 1), max(total, 1)) if total else GRID

    fig, ax = plt.subplots(figsize=(3.3, 3.3))
    ax.set_aspect("equal")
    ax.axis("off")
    ax.add_patch(Wedge((0, 0), 1.0, 0, 360, width=0.34, facecolor=GRID))
    if total:
        ax.add_patch(
            Wedge((0, 0), 1.0, 90, 90 + 360 * frac, width=0.34, facecolor=col)
        )
    ax.set_xlim(-1.15, 1.15)
    ax.set_ylim(-1.15, 1.15)
    ax.text(0, 0.08, f"{passed}/{total}" if total else "—", ha="center", va="center",
            fontsize=22, fontweight="bold", color=INK)
    ax.text(0, -0.26, pass_lbl, ha="center", va="center", fontsize=10, color=MUTED)
    if title:
        ax.set_title(title, color=INK, fontsize=12, fontweight="bold", pad=8)
    return _png(fig)
