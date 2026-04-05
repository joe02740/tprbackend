# Deploy ThinkPack Solo Backend to PRODUCTION environment
Write-Host "Deploying ThinkPack Solo Backend to PRODUCTION environment..." -ForegroundColor Red

# Set project (update with your actual project ID)
$PROJECT_ID = "thinkpack-original"
$REGION = "us-central1"
$SERVICE_NAME = "thinkpack-solo-backend"

Write-Host "Project: $PROJECT_ID" -ForegroundColor Cyan
Write-Host "Region: $REGION" -ForegroundColor Cyan
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Cyan

# Confirmation prompt for production
Write-Host "WARNING: This will deploy to PRODUCTION!" -ForegroundColor Red
$confirmation = Read-Host "Are you sure you want to proceed? (yes/no)"
if ($confirmation -ne "yes") {
    Write-Host "Deployment cancelled." -ForegroundColor Yellow
    exit 0
}

# Build and deploy using Cloud Build with production settings
gcloud run deploy $SERVICE_NAME `
    --source . `
    --allow-unauthenticated `
    --region=$REGION `
    --project=$PROJECT_ID `
    --memory=1Gi `
    --cpu=2 `
    --concurrency=100 `
    --timeout=300 `
    --max-instances=20 `
    --min-instances=1 `
    --set-env-vars="NODE_ENV=production" `
    --set-env-vars="PORT=8080" `
    --set-env-vars="LOG_LEVEL=info"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Production deployment complete!" -ForegroundColor Green
    Write-Host "URL: https://$SERVICE_NAME-[PROJECT-HASH].$REGION.run.app" -ForegroundColor Cyan
    Write-Host "Health check: https://$SERVICE_NAME-[PROJECT-HASH].$REGION.run.app/health" -ForegroundColor Cyan
    Write-Host "" -ForegroundColor White
    Write-Host "IMPORTANT: Verify these production settings:" -ForegroundColor Red
    Write-Host "1. MongoDB Atlas production cluster connected" -ForegroundColor White
    Write-Host "2. All AI API keys configured and working" -ForegroundColor White
    Write-Host "3. Rate limiting configured appropriately" -ForegroundColor White
    Write-Host "4. Monitoring and alerts set up" -ForegroundColor White
    Write-Host "5. Security headers and CORS configured" -ForegroundColor White
} else {
    Write-Host "Production deployment failed!" -ForegroundColor Red
    exit 1
}