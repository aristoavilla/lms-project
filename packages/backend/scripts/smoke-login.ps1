$ErrorActionPreference = "Stop"

$body = @{ email = "admin@school.edu"; password = "Password123!" } | ConvertTo-Json -Compress

try {
  $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8787/auth/login" -Method Post -ContentType "application/json" -Body $body
  Write-Output ("LOGIN_OK role=" + $resp.user.role + " email=" + $resp.user.email + " tokenPrefix=" + $resp.token.Substring(0, 20))
} catch {
  Write-Output ("LOGIN_FAIL " + $_.Exception.Message)
  if ($_.ErrorDetails.Message) {
    Write-Output $_.ErrorDetails.Message
  }
  exit 1
}
