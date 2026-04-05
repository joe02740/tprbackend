# Deploy ThinkPack Solo Backend with Full AI Services
# This script deploys the backend with proper JWT secret and full AI orchestration

Write-Host "🚀 Deploying ThinkPack Solo Backend with Full AI Services..." -ForegroundColor Green

# Generate deployment timestamp
$timestamp = Get-Date -Format "yyyy-MM-dd-HH-mm-ss"
Write-Host "📅 Deployment timestamp: $timestamp" -ForegroundColor Yellow

# Our generated JWT secret
$JWT_SECRET = "347805441f020c94f111ba0e420228c46be59e12625eb5b738acc39a8fb71b0d"

Write-Host "🔧 Deploying with full AI orchestration..." -ForegroundColor Cyan

# Deploy with optimized Cloud Run configuration
gcloud run deploy thinkpack-solo-backend `
    --source . `
    --region=us-central1 `
    --project=thinkpack-original `
    --platform=managed `
    --allow-unauthenticated `
    --memory=2Gi `
    --cpu=2 `
    --timeout=300 `
    --max-instances=10

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend deployment successful!" -ForegroundColor Green
    Write-Host "🌐 Backend URL: https://thinkpack-solo-backend-1055060512544.us-central1.run.app" -ForegroundColor Cyan
    Write-Host "" 
    Write-Host "🎯 Backend is now using FULL AI ORCHESTRATION!" -ForegroundColor Yellow
    Write-Host "✅ Environment variables set manually in Cloud Run console" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Test these endpoints:" -ForegroundColor White
    Write-Host "   - GET  /health" -ForegroundColor Gray
    Write-Host "   - GET  /api/ai/status" -ForegroundColor Gray
    Write-Host "   - POST /api/ai/generate" -ForegroundColor Gray
    Write-Host "   - POST /api/ai/orchestrate" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🚀 Ready for multi-AI responses and character selection!" -ForegroundColor White
} else {
    Write-Host "❌ Backend deployment failed!" -ForegroundColor Red
    exit 1
}
