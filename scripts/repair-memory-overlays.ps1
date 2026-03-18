param(
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$arguments = @("exec", "-T", "backend", "python", "/workspace/scripts/repair_memory_overlays.py")

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
