param(
    [string]$ProjectId = "thinkpack-original",
    [string]$Region = "us-central1",
    [string]$ServiceName = "thinkpack-solo-backend",
    [int]$Limit = 50,
    [string]$Freshness = "7d"
)

$ErrorActionPreference = 'Stop'

$filter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="' + $ServiceName + '" AND resource.labels.location="' + $Region + '" AND (httpRequest.requestUrl:"/api/ai/image" OR textPayload:Grok OR jsonPayload.message:Grok OR severity>=ERROR)'

Write-Host "Fetching Grok image backend logs..." -ForegroundColor Green
Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan
Write-Host "Service: $ServiceName" -ForegroundColor Cyan
Write-Host "Freshness: $Freshness" -ForegroundColor Cyan
Write-Host "Limit: $Limit" -ForegroundColor Cyan

& gcloud logging read $filter "--project=$ProjectId" "--limit=$Limit" "--freshness=$Freshness" "--order=desc" "--format=json"

exit $LASTEXITCODE