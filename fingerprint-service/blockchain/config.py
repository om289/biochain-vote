import logging
import os

# Mining Difficulty (number of leading zeros required)
MINING_DIFFICULTY = 4

# Base directory for the blockchain module
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'data')
CHAIN_FILE_PATH = os.path.join(DATA_DIR, 'chain_data.json')

# Ensure data directory exists
os.makedirs(DATA_DIR, exist_ok=True)

# Enterprise Logging Configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(name)s - %(message)s'
)
logger = logging.getLogger('BioChain')
