"""Pre-download model assets at build time so the agent starts offline.

The generic ``livekit.agents download-files`` only fetches assets for plugins
it auto-imports; the multilingual turn detector (languages.json / model_q8.onnx)
is missed. Importing the plugins here registers them, then we trigger each
plugin's own download. Kept free of any ``app`` imports so it runs during the
Docker build, before application config exists.
"""

import livekit.plugins.turn_detector.multilingual  # noqa: F401
import livekit.plugins.turn_detector.english  # noqa: F401
import livekit.plugins.silero  # noqa: F401
import livekit.plugins.openai  # noqa: F401
from livekit.agents import Plugin


def main() -> None:
    for plugin in Plugin.registered_plugins:
        print(f"prefetching assets for {plugin.package}")
        plugin.download_files()


if __name__ == "__main__":
    main()
