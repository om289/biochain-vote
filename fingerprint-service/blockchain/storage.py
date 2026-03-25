import json
import os
from typing import List
from .models import Block
from .config import CHAIN_FILE_PATH, logger

class BlockchainStorage:
    @staticmethod
    def save_chain(chain: List[Block]):
        """Persists the blockchain securely to disk"""
        try:
            with open(CHAIN_FILE_PATH, 'w') as f:
                json.dump([block.to_dict() for block in chain], f, indent=4)
            logger.info("Blockchain successfully synced to disk.")
        except Exception as e:
            logger.error(f"Failed to save blockchain: {e}")

    @staticmethod
    def load_chain() -> List[Block]:
        """Loads the blockchain from disk if it exists"""
        if not os.path.exists(CHAIN_FILE_PATH):
            logger.info("No existing blockchain found on disk. Initializing fresh genesis chain.")
            return []
            
        try:
            with open(CHAIN_FILE_PATH, 'r') as f:
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
            logger.info(f"Loaded existing blockchain from disk containing {len(chain)} blocks.")
            return chain
        except Exception as e:
            logger.error(f"Failed to load blockchain: {e}")
            return []
