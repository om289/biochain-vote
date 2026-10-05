"""
Seed demo voters into Supabase for BioChain Vote.
Run once: python seed_supabase.py
"""
import os
import requests
from dotenv import load_dotenv

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

voters = [
    {"id": "11111111-1111-1111-1111-111111111111", "name": "Rajesh Kumar Sharma", "voter_id": "DL/04/001/234567", "location": "New Delhi",      "fingerprint_template": "SIM:verified"},
    {"id": "22222222-2222-2222-2222-222222222222", "name": "Priya Patel",          "voter_id": "GJ/06/002/345678", "location": "Ahmedabad East", "fingerprint_template": "SIM:verified"},
    {"id": "33333333-3333-3333-3333-333333333333", "name": "Amit Singh",           "voter_id": "UP/08/003/456789", "location": "Lucknow",        "fingerprint_template": "SIM:verified"},
    {"id": "44444444-4444-4444-4444-444444444444", "name": "Sneha Devi",           "voter_id": "MH/10/004/567890", "location": "Mumbai South",   "fingerprint_template": "SIM:verified"},
    {"id": "55555555-5555-5555-5555-555555555555", "name": "Vikram Reddy",         "voter_id": "TG/12/005/678901", "location": "Hyderabad",      "fingerprint_template": "SIM:verified"},
    {"id": "66666666-6666-6666-6666-666666666666", "name": "Ananya Chatterjee",    "voter_id": "WB/14/006/789012", "location": "Kolkata North",  "fingerprint_template": "SIM:verified"},
    {"id": "77777777-7777-7777-7777-777777777777", "name": "Ravi Menon",           "voter_id": "KL/16/007/890123", "location": "Kochi",          "fingerprint_template": "SIM:verified"},
    {"id": "88888888-8888-8888-8888-888888888888", "name": "Neha Gupta",           "voter_id": "MP/18/008/901234", "location": "Bhopal",         "fingerprint_template": "SIM:verified"},
    {"id": "99999999-9999-9999-9999-999999999999", "name": "Karthik Iyer",         "voter_id": "TN/20/009/012345", "location": "Chennai Central","fingerprint_template": "SIM:verified"},
    {"id": "00000000-0000-0000-0000-000000000010", "name": "Sita Ram",             "voter_id": "RJ/22/010/123456", "location": "Jaipur",         "fingerprint_template": "SIM:verified"},
]

print("Seeding voters into Supabase...")
r = requests.post(
    f"{SUPABASE_URL}/rest/v1/voters",
    json=voters,
    headers=HEADERS
)
print(f"Status: {r.status_code}")
if r.status_code in [200, 201]:
    print("✓ Voters seeded successfully!")
elif r.status_code == 409:
    print("✓ Voters already exist (conflict). All good.")
else:
    print(f"Response: {r.text}")

# Verify
r2 = requests.get(f"{SUPABASE_URL}/rest/v1/voters?select=id,name,voter_id,location", headers=HEADERS)
data = r2.json()
print(f"\nVoters in Supabase ({len(data)} total):")
for v in data:
    print(f"  - {v['name']} [{v['voter_id']}] @ {v['location']}")
