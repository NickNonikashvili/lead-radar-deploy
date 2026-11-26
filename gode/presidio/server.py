#!/usr/bin/env python3
"""Minimal Presidio Analyzer REST server for running Gode's redaction layer without Docker.

Exposes the same HTTP contract as the official presidio-analyzer image, for the parts Gode uses:

    GET  /health               -> 200 "Presidio Analyzer service is up"
    POST /analyze              {"text", "language", "score_threshold"?, "entities"?, ...}
                               -> [{"analysis_explanation", "end", "entity_type", "score", "start"}]
    GET  /supportedentities?language=en -> ["CREDIT_CARD", ...]

Standard library HTTP server + presidio_analyzer with spaCy's small English model, so it runs on a
laptop (about 200 MB of RAM, versus 1 GB+ for the large model in the Docker image).

Privacy: request bodies are personal data by definition. This server never logs them, never logs
request lines, and binds to 127.0.0.1 unless HOST says otherwise.

Environment: HOST (127.0.0.1), PORT (5002), SPACY_MODEL (en_core_web_sm), PRESIDIO_LANGUAGE (en),
MAX_BODY_BYTES (2097152).
"""

import json
import os
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from presidio_analyzer import AnalyzerEngine
from presidio_analyzer.nlp_engine import NlpEngineProvider

HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "5002"))
SPACY_MODEL = os.environ.get("SPACY_MODEL", "en_core_web_sm")
LANGUAGE = os.environ.get("PRESIDIO_LANGUAGE", "en")
MAX_BODY_BYTES = int(os.environ.get("MAX_BODY_BYTES", str(2 * 1024 * 1024)))


def build_analyzer():
    # Same entity mapping and ignore list as presidio_analyzer/conf/default.yaml. Without
    # ner_model_configuration the defaults do not ignore ORG, which produces ORGANIZATION false
    # positives (e.g. "SSN" tagged as an organisation).
    nlp_config = {
        "nlp_engine_name": "spacy",
        "models": [{"lang_code": LANGUAGE, "model_name": SPACY_MODEL}],
        "ner_model_configuration": {
            "model_to_presidio_entity_mapping": {
                "PER": "PERSON",
                "PERSON": "PERSON",
                "NORP": "NRP",
                "FAC": "LOCATION",
                "LOC": "LOCATION",
                "GPE": "LOCATION",
                "LOCATION": "LOCATION",
                "ORG": "ORGANIZATION",
                "ORGANIZATION": "ORGANIZATION",
                "DATE": "DATE_TIME",
                "TIME": "DATE_TIME",
            },
            "low_confidence_score_multiplier": 0.4,
            "low_score_entity_names": [],
            "labels_to_ignore": [
                "ORGANIZATION", "CARDINAL", "EVENT", "LANGUAGE", "LAW", "MONEY",
                "ORDINAL", "PERCENT", "PRODUCT", "QUANTITY", "WORK_OF_ART",
            ],
        },
    }
    nlp_engine = NlpEngineProvider(nlp_configuration=nlp_config).create_engine()
    return AnalyzerEngine(nlp_engine=nlp_engine, supported_languages=[LANGUAGE])


ANALYZER = build_analyzer()
# spaCy pipelines are not documented as thread-safe; serialise analysis while /health stays responsive.
ANALYZE_LOCK = threading.Lock()


def result_to_dict(r):
    # Upstream serialises RecognizerResult.__dict__ minus recognition_metadata, with sorted keys.
    explanation = r.analysis_explanation.to_dict() if r.analysis_explanation else None
    return {"analysis_explanation": explanation, "end": r.end, "entity_type": r.entity_type,
            "score": r.score, "start": r.start}


def analyze_one(text, body):
    threshold = body.get("score_threshold")
    if threshold is not None and not isinstance(threshold, (int, float)):
        threshold = None
    entities = body.get("entities")
    if entities is not None and not (isinstance(entities, list) and all(isinstance(e, str) for e in entities)):
        entities = None
    with ANALYZE_LOCK:
        results = ANALYZER.analyze(
            text=text,
            language=body["language"],
            entities=entities,
            score_threshold=threshold,
            return_decision_process=bool(body.get("return_decision_process")),
            context=body.get("context") if isinstance(body.get("context"), list) else None,
            allow_list=body.get("allow_list") if isinstance(body.get("allow_list"), list) else None,
        )
    return [result_to_dict(r) for r in results]


class Handler(BaseHTTPRequestHandler):
    server_version = "gode-presidio-shim"
    sys_version = ""
    protocol_version = "HTTP/1.1"

    def log_message(self, format, *args):  # noqa: A002 (signature fixed by the base class)
        # Deliberately silent: never write request details anywhere.
        return

    def send_body(self, status, payload, content_type="application/json"):
        data = payload if isinstance(payload, bytes) else payload.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def send_json(self, status, obj):
        self.send_body(status, json.dumps(obj, sort_keys=True))

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == "/health":
            self.send_body(200, "Presidio Analyzer service is up", "text/plain; charset=utf-8")
        elif url.path == "/supportedentities":
            language = parse_qs(url.query).get("language", [LANGUAGE])[0]
            try:
                self.send_json(200, ANALYZER.get_supported_entities(language))
            except ValueError:
                self.send_json(400, {"error": "Unsupported language"})
        else:
            self.send_json(404, {"error": "Not found"})

    def read_json_body(self):
        try:
            length = int(self.headers.get("Content-Length", ""))
        except ValueError:
            self.send_json(411, {"error": "Content-Length required"})
            return None
        if length < 0 or length > MAX_BODY_BYTES:
            self.close_connection = True  # the unread body would desync keep-alive
            self.send_json(413, {"error": "Request too large"})
            return None
        try:
            body = json.loads(self.rfile.read(length) or b"null")
        except (ValueError, UnicodeDecodeError):
            self.send_json(400, {"error": "Invalid request json"})
            return None
        if not isinstance(body, dict):
            self.send_json(400, {"error": "Invalid request json"})
            return None
        return body

    def do_POST(self):
        if urlsplit(self.path).path != "/analyze":
            self.send_json(404, {"error": "Not found"})
            return
        body = self.read_json_body()
        if body is None:
            return
        text, language = body.get("text"), body.get("language")
        # Upstream answers these two with HTTP 500 and these exact messages; mirrored for compatibility.
        if not text:
            self.send_json(500, {"error": "No text provided"})
            return
        if not language:
            self.send_json(500, {"error": "No language provided"})
            return
        texts = text if isinstance(text, list) else [text]
        if not all(isinstance(t, str) for t in texts):
            self.send_json(400, {"error": "text must be a string or a list of strings"})
            return
        try:
            results = [analyze_one(t, body) for t in texts]
        except ValueError:
            # e.g. unsupported language; the message can be generic, never echo input
            self.send_json(400, {"error": "Invalid analyze request"})
            return
        except Exception as exc:  # pragma: no cover - defensive; report the type only, never the text
            print(f"presidio-shim: analyze failed ({type(exc).__name__})", file=sys.stderr)
            self.send_json(500, {"error": "Internal server error"})
            return
        self.send_json(200, results if isinstance(text, list) else results[0])


def main():
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    server.daemon_threads = True
    print(f"presidio-shim: listening on http://{HOST}:{PORT} (model {SPACY_MODEL})", file=sys.stderr)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
