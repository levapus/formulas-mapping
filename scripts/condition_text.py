from __future__ import annotations

import re
import unicodedata

_TRAILING_PUNCT = re.compile(r"[\s.,;:!?]+$", re.UNICODE)
_NUMBERED = re.compile(
    r"(?:^|\n)\s*\d+[\.\)]\s*",
    re.UNICODE,
)


def normalize_key(text: str) -> str:
    if not text:
        return ""
    s = unicodedata.normalize("NFKC", text)
    s = s.replace("ё", "е").replace("Ё", "Е")
    s = s.casefold()
    s = re.sub(r"\s+", " ", s, flags=re.UNICODE).strip()
    s = _TRAILING_PUNCT.sub("", s)
    return s


def split_conditions(text: str) -> list[str]:
    if text is None:
        return []
    raw = text.replace("\r\n", "\n").replace("\r", "\n").strip()
    if not raw:
        return []

    # If numbered markers exist, split on them; else split on newlines only.
    if re.search(r"(?:^|\n)\s*\d+[\.\)]\s*", raw):
        parts = _NUMBERED.split(raw)
    else:
        parts = raw.split("\n")

    out: list[str] = []
    for part in parts:
        piece = part.strip()
        piece = _TRAILING_PUNCT.sub("", piece).strip()
        # Drop leftover leading "или"/"or" noise only if the whole piece is empty after
        if piece:
            out.append(piece)
    return out
