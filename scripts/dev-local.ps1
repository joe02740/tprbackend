# Run ThinkPack Solo Backend locally for development
Write-Host "Starting ThinkPack Solo Backend locally..." -ForegroundColor Green

$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot

# Copy local environment file if .env doesn't exist
if (!(Test-Path ".env")) {
    if (Test-Path ".env.local") {
        Copy-Item ".env.local" ".env"
        Write-Host "Copied .env.local to .env" -ForegroundColor Green
    } else {
        Write-Host "No .env file found. Copy .env.local to .env and add your API keys" -ForegroundColor Yellow
        Write-Host "Example: Copy-Item '.env.local' '.env'" -ForegroundColor White
        exit 1
    }
}

# Install dependencies if node_modules doesn't exist
if (!(Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Blue
    npm install
}

Write-Host "Starting server on http://localhost:8080" -ForegroundColor Cyan
Write-Host "Health check: http://localhost:8080/health" -ForegroundColor Cyan
Write-Host "API docs: http://localhost:8080/" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow

# Start the server with nodemon for auto-restart
try {
    npm run dev
} finally {
    Pop-Location
}