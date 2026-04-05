# Simple local development script
Write-Host "Starting backend locally..." -ForegroundColor Green

# Copy environment file
if (!(Test-Path ".env")) {
    Copy-Item ".env.local" ".env"
    Write-Host "Environment file copied" -ForegroundColor Green
}

# Install if needed
if (!(Test-Path "node_modules")) {
    npm install
}

Write-Host "Server will start on http://localhost:8080" -ForegroundColor Cyan
npm run dev