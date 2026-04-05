Write-Host "🚀 Deploying to DEV environment..." -ForegroundColor Green

gcloud run deploy thinkpack-solo-backend `
    --source . `
    --allow-unauthenticated `
    --region=us-central1 `
    --project=thinkpack-original

Write-Host "✅ Dev deployment complete!" -ForegroundColor Green
Write-Host "🌐 URL: https://thinkpack-solo-backend-1055060512544.us-central1.run.app" -ForegroundColor Cyan