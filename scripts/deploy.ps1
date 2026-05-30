param(
    [string]$ProjectId = "thinkpack-original",
    [string]$Region = "us-central1",
    [string]$ServiceName = "thinkpack-solo-backend"
)

$ErrorActionPreference = 'Stop'

$RepoRoot = Split-Path -Parent $PSScriptRoot

Write-Host "Deploying ThinkPack Solo Backend..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Cyan
Write-Host "Source: $RepoRoot" -ForegroundColor Cyan

gcloud run deploy $ServiceName `
    --source $RepoRoot `
    --allow-unauthenticated `
    --region=$Region `
    --project=$ProjectId `
    --memory=1Gi `
    --cpu=1 `
    --concurrency=80 `
    --timeout=300 `
    --max-instances=10 `
    --min-instances=0 `
    --update-env-vars="NODE_ENV=production,GOOGLE_CLOUD_PROJECT_ID=$ProjectId"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

$ServiceUrl = gcloud run services describe $ServiceName `
    --region=$Region `
    --project=$ProjectId `
    --format="value(status.url)"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment succeeded, but failed to fetch the service URL." -ForegroundColor Yellow
    exit 0
}

Write-Host "Deployment complete." -ForegroundColor Green
Write-Host "URL: $ServiceUrl" -ForegroundColor Cyan
Write-Host "Health check: $ServiceUrl/health" -ForegroundColor Cyan