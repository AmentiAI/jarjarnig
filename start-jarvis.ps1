$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (Test-Path $ollama) {
  Start-Process -FilePath $ollama -ArgumentList 'serve' -WindowStyle Hidden -ErrorAction SilentlyContinue
}

Write-Host 'Starting J.A.R.V.I.S. on http://localhost:3001'
Start-Process -FilePath 'npx' -ArgumentList 'next','dev','-p','3001' -WorkingDirectory $root
Start-Sleep -Seconds 3
Write-Host 'Opening a public HTTPS tunnel for your phone...'
npx --yes cloudflared tunnel --url http://localhost:3001
