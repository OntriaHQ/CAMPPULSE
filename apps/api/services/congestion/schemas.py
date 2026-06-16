"""Congestion service schemas (Level 3 domain models)."""

from enum import Enum


class CongestionStatus(str, Enum):
    """Possible states for a congestion zone."""

    normal = "normal"
    flagged = "flagged"
    congested = "congested"
    anticipated = "anticipated"


class CongestionSeverity(str, Enum):
    """Severity levels based on ping ratio vs threshold."""

    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"
