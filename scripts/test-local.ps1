# Test ThinkPack Solo Backend API locally
Write-Host "🧪 Testing ThinkPack Solo Backend API..." -ForegroundColor Green

$BASE_URL = "http://localhost:8080"

Write-Host "Testing endpoints at $BASE_URL" -ForegroundColor Cyan

# Test health endpoint
Write-Host "`n1. Health Check:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "✅ Health: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "❌ Health check failed: $_" -ForegroundColor Red
}

# Test root endpoint
Write-Host "`n2. Root Endpoint:" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/" -Method Get
    Write-Host "✅ Service: $($response.message)" -ForegroundColor Green
} catch {
    Write-Host "❌ Root endpoint failed: $_" -ForegroundColor Red
}

# Test AI status (requires X-User-ID header)
Write-Host "`n3. AI Status:" -ForegroundColor Yellow
try {
    $headers = @{
        'X-User-ID' = 'test-user-dev'
        'Content-Type' = 'application/json'
    }
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/ai/status" -Method Get -Headers $headers
    Write-Host "✅ AI Status: $($response.data.totalAgents) agents" -ForegroundColor Green
} catch {
    Write-Host "❌ AI status failed: $_" -ForegroundColor Red
}

# Test conversations (requires X-User-ID header)
Write-Host "`n4. Conversations Endpoint:" -ForegroundColor Yellow
try {
    $headers = @{
        'X-User-ID' = 'test-user-dev'
        'Content-Type' = 'application/json'
    }
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/conversations" -Method Get -Headers $headers
    Write-Host "✅ Conversations: Found $($response.data.pagination.totalItems) conversations" -ForegroundColor Green
} catch {
    Write-Host "❌ Conversations failed: $_" -ForegroundColor Red
}

Write-Host "`n🎉 Local API testing complete!" -ForegroundColor Green
Write-Host "💡 Tip: Use Postman or curl for more detailed API testing" -ForegroundColor Blue