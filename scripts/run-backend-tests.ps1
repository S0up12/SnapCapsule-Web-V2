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
    'export SNAPCAPSULE_DATABASE_URL="postgresql+psycopg://${SNAPCAPSULE_DATABASE_USER}:${SNAPCAPSULE_DATABASE_PASSWORD}@${SNAPCAPSULE_DATABASE_HOST}:${SNAPCAPSULE_DATABASE_PORT}/${SNAPCAPSULE_DATABASE_NAME}" && export SNAPCAPSULE_TEST_DATABASE_URL="${SNAPCAPSULE_DATABASE_URL}_test" && python -m pip install -e ".[dev]" && alembic upgrade head && python -m pytest "$@"',
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
