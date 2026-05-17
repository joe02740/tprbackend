Write-Host "deploy-simple.ps1 is deprecated. Use .\deploy.ps1 for the single backend service." -ForegroundColor Yellow
& "$PSScriptRoot\deploy.ps1"
exit $LASTEXITCODE
