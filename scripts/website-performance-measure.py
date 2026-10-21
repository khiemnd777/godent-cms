"""Bounded public-only server timing probes; no authentication or write requests."""
import hashlib
import json
import statistics
import sys
import time
import urllib.request
from pathlib import Path

phase = sys.argv[1] if len(sys.argv) == 2 else ""
if phase not in ("before", "after", "after-idle", "home-before", "home-after"):
    raise SystemExit("Use before, after, after-idle, home-before or home-after")
routes = [
    ("home_vi", "http://localhost:5892/lac-van"),
    ("home_en", "http://localhost:5892/lac-van/en"),
    ("doctors_vi", "http://localhost:5892/lac-van/bac-si"),
    ("doctors_en", "http://localhost:5892/lac-van/en/bac-si"),
    ("home_api", "http://127.0.0.1:5890/api/public/builder/lac-van/vi/home/home"),
    ("doctors_api", "http://127.0.0.1:5890/api/public/builder/lac-van/vi/doctor"),
]
report = {"phase": phase, "recordedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "routes": {}}
for label, url in routes:
    samples = []
    for _ in range(5 if phase.startswith("home-") else 3):
        start = time.perf_counter()
        with urllib.request.urlopen(url, timeout=30) as response:
            headers_at = time.perf_counter()
            body = response.read()
            samples.append({"status": response.status, "headersMs": round((headers_at - start) * 1000, 2), "totalMs": round((time.perf_counter() - start) * 1000, 2), "bytes": len(body), "cacheControl": response.headers.get("Cache-Control"), **({"jsonSha256": hashlib.sha256(json.dumps(json.loads(body), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()).hexdigest()} if label.endswith("api") else {})})
    report["routes"][label] = {"url": url, "samples": samples, "medianMs": statistics.median(s["totalMs"] for s in samples)}
    print(label, report["routes"][label]["medianMs"], flush=True)
destination = Path("docs/evidence/website-performance") / (phase + ".json")
with destination.open("x") as output:
    json.dump(report, output, indent=2)
    output.write("\n")
