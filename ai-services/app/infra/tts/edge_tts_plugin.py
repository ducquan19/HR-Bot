import asyncio
import io
import logging
from typing import Optional

import av
import edge_tts
from livekit import rtc
from livekit.agents import tts, utils

logger = logging.getLogger(__name__)

class EdgeTTS(tts.TTS):
    def __init__(self, voice: str = "vi-VN-HoaiMyNeural", **kwargs):
        super().__init__(
            capabilities=tts.TTSCapabilities(streaming=False),
            sample_rate=24000,
            num_channels=1,
            **kwargs
        )
        self._voice = voice

    def synthesize(
        self, text: str, *, conn_options: Optional[dict] = None
    ) -> "tts.ChunkedStream":
        return EdgeTTSStream(self, text, conn_options)

class EdgeTTSStream(tts.ChunkedStream):
    def __init__(self, tts_impl: EdgeTTS, text: str, conn_options: Optional[dict] = None):
        super().__init__(tts=tts_impl, input_text=text, conn_options=conn_options)
        self._text = text
        self._voice = tts_impl._voice

    async def _run(self) -> None:
        try:
            communicate = edge_tts.Communicate(self._text, self._voice)
            audio_data = bytearray()
            
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    audio_data.extend(chunk["data"])

            if not audio_data:
                return

            # Decode MP3 to PCM
            container = av.open(io.BytesIO(audio_data))
            stream = container.streams.audio[0]
            
            for frame in container.decode(stream):
                # Convert to signed 16-bit PCM (s16), required by LiveKit rtc.AudioFrame
                resampled = frame.to_ndarray(format="s16", layout="mono")
                
                rtc_frame = rtc.AudioFrame(
                    data=resampled.tobytes(),
                    sample_rate=frame.sample_rate,
                    num_channels=1,
                    samples_per_channel=frame.samples,
                )
                
                self._event_ch.send_nowait(
                    tts.SynthesizedAudio(text=self._text, data=rtc_frame)
                )

        except Exception as e:
            logger.error(f"EdgeTTS synthesis failed: {e}")
            raise
