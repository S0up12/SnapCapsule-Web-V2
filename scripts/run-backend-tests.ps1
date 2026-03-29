param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PytestArgs = @()
)

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  & docker compose up -d db redis
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & docker compose build backend
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & docker compose run --rm backend python -m pip install -e ".[dev]"
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  & docker compose run --rm backend alembic upgrade head
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  $command = @("compose", "run", "--rm", "backend", "python", "-m", "pytest")
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
