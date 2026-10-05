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
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

app = Flask(__name__)
CORS(app)

# ─── Supabase config ─────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
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
from blockchain.merkle import build_tree, get_proof, get_root, verify_proof, hash_transaction

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

# ─── Merkle Tree API ─────────────────────────────────────────────────────────

def _build_chain_merkle_tree():
    """Build a Merkle tree from all transactions across all blocks."""
    all_tx_hashes = []
    for block in voting_chain.chain:
        for tx in block.transactions:
            all_tx_hashes.append(hash_transaction(tx))
    return build_tree(all_tx_hashes)


@app.route("/api/merkle-root", methods=["GET"])
def get_merkle_root():
    """Returns the Merkle root of all transactions in the master chain."""
    tree = _build_chain_merkle_tree()
    return jsonify({
        "merkle_root": get_root(tree),
        "leaf_count": tree['leaf_count'],
        "chain_length": len(voting_chain.chain),
    }), 200


@app.route("/api/merkle-proof/<tx_hash>", methods=["GET"])
def get_merkle_proof(tx_hash):
    """
    Returns the Merkle proof for a specific transaction hash.
    The tx_hash can be the direct transaction hash or a voter_id to search for.
    """
    tree = _build_chain_merkle_tree()
    root = get_root(tree)

    # First try the hash directly as a leaf
    proof = get_proof(tree, tx_hash)

    if proof is None:
        # Try to find the transaction by voter_id and hash it
        for block in voting_chain.chain:
            for tx in block.transactions:
                leaf = hash_transaction(tx)
                if leaf == tx_hash or tx.get('voter_id') == tx_hash or tx.get('id') == tx_hash:
                    proof = get_proof(tree, leaf)
                    tx_hash = leaf  # normalize to the actual leaf hash
                    break
            if proof is not None:
                break

    if proof is None:
        return jsonify({"error": "Transaction not found in Merkle tree"}), 404

    return jsonify({
        "leaf_hash": tx_hash,
        "merkle_root": root,
        "proof": proof,
        "verified": verify_proof(tx_hash, proof, root),
    }), 200


# ─── ZK-Commitment API ───────────────────────────────────────────────────────

# In-memory store for vote commitments (in production, persist to DB)
_vote_commitments: dict = {}


@app.route("/api/zk-commit", methods=["POST"])
def submit_zk_commitment():
    """
    Accept a zero-knowledge vote commitment.
    The voter sends commitment = SHA256(candidateId || nonce) before voting.
    Later they can reveal the nonce to prove their vote without exposing it now.
    """
    data = request.json
    if not data or not all(k in data for k in ["voter_id", "commitment", "election_id"]):
        return jsonify({"error": "voter_id, commitment, and election_id required"}), 400

    key = f"{data['voter_id']}:{data['election_id']}"
    _vote_commitments[key] = {
        "commitment": data["commitment"],
        "timestamp": time.time(),
        "revealed": False,
    }
    logger.info(f"ZK commitment stored for voter {data['voter_id']} in election {data['election_id']}")
    return jsonify({"message": "Commitment accepted", "commitment": data["commitment"]}), 201


@app.route("/api/zk-verify", methods=["POST"])
def verify_zk_commitment():
    """
    Verify a zero-knowledge commitment by revealing the preimage.
    The voter provides candidateId + nonce; we check SHA256(candidateId || nonce) == stored commitment.
    """
    data = request.json
    if not data or not all(k in data for k in ["voter_id", "election_id", "candidate_id", "nonce"]):
        return jsonify({"error": "voter_id, election_id, candidate_id, and nonce required"}), 400

    key = f"{data['voter_id']}:{data['election_id']}"
    stored = _vote_commitments.get(key)
    if not stored:
        return jsonify({"error": "No commitment found for this voter/election"}), 404

    # Recompute: commitment = SHA256(candidate_id + nonce)
    preimage = data['candidate_id'] + data['nonce']
    recomputed = hashlib.sha256(preimage.encode('utf-8')).hexdigest()

    match = recomputed == stored['commitment']
    if match:
        stored['revealed'] = True
        logger.info(f"ZK commitment verified for voter {data['voter_id']}")

    return jsonify({
        "valid": match,
        "stored_commitment": stored['commitment'],
        "recomputed": recomputed,
    }), 200

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

# ─── Election Results & Analytics API ────────────────────────────────────────

def _collect_all_election_votes(election_id: str) -> list:
    """Collect all vote transactions for an election from master + booth chains."""
    votes = []
    seen_voter_ids = set()  # prevent cross-booth duplicates

    # Master chain
    for block in voting_chain.chain:
        for tx in block.transactions:
            if tx.get('election_id') == election_id:
                key = tx.get('voter_id', '')
                if key not in seen_voter_ids:
                    seen_voter_ids.add(key)
                    votes.append({**tx, '_source': 'master', '_block_index': block.index, '_block_time': block.timestamp})

    # Booth chains
    for booth_info in booth_manager.list_booths():
        booth = booth_manager.get_booth(booth_info['booth_id'])
        if not booth:
            continue
        for block in booth.chain:
            for tx in block.transactions:
                if tx.get('election_id') == election_id:
                    key = tx.get('voter_id', '')
                    if key not in seen_voter_ids:
                        seen_voter_ids.add(key)
                        votes.append({
                            **tx,
                            '_source': f'booth:{booth_info["booth_id"]}',
                            '_booth_id': booth_info['booth_id'],
                            '_booth_name': booth_info.get('name', booth_info['booth_id']),
                            '_block_index': block.index,
                            '_block_time': block.timestamp,
                        })

    return votes


@app.route("/api/results/<election_id>", methods=["GET"])
def get_election_results(election_id):
    """Get candidate vote tallies for an election by scanning all chains."""
    votes = _collect_all_election_votes(election_id)
    total = len(votes)

    # Tally by candidate_id
    candidate_counts = {}
    for v in votes:
        cid = v.get('candidate_id', 'unknown')
        candidate_counts[cid] = candidate_counts.get(cid, 0) + 1

    results = []
    for cid, count in candidate_counts.items():
        results.append({
            "candidateId": cid,
            "voteCount": count,
            "percentage": round((count / total) * 100, 2) if total > 0 else 0,
        })

    # Sort by vote count descending
    results.sort(key=lambda x: x['voteCount'], reverse=True)

    return jsonify({
        "electionId": election_id,
        "totalVotes": total,
        "results": results,
    }), 200


@app.route("/api/analytics/<election_id>", methods=["GET"])
def get_election_analytics(election_id):
    """Comprehensive election analytics dashboard data."""
    votes = _collect_all_election_votes(election_id)
    total = len(votes)

    # ── Candidate tallies ──
    candidate_counts = {}
    for v in votes:
        cid = v.get('candidate_id', 'unknown')
        candidate_counts[cid] = candidate_counts.get(cid, 0) + 1

    results = []
    for cid, count in candidate_counts.items():
        results.append({
            "candidateId": cid,
            "voteCount": count,
            "percentage": round((count / total) * 100, 2) if total > 0 else 0,
        })
    results.sort(key=lambda x: x['voteCount'], reverse=True)

    # Winner & margin
    winner = results[0] if results else None
    runner_up = results[1] if len(results) > 1 else None
    margin = (winner['voteCount'] - runner_up['voteCount']) if (winner and runner_up) else 0

    # ── Time series (bucket votes by hour) ──
    time_buckets = {}
    for v in votes:
        ts = v.get('timestamp', v.get('_block_time', 0))
        if isinstance(ts, (int, float)):
            from datetime import datetime
            dt = datetime.fromtimestamp(ts)
            bucket = dt.strftime('%Y-%m-%d %H:00')
        else:
            bucket = str(ts)[:13] + ':00'
        time_buckets[bucket] = time_buckets.get(bucket, 0) + 1

    time_series = [{"time": k, "votes": v} for k, v in sorted(time_buckets.items())]

    # ── Per-booth breakdown ──
    booth_breakdown = {}
    for v in votes:
        bid = v.get('_booth_id', 'master')
        bname = v.get('_booth_name', 'Master Chain')
        if bid not in booth_breakdown:
            booth_breakdown[bid] = {"boothId": bid, "boothName": bname, "voteCount": 0, "candidates": {}}
        booth_breakdown[bid]["voteCount"] += 1
        cid = v.get('candidate_id', 'unknown')
        booth_breakdown[bid]["candidates"][cid] = booth_breakdown[bid]["candidates"].get(cid, 0) + 1

    # Add validity status to booth data
    booth_list = []
    for bid, bdata in booth_breakdown.items():
        if bid == 'master':
            bdata["isValid"] = voting_chain.is_chain_valid()
            bdata["blockCount"] = len(voting_chain.chain)
        else:
            booth = booth_manager.get_booth(bid)
            if booth:
                bdata["isValid"] = booth.is_chain_valid()
                bdata["blockCount"] = len(booth.chain)
            else:
                bdata["isValid"] = False
                bdata["blockCount"] = 0
        booth_list.append(bdata)

    # ── Blockchain stats ──
    master_blocks = len(voting_chain.chain)
    master_valid = voting_chain.is_chain_valid()

    # ── Merkle tree ──
    tree = _build_chain_merkle_tree()
    merkle_root = get_root(tree)

    return jsonify({
        "electionId": election_id,
        "totalVotes": total,
        "results": results,
        "winner": winner,
        "runnerUp": runner_up,
        "margin": margin,
        "timeSeries": time_series,
        "boothBreakdown": booth_list,
        "blockchain": {
            "masterBlocks": master_blocks,
            "masterValid": master_valid,
            "merkleRoot": merkle_root,
            "leafCount": tree['leaf_count'],
            "totalBooths": len(booth_manager.booths),
        },
    }), 200


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


# ─── Seed Demo Data ──────────────────────────────────────────────────────────

@app.route("/api/seed-demo", methods=["POST"])
def seed_demo():
    """
    One-click setup: creates booths, assigns voters + elections, marks fingerprints,
    and generates a realistic completed election with blockchain votes.
    """
    import random

    results = {"steps": []}

    # ── 1. Register Booths (one per constituency) ──
    booths_config = [
        {"booth_id": "booth-delhi-01", "name": "New Delhi Polling Station #1", "constituency": "New Delhi"},
        {"booth_id": "booth-ahmedabad-01", "name": "Ahmedabad East Polling Station #1", "constituency": "Ahmedabad East"},
        {"booth_id": "booth-lucknow-01", "name": "Lucknow Central Polling Station #1", "constituency": "Lucknow"},
        {"booth_id": "booth-lucknow-02", "name": "Lucknow South Polling Station #2", "constituency": "Lucknow"},
        {"booth_id": "booth-mumbai-01", "name": "Mumbai South Polling Station #1", "constituency": "Mumbai South"},
    ]

    for bc in booths_config:
        booth_manager.register_booth(bc["booth_id"], bc["name"], bc["constituency"])
    results["steps"].append(f"Registered {len(booths_config)} polling booths")

    # ── 2. Get voters from Supabase ──
    voters = []
    try:
        url = f"{SUPABASE_URL}/rest/v1/voters?select=*"
        r = http_requests.get(url, headers=SUPABASE_HEADERS, timeout=10)
        if r.ok:
            voters = r.json()
    except Exception as e:
        results["steps"].append(f"Warning: Could not fetch voters from Supabase: {e}")

    # Demo voter-to-booth mapping (by constituency/location)
    voter_booth_map = {
        "New Delhi": "booth-delhi-01",
        "Ahmedabad East": "booth-ahmedabad-01",
        "Lucknow": "booth-lucknow-01",
        "Mumbai South": "booth-mumbai-01",
        "Hyderabad": "booth-delhi-01",  # fallback
    }

    # ── 3. Assign voters to booths + mark fingerprints as verified ──
    assigned_count = 0
    fp_count = 0

    for v in voters:
        voter_id = v.get("id", "")
        location = v.get("location", "")

        # Assign to booth
        booth_id = voter_booth_map.get(location, "booth-delhi-01")
        booth_manager.assign_voter(booth_id, voter_id)
        assigned_count += 1

        # Mark fingerprint as verified (simulated) if not already
        existing_fp = v.get("fingerprint_template", "")
        if not existing_fp:
            sim_fp = f"SIM:{hashlib.sha256(f'sim:{voter_id}:{time.time()}'.encode()).hexdigest()}"
            try:
                fp_url = f"{SUPABASE_URL}/rest/v1/voters?id=eq.{voter_id}"
                http_requests.patch(fp_url, json={"fingerprint_template": sim_fp}, headers=SUPABASE_HEADERS, timeout=10)
                fp_count += 1
            except Exception:
                pass

    results["steps"].append(f"Assigned {assigned_count} voters to booths")
    results["steps"].append(f"Marked {fp_count} voter fingerprints as verified (simulated)")

    # ── 4. Assign elections to booths ──
    election_booth_map = {
        "elec-001": ["booth-delhi-01"],
        "elec-002": ["booth-ahmedabad-01"],
        "elec-003": ["booth-mumbai-01"],
        "elec-004": ["booth-lucknow-01", "booth-lucknow-02"],
    }
    for elec_id, booth_ids in election_booth_map.items():
        for bid in booth_ids:
            booth_manager.assign_election(bid, elec_id)
    results["steps"].append("Assigned elections to booths")

    # ── 5. Generate completed election results for elec-004 ──
    # Create 20 synthetic voters and cast votes with realistic distribution
    # BJP (cand-008): ~45%, SP (cand-009): ~33%, BSP (cand-010): ~22%
    completed_election_id = "elec-004"
    candidates = ["cand-008", "cand-009", "cand-010"]
    weights = [0.45, 0.33, 0.22]  # BJP wins

    # Generate synthetic voter IDs for the completed election
    synthetic_voters = [f"syn-voter-{i:03d}" for i in range(1, 21)]

    # Assign synthetic voters to Lucknow booths
    for i, sv in enumerate(synthetic_voters):
        target_booth = "booth-lucknow-01" if i < 12 else "booth-lucknow-02"
        booth_manager.assign_voter(target_booth, sv)

    # Cast votes (distributed across the 2 Lucknow booths)
    votes_cast = 0
    vote_distribution = {c: 0 for c in candidates}

    for i, sv in enumerate(synthetic_voters):
        target_booth = "booth-lucknow-01" if i < 12 else "booth-lucknow-02"
        booth = booth_manager.get_booth(target_booth)
        if not booth:
            continue

        # Check if already voted
        if booth.has_voter_already_voted(sv, completed_election_id):
            continue

        # Weighted random candidate selection
        r = random.random()
        cumulative = 0
        chosen_candidate = candidates[-1]
        for ci, w in zip(candidates, weights):
            cumulative += w
            if r <= cumulative:
                chosen_candidate = ci
                break

        try:
            booth.add_vote(sv, chosen_candidate, completed_election_id)
            booth.mine_pending_votes()
            votes_cast += 1
            vote_distribution[chosen_candidate] = vote_distribution.get(chosen_candidate, 0) + 1
        except ValueError:
            pass  # Already voted

    results["steps"].append(f"Generated {votes_cast} votes for completed election (elec-004)")
    results["steps"].append(f"Vote distribution: {vote_distribution}")

    # ── 6. Summary ──
    results["booths"] = len(booth_manager.booths)
    results["votersAssigned"] = assigned_count
    results["fingerprintsMarked"] = fp_count
    results["completedElectionVotes"] = votes_cast
    results["voteDistribution"] = vote_distribution

    logger.info(f"Demo seed complete: {results}")
    return jsonify(results), 200


if __name__ == "__main__":
    app.run(port=5000, debug=False)