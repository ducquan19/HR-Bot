import logging
import re
from functools import lru_cache

from livekit.agents import DEFAULT_API_CONNECT_OPTIONS
from livekit.plugins import openai
from livekit.plugins.openai import tts as _openai_tts

from app.config import Settings

logger = logging.getLogger(__name__)

# The self-hosted Kokoro/Vietnamese endpoints return raw audio, not OpenAI's
# SSE stream. The LiveKit plugin already routes tts-1/tts-1-hd through its raw
# audio path; keep kokoro registered as a backward-compatible model alias.
if hasattr(_openai_tts, "AUDIO_STREAM_MODELS"):
    _openai_tts.AUDIO_STREAM_MODELS.add("kokoro")
    _openai_tts.AUDIO_STREAM_MODELS.add("tts-1")

# sea_g2p wraps foreign (English) segments in <en>...</en> and, for acronyms,
# splits them into single lowercase letters: "RAG" -> "<en>r a g</en>". A
# self-hosted Vietnamese TTS voice reads those bare letters as Vietnamese
# phonemes ("rờ a gờ"), not as letter names. We re-spell each single letter
# with an English letter name written phonetically so the voice says the
# acronym the way people do: "a ây gi".
_EN_SEGMENT_RE = re.compile(r"<en>(.*?)</en>", re.DOTALL)
# Defensive: drop any stray/unbalanced tag the segment pass didn't consume.
_STRAY_TAG_RE = re.compile(r"</?en>")

# English alphabet letter names, transcribed so a Vietnamese TTS voice sounds
# them out like spoken English (e.g. "R" -> "a", as in "ar"). Tune these against
# the actual hosted voice — pronunciation quality depends on the model.
_EN_LETTER_NAMES = {
    "a": "ây", "b": "bi", "c": "xi", "d": "đi", "e": "i",
    "f": "ép", "g": "gi", "h": "ếch", "i": "ai", "j": "giây",
    "k": "kây", "l": "eo", "m": "em", "n": "en", "o": "ô",
    "p": "pi", "q": "kiu", "r": "a", "s": "ét", "t": "ti",
    "u": "diu", "v": "vi", "w": "đáp-bồ-diu", "x": "ích",
    "y": "oai", "z": "dét",
}


def _spell_en_segment(match: "re.Match[str]") -> str:
    """Re-spell a single <en>...</en> segment with English letter names.

    Single-letter tokens are sea_g2p's "spell it out" signal and get mapped to
    their English letter name; multi-character tokens (e.g. "ram", "nasa") are
    pronounceable words sea_g2p chose to keep whole, so we leave them verbatim.
    """
    spelled = []
    for token in match.group(1).split():
        if len(token) == 1 and token in _EN_LETTER_NAMES:
            spelled.append(_EN_LETTER_NAMES[token])
        else:
            spelled.append(token)
    return " ".join(spelled)


@lru_cache(maxsize=1)
def _vietnamese_normalizer():
    from sea_g2p import Normalizer

    return Normalizer(lang="vi")


def normalize_vietnamese_tts_text(text: str) -> str:
    """Normalize Vietnamese text before sending it to the TTS server.

    Runs sea_g2p's Vietnamese normalizer (numbers, dates, units, ...), then
    re-spells the English acronyms it tagged so the voice reads "RAG" as
    "a ây gi" instead of the raw phonemes "r a g". On any failure the original
    text is returned unchanged.
    """
    try:
        normalized = _vietnamese_normalizer().normalize(text)
    except Exception:
        logger.warning("failed to normalize Vietnamese TTS text", exc_info=True)
        return text

    if not isinstance(normalized, str):
        return text
    spelled = _EN_SEGMENT_RE.sub(_spell_en_segment, normalized)
    return _STRAY_TAG_RE.sub("", spelled)


from .edge_tts_plugin import EdgeTTS

class VietnameseNormalizingTTS(EdgeTTS):
    """TTS that normalizes Vietnamese text (acronym spelling) before synthesis."""

    def synthesize(
        self,
        text: str,
        *,
        conn_options=DEFAULT_API_CONNECT_OPTIONS,
    ):
        return super().synthesize(
            normalize_vietnamese_tts_text(text),
            conn_options=conn_options,
        )


def build_tts(settings: Settings, language: str | None = None):
    lang = (language or settings.language or "en").lower()
    
    # We ignore the kokoro/openai configs and strictly use our free EdgeTTS plugin.
    # We use VietnameseNormalizingTTS so acronyms like RAG still sound natural.
    if lang == "vi":
        voice = "vi-VN-HoaiMyNeural"
        return VietnameseNormalizingTTS(voice=voice)
    else:
        voice = "en-US-AriaNeural"
        return EdgeTTS(voice=voice)
