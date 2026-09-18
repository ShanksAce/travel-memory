Set-Location -LiteralPath $PSScriptRoot
$taskNode=(Get-Command node -ErrorAction Stop).Source
$taskNpm=Join-Path (Split-Path $taskNode) 'node_modules/npm/bin/npm-cli.js'
if (!(Test-Path -LiteralPath 'node_modules/vinext')) { Write-Host '請先依 README.md 安裝套件並初始化資料庫。'; exit 1 }
Write-Host 'Travel Memory 專題啟動中，請開啟下方顯示的 Local 網址。'
& $taskNode $taskNpm run dev -- --hostname 127.0.0.1

