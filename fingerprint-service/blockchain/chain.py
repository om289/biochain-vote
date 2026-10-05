import time
import hashlib
import threading
from typing import List, Optional
from .models import Block, VoteTransaction
from .storage import BlockchainStorage
from .config import MINING_DIFFICULTY, logger

_chain_lock = threading.Lock()

class Blockchain:
    def __init__(self):
        self.chain: List[Block] = BlockchainStorage.load_chain()
        self.pending_votes: List[dict] = []
        
        # If the loaded chain is empty, create the genesis block
        if not self.chain:
            logger.info("Generating Genesis Block...")
            self.create_block(proof=100, previous_hash='1')
            
    def create_block(self, proof: int, previous_hash: str) -> Block:
        block = Block(
            index=len(self.chain) + 1,
            timestamp=time.time(),
            transactions=self.pending_votes,
            proof=proof,
            previous_hash=previous_hash or self.chain[-1].hash()
        )
        self.pending_votes = []
        self.chain.append(block)
        
        # Persist to disk every time a new block is added
        BlockchainStorage.save_chain(self.chain)
        
        return block

    def add_vote(self, voter_id: str, candidate_id: str, election_id: str) -> dict:
        """Creates a transaction and adds it to pending votes"""
        with _chain_lock:
            # Enterprise Validation: Prevent double voting securely on the blockchain level
            if self.has_voter_already_voted(voter_id, election_id):
                logger.warning(f"Double voting attempt blocked for Voter {voter_id} in Election {election_id}")
                raise ValueError(f"Voter {voter_id} has already cast a vote in Election {election_id}")

            tx = VoteTransaction.create(voter_id, candidate_id, election_id)
            self.pending_votes.append(tx.to_dict())
            logger.info(f"Transaction {tx.id} added to pending pool.")
            return tx.to_dict()

    def has_voter_already_voted(self, voter_id: str, election_id: str) -> bool:
        """Scans the entire blockchain history to prevent double voting"""
        voter_hash = hashlib.sha256(f"voter:{voter_id}:{election_id}".encode()).hexdigest()
        for block in self.chain:
            for tx in block.transactions:
                if tx.get('voter_hash') == voter_hash and tx.get('election_id') == election_id:
                    return True
        for pending_tx in self.pending_votes:
            if pending_tx.get('voter_hash') == voter_hash and pending_tx.get('election_id') == election_id:
                return True
        return False

    def has_voter_voted(self, voter_id: str, election_id: str = None) -> bool:
        """Check if a voter has voted in any (or a specific) election."""
        if election_id is not None:
            voter_hash = hashlib.sha256(f"voter:{voter_id}:{election_id}".encode()).hexdigest()
            for block in self.chain:
                for tx in block.transactions:
                    if tx.get('voter_hash') == voter_hash and tx.get('election_id') == election_id:
                        return True
            for pending_tx in self.pending_votes:
                if pending_tx.get('voter_hash') == voter_hash and pending_tx.get('election_id') == election_id:
                    return True
        else:
            # No election_id: check all elections by hashing voter_id against each tx's election_id
            for block in self.chain:
                for tx in block.transactions:
                    tx_election = tx.get('election_id')
                    if tx_election is not None:
                        h = hashlib.sha256(f"voter:{voter_id}:{tx_election}".encode()).hexdigest()
                        if tx.get('voter_hash') == h:
                            return True
            for pending_tx in self.pending_votes:
                tx_election = pending_tx.get('election_id')
                if tx_election is not None:
                    h = hashlib.sha256(f"voter:{voter_id}:{tx_election}".encode()).hexdigest()
                    if pending_tx.get('voter_hash') == h:
                        return True
        return False

    def get_votes_by_election(self, election_id: str) -> list:
        """Get all vote transactions for a specific election from the chain."""
        votes = []
        for block in self.chain:
            for tx in block.transactions:
                if tx.get('election_id') == election_id:
                    votes.append(tx)
        return votes

    def get_all_transactions(self) -> list:
        """Get all vote transactions from the entire chain."""
        txs = []
        for block in self.chain:
            for tx in block.transactions:
                txs.append(tx)
        return txs

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def proof_of_work(self, previous_proof: int, max_iterations: int = 1_000_000) -> int:
        new_proof = 1
        check_proof = False
        iterations = 0
        while check_proof is False:
            iterations += 1
            if iterations > max_iterations:
                raise RuntimeError(f'proof_of_work exceeded {max_iterations} iterations')
            hash_operation = hashlib.sha256(str(new_proof**2 - previous_proof**2).encode()).hexdigest()
            if hash_operation[:4] == '0000':
                check_proof = True
            else:
                new_proof += 1
        return new_proof

    def is_chain_valid(self) -> bool:
        # Reload from disk to validate persisted state, not just in-memory state
        try:
            stored_chain = BlockchainStorage.load_chain()
            if stored_chain:
                self.chain = stored_chain
        except Exception as e:
            logger.warning(f'[is_chain_valid] Could not reload chain from disk: {e}')

        if not self.chain:
            return False
            
        previous_block = self.chain[0]
        block_index = 1
        target = '0' * MINING_DIFFICULTY
        
        while block_index < len(self.chain):
            block = self.chain[block_index]
            if block.previous_hash != previous_block.hash():
                logger.error(f"Invalid chain: Hash mismatch at Block {block.index}")
                return False
                
            hash_operation = hashlib.sha256(str(block.proof**2 - previous_block.proof**2).encode()).hexdigest()
            if not hash_operation.startswith(target):
                logger.error(f"Invalid chain: PoW mismatch at Block {block.index}")
                return False
                
            previous_block = block
            block_index += 1
            
        return True

    def mine_pending_votes(self) -> Optional[dict]:
        """Mines pending transactions instantly into an immutable block"""
        with _chain_lock:
            if not self.pending_votes:
                logger.info("No pending votes to mine.")
                return None
                
            last_block = self.last_block
            proof = self.proof_of_work(last_block.proof)
            previous_hash = last_block.hash()
            
            block = self.create_block(proof, previous_hash)
            logger.info(f"Successfully mined Block {block.index} with {len(block.transactions)} transactions.")
            return block.to_dict()

# Global singleton
voting_chain = Blockchain()
