$ErrorActionPreference = "Stop"

$json = '{"email":"admin@school.edu","password":"Password123!"}'
curl.exe -s -X POST http://127.0.0.1:8787/auth/login -H "Content-Type: application/json" --data $json
