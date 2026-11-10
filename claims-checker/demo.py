import argparse
import importlib.util
import inspect
import json
import linecache
import sys
import time
import traceback
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlsplit

import claims_checker


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data" / "sample_claims.csv"
WEB = ROOT / "web"
ASSETS = {
    "/": ("home.html", "text/html; charset=utf-8"),
    "/lab": ("index.html", "text/html; charset=utf-8"),
    "/lab/": ("index.html", "text/html; charset=utf-8"),
    "/styles.css": ("styles.css", "text/css; charset=utf-8"),
    "/home.css": ("home.css", "text/css; charset=utf-8"),
    "/ui.js": ("ui.js", "text/javascript; charset=utf-8"),
    "/api.js": ("api.js", "text/javascript; charset=utf-8"),
    "/app.js": ("app.js", "text/javascript; charset=utf-8"),
    "/home.js": ("home.js", "text/javascript; charset=utf-8"),
}
sys.dont_write_bytecode = True


def load_backend():
    modules = []
    for name in ("validators", "report"):
        full_name = f"claims_checker.{name}"
        path = ROOT / "claims_checker" / f"{name}.py"
        spec = importlib.util.spec_from_file_location(full_name, path)
        if spec is None:
            raise ImportError(f"Could not load Python source from {path}")
        module = importlib.util.module_from_spec(spec)
        # Read saved source directly so rapid, same-size edits bypass bytecode caches.
        exec(compile(path.read_text(encoding="utf-8-sig"), str(path), "exec"), module.__dict__)
        sys.modules[full_name] = module
        setattr(claims_checker, name, module)
        modules.append(module)
    linecache.clearcache()
    return modules


def source_snapshot(modules):
    sources = {}
    for module in modules:
        for name, function in inspect.getmembers(module, inspect.isfunction):
            if function.__module__ != module.__name__:
                continue
            lines, start = inspect.getsourcelines(function)
            sources[name] = {
                "file": str(Path(module.__file__).relative_to(ROOT)),
                "line": start,
                "code": "".join(lines).rstrip(),
            }
    return sources


def observe_validation(module, row):
    checks = []
    active = {}

    def trace(frame, event, value):
        if frame.f_code.co_filename != module.__file__:
            return None
        if not frame.f_code.co_name.startswith("is_valid_"):
            return None
        frame.f_trace_lines = False
        if event == "call":
            names = frame.f_code.co_varnames[:frame.f_code.co_argcount]
            check = {
                "function": frame.f_code.co_name,
                "inputs": {name: repr(frame.f_locals[name]) for name in names},
                "returned": None,
                "passed": None,
                "error": None,
            }
            checks.append(check)
            active[id(frame)] = (check, time.perf_counter())
        elif id(frame) in active:
            check, started = active[id(frame)]
            if event == "exception":
                check["error"] = f"{value[0].__name__}: {value[1]}"
            elif event == "return":
                check["returned"] = repr(value)
                check["passed"] = value if isinstance(value, bool) else None
                check["duration_ms"] = round((time.perf_counter() - started) * 1000, 3)
                if value is not None:
                    check["error"] = None
                del active[id(frame)]
        return trace

    previous_trace = sys.gettrace()
    try:
        sys.settrace(trace)
        problems = module.validate_claim(row)
    finally:
        sys.settrace(previous_trace)
    return {"claim_id": row["claim_id"], "problems": problems, "checks": checks}


def exception_details(error):
    frames = []
    claim_id = None
    current = error.__traceback__
    while current is not None:
        frame = current.tb_frame
        path = Path(frame.f_code.co_filename)
        if path.is_relative_to(ROOT):
            frames.append({
                "file": str(path.relative_to(ROOT)),
                "function": frame.f_code.co_name,
                "line": current.tb_lineno,
                "code": linecache.getline(str(path), current.tb_lineno).strip(),
            })
            for name in ("claim", "row"):
                row = frame.f_locals.get(name)
                if isinstance(row, dict) and "claim_id" in row:
                    claim_id = row["claim_id"]
        current = current.tb_next
    return {
        "type": type(error).__name__,
        "message": str(error),
        "frames": frames,
        "claim_id": claim_id,
        "traceback": "".join(traceback.format_exception(type(error), error, error.__traceback__)),
    }


def run_snapshot(validate):
    started = time.perf_counter()
    result = {
        "kind": "claims-lab-run",
        "status": "ready",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "claims": [],
        "evaluations": [],
        "sources": {},
        "summary": None,
        "error": None,
        "events": [],
        "stages": [
            {"id": "load", "name": "Read CSV", "function": "load_claims", "status": "waiting"},
            {"id": "validate", "name": "Validate claims", "function": "validate_claim", "status": "waiting"},
            {"id": "report", "name": "Build summary", "function": "summarize", "status": "waiting"},
        ],
    }

    def record(stage, level, function, message, claim_id=None):
        result["events"].append({
            "stage": stage,
            "level": level,
            "function": function,
            "message": message,
            "claim_id": claim_id,
            "offset_ms": round((time.perf_counter() - started) * 1000, 3),
        })

    stage = result["stages"][0]
    try:
        validators, report = load_backend()
        result["sources"] = source_snapshot((validators, report))
        claims = report.load_claims(DATA)
        result["claims"] = claims
        stage["status"] = "complete"
        record("load", "success", "load_claims", f"Read {len(claims)} rows from sample_claims.csv")

        if validate:
            stage = result["stages"][1]
            record("validate", "info", "validate_claim", "Calling validate_claim for each CSV row")
            for row in claims:
                evaluation = observe_validation(validators, row)
                result["evaluations"].append(evaluation)
                count = len(evaluation["problems"])
                record(
                    "validate", "warning" if count else "success", "validate_claim",
                    f"{row['claim_id']} returned {count} problem(s)", row["claim_id"],
                )
            stage["status"] = "complete"
            stage = result["stages"][2]
            record("report", "info", "summarize", "Calling the real summarize function")
            result["summary"] = report.summarize(claims)
            stage["status"] = "complete"
            result["status"] = "complete"
            record("report", "success", "summarize", "Summary returned successfully")
        status = HTTPStatus.OK
    except Exception as error:
        traceback.print_exc()
        stage["status"] = "failed"
        result["status"] = "failed"
        result["error"] = exception_details(error)
        function = result["error"]["frames"][-1]["function"] if result["error"]["frames"] else stage["function"]
        record(
            stage["id"], "error", function,
            f"{type(error).__name__}: {error}", result["error"]["claim_id"],
        )
        status = HTTPStatus.INTERNAL_SERVER_ERROR
    result["duration_ms"] = round((time.perf_counter() - started) * 1000, 3)
    return result, status


class DemoHandler(BaseHTTPRequestHandler):
    server_version = "ClaimsLab/1.0"

    def send_content(self, status, content, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(content)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header(
            "Content-Security-Policy",
            "default-src 'self'; script-src 'self'; style-src 'self'; "
            "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; "
            "base-uri 'none'; form-action 'none'",
        )
        self.end_headers()
        self.wfile.write(content)

    def send_json(self, status, payload):
        self.send_content(status, json.dumps(payload).encode("utf-8"), "application/json; charset=utf-8")

    def allowed_request(self):
        server = self.server
        if not isinstance(server, HTTPServer):
            raise TypeError("Claims Lab requires an HTTP server.")
        port = server.server_port
        host = self.headers.get("Host", "")
        if host not in {f"127.0.0.1:{port}", f"localhost:{port}"}:
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "Use the local Claims Lab address."})
            return False
        origin = self.headers.get("Origin")
        if origin is not None and origin != f"http://{host}":
            self.send_json(HTTPStatus.FORBIDDEN, {"error": "Cross-origin requests are not allowed."})
            return False
        return True

    def do_GET(self):
        if not self.allowed_request():
            return
        path = urlsplit(self.path).path
        if path == "/api/health":
            self.send_json(HTTPStatus.OK, {"status": "ok", "service": "claims-lab"})
        elif path == "/api/claims":
            payload, status = run_snapshot(validate=False)
            self.send_json(status, payload)
        elif path in ASSETS or path == "/sample.csv":
            if path == "/sample.csv":
                file_path, content_type = DATA, "text/csv; charset=utf-8"
            else:
                name, content_type = ASSETS[path]
                file_path = WEB / name
            try:
                content = file_path.read_bytes()
                if content_type.startswith("text/html"):
                    content = content.replace(
                        b"<!-- SITE_HEADER -->", (WEB / "header.html").read_bytes()
                    )
            except OSError as error:
                traceback.print_exc()
                self.send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
                return
            self.send_content(HTTPStatus.OK, content, content_type)
        else:
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "This demo route does not exist."})

    def do_POST(self):
        if not self.allowed_request():
            return
        if urlsplit(self.path).path != "/api/run":
            self.send_json(HTTPStatus.NOT_FOUND, {"error": "This demo route does not exist."})
        elif self.headers.get("Content-Length", "0") != "0":
            self.send_json(HTTPStatus.BAD_REQUEST, {"error": "This demo uses only the local sample CSV."})
        else:
            payload, status = run_snapshot(validate=True)
            self.send_json(status, payload)


def main():
    parser = argparse.ArgumentParser(description="Open the local Claims Lab classroom dashboard.")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    try:
        server = HTTPServer(("127.0.0.1", args.port), DemoHandler)
    except OSError as error:
        parser.exit(1, f"Could not start Claims Lab: {error}. Try a different --port.\n")
    with server:
        print(f"Claims Lab: http://127.0.0.1:{args.port}", flush=True)
        print("Local synthetic data only. Press Ctrl+C to stop.", flush=True)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nClaims Lab stopped.")


if __name__ == "__main__":
    main()
