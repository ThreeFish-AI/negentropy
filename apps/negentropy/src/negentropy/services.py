"""
ADK Service Entry Point.

This file is automatically loaded by the Google ADK CLI (`adk web`, `adk run`)
when the agent starts.

Its presence at the root of the agent directory is MANDATORY for ADK auto-discovery.

Ideally, this file should only contain configuration hooks or registration logic.
We use it here to bootstrap our valid environment configuration by patching
default ADK service factories to respect `.env` settings (Zero-Config Launch).

See `src/negentropy/engine/bootstrap.py` for implementation details.
"""

from negentropy.engine.bootstrap import apply_adk_patches

# Apply patches immediately upon import
apply_adk_patches()
