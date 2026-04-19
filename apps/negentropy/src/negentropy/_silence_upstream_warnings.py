"""Site-init hook that silences two well-known upstream startup warnings.

These warnings fire during ADK CLI dependency import, BEFORE
``negentropy.bootstrap`` runs, and therefore cannot be suppressed via
``warnings.filterwarnings`` in regular project code:

1. ``authlib._joserfc_helpers`` triggers ``AuthlibDeprecationWarning`` when
   importing the deprecated ``authlib.jose`` shim. ``authlib.deprecate`` also
   calls ``warnings.simplefilter("always", AuthlibDeprecationWarning)`` on its
   own import, which would defeat any ``filterwarnings`` registered earlier. We
   therefore install a ``showwarning`` hook (which runs AFTER filter checks)
   and drop the noise by message-content whitelist.
2. ``google.adk.auth.*`` triggers
   ``UserWarning("[EXPERIMENTAL] feature FeatureName.PLUGGABLE_AUTH ...")``
   because the feature is ``default_on=True`` in google-adk 1.31.0.

Loaded via ``_negentropy_silence.pth`` at site initialisation, so the hook is
in place before any third-party import in the venv.
"""

from __future__ import annotations

import warnings

_SILENCED_SUBSTRINGS = (
    "authlib.jose module is deprecated",
    "PLUGGABLE_AUTH",
)

_orig_showwarning = warnings.showwarning


def _filtered_showwarning(message, category, filename, lineno, file=None, line=None):
    msg_str = str(message)
    if any(token in msg_str for token in _SILENCED_SUBSTRINGS):
        return
    _orig_showwarning(message, category, filename, lineno, file=file, line=line)


warnings.showwarning = _filtered_showwarning
