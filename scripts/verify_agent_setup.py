#!/usr/bin/env python3
"""Read-only, standard-library verification of godent-cms Agent Kit adoption."""
import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
PIN = "919ce6b8d84c8ac5ad4ce473ad6e6c2c9973d2ac"
ERRORS = []


def check(condition, message):
    if not condition:
        ERRORS.append(message)


def scoped(name, directory=False):
    rel = Path(name)
    path = ROOT / rel
    safe = (
        not rel.is_absolute()
        and ".." not in rel.parts
        and ".git" not in rel.parts
        and path.resolve().is_relative_to(ROOT)
        and not any((ROOT / Path(*rel.parts[:i])).is_symlink()
                    for i in range(1, len(rel.parts) + 1))
    )
    check(safe, "Unsafe path: " + str(name))
    check(path.is_dir() if directory else path.is_file(), "Missing path: " + str(name))
    return path if safe and (path.is_dir() if directory else path.is_file()) else None


def digest(data):
    return hashlib.sha256(data).hexdigest()


def git_blob(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def frontmatter(path):
    """Parse the plain scalar frontmatter used by the pinned package, not general YAML."""
    match = re.match(r"\A---\n(.*?)\n---(?:\n|$)", path.read_text(), re.S)
    check(match is not None, "Missing frontmatter: " + str(path.relative_to(ROOT)))
    if not match:
        return {}
    values = {}
    for line in match[1].splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        pair = re.fullmatch(r"([A-Za-z_][\w-]*):[ \t]*(.+)", line)
        if not pair:
            ERRORS.append("Unsupported frontmatter syntax: " + str(path.relative_to(ROOT)))
            continue
        key, value = pair.groups()
        check(key not in values, "Duplicate frontmatter key: " + str(path.relative_to(ROOT)))
        check(value not in {"|", ">", "|-", ">-"} and not value.startswith(("&", "*", "!")),
              "Expected pinned scalar frontmatter: " + str(path.relative_to(ROOT)))
        values[key] = value.strip().strip('"').strip("'")
    return values


def unfenced(text):
    output = []
    fence = None
    for line in text.splitlines():
        found = re.match(r"^\s{0,3}(`{3,}|~{3,})", line)
        if found:
            mark = found.group(1)
            if fence is None:
                fence = (mark[0], len(mark))
            elif mark[0] == fence[0] and len(mark) >= fence[1]:
                fence = None
            continue
        if fence is None:
            output.append(line)
    return "\n".join(output)


def heading_anchors(text):
    anchors = set()
    counts = {}
    for line in unfenced(text).splitlines():
        match = re.match(r"^#{1,6}\s+(.+?)(?:\s+#+)?$", line)
        if match:
            label = re.sub(r"\[([^]]+)\]\([^)]+\)", r"\1", match[1]).lower()
            slug = re.sub(r"[^\w\-\s]", "", label).replace(" ", "-")
            count = counts.get(slug, 0)
            counts[slug] = count + 1
            anchors.add(slug if count == 0 else slug + "-" + str(count))
    anchors.update(re.findall(r'<a\s+(?:id|name)=["\x27]([^"\x27]+)', text))
    return anchors


def verify(setup_only=False):
    check(Path.cwd().resolve() == ROOT, "Run from the repository root")
    manifest = json.loads((ROOT / "docs/skills-manifest.json").read_text())
    baseline = json.loads((ROOT / "docs/agent-kit/upstream-skills-manifest.json").read_text())
    source = json.loads((ROOT / "docs/agent-kit/template-source.json").read_text())
    check(source["commit"] == PIN, "Template source commit mismatch")
    check(git_blob((ROOT / "docs/agent-kit/upstream-skills-manifest.json").read_bytes())
          == source["manifest_git_blob_sha"], "Upstream manifest snapshot changed")
    check(manifest["project_adoption"]["template_commit"] == PIN, "Adoption pin mismatch")
    check(manifest["project_adoption"]["approval"] == "GCMS-SETUP-001 v2", "Approval mismatch")
    baseline_files = {item["path"]: item for item in baseline["files"]}
    check(len(baseline_files) == 81, "Unexpected pinned template inventory")
    check({i["path"] for i in manifest["files"]} == set(baseline_files),
          "Maintained kit file inventory changed")
    changed = []
    upstream = []
    for item in manifest["files"]:
        name = item["path"]
        path = scoped(name)
        if path is None:
            continue
        data = path.read_bytes()
        original = baseline_files[name]
        check(digest(data) == item["sha256"], "Hash mismatch: " + name)
        check(item.get("origin") == original.get("origin"), "Origin changed: " + name)
        check(item.get("adaptation") == original.get("adaptation"), "Upstream adaptation changed: " + name)
        modified = item["sha256"] != original["sha256"]
        if modified:
            changed.append(name)
            adaptation = item.get("project_adaptation", {})
            check(adaptation.get("template_sha256") == original["sha256"],
                  "Missing template digest: " + name)
            check(adaptation.get("source_commit") == PIN and adaptation.get("reason"),
                  "Missing local adaptation provenance: " + name)
            scoped(adaptation.get("record", ""))
        else:
            check(git_blob(data) == source["files"][name]["git_blob_sha"],
                  "Template Git blob mismatch: " + name)
        origin = item.get("origin", {})
        if origin.get("repository") == manifest["upstream"]["repository"]:
            check(origin.get("commit") == manifest["upstream"]["commit"], "Upstream pin: " + name)
            if item.get("adaptation") is None:
                check(git_blob(data) == origin.get("git_blob_sha"), "Unmarked upstream change: " + name)
            else:
                scoped(item["adaptation"].get("record", ""))
                check(item["adaptation"].get("source") and item["adaptation"].get("reason"),
                      "Incomplete upstream adaptation: " + name)
            if name.startswith(".agents/"):
                upstream.append(item)
    check(set(changed) == set(manifest["project_adoption"]["adapted_paths"]), "Adaptation inventory mismatch")
    adapted = sum("adaptation" in item for item in upstream)
    check(len(upstream) == manifest["upstream"]["file_count"], "Upstream count mismatch")
    check(adapted == manifest["upstream"]["adapted_file_count"], "Adapted upstream count mismatch")
    check(len(upstream) - adapted == manifest["upstream"]["unchanged_file_count"], "Original upstream count mismatch")
    check(manifest["mirror_pairs"] == baseline["mirror_pairs"], "Pinned mirror inventory changed")
    by_path = {i["path"]: i for i in manifest["files"]}
    for pair in manifest["mirror_pairs"]:
        canonical, mirror = scoped(pair["canonical"]), scoped(pair["mirror"])
        if canonical and mirror:
            check(canonical.read_bytes() == mirror.read_bytes(), "Mirror bytes: " + pair["mirror"])
            check(digest(canonical.read_bytes()) == pair["sha256"], "Mirror digest: " + pair["canonical"])
            check(by_path[pair["canonical"]].get("origin") == by_path[pair["mirror"]].get("origin"),
                  "Mirror origin: " + pair["mirror"])
            check(by_path[pair["canonical"]].get("adaptation") == by_path[pair["mirror"]].get("adaptation"),
                  "Mirror adaptation: " + pair["mirror"])
    expected_skills = {item["name"] for item in manifest["skills"]}
    check(len(expected_skills) == 17, "Expected 17 logical skills")
    for folder in (".agents/skills", ".claude/skills"):
        skill_paths = sorted((ROOT / folder).glob("*/SKILL.md"))
        check({p.parent.name for p in skill_paths} == expected_skills, "Skill inventory: " + folder)
        for path in skill_paths:
            values = frontmatter(path)
            check(values.get("name") == path.parent.name and bool(values.get("description")),
                  "Skill metadata: " + str(path.relative_to(ROOT)))
    expected_agents = {"kit-explorer", "kit-implementer", "kit-reviewer"}
    check({p.stem for p in (ROOT / ".codex/agents").glob("*.toml")} == expected_agents,
          "Codex adapter inventory")
    check({p.stem for p in (ROOT / ".claude/agents").glob("*.md")} == expected_agents,
          "Claude adapter inventory")
    for role in manifest["native_agents"]:
        codex = tomllib.loads((ROOT / role["codex"]).read_text())
        claude = frontmatter(ROOT / role["claude"])
        check(codex.get("name") == role["name"] and codex.get("description")
              and codex.get("developer_instructions"), "Codex adapter fields: " + role["name"])
        check(claude.get("name") == role["name"] and claude.get("description"),
              "Claude adapter fields: " + role["name"])
        check(not {"model", "model_reasoning_effort", "sandbox_mode"} & set(codex),
              "Unexpected Codex runtime override: " + role["name"])
        check(claude.get("model", "inherit") == "inherit", "Unexpected Claude model pin: " + role["name"])
        check(not {"tools", "disallowedTools", "permissionMode"} & set(claude),
              "Unexpected Claude runtime override: " + role["name"])
        scoped(role["role_source"])
    links = 0
    markdown_paths = {ROOT / item["path"] for item in manifest["files"] if item["path"].endswith(".md")}
    markdown_paths.update((ROOT / "docs").rglob("*.md"))
    markdowns = sorted(markdown_paths)
    anchor_cache = {}
    for path in markdowns:
        text = path.read_text()
        check(not any(line.rstrip() != line for line in text.splitlines()),
              "Trailing whitespace: " + str(path.relative_to(ROOT)))
        check(text.endswith("\n"), "Missing final newline: " + str(path.relative_to(ROOT)))
        for target in re.findall(r"!?\[[^\]\n]*\]\(([^\s)]+)(?:\s+[^)]*)?\)", unfenced(text)):
            parsed = urlsplit(target.strip("<>"))
            if parsed.scheme or parsed.netloc:
                continue
            relative = unquote(parsed.path)
            resolved = (path.parent / relative).resolve() if relative else path
            check(resolved.is_relative_to(ROOT), "Link leaves repository: " + str(path) + " -> " + target)
            check(resolved.exists(), "Broken link: " + str(path.relative_to(ROOT)) + " -> " + target)
            if parsed.fragment and resolved.is_file() and resolved.suffix == ".md":
                if resolved not in anchor_cache:
                    anchor_cache[resolved] = heading_anchors(resolved.read_text())
                check(unquote(parsed.fragment) in anchor_cache[resolved],
                      "Broken anchor: " + str(path.relative_to(ROOT)) + " -> " + target)
            links += 1
    active_tasks = sorted(p.name for p in (ROOT / "docs/tasks").glob("*.md") if p.name != "README.md")
    if setup_only:
        check(active_tasks == ["GCMS-SETUP-001.md"], "Unexpected inherited/active task records")
    task = (ROOT / "docs/tasks/GCMS-SETUP-001.md").read_text()
    check("Approved GCMS-SETUP-001 v2." in task and "chưa triển khai ứng dụng" in task,
          "Missing direct approval or latest restriction")
    for name in ("docs/project-context.md", "docs/project-plan.md", "docs/project-state.md", "README.md"):
        check("Bun" in (ROOT / name).read_text() or name == "docs/project-plan.md",
              "Missing Bun baseline: " + name)
    if setup_only:
        for name in ("package.json", "bun.lock", "bun.lockb", "pnpm-lock.yaml", "package-lock.json",
                     "yarn.lock", "node_modules", "apps", "packages", "src", "migrations", "docker-compose.yml"):
            check(not (ROOT / name).exists(), "Application artifact outside setup: " + name)
    for root_name in (".agents", ".claude", ".codex"):
        for path in (ROOT / root_name).rglob("*"):
            if path.is_file():
                check(str(path.relative_to(ROOT)) in by_path, "Uninventoried agent file: " + str(path.relative_to(ROOT)))
    all_files = [p for p in ROOT.rglob("*") if p.is_file() and ".git" not in p.relative_to(ROOT).parts] if setup_only else []
    for path in all_files:
        rel = path.relative_to(ROOT)
        check(not path.is_symlink(), "Symlink in setup: " + str(rel))
        check(not rel.name.startswith(".env") and not rel.name.endswith((".pem", ".key")),
              "Unexpected credential/config artifact: " + str(rel))
        check(path.suffix not in {".ts", ".tsx", ".js", ".jsx", ".sql", ".sh"},
              "Unexpected application/executable source: " + str(rel))
    branch = subprocess.run(["git", "symbolic-ref", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    if setup_only:
        check(branch.returncode == 0 and branch.stdout.strip() == "main", "Expected fresh main")
    revision = subprocess.run(["git", "rev-parse", "--verify", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    if setup_only:
        check(revision.returncode != 0, "Setup-only task must have no commits")
    remotes = subprocess.run(["git", "remote"], cwd=ROOT, capture_output=True, text=True)
    if setup_only:
        check(remotes.returncode == 0 and not remotes.stdout.strip(), "Unexpected Git remote")
    staged = subprocess.run(["git", "diff", "--cached", "--name-only"], cwd=ROOT, capture_output=True, text=True)
    if setup_only:
        check(staged.returncode == 0 and not staged.stdout.strip(), "Unexpected staged files")
    if ERRORS:
        print("\n".join("FAIL: " + error for error in ERRORS))
        return 1
    print(f"PASS: {len(manifest['files'])} maintained kit hashes; {len(changed)} declared local adaptations")
    print(f"PASS: {len(manifest['mirror_pairs'])} mirror pairs; 17 skills per root; 3 native definitions per client")
    print(f"PASS: {len(upstream) - adapted} original / {adapted} adapted upstream canonical files")
    print(f"PASS: {len(markdowns)} Markdown files; {links} local links/anchors; plain frontmatter and TOML syntax")
    print("PASS: setup approval provenance and Bun documentation baseline")
    if setup_only:
        print("PASS: initialization boundary; no inherited task, application artifact, commit, remote or staging")
    print("LIMIT: this command checks static package integrity; it does not test native discovery, invocation or application behavior")
    return 0


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--setup-only", action="store_true", help="Also enforce the initial documentation-only scope")
        raise SystemExit(verify(parser.parse_args().setup_only))
    except (KeyError, ValueError, OSError, TypeError) as error:
        print("FAIL: " + str(error))
        raise SystemExit(1)
