import asyncio
import httpx
import uuid
import sys

BASE_URL = "http://localhost:8000/api/v1"

async def verify():
    print("Testing Milestone 2 Implementation...")
    
    async with httpx.AsyncClient(base_url=BASE_URL) as client:
        try:
            # 1. Check health
            r = await client.get("/health")
            print(f"Health check: {r.status_code}")
        except Exception as e:
            print(f"Connection failed: {e}")
            print("Make sure the API server is running with 'pnpm dev' or 'uvicorn main:app --reload'")
            return

        # 2. Submit incident
        print("Submitting incident...")
        r = await client.post("/incidents", data={
            "type": "flooding",
            "lat": 6.9271,
            "lon": 3.3958,
            "severity": "high",
            "description": "Heavy flooding near the main gate"
        })
        if r.status_code != 201:
            print(f"FAILED: Submit incident returned {r.status_code}")
            print(r.json())
            return
        
        data = r.json()["data"]
        incident_id = data["incident_id"]
        print(f"SUCCESS: Incident created ID={incident_id}")

        # 3. Duplicate detection
        print("Submitting duplicate incident...")
        r = await client.post("/incidents", data={
            "type": "flooding",
            "lat": 6.92715,
            "lon": 3.39582,
            "severity": "medium"
        })
        data = r.json()["data"]
        if data.get("is_duplicate"):
            print("SUCCESS: Duplicate detected correctly.")
        else:
            print("FAILED: Duplicate NOT detected.")

        # 4. Get incident
        print("Fetching incident detail...")
        r = await client.get(f"/incidents/{incident_id}")
        if r.status_code == 200:
            print("SUCCESS: Incident details retrieved.")
        else:
            print(f"FAILED: Could not retrieve incident. Status={r.status_code}")

    print("\nVerification Complete.")

if __name__ == "__main__":
    asyncio.run(verify())
