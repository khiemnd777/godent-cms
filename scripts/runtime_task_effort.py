#!/usr/bin/env python3
"""Bind matrix effort to a Codex CLI run or check runtime-written turn metadata."""
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

from route_task_effort import POLICY_PATH, resolve_effort

ROOT = Path(__file__).resolve().parents[1]


def read_runtime(path, expected_cwd=ROOT, expected_thread=None):
    """Read whitelisted metadata only; ignore messages, prompts and tool output."""
    meta = None
    contexts = []
    with Path(path).open() as handle:
        for line in handle:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            payload = row.get("payload", {})
            if row.get("type") == "session_meta":
                source = payload.get("source")
                spawn = source.get("subagent", {}).get("thread_spawn", {}) if isinstance(source, dict) else {}
                meta = {
                    "thread_id": payload.get("id"), "cli_version": payload.get("cli_version"),
                    "cwd": payload.get("cwd"), "role": payload.get("agent_role"),
                    "parent_thread_id": spawn.get("parent_thread_id"),
                    "source_kind": "subagent" if spawn else source if isinstance(source, str) else "other",
                }
            elif row.get("type") == "turn_context":
                contexts.append({
                    "turn_id": payload.get("turn_id"), "timestamp": row.get("timestamp"),
                    "model": payload.get("model"), "effort": payload.get("effort"),
                    "cwd": payload.get("cwd"),
                })
    if not meta or not contexts:
        raise ValueError("No runtime session/turn metadata; effort remains Unknown")
    current = contexts[-1]
    if expected_thread and meta["thread_id"] != expected_thread:
        raise ValueError("Wrong runtime thread identity")
    if Path(meta["cwd"] or "").resolve() != Path(expected_cwd).resolve():
        raise ValueError("Wrong runtime session workspace")
    if Path(current["cwd"] or "").resolve() != Path(expected_cwd).resolve():
        raise ValueError("Wrong runtime turn workspace")
    return {**meta, **current, "evidence_kind": "runtime_written_turn_context"}


def compare_runtime(route, observed, expected_model=None, expected_role=None, expected_parent=None):
    errors = []
    if route["role"] != "coordinator" and not all((expected_model, expected_role, expected_parent)):
        errors.append("Child verification requires the expected parent, native role and selected model")
    if route["role"] == "coordinator" and (observed.get("role") or observed.get("parent_thread_id")):
        errors.append("A child context cannot verify the coordinator")
    required = route["required_effort"]
    if not observed.get("model") or not observed.get("effort"):
        errors.append("Missing model/effort observation")
    if required and observed.get("effort") != required:
        errors.append("Required effort does not equal recorded runtime effort")
    if expected_model and observed.get("model") != expected_model:
        errors.append("Recorded model differs from the selected parent model")
    if expected_role and observed.get("role") != expected_role:
        errors.append("Recorded native role differs from the requested role")
    if expected_parent and observed.get("parent_thread_id") != expected_parent:
        errors.append("Recorded child belongs to another parent")
    return {
        "status": "FAIL" if errors else "PASS", "required_effort": required,
        "observed": observed, "errors": errors,
        "limit": "Recorded runtime configuration; not an internal reasoning trace or quality guarantee",
    }


def execution_command(route, model, cwd=ROOT):
    if route["role"] != "coordinator":
        raise ValueError("CLI exec starts a coordinator; use native spawn for a real child")
    if route["support_status"] == "UNSUPPORTED":
        raise ValueError("Required effort unsupported; no execution or downgrade")
    if not model:
        raise ValueError("A runtime-observed parent model is required; no model substitution")
    command = ["codex", "exec", "--json", "-C", str(cwd), "-m", model]
    if route["required_effort"]:
        command += ["-c", 'model_reasoning_effort="' + route["required_effort"] + '"']
    command += ["-"]
    return command


def locate_runtime(thread_id):
    if not thread_id or any(c not in "0123456789abcdef-" for c in thread_id):
        raise ValueError("Invalid runtime thread ID")
    sessions = Path.home() / ".codex" / "sessions"
    matches = list(sessions.glob("**/*" + thread_id + ".jsonl"))
    if len(matches) != 1:
        raise ValueError("Runtime log unavailable or ambiguous; no observed-effort claim")
    return matches[0]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--task-type", action="append", default=[])
    parser.add_argument("--risk", action="append", default=[])
    parser.add_argument("--role", choices=["coordinator", "explorer", "implementer", "reviewer"], default="coordinator")
    parser.add_argument("--unclassified-reason")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--session-log", type=Path, help="Runtime log; only metadata is read")
    source.add_argument("--current-session", action="store_true", help="Locate CODEX_THREAD_ID runtime metadata")
    parser.add_argument("--expected-thread", default=os.environ.get("CODEX_THREAD_ID"))
    parser.add_argument("--expected-model")
    parser.add_argument("--expected-parent")
    parser.add_argument("--execute", action="store_true", help="Explicitly launch an approved coordinator task")
    parser.add_argument("--prompt-file", type=Path)
    parser.add_argument("--timeout", type=int, default=180)
    args = parser.parse_args()
    try:
        policy = json.loads(POLICY_PATH.read_text())
        route = resolve_effort(policy, args.task_type, args.risk, args.role,
                               unclassified_reason=args.unclassified_reason)
        session_log = locate_runtime(os.environ.get("CODEX_THREAD_ID")) if args.current_session else args.session_log
        observed = read_runtime(session_log, expected_thread=args.expected_thread)
        if not args.execute:
            result = compare_runtime(route, observed, args.expected_model,
                                     policy["roles"][args.role], args.expected_parent)
        else:
            if args.role != "coordinator" or not args.prompt_file:
                raise ValueError("Execution requires coordinator role and --prompt-file")
            if not 1 <= args.timeout <= 600:
                raise ValueError("Timeout must be between 1 and 600 seconds")
            command = execution_command(route, observed["model"])
            # Native CLI controls remain in force. No shell, profile, permission bypass,
            # automatic install, global config write or prompt-as-setting mechanism.
            completed = subprocess.run(command, input=args.prompt_file.read_text(), cwd=ROOT,
                                       text=True, capture_output=True, timeout=args.timeout)
            if completed.returncode:
                result = {"status": "FAIL", "stage": "native_execution", "exit_code": completed.returncode,
                          "required_effort": route["required_effort"],
                          "observed": None, "limit": "Native run failed; no fallback or success claim"}
            else:
                events = []
                for line in completed.stdout.splitlines():
                    try:
                        events.append(json.loads(line))
                    except ValueError:
                        continue
                thread_ids = [event.get("thread_id") for event in events if event.get("type") == "thread.started"]
                if len(thread_ids) != 1:
                    raise ValueError("Native execution did not identify exactly one coordinator thread")
                actual = read_runtime(locate_runtime(thread_ids[0]), expected_thread=thread_ids[0])
                result = compare_runtime(route, actual, expected_model=observed["model"])
                result["dispatch"] = {"model": observed["model"], "required_effort": route["required_effort"],
                                      "mechanism": "codex exec per-process config override",
                                      "global_settings_changed": False}
        result["route"] = {key: route[key] for key in
                           ("policy_id", "task_types", "risk_signals", "routing", "fallback_reason", "role")}
        result["policy_sha256"] = hashlib.sha256(POLICY_PATH.read_bytes()).hexdigest()
        print(json.dumps(result, indent=2))
        return 0 if result["status"] == "PASS" else 3
    except subprocess.TimeoutExpired:
        print(json.dumps({"status": "FAIL", "stage": "timeout", "observed": None,
                          "limit": "Owned native process timed out; descendant status Unknown; no success/fallback claim"}))
        return 3
    except (OSError, KeyError, TypeError, ValueError) as error:
        print(json.dumps({"status": "FAIL", "error": str(error), "observed": None}))
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
