#!/usr/bin/env python3
"""Resolve project task effort; emit dispatch intent without spawning or changing settings."""
import argparse
import json
from pathlib import Path

POLICY_PATH = Path(__file__).resolve().parents[1] / "docs/task-effort-policy.json"


def validate_policy(policy):
    order = policy["effort_order"]
    if order != ["medium", "high", "xhigh"]:
        raise ValueError("Invalid effort ordering")
    if not policy["task_types"] or any(item["effort"] not in order for item in policy["task_types"].values()):
        raise ValueError("Invalid task effort")
    if any(value not in order for value in policy["risk_floors"].values()):
        raise ValueError("Invalid risk floor")
    if policy["fallback"]["mode"] != "inherit" or policy["fallback"]["requested_effort"] is not None:
        raise ValueError("Unclassified work must use general inheritance, not a fixed default")
    if policy["roles"] != {"coordinator": None, "explorer": "kit-explorer",
                          "implementer": "kit-implementer", "reviewer": "kit-reviewer"}:
        raise ValueError("Unexpected role route")


def resolve_effort(policy, task_types, risks=(), role="coordinator", supported_efforts=None,
                   unclassified_reason=None):
    validate_policy(policy)
    if role not in policy["roles"]:
        raise ValueError("Unknown role: " + role)
    unknown_risks = sorted(set(risks) - set(policy["risk_floors"]))
    if unknown_risks:
        raise ValueError("Unknown risk signals: " + ", ".join(unknown_risks))
    if supported_efforts is not None and not set(supported_efforts) <= set(policy["effort_order"]):
        raise ValueError("Invalid supported effort values")
    matched = sorted(set(task_types) & set(policy["task_types"]))
    unknown = sorted(set(task_types) - set(policy["task_types"]))
    risk_matches = sorted(set(risks))
    candidates = [policy["task_types"][name]["effort"] for name in matched]
    candidates += [policy["risk_floors"][name] for name in risk_matches]
    required = max(candidates, key=policy["effort_order"].index) if candidates else None
    if required is None and not (unclassified_reason and unclassified_reason.strip()):
        raise ValueError("General fallback requires a recorded reason after task/risk classification")
    compatibility = ("UNSUPPORTED" if required and supported_efforts is not None
                     and required not in supported_efforts else
                     "SUPPORTED_BY_CALLER_INPUT" if required and supported_efforts is not None else "NOT_CHECKED")
    spawn = None
    if role != "coordinator":
        spawn = {"agent_type": policy["roles"][role], "fork_turns": "none"}
        if required:
            spawn["reasoning_effort"] = required
    return {
        "policy_id": policy["policy_id"],
        "task_types": matched,
        "unclassified_types": unknown,
        "risk_signals": risk_matches,
        "routing": "PROJECT_MATRIX" if required else "GENERAL_FALLBACK",
        "required_effort": required,
        "fallback": None if required else policy["fallback"],
        "fallback_reason": unclassified_reason.strip() if required is None else None,
        "role": role,
        "required_role_selector": policy["roles"][role],
        "spawn_arguments": spawn,
        "coordinator_setting": required if role == "coordinator" else None,
        "support_status": compatibility,
        "dispatch_allowed_by_effort": False if compatibility == "UNSUPPORTED" else None,
        "authority": "Must be established separately; classifier grants none",
        "observed_model": "Unknown",
        "observed_effort": "Unknown",
        "runtime_settings_changed": False,
        "agent_spawned": False,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task-type", action="append", default=[], help="Repeat for a mixed task; unknown types use fallback only if nothing else matches")
    parser.add_argument("--risk", action="append", default=[], help="Known risk signal; repeat as needed")
    parser.add_argument("--role", choices=["coordinator", "explorer", "implementer", "reviewer"], default="coordinator")
    parser.add_argument("--unclassified-reason", help="Required only when no task category/risk matches")
    parser.add_argument("--supported-effort", action="append", choices=["medium", "high", "xhigh"],
                        help="Optional verified model capability input; does not observe the runtime")
    args = parser.parse_args()
    try:
        policy = json.loads(POLICY_PATH.read_text())
        result = resolve_effort(policy, args.task_type, args.risk, args.role, args.supported_effort,
                                args.unclassified_reason)
    except (OSError, KeyError, TypeError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(result, indent=2))
    return 2 if result["support_status"] == "UNSUPPORTED" else 0


if __name__ == "__main__":
    raise SystemExit(main())
