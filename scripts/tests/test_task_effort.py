"""Routing regression checks; no native agents, settings, fixtures or application services."""
import importlib.util
import json
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location("route_task_effort", ROOT / "scripts/route_task_effort.py")
ROUTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ROUTER)
POLICY = json.loads((ROOT / "docs/task-effort-policy.json").read_text())


class RoutingTests(unittest.TestCase):
    def route(self, types, **kwargs):
        return ROUTER.resolve_effort(POLICY, types, **kwargs)

    def test_user_matrix_base_levels_and_disambiguated_ranges(self):
        expected = {
            "agent-kit-analysis": "high", "cms-requirements-analysis": "high",
            "multi-tenant-architecture": "xhigh", "tenant-rbac-security-review": "xhigh",
            "tech-stack-selection": "high", "architecture-review": "xhigh",
            "template-initialization": "medium", "agent-artifact-generation": "medium",
            "agent-policy-design": "high", "implementation": "medium", "test-development": "medium",
            "complex-debugging": "high", "critical-debugging": "xhigh",
            "final-architecture-security-audit": "xhigh",
        }
        self.assertEqual(set(expected), set(POLICY["task_types"]))
        for task_type, effort in expected.items():
            with self.subTest(task_type=task_type):
                result = self.route([task_type])
                self.assertEqual(effort, result["required_effort"])
                self.assertEqual("PROJECT_MATRIX", result["routing"])
                self.assertIsNone(result["fallback"])

    def test_tenant_and_rbac_implementation_are_not_routine_medium(self):
        for risk in ("tenant-isolation", "authorization", "security-boundary", "sensitive-data",
                     "publication-integrity", "transaction-concurrency", "irreversible-data-change"):
            with self.subTest(risk=risk):
                result = self.route(["implementation"], risks=[risk])
                self.assertEqual("xhigh", result["required_effort"])
                self.assertIsNone(result["fallback"])

    def test_integration_tests_for_rls_and_concurrency_are_xhigh(self):
        result = self.route(["test-development"], risks=["transaction-concurrency", "tenant-isolation"])
        self.assertEqual("xhigh", result["required_effort"])

    def test_runtime_compatibility_and_shared_contract_raise_medium_to_high(self):
        for risk in ("bun-runtime-compatibility", "shared-contract"):
            self.assertEqual("high", self.route(["implementation"], risks=[risk])["required_effort"])

    def test_mixed_task_uses_highest_required_effort(self):
        result = self.route(["template-initialization", "multi-tenant-architecture", "unknown"])
        self.assertEqual("xhigh", result["required_effort"])
        self.assertEqual(["unknown"], result["unclassified_types"])
        self.assertIsNone(result["fallback"])

    def test_fallback_only_when_both_category_and_risk_are_unmatched(self):
        for types in ([], ["unknown"]):
            result = self.route(types, unclassified_reason="Inspected scope; no category/risk matches")
            self.assertEqual("GENERAL_FALLBACK", result["routing"])
            self.assertIsNone(result["required_effort"])
            self.assertEqual("inherit", result["fallback"]["mode"])
            self.assertEqual("Inspected scope; no category/risk matches", result["fallback_reason"])
        self.assertEqual("xhigh", self.route(["unknown"], risks=["tenant-isolation"])["required_effort"])

    def test_invalid_risk_is_not_silently_dropped(self):
        with self.assertRaises(ValueError):
            self.route(["implementation"], risks=["typo-security-risk"])

    def test_fallback_requires_a_recorded_classification_reason(self):
        for reason in (None, "", "   "):
            with self.subTest(reason=reason), self.assertRaises(ValueError):
                self.route(["unknown"], unclassified_reason=reason)

    def test_explicit_effort_dispatch_keeps_model_and_permissions_unset(self):
        result = self.route(["architecture-review"], role="reviewer")
        self.assertEqual({"agent_type": "kit-reviewer", "fork_turns": "none", "reasoning_effort": "xhigh"},
                         result["spawn_arguments"])
        self.assertNotIn("model", result["spawn_arguments"])
        self.assertFalse(result["runtime_settings_changed"])
        self.assertFalse(result["agent_spawned"])
        self.assertEqual("Unknown", result["observed_effort"])

    def test_coordinator_setting_is_requested_not_claimed_applied(self):
        result = self.route(["cms-requirements-analysis"])
        self.assertEqual("high", result["coordinator_setting"])
        self.assertIsNone(result["spawn_arguments"])
        self.assertFalse(result["runtime_settings_changed"])

    def test_fallback_dispatch_omits_effort_override(self):
        result = self.route(["unknown"], role="explorer", unclassified_reason="Inspected scope; unmatched")
        self.assertEqual({"agent_type": "kit-explorer", "fork_turns": "none"}, result["spawn_arguments"])

    def test_unsupported_xhigh_does_not_downgrade_or_fallback(self):
        result = self.route(["architecture-review"], supported_efforts=["medium", "high"])
        self.assertEqual("UNSUPPORTED", result["support_status"])
        self.assertEqual("xhigh", result["required_effort"])
        self.assertFalse(result["dispatch_allowed_by_effort"])
        self.assertIsNone(result["fallback"])

    def test_role_does_not_determine_effort(self):
        for role in POLICY["roles"]:
            for task_type, effort in (("template-initialization", "medium"), ("architecture-review", "xhigh")):
                self.assertEqual(effort, self.route([task_type], role=role)["required_effort"])


if __name__ == "__main__":
    unittest.main()
