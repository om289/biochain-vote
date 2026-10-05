import os
import json
from typing import List, Optional, Dict
from .models import Block, VoteTransaction
from .chain import Blockchain
from .config import DATA_DIR, logger


class BoothBlockchain(Blockchain):
    """
    A booth-level blockchain that operates independently during voting hours.
    Each physical voting booth gets its own isolated chain.
    """
    def __init__(self, booth_id: str, name: str, constituency: str):
        self.booth_id = booth_id
        self.booth_name = name
        self.constituency = constituency
        self._booth_file = os.path.join(DATA_DIR, f"booth_{booth_id}_chain.json")

        # Load booth-specific chain from disk
        self.chain: List[Block] = self._load_booth_chain()
        self.pending_votes: list = []

        if not self.chain:
            logger.info(f"[Booth {booth_id}] Generating Genesis Block...")
            self.create_block(proof=100, previous_hash='1')

    def _load_booth_chain(self) -> List[Block]:
        if not os.path.exists(self._booth_file):
            return []
        try:
            with open(self._booth_file, 'r') as f:
                data = json.load(f)
            chain = []
            for item in data:
                block = Block(
                    index=item.get('index', 0),
                    timestamp=item.get('timestamp', 0.0),
                    transactions=item.get('transactions', []),
                    proof=item.get('proof', 0),
                    previous_hash=item.get('previous_hash', '')
                )
                chain.append(block)
            logger.info(f"[Booth {self.booth_id}] Loaded {len(chain)} blocks from disk.")
            return chain
        except Exception as e:
            logger.error(f"[Booth {self.booth_id}] Failed to load chain: {e}")
            return []

    def _save_booth_chain(self):
        try:
            with open(self._booth_file, 'w') as f:
                json.dump([block.to_dict() for block in self.chain], f, indent=4)
        except Exception as e:
            logger.error(f"[Booth {self.booth_id}] Failed to save chain: {e}")

    def create_block(self, proof: int, previous_hash: str) -> Block:
        block = super().create_block(proof, previous_hash)
        self._save_booth_chain()
        return block

    def export_chain(self) -> List[dict]:
        """Serializes the booth chain for merging into the master chain"""
        return [block.to_dict() for block in self.chain]

    def get_info(self, assigned_voters: list = None, assigned_elections: list = None) -> dict:
        return {
            "booth_id": self.booth_id,
            "name": self.booth_name,
            "constituency": self.constituency,
            "blocks": len(self.chain),
            "is_valid": self.is_chain_valid(),
            "total_votes": sum(len(b.transactions) for b in self.chain),
            "assigned_voters": assigned_voters or [],
            "assigned_elections": assigned_elections or [],
        }


class BoothManager:
    """
    Manages all booth-level blockchains.
    Handles registration, voting, and chain merging.
    """
    def __init__(self):
        self.booths: Dict[str, BoothBlockchain] = {}
        self.assignments: Dict[str, List[str]] = {}  # booth_id -> [voter_ids]
        self.election_assignments: Dict[str, List[str]] = {}  # booth_id -> [election_ids]
        self._registry_file = os.path.join(DATA_DIR, "booth_registry.json")
        self._assignments_file = os.path.join(DATA_DIR, "booth_assignments.json")
        self._elections_file = os.path.join(DATA_DIR, "booth_elections.json")
        self._load_registry()
        self._load_assignments()
        self._load_election_assignments()

    def _load_registry(self):
        """Load all previously registered booths from disk"""
        if not os.path.exists(self._registry_file):
            return
        try:
            with open(self._registry_file, 'r') as f:
                registry = json.load(f)
            for entry in registry:
                booth = BoothBlockchain(
                    booth_id=entry['booth_id'],
                    name=entry['name'],
                    constituency=entry['constituency']
                )
                self.booths[entry['booth_id']] = booth
            logger.info(f"Loaded {len(self.booths)} registered booths from disk.")
        except Exception as e:
            logger.error(f"Failed to load booth registry: {e}")

    def _save_registry(self):
        try:
            registry = [
                {"booth_id": b.booth_id, "name": b.booth_name, "constituency": b.constituency}
                for b in self.booths.values()
            ]
            with open(self._registry_file, 'w') as f:
                json.dump(registry, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save booth registry: {e}")

    def _load_assignments(self):
        if not os.path.exists(self._assignments_file):
            return
        try:
            with open(self._assignments_file, 'r') as f:
                self.assignments = json.load(f)
            logger.info(f"Loaded booth assignments from disk.")
        except Exception as e:
            logger.error(f"Failed to load booth assignments: {e}")

    def _save_assignments(self):
        try:
            with open(self._assignments_file, 'w') as f:
                json.dump(self.assignments, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save booth assignments: {e}")

    def assign_voter(self, booth_id: str, voter_id: str) -> bool:
        if booth_id not in self.booths:
            return False
        if booth_id not in self.assignments:
            self.assignments[booth_id] = []
        if voter_id not in self.assignments[booth_id]:
            # Remove from any other booth first
            for bid in self.assignments:
                if voter_id in self.assignments[bid]:
                    self.assignments[bid].remove(voter_id)
            self.assignments[booth_id].append(voter_id)
            self._save_assignments()
            logger.info(f"Assigned voter {voter_id} to booth {booth_id}")
        return True

    def unassign_voter(self, booth_id: str, voter_id: str) -> bool:
        if booth_id in self.assignments and voter_id in self.assignments[booth_id]:
            self.assignments[booth_id].remove(voter_id)
            self._save_assignments()
            return True
        return False

    def get_voter_booth(self, voter_id: str) -> Optional[str]:
        for bid, voters in self.assignments.items():
            if voter_id in voters:
                return bid
        return None

    def get_booth_voters(self, booth_id: str) -> List[str]:
        return self.assignments.get(booth_id, [])

    def _load_election_assignments(self):
        if not os.path.exists(self._elections_file):
            return
        try:
            with open(self._elections_file, 'r') as f:
                self.election_assignments = json.load(f)
            logger.info(f"Loaded booth election assignments from disk.")
        except Exception as e:
            logger.error(f"Failed to load booth election assignments: {e}")

    def _save_election_assignments(self):
        try:
            with open(self._elections_file, 'w') as f:
                json.dump(self.election_assignments, f, indent=4)
        except Exception as e:
            logger.error(f"Failed to save booth election assignments: {e}")

    def assign_election(self, booth_id: str, election_id: str) -> bool:
        if booth_id not in self.booths:
            return False
        if booth_id not in self.election_assignments:
            self.election_assignments[booth_id] = []
        if election_id not in self.election_assignments[booth_id]:
            self.election_assignments[booth_id].append(election_id)
            self._save_election_assignments()
            logger.info(f"Assigned election {election_id} to booth {booth_id}")
        return True

    def unassign_election(self, booth_id: str, election_id: str) -> bool:
        if booth_id in self.election_assignments and election_id in self.election_assignments[booth_id]:
            self.election_assignments[booth_id].remove(election_id)
            self._save_election_assignments()
            return True
        return False

    def get_booth_elections(self, booth_id: str) -> List[str]:
        return self.election_assignments.get(booth_id, [])

    def register_booth(self, booth_id: str, name: str, constituency: str) -> BoothBlockchain:
        if booth_id in self.booths:
            logger.warning(f"Booth {booth_id} already exists. Returning existing instance.")
            return self.booths[booth_id]
        booth = BoothBlockchain(booth_id, name, constituency)
        self.booths[booth_id] = booth
        self._save_registry()
        logger.info(f"Registered new booth: {name} ({booth_id}) for {constituency}")
        return booth

    def get_booth(self, booth_id: str) -> Optional[BoothBlockchain]:
        return self.booths.get(booth_id)

    def list_booths(self) -> List[dict]:
        return [booth.get_info(
            assigned_voters=self.assignments.get(bid, []),
            assigned_elections=self.election_assignments.get(bid, [])
        ) for bid, booth in self.booths.items()]

    def merge_all_into_master(self, master: Blockchain) -> dict:
        """
        Merges all booth chains into the master blockchain.
        Validates each booth chain before merging.
        Detects cross-booth double voting.
        """
        all_transactions = []
        invalid_booths = []
        voter_election_tracker: Dict[str, str] = {}  # voter_id+election_id -> booth_id

        for booth_id, booth in self.booths.items():
            # Validate the booth chain first
            if not booth.is_chain_valid():
                invalid_booths.append(booth_id)
                logger.error(f"Booth {booth_id} has an INVALID chain! Skipping.")
                continue

            # Collect all transactions from this booth (skip genesis block)
            for block in booth.chain[1:]:
                for tx in block.transactions:
                    key = f"{tx['voter_id']}:{tx['election_id']}"
                    if key in voter_election_tracker:
                        logger.error(
                            f"CROSS-BOOTH DOUBLE VOTE DETECTED! "
                            f"Voter {tx['voter_id']} voted in booth {voter_election_tracker[key]} "
                            f"AND booth {booth_id} for election {tx['election_id']}"
                        )
                        continue  # Skip the duplicate
                    voter_election_tracker[key] = booth_id
                    all_transactions.append(tx)

        # Sort all transactions by timestamp for chronological ordering
        all_transactions.sort(key=lambda t: t.get('timestamp', 0))

        # Add all validated transactions to master chain in batches
        merged_blocks = 0
        batch_size = 10
        for i in range(0, len(all_transactions), batch_size):
            batch = all_transactions[i:i + batch_size]
            master.pending_votes = batch
            master.mine_pending_votes()
            merged_blocks += 1

        logger.info(
            f"Merge complete: {len(all_transactions)} transactions from "
            f"{len(self.booths) - len(invalid_booths)} valid booths into {merged_blocks} new blocks."
        )

        return {
            "merged_transactions": len(all_transactions),
            "merged_blocks": merged_blocks,
            "invalid_booths": invalid_booths,
            "total_booths": len(self.booths),
            "master_chain_length": len(master.chain),
            "master_chain_valid": master.is_chain_valid(),
        }


# Global singleton
booth_manager = BoothManager()
