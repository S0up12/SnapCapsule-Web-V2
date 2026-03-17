param(
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$arguments = @("exec", "-T", "backend", "python", "/workspace/scripts/reclassify_audio_assets.py")

if ($Apply) {
    $arguments += "--apply"
}

Push-Location $repoRoot
try {
    docker compose @arguments
}
finally {
    Pop-Location
}
