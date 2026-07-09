import urllib.request
import json

url = 'https://lostfound-hun8.onrender.com/api/register.php'
data = json.dumps({"name": "Test", "email": "test@test.com", "password": "password123"}).encode('utf-8')
req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req) as f:
        print("STATUS:", f.status)
        print("BODY:", f.read().decode('utf-8', errors='replace'))
except urllib.error.HTTPError as e:
    print("HTTP ERROR:", e.code)
    print("BODY:", e.read().decode('utf-8', errors='replace'))
except Exception as e:
    print("OTHER ERROR:", e)
