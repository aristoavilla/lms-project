$ErrorActionPreference = "Stop"

$json = @{ email = "admin@school.edu"; password = "Password123!" } | ConvertTo-Json -Compress
$tmpPath = [System.IO.Path]::GetTempFileName()

try {
	$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
	[System.IO.File]::WriteAllText($tmpPath, $json, $utf8NoBom)
	curl.exe -s -X POST http://127.0.0.1:8787/auth/login -H "Content-Type: application/json" --data-binary "@$tmpPath"
} finally {
	Remove-Item -Path $tmpPath -ErrorAction SilentlyContinue
}
