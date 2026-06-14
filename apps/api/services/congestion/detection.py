"""Congestion detection domain logic (Level 3 — pure, no I/O)."""

from services.congestion.schemas import CongestionSeverity

# From AGENTS.md spec
_THRESHOLD = 50

_SEVERITY_THRESHOLDS = [
    (3.0, CongestionSeverity.critical),
    (2.0, CongestionSeverity.high),
    (1.5, CongestionSeverity.medium),
    (1.0, CongestionSeverity.low),
]

_CLEAR_RATIO = 0.4  # ≤ 20 pings / 50 threshold


def compute_severity(ping_count: int, threshold: int = _THRESHOLD) -> CongestionSeverity:
    """Compute congestion severity from ping count vs threshold ratio."""
    ratio = ping_count / threshold
    for cutoff, level in _SEVERITY_THRESHOLDS:
        if ratio >= cutoff:
            return level
    return CongestionSeverity.low


def should_flag(ping_count: int, threshold: int = _THRESHOLD) -> bool:
    """Return True when W1 threshold is crossed."""
    return ping_count >= threshold


def should_confirm(ping_count: int, threshold: int = _THRESHOLD) -> bool:
    """Return True when W2 revalidation confirms congestion."""
    return ping_count >= threshold


def should_clear(ping_count: int, threshold: int = _THRESHOLD) -> bool:
    """Return True when W2 revalidation clears the flag (≤ 20 pings / 40% of threshold)."""
    return ping_count <= int(threshold * _CLEAR_RATIO)
