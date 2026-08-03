param(
  [Parameter(Mandatory = $true)]
  [string]$CronSecret,

  [string]$BaseUrl = "https://cric4all.app",

  [switch]$Live
)

$path = if ($Live) {
  "/api/cron/team-kit-reminders"
} else {
  "/api/cron/team-kit-reminders?dryRun=1"
}

$uri = "$($BaseUrl.TrimEnd('/'))$path"

Write-Host "Calling $uri"

$response = Invoke-RestMethod `
  -Method GET `
  -Uri $uri `
  -Headers @{
    Authorization = "Bearer $CronSecret"
    "X-Cron-Source" = "manual-powershell-test"
  }

$response | ConvertTo-Json -Depth 12
