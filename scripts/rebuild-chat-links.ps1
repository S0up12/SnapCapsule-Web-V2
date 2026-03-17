param(
    [switch]$Apply
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$arguments = @("exec", "-T", "backend", "python", "/workspace/scripts/rebuild_chat_links.py")

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
