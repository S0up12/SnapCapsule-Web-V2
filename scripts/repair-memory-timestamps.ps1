param(
  [switch]$Apply
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  $arguments = @("compose", "exec", "backend", "python", "scripts/repair_memory_timestamps_from_archives.py")
  if ($Apply) {
    $arguments += "--apply"
  }

  & docker @arguments
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
