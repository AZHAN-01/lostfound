import urllib.request
import json
import uuid

url_reg = 'https://lostfound-hun8.onrender.com/api/register.php'
email = 'test_' + str(uuid.uuid4())[:8] + '@gmail.com'
password = 'password123'
phone = '1234567890'
address = '123 Test St'
name = 'Test User'

# 1. Register
data_reg = json.dumps({"id": str(uuid.uuid4()), "name": name, "email": email, "password": password, "phone": phone, "address": address}).encode('utf-8')
req_reg = urllib.request.Request(url_reg, data=data_reg, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req_reg) as f:
        print("REG STATUS:", f.status)
        print("REG BODY:", f.read().decode('utf-8', errors='replace'))
except urllib.error.HTTPError as e:
    print("REG HTTP ERROR:", e.code)
    print("REG BODY:", e.read().decode('utf-8', errors='replace'))

# 2. Login
url_login = 'https://lostfound-hun8.onrender.com/api/login.php'
data_login = json.dumps({"identifier": email, "password": password}).encode('utf-8')
req_login = urllib.request.Request(url_login, data=data_login, headers={'Content-Type': 'application/json'})
try:
    with urllib.request.urlopen(req_login) as f:
        print("LOGIN STATUS:", f.status)
        print("LOGIN BODY:", f.read().decode('utf-8', errors='replace'))
except urllib.error.HTTPError as e:
    print("LOGIN HTTP ERROR:", e.code)
    print("LOGIN BODY:", e.read().decode('utf-8', errors='replace'))
