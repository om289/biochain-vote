import os
import requests
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json"
}

def check_table(name):
    r = requests.get(f"{SUPABASE_URL}/rest/v1/{name}?select=count", headers=HEADERS)
    print(f"Table {name}: {r.status_code} {r.text}")

for t in ["elections", "candidates", "booths", "blocks", "voters", "votes"]:
    check_table(t)

