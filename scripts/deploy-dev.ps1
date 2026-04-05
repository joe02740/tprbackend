# Deploy ThinkPack Solo Backend to DEV environment
Write-Host "🚀 Deploying ThinkPack Solo Backend to DEV environment..." -ForegroundColor Green

# Set project (update with your actual project ID)
$PROJECT_ID = "thinkpack-original"
$REGION = "us-central1"
$SERVICE_NAME = "thinkpack-solo-backend-dev"

Write-Host "📦 Project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host "🌍 Region: $REGION" -ForegroundColor Cyan
Write-Host "🔧 Service: $SERVICE_NAME" -ForegroundColor Cyan

# Build and deploy using Cloud Build
gcloud run deploy $SERVICE_NAME `
    --source . `
    --allow-unauthenticated `
    --region=$REGION `
    --project=$PROJECT_ID `
    --memory=512Mi `
    --cpu=1 `
    --concurrency=80 `
    --timeout=300 `
    --max-instances=10 `
    --min-instances=0 `
    --set-env-vars="NODE_ENV=development" `
    --set-env-vars="PORT=8080"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Dev deployment complete!" -ForegroundColor Green
    Write-Host "🌐 URL: https://$SERVICE_NAME-[PROJECT-HASH].$REGION.run.app" -ForegroundColor Cyan
    Write-Host "🔍 Health check: https://$SERVICE_NAME-[PROJECT-HASH].$REGION.run.app/health" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor White
    Write-Host "📋 Next steps:" -ForegroundColor Yellow
    Write-Host "1. Set up MongoDB Atlas connection string in Cloud Run environment variables" -ForegroundColor White
    Write-Host "2. Configure AI API keys (OPENAI_API_KEY, GOOGLE_AI_API_KEY, etc.)" -ForegroundColor White
    Write-Host "3. Test the API endpoints using the health check" -ForegroundColor White
} else {
    Write-Host "❌ Deployment failed!" -ForegroundColor Red
    exit 1
}