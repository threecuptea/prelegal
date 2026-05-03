# Build and start the Prelegal stack on Windows.
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location (Join-Path $ScriptDir "..")

docker compose up --build -d
Write-Host "Prelegal is starting at http://localhost:8000"
