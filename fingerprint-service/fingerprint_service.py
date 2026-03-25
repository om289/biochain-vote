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


from blockchain.chain import voting_chain
from blockchain.config import logger
from blockchain.booth import booth_manager

# ─── Blockchain API ──────────────────────────────────────────────────────────
@app.route("/api/votes", methods=["POST"])
def cast_vote():
    data = request.json
    required_fields = ["voter_id", "candidate_id", "election_id"]
    if not all(k in data for k in required_fields):
        return jsonify({"error": "Missing required fields"}), 400
    
    try:
        # Add vote to pending pool with strict validation
        vote = voting_chain.add_vote(data["voter_id"], data["candidate_id"], data["election_id"])
        
        # Auto-mine for demo purposes so it's instantly on the chain
        block = voting_chain.mine_pending_votes()
        if block:
            return jsonify({
                "message": "Vote successfully cast and secured on the blockchain!",
                "vote": vote,
                "block_index": block["index"],
                "block_hash": block["previous_hash"]
            }), 201
        else:
            return jsonify({"error": "Failed to mine block"}), 500
    except ValueError as e:
        logger.warning(f"API Error: {str(e)}")
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.error(f"Unexpected API Error: {str(e)}")
        return jsonify({"error": "Internal server error occurred while processing the vote"}), 500

@app.route("/api/blocks", methods=["GET"])
def get_chain():
    chain_data = [block.to_dict() for block in voting_chain.chain]
    response = {
        "chain": chain_data,
        "length": len(chain_data),
        "is_valid": voting_chain.is_chain_valid()
    }
    return jsonify(response), 200

# ─── Booth API ───────────────────────────────────────────────────────────────
@app.route("/api/booths", methods=["GET"])
def list_booths():
    return jsonify({"booths": booth_manager.list_booths()}), 200

@app.route("/api/booths", methods=["POST"])
def register_booth():
    data = request.json
    if not data or not all(k in data for k in ["booth_id", "name", "constituency"]):
        return jsonify({"error": "booth_id, name, and constituency are required"}), 400
    booth = booth_manager.register_booth(data["booth_id"], data["name"], data["constituency"])
    return jsonify({"message": f"Booth '{data['name']}' registered.", "booth": booth.get_info(booth_manager.get_booth_voters(data["booth_id"]))}), 201

@app.route("/api/booths/<booth_id>/assign", methods=["POST"])
def assign_voter_to_booth(booth_id):
    data = request.json
    if not data or "voter_id" not in data:
        return jsonify({"error": "voter_id is required"}), 400
    if booth_manager.assign_voter(booth_id, data["voter_id"]):
        return jsonify({"message": f"Voter assigned to booth {booth_id}"}), 200
    return jsonify({"error": f"Booth {booth_id} not found"}), 404

@app.route("/api/booths/<booth_id>/unassign", methods=["POST"])
def unassign_voter_from_booth(booth_id):
    data = request.json
    if not data or "voter_id" not in data:
        return jsonify({"error": "voter_id is required"}), 400
    if booth_manager.unassign_voter(booth_id, data["voter_id"]):
        return jsonify({"message": f"Voter unassigned from booth {booth_id}"}), 200
    return jsonify({"error": "Voter not found in this booth"}), 404

@app.route("/api/booths/<booth_id>/voters", methods=["GET"])
def get_booth_voters(booth_id):
    voters = booth_manager.get_booth_voters(booth_id)
    return jsonify({"booth_id": booth_id, "voters": voters}), 200

@app.route("/api/booths/<booth_id>/elections/assign", methods=["POST"])
def assign_election_to_booth(booth_id):
    data = request.json
    if not data or "election_id" not in data:
        return jsonify({"error": "election_id is required"}), 400
    if booth_manager.assign_election(booth_id, data["election_id"]):
        return jsonify({"message": f"Election assigned to booth {booth_id}"}), 200
    return jsonify({"error": f"Booth {booth_id} not found"}), 404

@app.route("/api/booths/<booth_id>/elections/unassign", methods=["POST"])
def unassign_election_from_booth(booth_id):
    data = request.json
    if not data or "election_id" not in data:
        return jsonify({"error": "election_id is required"}), 400
    if booth_manager.unassign_election(booth_id, data["election_id"]):
        return jsonify({"message": f"Election unassigned from booth {booth_id}"}), 200
    return jsonify({"error": "Election not found in this booth"}), 404

@app.route("/api/booths/<booth_id>/votes", methods=["POST"])
def cast_booth_vote(booth_id):
    booth = booth_manager.get_booth(booth_id)
    if not booth:
        return jsonify({"error": f"Booth {booth_id} not found"}), 404
    data = request.json
    required_fields = ["voter_id", "candidate_id", "election_id"]
    if not all(k in data for k in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    # Enforce: election must be assigned to THIS booth
    assigned_elections = booth_manager.get_booth_elections(booth_id)
    if data["election_id"] not in assigned_elections:
        return jsonify({"error": f"Election {data['election_id']} is not active at booth {booth_id}"}), 403

    # Enforce: voter must be assigned to THIS booth
    assigned_booth = booth_manager.get_voter_booth(data["voter_id"])
    if assigned_booth != booth_id:
        return jsonify({"error": f"Voter is not assigned to booth {booth_id}. Assigned to: {assigned_booth or 'none'}"}), 403

    try:
        vote = booth.add_vote(data["voter_id"], data["candidate_id"], data["election_id"])
        block = booth.mine_pending_votes()
        if block:
            return jsonify({
                "message": f"Vote cast on Booth {booth_id} and mined!",
                "vote": vote,
                "block_index": block["index"],
                "block_hash": block["previous_hash"],
                "booth_id": booth_id
            }), 201
        return jsonify({"error": "Failed to mine block"}), 500
    except ValueError as e:
        return jsonify({"error": str(e)}), 403
    except Exception as e:
        logger.error(f"Booth vote error: {str(e)}")
        return jsonify({"error": "Internal server error"}), 500

@app.route("/api/booths/<booth_id>/blocks", methods=["GET"])
def get_booth_chain(booth_id):
    booth = booth_manager.get_booth(booth_id)
    if not booth:
        return jsonify({"error": f"Booth {booth_id} not found"}), 404
    chain_data = [block.to_dict() for block in booth.chain]
    return jsonify({
        "booth_id": booth_id,
        "chain": chain_data,
        "length": len(chain_data),
        "is_valid": booth.is_chain_valid()
    }), 200

@app.route("/api/merge", methods=["POST"])
def merge_booths():
    """Merge all booth chains into the master blockchain"""
    if len(booth_manager.booths) == 0:
        return jsonify({"error": "No booths to merge"}), 400
    result = booth_manager.merge_all_into_master(voting_chain)
    return jsonify({"message": "Merge complete!", **result}), 200

@app.route("/api/voter/<voter_id>/booth", methods=["GET"])
def get_voter_assigned_booth(voter_id):
    """Get the booth assigned to a specific voter"""
    booth_id = booth_manager.get_voter_booth(voter_id)
    if not booth_id:
        return jsonify({"assigned": False}), 200
    booth = booth_manager.get_booth(booth_id)
    if booth:
        return jsonify({
            "assigned": True,
            "booth_id": booth.booth_id,
            "booth_name": booth.booth_name,
            "constituency": booth.constituency
        }), 200
    return jsonify({"assigned": False}), 200

@app.route("/api/voter/<voter_id>/locked", methods=["GET"])
def is_voter_locked(voter_id):
    # Check master chain
    if voting_chain.has_voter_voted(voter_id):
        return jsonify({"locked": True}), 200
    
    # Check all booth chains
    booths = booth_manager.list_booths()
    for b in booths:
        booth_chain = booth_manager.get_booth(b["booth_id"])
        if booth_chain and booth_chain.has_voter_voted(voter_id):
            return jsonify({"locked": True}), 200
            
    return jsonify({"locked": False}), 200

@app.route("/api/voter/<voter_id>/votes", methods=["GET"])
def get_voter_votes(voter_id):
    votes = []
    
    # Helper to extract votes from a chain
    def extract_votes(chain_obj):
        if not chain_obj: return
        for block in chain_obj.chain:
            for tx in block.transactions:
                if tx.get("voter_id") == voter_id:
                    votes.append({
                        "id": tx.get("id", ""),
                        "voterId": tx.get("voter_id", ""),
                        "candidateId": tx.get("candidate_id", ""),
                        "electionId": tx.get("election_id", ""),
                        "blockHash": block.previous_hash,
                        "blockIndex": block.index,
                        "timestamp": tx.get("timestamp", "")
                    })
    
    # Master chain
    extract_votes(voting_chain)
    
    # Booth chains
    booths = booth_manager.list_booths()
    for b in booths:
        booth_chain = booth_manager.get_booth(b["booth_id"])
        extract_votes(booth_chain)
            
    return jsonify({"votes": votes}), 200

# ─── Legacy Routes ───────────────────────────────────────────────────────────
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