"""
Seed demo voters into Supabase for BioChain Vote.
Run once: python seed_supabase.py
"""
import requests

SUPABASE_URL = "https://hbuxgqnbbheyuwxmquvp.supabase.co"
SUPABASE_KEY = "sb_publishable_xA_NioJpy7-1JjhwipHUGA_Z40yHkCU"
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates"
}

voters = [
    {"id": "voter-001", "name": "Rajesh Kumar Sharma", "voter_id": "DL/04/001/234567", "location": "New Delhi",    "fingerprint_template": None},
    {"id": "voter-002", "name": "Priya Patel",          "voter_id": "GJ/06/002/345678", "location": "Ahmedabad East","fingerprint_template": None},
    {"id": "voter-003", "name": "Amit Singh",           "voter_id": "UP/08/003/456789", "location": "Lucknow",      "fingerprint_template": None},
    {"id": "voter-004", "name": "Sneha Devi",           "voter_id": "MH/10/004/567890", "location": "Mumbai South", "fingerprint_template": None},
    {"id": "voter-005", "name": "Vikram Reddy",         "voter_id": "TG/12/005/678901", "location": "Hyderabad",    "fingerprint_template": None},
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
