DEPARTMENT_ROUTING = {
    "flooding": "infrastructure",
    "pothole": "infrastructure",
    "streetlight": "utilities",
    "water_leak": "utilities",
    "trash": "sanitation",
    "security": "security",
    "congestion": "infrastructure",
    "other": "infrastructure",
}

VALID_STATUS_TRANSITIONS = {
    "submitted": ["assigned"],
    "assigned": ["in_progress"],
    "in_progress": ["resolved"],
    "resolved": ["closed"],
}

RESPONSE_WINDOWS = {
    ("critical", "security"): "15\u201330 minutes",
    ("critical", "infrastructure"): "30\u201360 minutes",
    ("critical", "utilities"): "1\u20132 hours",
    ("critical", "emergency"): "15\u201330 minutes",
    ("high", "infrastructure"): "1\u20132 hours",
    ("high", "utilities"): "2\u20134 hours",
    ("high", "security"): "30\u201360 minutes",
    ("medium", "sanitation"): "4\u20138 hours",
    ("low", "sanitation"): "1\u20132 days",
}


def resolve_department(incident_type: str) -> str:
    return DEPARTMENT_ROUTING.get(incident_type, "infrastructure")


def is_valid_transition(current_status: str, next_status: str) -> bool:
    return next_status in VALID_STATUS_TRANSITIONS.get(current_status, [])


def estimate_response_window(severity: str, department: str) -> str:
    return RESPONSE_WINDOWS.get((severity, department), "2\u20134 hours")
