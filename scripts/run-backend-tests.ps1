param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PytestArgs = @()
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$composeFile = "docker-compose.dev.yml"
Push-Location $repoRoot

try {
  & docker compose -f $composeFile up -d db redis
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & docker compose -f $composeFile build backend
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $command = @(
    "compose",
    "-f",
    $composeFile,
    "run",
    "--rm",
    "backend",
    "sh",
    "-lc",
    'python -m pip install -e ".[dev]" && alembic upgrade head && python -m pytest "$@"',
    "pytest"
  )
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
