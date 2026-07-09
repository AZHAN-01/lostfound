import urllib.request
import json

url_login = 'https://lostfound-hun8.onrender.com/api/login.php'
data_login = json.dumps({"identifier": "6006993965", "password": "azhan@123"}).encode('utf-8')
req_login = urllib.request.Request(url_login, data=data_login, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req_login) as f:
        print("LOGIN STATUS:", f.status)
        print("LOGIN BODY:", f.read().decode('utf-8', errors='replace'))
except urllib.error.HTTPError as e:
    print("LOGIN HTTP ERROR:", e.code)
    print("LOGIN BODY:", e.read().decode('utf-8', errors='replace'))
except Exception as e:
    print("OTHER ERROR:", e)
