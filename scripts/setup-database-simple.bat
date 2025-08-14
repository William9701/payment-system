@echo off
REM Simplified Database Setup Script (Windows)
REM Skips service checks and goes straight to configuration

echo.
echo ==========================================
echo iRecharge Payment System Database Setup
echo ==========================================
echo.

:: Default configuration
set DEFAULT_DB_NAME=payment_system_dev
set DEFAULT_DB_USER=payment_user
set DEFAULT_DB_HOST=localhost
set DEFAULT_DB_PORT=5432

echo Database Configuration
echo Press Enter to use default values shown in brackets
echo.

set /p DB_NAME="Database name [%DEFAULT_DB_NAME%]: "
if "%DB_NAME%"=="" set DB_NAME=%DEFAULT_DB_NAME%

set /p DB_USER="Database user [%DEFAULT_DB_USER%]: "
if "%DB_USER%"=="" set DB_USER=%DEFAULT_DB_USER%

set /p DB_HOST="Database host [%DEFAULT_DB_HOST%]: "
if "%DB_HOST%"=="" set DB_HOST=%DEFAULT_DB_HOST%

set /p DB_PORT="Database port [%DEFAULT_DB_PORT%]: "
if "%DB_PORT%"=="" set DB_PORT=%DEFAULT_DB_PORT%

set /p DB_PASSWORD="Database password for %DB_USER%: "
set /p ADMIN_PASSWORD="PostgreSQL admin password (for user creation): "

echo.
echo Configuration:
echo   Database: %DB_NAME%
echo   User: %DB_USER%
echo   Host: %DB_HOST%
echo   Port: %DB_PORT%
echo.

:: Create database and user
echo Creating database and user...

:: Create user if it doesn't exist
echo Creating user '%DB_USER%'...
set PGPASSWORD=%ADMIN_PASSWORD%
psql -h %DB_HOST% -p %DB_PORT% -U postgres -c "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '%DB_USER%') THEN CREATE USER %DB_USER% WITH PASSWORD '%DB_PASSWORD%'; ALTER USER %DB_USER% CREATEDB; GRANT ALL PRIVILEGES ON DATABASE postgres TO %DB_USER%; END IF; END $$;" >nul 2>&1

if errorlevel 1 (
    echo Failed to create user. Please check admin password.
    pause
    exit /b 1
)

:: Create database if it doesn't exist
echo Creating database '%DB_NAME%'...
psql -h %DB_HOST% -p %DB_PORT% -U postgres -c "SELECT 'CREATE DATABASE %DB_NAME% OWNER %DB_USER%' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '%DB_NAME%')\gexec" >nul 2>&1

:: Grant privileges
echo Granting privileges...
psql -h %DB_HOST% -p %DB_PORT% -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE %DB_NAME% TO %DB_USER%; ALTER DATABASE %DB_NAME% OWNER TO %DB_USER%;" >nul 2>&1

echo Database and user created successfully

:: Test database connection
echo Testing database connection...
set PGPASSWORD=%DB_PASSWORD%
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -c "SELECT version();" >nul 2>&1

if errorlevel 1 (
    echo Failed to connect to database
    pause
    exit /b 1
)
echo Database connection successful

:: Create .env file
echo Creating .env file...

if exist ".env" (
    echo Warning: .env file already exists
    set /p backup_env="Do you want to backup and recreate it? (y/N): "
    if /i "!backup_env!"=="y" (
        ren .env .env.backup.%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
        echo Backed up existing .env file
    ) else (
        echo Keeping existing .env file. Please update database settings manually.
        goto skip_env
    )
)

:: Generate simple keys
set JWT_SECRET=your_jwt_secret_key_here_minimum_32_characters_long_%RANDOM%%RANDOM%
set JWT_REFRESH_SECRET=your_jwt_refresh_secret_key_here_minimum_32_characters_long_%RANDOM%%RANDOM%
set ENCRYPTION_KEY=your_32_character_encryption_key_%RANDOM%%RANDOM%%RANDOM%
set WEBHOOK_SECRET=your_webhook_secret_for_signature_verification_%RANDOM%

:: Create .env file
(
echo # Application Configuration
echo NODE_ENV=development
echo PORT=3000
echo API_PREFIX=api/v1
echo.
echo # Database Configuration
echo DATABASE_TYPE=postgres
echo DATABASE_HOST=%DB_HOST%
echo DATABASE_PORT=%DB_PORT%
echo DATABASE_USERNAME=%DB_USER%
echo DATABASE_PASSWORD=%DB_PASSWORD%
echo DATABASE_NAME=%DB_NAME%
echo DATABASE_SYNC=false
echo DATABASE_LOGGING=true
echo.
echo # JWT Configuration
echo JWT_SECRET=%JWT_SECRET%
echo JWT_EXPIRES_IN=1h
echo JWT_REFRESH_SECRET=%JWT_REFRESH_SECRET%
echo JWT_REFRESH_EXPIRES_IN=7d
echo.
echo # AWS Configuration ^(Optional for local development^)
echo AWS_REGION=us-east-1
echo AWS_ACCESS_KEY_ID=your_aws_access_key
echo AWS_SECRET_ACCESS_KEY=your_aws_secret_key
echo AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/payment-events
echo.
echo # Encryption Configuration
echo ENCRYPTION_KEY=%ENCRYPTION_KEY%
echo BCRYPT_ROUNDS=10
echo.
echo # Webhook Configuration
echo WEBHOOK_SECRET=%WEBHOOK_SECRET%
echo.
echo # API Rate Limiting
echo RATE_LIMIT_WINDOW_MS=60000
echo RATE_LIMIT_MAX_REQUESTS=100
echo.
echo # Logging Configuration
echo LOG_LEVEL=info
echo LOG_FORMAT=combined
) > .env

echo .env file created

:skip_env

:: Install dependencies and run migrations
echo Running database migrations...

if not exist "package.json" (
    echo package.json not found. Please run this script from the project root.
    pause
    exit /b 1
)

:: Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)

:: Run migrations
echo Running migrations...
npm run migration:run

if errorlevel 1 (
    echo Migration failed
    pause
    exit /b 1
)

echo Database migrations completed

:: Show next steps
echo.
echo ==========================================
echo Database setup completed successfully!
echo ==========================================
echo.
echo Next steps:
echo 1. Start the development server:
echo    npm run start:dev
echo.
echo 2. Access the API documentation:
echo    http://localhost:3000/api/docs
echo.
echo 3. Test the API endpoints using the Swagger UI
echo.
echo Available commands:
echo   npm run start:dev     - Start development server
echo   npm run test          - Run tests
echo   npm run build         - Build for production
echo.
echo Database connection details:
echo   Host: %DB_HOST%:%DB_PORT%
echo   Database: %DB_NAME%
echo   User: %DB_USER%
echo.

pause