import hashlib
import json
import time
from dataclasses import dataclass, asdict
from typing import List

@dataclass
class VoteTransaction:
    id: str
    voter_id: str
    candidate_id: str
    election_id: str
    timestamp: float

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def create(cls, voter_id: str, candidate_id: str, election_id: str) -> "VoteTransaction":
        tx_id = hashlib.sha256(f"{voter_id}{candidate_id}{election_id}{time.time()}".encode()).hexdigest()
        return cls(
            id=tx_id,
            voter_id=voter_id,
            candidate_id=candidate_id,
            election_id=election_id,
            timestamp=time.time()
        )

@dataclass
class Block:
    index: int
    timestamp: float
    transactions: List[dict]
    proof: int
    previous_hash: str
    
    def to_dict(self) -> dict:
        return asdict(self)

    def hash(self) -> str:
        """Returns the cryptographic SHA-256 hash of the block"""
        block_string = json.dumps(self.to_dict(), sort_keys=True).encode()
        return hashlib.sha256(block_string).hexdigest()
