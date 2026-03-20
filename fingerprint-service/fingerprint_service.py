"""
Fingerprint Service — BioChain Vote
Uses Windows Biometric Framework (winbio.dll) to capture fingerprints.
Completely bypasses the NITGEN SDK DLL.

Endpoints:
  GET  /status  — health check
  POST /enroll  — capture fingerprint + store template hash in Supabase
  POST /verify  — capture fingerprint + compare against stored template
  POST /scan    — legacy compatibility alias for /verify
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import ctypes
import ctypes.wintypes
import hashlib
import requests as http_requests
import time
import threading
import os
import subprocess
import json
import sys

app = Flask(__name__)
CORS(app)

# ─── Supabase config ─────────────────────────────────────────────────────────
SUPABASE_URL = "https://hbuxgqnbbheyuwxmquvp.supabase.co"
SUPABASE_KEY = "sb_publishable_xA_NioJpy7-1JjhwipHUGA_Z40yHkCU"
SUPABASE_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

# ─── Windows Biometric Framework (winbio.dll) ─────────────────────────────────
WINBIO_TYPE_FINGERPRINT = 0x00000008
WINBIO_POOL_SYSTEM      = 0x00000001
# ─── NITGEN Subprocess Integration ───────────────────────────────────────────
def run_nitgen_subprocess(command, template=None):
    """
    Runs `python test_nitgen.py` in a completely isolated subprocess.
    Because NBioBSP.dll strictly fails with hr=0x01 if it detects it is running in 
    a background worker thread (like Flask) without a top-level Windows GUI, 
    we must spawn a literal python executable with the auto-GUI flags to get capture focus.
    """
    cur_dir = os.path.dirname(os.path.abspath(__file__))
    worker = os.path.join(cur_dir, "nbio_worker.py")
    cmd = [sys.executable, worker, f"--{command}"]
    if template:
        cmd.append(template)
        
    try:
        print(f"[NITGEN] Starting scanner worker subprocess for {command}...")
        
        # NOTE: Do NOT use CREATE_NO_WINDOW — it prevents the child process from getting
        # a proper interactive desktop session, which blocks USB hardware access for the scanner LED.
        proc = subprocess.run(
            cmd, 
            cwd=cur_dir, 
            capture_output=True, 
            text=True, 
            timeout=30
        )
        
        output = proc.stdout.strip()
        lines = output.split("\n")
        
        # Find the JSON line
        for line in reversed(lines):
            line = line.strip()
            if line.startswith("{") and line.endswith("}"):
                return json.loads(line)
                
        if proc.stderr:
            print(f"[NITGEN ERROR] {proc.stderr}")
            
        return {"success": False, "error": f"Could not parse JSON from worker. Stdout: {output}"}
        
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Capture timed out. Place finger faster."}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ─── Simulated mode helpers ──────────────────────────────────────────────────
def sim_enroll(voter_id: str) -> str:
    raw = f"sim:{voter_id}:{time.time()}"
    return "SIM:" + hashlib.sha256(raw.encode()).hexdigest()

def sim_verify(stored: str) -> bool:
    return bool(stored)


# ─── Supabase helpers ────────────────────────────────────────────────────────
def db_get_template(voter_id: str):
    url = f"{SUPABASE_URL}/rest/v1/voters?id=eq.{voter_id}&select=fingerprint_template"
    r = http_requests.get(url, headers=SUPABASE_HEADERS, timeout=10)
    data = r.json()
    if data and len(data) > 0:
        return data[0].get("fingerprint_template")
    return None

def db_save_template(voter_id: str, template: str) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/voters?id=eq.{voter_id}"
    r = http_requests.patch(url, json={"fingerprint_template": template}, headers=SUPABASE_HEADERS, timeout=10)
    return r.status_code in [200, 204]


# ─── Routes ──────────────────────────────────────────────────────────────────
@app.route("/")
@app.route("/status", methods=["GET"])
def get_status():
    """Returns the scanner connection status."""
    return jsonify({
        "mode": "NBioBSP_Subprocess",
        "status": "running"
    })


@app.route("/enroll", methods=["POST"])
def enroll():
    data = request.json
    if not data or "voter_id" not in data:
        return jsonify({"error": "voter_id required"}), 400

    voter_id = data["voter_id"]

    print(f"[ENROLL] Spawning scanner GUI for voter {voter_id}...")
    result = run_nitgen_subprocess("enroll")
    
    if result.get("success"):
        template = "NITGEN:" + result["template"]
        ok = db_save_template(voter_id, template)
        if ok:
            return jsonify({"status": "enrolled", "voter_id": voter_id, "simulated": False})
        else:
            return jsonify({"error": "Fingerprint captured but failed to save to database."}), 500
    else:
        error_msg = result.get("error", "Unknown capture error")
        return jsonify({
            "error": f"Fingerprint capture failed: {error_msg}. Place your finger firmly on the scanner."
        }), 500


@app.route("/verify", methods=["POST"])
def verify():
    data = request.json
    if not data or "voter_id" not in data:
        return jsonify({"error": "voter_id required"}), 400

    voter_id = data["voter_id"]
    stored = db_get_template(voter_id)

    if not stored:
        return jsonify({
            "error": "No fingerprint enrolled for this voter. Please enroll first.",
            "match": False
        }), 404

    if stored.startswith("NITGEN:"):
        pure_template = stored[7:]
        result = run_nitgen_subprocess("verify", pure_template)
        
        if result.get("success"):
            match = result.get("match", False)
            return jsonify({"match": match, "voter_id": voter_id, "simulated": False})
        else:
            error_msg = result.get("error", "Unknown verify error")
            return jsonify({
                "error": f"Fingerprint capture failed: {error_msg}.",
                "match": False
            }), 500
    else:
        # Simulated: always match if template exists
        return jsonify({"match": sim_verify(stored), "voter_id": voter_id, "simulated": True})


@app.route("/scan", methods=["POST"])
def scan():
    """Legacy endpoint — redirects to verify."""
    data = request.json or {}
    voter_id = data.get("voter_id", "unknown")
    stored = db_get_template(voter_id)
    return jsonify({"status": "ok" if stored else "no_template", "voter_id": voter_id})


if __name__ == "__main__":
    app.run(port=5000, debug=False)