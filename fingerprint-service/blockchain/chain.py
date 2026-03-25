import time
import hashlib
from typing import List, Optional
from .models import Block, VoteTransaction
from .storage import BlockchainStorage
from .config import MINING_DIFFICULTY, logger

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
        for block in self.chain:
            for tx in block.transactions:
                if tx.get('voter_id') == voter_id and tx.get('election_id') == election_id:
                    return True
        for pending_tx in self.pending_votes:
             if pending_tx.get('voter_id') == voter_id and pending_tx.get('election_id') == election_id:
                 return True
        return False

    @property
    def last_block(self) -> Block:
        return self.chain[-1]

    def proof_of_work(self, previous_proof: int) -> int:
        new_proof = 1
        target = '0' * MINING_DIFFICULTY
        while True:
            hash_operation = hashlib.sha256(str(new_proof**2 - previous_proof**2).encode()).hexdigest()
            if hash_operation.startswith(target):
                return new_proof
            new_proof += 1

    def is_chain_valid(self) -> bool:
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
