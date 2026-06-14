import pytest
from services.incident.routing import (
    estimate_response_window,
    is_valid_transition,
    resolve_department,
)


class TestDepartmentRouting:
    @pytest.mark.parametrize("incident_type,expected_dept", [
        ("flooding", "infrastructure"),
        ("pothole", "infrastructure"),
        ("streetlight", "utilities"),
        ("water_leak", "utilities"),
        ("trash", "sanitation"),
        ("security", "security"),
        ("congestion", "infrastructure"),
        ("other", "infrastructure"),
    ])
    def test_routing_is_exhaustive(self, incident_type, expected_dept):
        assert resolve_department(incident_type) == expected_dept

    def test_unknown_type_falls_back_to_infrastructure(self):
        assert resolve_department("unknown_type") == "infrastructure"


class TestStatusTransitions:
    @pytest.mark.parametrize("current,next_status,valid", [
        ("submitted", "assigned", True),
        ("assigned", "in_progress", True),
        ("in_progress", "resolved", True),
        ("resolved", "closed", True),
        ("submitted", "resolved", False),
        ("submitted", "closed", False),
        ("resolved", "submitted", False),
        ("closed", "resolved", False),
        ("in_progress", "submitted", False),
        ("assigned", "submitted", False),
    ])
    def test_transition_validity(self, current, next_status, valid):
        assert is_valid_transition(current, next_status) == valid


class TestResponseWindowEstimation:
    def test_critical_security_is_fastest(self):
        window = estimate_response_window("critical", "security")
        assert "15" in window or "30" in window

    def test_low_sanitation_is_slowest(self):
        window = estimate_response_window("low", "sanitation")
        assert "day" in window

    def test_returns_string_for_all_valid_combinations(self):
        severities = ["low", "medium", "high", "critical"]
        departments = ["infrastructure", "sanitation", "security", "utilities", "emergency"]
        for s in severities:
            for d in departments:
                result = estimate_response_window(s, d)
                assert isinstance(result, str)
                assert len(result) > 0

    def test_unknown_combo_returns_default(self):
        result = estimate_response_window("low", "emergency")
        assert "2" in result
