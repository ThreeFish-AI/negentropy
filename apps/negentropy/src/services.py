"""
ADK Service Entry Point.

Loaded by ``load_services_module(agents_dir)`` inside google.adk.cli.fast_api.
When agents_dir is ``src``, ADK adds ``src`` to sys.path and calls
``import services``, which resolves to this file.
"""

from negentropy.engine.bootstrap import apply_adk_patches

# Apply patches immediately upon import
apply_adk_patches()
