"""
merkle.py — SHA-256 Merkle Tree for BioChain Vote

Provides:
  - build_tree(leaves) → dict with root, layers
  - get_proof(tree, leaf_hash) → list of {hash, position}
  - get_root(tree) → str
  - verify_proof(leaf, proof, root) → bool

All hashes are hex-encoded SHA-256.
"""

import hashlib
from typing import List, Optional, Dict, Any


def _sha256(data: str) -> str:
    """SHA-256 hash of a string, returned as hex."""
    return hashlib.sha256(data.encode('utf-8')).hexdigest()


def _hash_pair(left: str, right: str) -> str:
    """Hash two sibling nodes together (sorted concatenation for consistency)."""
    return _sha256(left + right)


def build_tree(leaves: List[str]) -> Dict[str, Any]:
    """
    Build a Merkle tree from a list of leaf hashes.

    Args:
        leaves: List of hex-encoded SHA-256 hashes (transaction hashes).

    Returns:
        dict with:
          - 'root': The Merkle root hash
          - 'layers': List of layers, from leaves (layer 0) to root (last layer)
          - 'leaf_count': Number of leaves
    """
    if not leaves:
        return {
            'root': _sha256('empty'),
            'layers': [],
            'leaf_count': 0,
        }

    # Layer 0 = the leaves themselves
    current_layer = list(leaves)
    layers = [current_layer[:]]

    while len(current_layer) > 1:
        next_layer = []
        for i in range(0, len(current_layer), 2):
            left = current_layer[i]
            # If odd number of nodes, duplicate the last one
            right = current_layer[i + 1] if i + 1 < len(current_layer) else left
            next_layer.append(_hash_pair(left, right))
        current_layer = next_layer
        layers.append(current_layer[:])

    return {
        'root': current_layer[0],
        'layers': layers,
        'leaf_count': len(leaves),
    }


def get_root(tree: Dict[str, Any]) -> str:
    """Get the Merkle root from a built tree."""
    return tree.get('root', '')


def get_proof(tree: Dict[str, Any], leaf_hash: str) -> Optional[List[Dict[str, str]]]:
    """
    Get the Merkle proof for a specific leaf.

    Args:
        tree: A tree built by build_tree()
        leaf_hash: The hash of the leaf to prove inclusion for

    Returns:
        List of proof steps, each with:
          - 'hash': The sibling hash
          - 'position': 'left' or 'right' (position of the sibling)
        Returns None if the leaf is not in the tree.
    """
    layers = tree.get('layers', [])
    if not layers:
        return None

    # Find the leaf index in layer 0
    try:
        index = layers[0].index(leaf_hash)
    except ValueError:
        return None

    proof = []
    for layer in layers[:-1]:  # Skip the root layer
        # Determine sibling
        if index % 2 == 0:
            # Current node is on the left, sibling is on the right
            sibling_index = index + 1
            if sibling_index < len(layer):
                proof.append({'hash': layer[sibling_index], 'position': 'right'})
            else:
                # Odd leaf count — sibling is itself (duplicate)
                proof.append({'hash': layer[index], 'position': 'right'})
        else:
            # Current node is on the right, sibling is on the left
            sibling_index = index - 1
            proof.append({'hash': layer[sibling_index], 'position': 'left'})

        # Move to parent index
        index = index // 2

    return proof


def verify_proof(leaf_hash: str, proof: List[Dict[str, str]], root: str) -> bool:
    """
    Verify a Merkle proof client-side.

    Args:
        leaf_hash: The hash of the leaf being verified
        proof: List of proof steps from get_proof()
        root: The expected Merkle root

    Returns:
        True if the proof is valid and the leaf is included in the tree.
    """
    current = leaf_hash

    for step in proof:
        sibling = step['hash']
        position = step['position']

        if position == 'right':
            current = _hash_pair(current, sibling)
        else:
            current = _hash_pair(sibling, current)

    return current == root


def hash_transaction(tx: dict) -> str:
    """
    Hash a vote transaction for use as a Merkle leaf.
    Uses voter_id + candidate_id + election_id + timestamp for uniqueness.
    """
    data = f"{tx.get('voter_id', '')}{tx.get('candidate_id', '')}{tx.get('election_id', '')}{tx.get('timestamp', '')}"
    return _sha256(data)
