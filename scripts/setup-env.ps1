param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("production")]
    [string]$Environment,

    [Parameter(Mandatory=$true)]
    [string]$ProjectId,

    [Parameter(Mandatory=$true)]
    [string]$MongoDbUri,

    [string]$OpenAiKey = "",
    [string]$GoogleAiKey = "",
    [string]$AzureOpenAiKey = "",
    [string]$AzureOpenAiEndpoint = "",
    [string]$JwtSecret = ""
)

# Setup environment variables for ThinkPack Solo Backend
Write-Host "Setting up environment variables for ThinkPack Solo Backend..." -ForegroundColor Green

$SERVICE_NAME = "thinkpack-solo-backend"
$REGION = "us-central1"

Write-Host "Project: $ProjectId" -ForegroundColor Cyan
Write-Host "Service: $SERVICE_NAME" -ForegroundColor Cyan
Write-Host "Environment: $Environment" -ForegroundColor Cyan

# Generate JWT secret if not provided
if ([string]::IsNullOrEmpty($JwtSecret)) {
    $JwtSecret = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes([System.Guid]::NewGuid().ToString() + [System.Guid]::NewGuid().ToString()))
    Write-Host "Generated new JWT secret" -ForegroundColor Yellow
}

# Build environment variables array
$envVars = @(
    "NODE_ENV=$Environment",
    "MONGODB_URI=$MongoDbUri",
    "MONGODB_DATABASE=thinkpack_solo",
    "JWT_SECRET=$JwtSecret",
    "GOOGLE_CLOUD_PROJECT_ID=$ProjectId",
    "VERTEX_AI_LOCATION=us-east5"
)

# Add API keys if provided
if (![string]::IsNullOrEmpty($OpenAiKey)) {
    $envVars += "OPENAI_API_KEY=$OpenAiKey"
    Write-Host "OpenAI API key configured" -ForegroundColor Green
}

if (![string]::IsNullOrEmpty($GoogleAiKey)) {
    $envVars += "GOOGLE_AI_API_KEY=$GoogleAiKey"
    Write-Host "Google AI API key configured" -ForegroundColor Green
}

if (![string]::IsNullOrEmpty($AzureOpenAiKey)) {
    $envVars += "AZURE_OPENAI_API_KEY=$AzureOpenAiKey"
    $envVars += "USE_AZURE_OPENAI=true"
    Write-Host "Azure OpenAI API key configured" -ForegroundColor Green

    if (![string]::IsNullOrEmpty($AzureOpenAiEndpoint)) {
        $envVars += "AZURE_OPENAI_ENDPOINT=$AzureOpenAiEndpoint"
        Write-Host "Azure OpenAI endpoint configured" -ForegroundColor Green
    }
}

# Environment-specific settings
if ($Environment -eq "prod") {
    $envVars += "LOG_LEVEL=info"
    $envVars += "RATE_LIMIT_MAX_REQUESTS=100"
} else {
    $envVars += "LOG_LEVEL=debug"
    $envVars += "RATE_LIMIT_MAX_REQUESTS=1000"
}

# Apply environment variables to Cloud Run service
Write-Host "Applying environment variables to Cloud Run service..." -ForegroundColor Blue

$envVarString = $envVars -join ","

try {
    gcloud run services update $SERVICE_NAME `
        --region=$REGION `
        --project=$ProjectId `
        --set-env-vars=$envVarString

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Environment variables applied successfully!" -ForegroundColor Green
        Write-Host "" -ForegroundColor White
        Write-Host "Verify deployment:" -ForegroundColor Yellow
        Write-Host "gcloud run services describe $SERVICE_NAME --region=$REGION --project=$ProjectId" -ForegroundColor White
        Write-Host "" -ForegroundColor White
        Write-Host "Test the service:" -ForegroundColor Yellow
        Write-Host "curl https://$SERVICE_NAME-[PROJECT-HASH].$REGION.run.app/health" -ForegroundColor White
    } else {
        Write-Host "Failed to apply environment variables!" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "Error applying environment variables: $_" -ForegroundColor Red
    exit 1
}

# Security reminder
Write-Host "" -ForegroundColor White
Write-Host "Security Reminders:" -ForegroundColor Red
Write-Host "1. Keep your API keys secure and rotate them regularly" -ForegroundColor White
Write-Host "2. Monitor usage and costs for all AI services" -ForegroundColor White
Write-Host "3. Set up proper monitoring and alerting" -ForegroundColor White
Write-Host "4. Review access logs regularly" -ForegroundColor White