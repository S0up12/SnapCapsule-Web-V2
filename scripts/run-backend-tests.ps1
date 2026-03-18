param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PytestArgs = @()
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  & docker compose exec backend python -m pip install -e ".[dev]"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $command = @("compose", "exec", "backend", "python", "-m", "pytest")
  if ($PytestArgs.Count -gt 0) {
    $command += $PytestArgs
  } else {
    $command += @("tests", "-q")
  }

  & docker @command
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
