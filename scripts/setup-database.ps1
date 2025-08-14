# Payment System Database Setup Script (PowerShell)
# This script automates the database setup process for the iRecharge Payment System

param(
    [string]$DbName = "payment_system_dev",
    [string]$DbUser = "payment_user", 
    [string]$DbHost = "localhost",
    [int]$DbPort = 5432,
    [switch]$SkipPrompts
)

# Add required assembly for password generation
Add-Type -AssemblyName System.Web

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-ColorText {
    param([string]$Text, [string]$Color = "White")
    Write-Host $Text -ForegroundColor $Color
}

function Test-PostgreSQL {
    Write-ColorText "Checking PostgreSQL installation..." $Blue
    try {
        $null = Get-Command psql -ErrorAction Stop
        Write-ColorText "✓ PostgreSQL found" $Green
        return $true
    }
    catch {
        Write-ColorText "✗ PostgreSQL is not installed or not in PATH" $Red
        Write-ColorText "Please install PostgreSQL first:" $Yellow
        Write-ColorText "  Download from: https://www.postgresql.org/download/windows/" $Yellow
        Write-ColorText "  Make sure to add PostgreSQL bin folder to your PATH" $Yellow
        return $false
    }
}

function Test-PostgreSQLService {
    Write-ColorText "Checking PostgreSQL service..." $Blue
    try {
        $result = & pg_isready -h localhost -p 5432 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorText "✓ PostgreSQL service is running" $Green
            return $true
        }
        else {
            throw "Service not running"
        }
    }
    catch {
        Write-ColorText "✗ PostgreSQL service is not running" $Red
        Write-ColorText "Please start PostgreSQL service:" $Yellow
        Write-ColorText "  - Open Services (services.msc)" $Yellow
        Write-ColorText "  - Find 'postgresql' service and start it" $Yellow
        return $false
    }
}

function Get-DatabaseConfig {
    if ($SkipPrompts) {
        return @{
            DbName = $DbName
            DbUser = $DbUser
            DbHost = $DbHost
            DbPort = $DbPort
        }
    }

    Write-ColorText "`nDatabase Configuration" $Blue
    Write-ColorText "Press Enter to use default values shown in brackets" $Yellow
    
    $config = @{}
    
    $input = Read-Host "Database name [$DbName]"
    $config.DbName = if ($input) { $input } else { $DbName }
    
    $input = Read-Host "Database user [$DbUser]"
    $config.DbUser = if ($input) { $input } else { $DbUser }
    
    $input = Read-Host "Database host [$DbHost]"
    $config.DbHost = if ($input) { $input } else { $DbHost }
    
    $input = Read-Host "Database port [$DbPort]"
    $config.DbPort = if ($input) { [int]$input } else { $DbPort }
    
    $config.DbPassword = Read-Host "Database password for $($config.DbUser)" -AsSecureString
    $config.AdminPassword = Read-Host "PostgreSQL admin password (for user creation)" -AsSecureString
    
    Write-Host "`nConfiguration:"
    Write-Host "  Database: $($config.DbName)"
    Write-Host "  User: $($config.DbUser)"
    Write-Host "  Host: $($config.DbHost)"
    Write-Host "  Port: $($config.DbPort)"
    Write-Host ""
    
    return $config
}

function New-Database {
    param($Config)
    
    Write-ColorText "Creating database and user..." $Blue
    
    $adminPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Config.AdminPassword))
    $userPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Config.DbPassword))
    
    $env:PGPASSWORD = $adminPwd
    
    # Create user if it doesn't exist
    Write-ColorText "Creating user '$($Config.DbUser)'..." $Yellow
    $createUserSQL = "DO `$`$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$($Config.DbUser)') THEN CREATE USER $($Config.DbUser) WITH PASSWORD '$userPwd'; ALTER USER $($Config.DbUser) CREATEDB; GRANT ALL PRIVILEGES ON DATABASE postgres TO $($Config.DbUser); END IF; END `$`$;"
    
    try {
        $null = & psql -h $Config.DbHost -p $Config.DbPort -U postgres -c $createUserSQL 2>&1
        if ($LASTEXITCODE -ne 0) { 
            throw "User creation failed" 
        }
    }
    catch {
        Write-ColorText "✗ Failed to create user. Please check admin password." $Red
        return $false
    }
    
    # Create database
    Write-ColorText "Creating database '$($Config.DbName)'..." $Yellow
    $createDbSQL = "SELECT 'CREATE DATABASE $($Config.DbName) OWNER $($Config.DbUser)' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$($Config.DbName)')\gexec"
    
    try {
        $null = & psql -h $Config.DbHost -p $Config.DbPort -U postgres -c $createDbSQL 2>&1
    }
    catch {
        Write-ColorText "✗ Failed to create database." $Red
        return $false
    }
    
    # Grant privileges
    Write-ColorText "Granting privileges..." $Yellow
    $grantSQL = "GRANT ALL PRIVILEGES ON DATABASE $($Config.DbName) TO $($Config.DbUser); ALTER DATABASE $($Config.DbName) OWNER TO $($Config.DbUser);"
    $null = & psql -h $Config.DbHost -p $Config.DbPort -U postgres -c $grantSQL 2>&1
    
    Write-ColorText "✓ Database and user created successfully" $Green
    return $true
}

function Test-DatabaseConnection {
    param($Config)
    
    Write-ColorText "Testing database connection..." $Blue
    
    $userPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Config.DbPassword))
    $env:PGPASSWORD = $userPwd
    
    try {
        $null = & psql -h $Config.DbHost -p $Config.DbPort -U $Config.DbUser -d $Config.DbName -c "SELECT version();" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-ColorText "✓ Database connection successful" $Green
            return $true
        }
        else {
            throw "Connection failed"
        }
    }
    catch {
        Write-ColorText "✗ Failed to connect to database" $Red
        return $false
    }
}

function New-EnvFile {
    param($Config)
    
    Write-ColorText "Creating .env file..." $Blue
    
    if (Test-Path ".env") {
        Write-ColorText "Warning: .env file already exists" $Yellow
        if (-not $SkipPrompts) {
            $backup = Read-Host "Do you want to backup and recreate it? (y/N)"
            if ($backup -match "^[Yy]$") {
                $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
                Rename-Item ".env" ".env.backup.$timestamp"
                Write-ColorText "Backed up existing .env file" $Yellow
            }
            else {
                Write-ColorText "Keeping existing .env file. Please update database settings manually." $Yellow
                return
            }
        }
    }
    
    # Generate secure keys
    $jwtSecret = [System.Web.Security.Membership]::GeneratePassword(32, 8)
    $jwtRefreshSecret = [System.Web.Security.Membership]::GeneratePassword(32, 8)  
    $encryptionKey = [System.Web.Security.Membership]::GeneratePassword(32, 8)
    $webhookSecret = [System.Web.Security.Membership]::GeneratePassword(24, 6)
    
    $userPwd = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($Config.DbPassword))
    
    $envContent = @"
# Application Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database Configuration
DATABASE_TYPE=postgres
DATABASE_HOST=$($Config.DbHost)
DATABASE_PORT=$($Config.DbPort)
DATABASE_USERNAME=$($Config.DbUser)
DATABASE_PASSWORD=$userPwd
DATABASE_NAME=$($Config.DbName)
DATABASE_SYNC=false
DATABASE_LOGGING=true

# JWT Configuration
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=$jwtRefreshSecret
JWT_REFRESH_EXPIRES_IN=7d

# AWS Configuration (Optional for local development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/payment-events

# Encryption Configuration
ENCRYPTION_KEY=$encryptionKey
BCRYPT_ROUNDS=10

# Webhook Configuration
WEBHOOK_SECRET=$webhookSecret

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=combined
"@
    
    $envContent | Out-File -FilePath ".env" -Encoding UTF8
    Write-ColorText "✓ .env file created with secure keys" $Green
}

function Invoke-Migrations {
    Write-ColorText "Running database migrations..." $Blue
    
    if (-not (Test-Path "package.json")) {
        Write-ColorText "✗ package.json not found. Please run this script from the project root." $Red
        return $false
    }
    
    # Install dependencies if needed
    if (-not (Test-Path "node_modules")) {
        Write-ColorText "Installing dependencies..." $Yellow
        npm install
    }
    
    # Run migrations
    npm run migration:run
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorText "✓ Database migrations completed" $Green
        return $true
    }
    else {
        Write-ColorText "✗ Migration failed" $Red
        return $false
    }
}

function Show-NextSteps {
    param($Config)
    
    Write-Host ""
    Write-ColorText "Database setup completed successfully!" $Green
    Write-Host "=================================================="
    Write-Host ""
    Write-ColorText "Next steps:" $Blue
    Write-Host "1. Start the development server:"
    Write-ColorText "   npm run start:dev" $Yellow
    Write-Host ""
    Write-Host "2. Access the API documentation:"
    Write-ColorText "   http://localhost:3000/api/docs" $Yellow
    Write-Host ""
    Write-Host "3. Test the API endpoints using the Swagger UI or your preferred API client"
    Write-Host ""
    Write-ColorText "Available commands:" $Blue
    Write-ColorText "  npm run start:dev     - Start development server" $Yellow
    Write-ColorText "  npm run test          - Run tests" $Yellow
    Write-ColorText "  npm run build         - Build for production" $Yellow
    Write-ColorText "  npm run migration:run - Run new migrations" $Yellow
    Write-Host ""
    Write-ColorText "Database connection details:" $Blue
    Write-Host "  Host: $($Config.DbHost):$($Config.DbPort)"
    Write-Host "  Database: $($Config.DbName)"
    Write-Host "  User: $($Config.DbUser)"
    Write-Host ""
}

# Main execution
try {
    Write-ColorText "iRecharge Payment System Database Setup" $Blue
    Write-Host "=================================================="
    
    # Check prerequisites
    if (-not (Test-PostgreSQL)) { exit 1 }
    if (-not (Test-PostgreSQLService)) { exit 1 }
    
    # Get configuration
    $config = Get-DatabaseConfig
    
    if ($config.DbPassword -and $config.AdminPassword) {
        # Create database and user
        if (-not (New-Database $config)) { exit 1 }
        
        # Test connection
        if (-not (Test-DatabaseConnection $config)) { exit 1 }
    }
    
    # Create .env file
    New-EnvFile $config
    
    # Run migrations
    if (-not (Invoke-Migrations)) { exit 1 }
    
    # Show next steps
    Show-NextSteps $config
}
catch {
    Write-ColorText "Setup failed: $($_.Exception.Message)" $Red
    exit 1
}
finally {
    # Clean up environment variables
    $env:PGPASSWORD = $null
}