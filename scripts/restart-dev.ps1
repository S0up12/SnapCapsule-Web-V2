param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$Services = @("backend", "worker", "frontend")
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot

Push-Location $repoRoot
try {
    docker compose restart @Services
}
finally {
    Pop-Location
}
