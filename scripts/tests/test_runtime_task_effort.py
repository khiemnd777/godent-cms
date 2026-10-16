"""Runtime binding tests with synthetic metadata; real-run evidence is recorded separately."""
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import runtime_task_effort as runtime
import route_task_effort as routing

POLICY = json.loads((ROOT / "docs/task-effort-policy.json").read_text())


class RuntimeEffortTests(unittest.TestCase):
    def route(self, task_type="agent-policy-design", role="coordinator", **kwargs):
        return routing.resolve_effort(POLICY, [task_type], role=role, **kwargs)

    def observed(self, effort="high", **kwargs):
        return {"model": "selected-model", "effort": effort, "role": None,
                "parent_thread_id": None, **kwargs}

    def test_matrix_value_is_bound_to_native_command(self):
        for category, effort in (("template-initialization", "medium"),
                                 ("agent-policy-design", "high"), ("architecture-review", "xhigh")):
            command = runtime.execution_command(self.route(category), "selected-model")
            self.assertIn('model_reasoning_effort="' + effort + '"', command)
            self.assertEqual("selected-model", command[command.index("-m") + 1])
            self.assertFalse(any("bypass" in item or "ignore" in item for item in command))

    def test_fallback_command_omits_effort_override(self):
        route = self.route("unknown", unclassified_reason="Inspected and unmatched")
        command = runtime.execution_command(route, "selected-model")
        self.assertFalse(any("model_reasoning_effort" in item for item in command))

    def test_wrong_effort_fails_even_if_higher(self):
        for effort in ("medium", "xhigh", None):
            self.assertEqual("FAIL", runtime.compare_runtime(self.route(), self.observed(effort))["status"])

    def test_model_role_and_parent_identity_mismatch_fail(self):
        for kwargs in ({"expected_model": "another"}, {"expected_role": "kit-explorer"},
                       {"expected_parent": "another"}):
            self.assertEqual("FAIL", runtime.compare_runtime(self.route(), self.observed(), **kwargs)["status"])

    def test_matching_actual_child_passes(self):
        result = runtime.compare_runtime(self.route("architecture-review", "reviewer"),
                                         self.observed("xhigh", role="kit-reviewer", parent_thread_id="parent"),
                                         "selected-model", "kit-reviewer", "parent")
        self.assertEqual("PASS", result["status"])

    def test_child_context_cannot_verify_coordinator(self):
        child = self.observed(role="kit-explorer", parent_thread_id="parent")
        self.assertEqual("FAIL", runtime.compare_runtime(self.route(), child)["status"])

    def test_child_verification_requires_parent_role_and_model(self):
        route = self.route("architecture-review", "reviewer")
        child = self.observed("xhigh", role="kit-reviewer", parent_thread_id="parent")
        expected = {"expected_model": "selected-model", "expected_role": "kit-reviewer",
                    "expected_parent": "parent"}
        for omitted in expected:
            incomplete = {key: value for key, value in expected.items() if key != omitted}
            self.assertEqual("FAIL", runtime.compare_runtime(route, child, **incomplete)["status"])

    def test_cli_root_is_never_mislabeled_as_native_child(self):
        with self.assertRaises(ValueError):
            runtime.execution_command(self.route(role="explorer"), "selected-model")

    def test_missing_parent_model_or_unsupported_effort_cannot_run(self):
        with self.assertRaises(ValueError):
            runtime.execution_command(self.route(), None)
        route = self.route("architecture-review", supported_efforts=["medium", "high"])
        with self.assertRaises(ValueError):
            runtime.execution_command(route, "selected-model")

    def test_metadata_reader_ignores_prompt_and_self_report(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "runtime.jsonl"
            rows = [
                {"type":"session_meta","payload":{"id":"thread","cwd":str(ROOT),"source":"exec"}},
                {"type":"response_item","payload":{"role":"assistant","content":[{"text":"I used xhigh"}]}},
                {"type":"turn_context","payload":{"turn_id":"turn","cwd":str(ROOT),"model":"selected-model","effort":"high"}},
            ]
            path.write_text("\n".join(json.dumps(row) for row in rows)+"\n")
            actual = runtime.read_runtime(path, expected_thread="thread")
            self.assertEqual("high", actual["effort"])
            self.assertNotIn("content", actual)
            with self.assertRaises(ValueError):
                runtime.read_runtime(path, expected_thread="wrong-thread")
            with self.assertRaises(ValueError):
                runtime.read_runtime(path, expected_cwd=ROOT / "another")


if __name__ == "__main__":
    unittest.main()
