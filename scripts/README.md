# Database Setup Scripts

This directory contains automated database setup scripts for the iRecharge Payment System. These scripts will help you quickly set up PostgreSQL database, create necessary users, and configure the environment.

## Available Scripts

### 1. **setup-database.sh** (Linux/macOS/WSL)
Bash script for Unix-like systems.

**Usage:**
```bash
# Make the script executable
chmod +x scripts/setup-database.sh

# Run the script
./scripts/setup-database.sh
```

### 2. **setup-database.bat** (Windows Command Prompt)
Windows batch file for Command Prompt.

**Usage:**
```cmd
# Run from project root
scripts\setup-database.bat
```

### 3. **setup-database.ps1** (Windows PowerShell)
PowerShell script with better Windows integration.

**Usage:**
```powershell
# Run from project root (you may need to allow script execution)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
.\scripts\setup-database.ps1

# Or with parameters for automated setup
.\scripts\setup-database.ps1 -DbName "my_payment_db" -DbUser "my_user" -SkipPrompts
```

## What These Scripts Do

1. **Check Prerequisites**
   - Verify PostgreSQL is installed and accessible
   - Check if PostgreSQL service is running

2. **Database Setup**
   - Create a new PostgreSQL user with appropriate permissions
   - Create the application database
   - Grant necessary privileges

3. **Environment Configuration**
   - Generate secure JWT secrets and encryption keys
   - Create `.env` file with database connection details
   - Backup existing `.env` file if it exists

4. **Database Migration**
   - Install npm dependencies if needed
   - Run database migrations to create tables

5. **Verification**
   - Test database connection
   - Provide next steps and usage instructions

## Prerequisites

### PostgreSQL Installation

**Windows:**
- Download from: https://www.postgresql.org/download/windows/
- During installation, remember the superuser (postgres) password
- Make sure PostgreSQL bin directory is added to PATH

**macOS:**
```bash
# Using Homebrew
brew install postgresql
brew services start postgresql
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Node.js
Make sure Node.js (version 18 or higher) and npm are installed.

## Manual Setup (Alternative)

If you prefer manual setup or the scripts don't work in your environment:

1. **Create PostgreSQL user and database:**
```sql
-- Connect as postgres user
psql -U postgres

-- Create user
CREATE USER payment_user WITH PASSWORD 'your_secure_password';
ALTER USER payment_user CREATEDB;

-- Create database
CREATE DATABASE payment_system_dev OWNER payment_user;
GRANT ALL PRIVILEGES ON DATABASE payment_system_dev TO payment_user;

-- Exit
\q
```

2. **Create .env file manually:**
```bash
cp .env.example .env
# Edit .env with your database credentials and generate secure keys
```

3. **Run migrations:**
```bash
npm install
npm run migration:run
```

## Troubleshooting

### Common Issues

**"PostgreSQL not found" or "psql command not found"**
- Ensure PostgreSQL is installed
- Add PostgreSQL bin directory to your system PATH
- On Windows: Usually `C:\Program Files\PostgreSQL\15\bin`

**"PostgreSQL service not running"**
- Windows: Start the service from Services.msc
- macOS: `brew services start postgresql`
- Linux: `sudo systemctl start postgresql`

**"Permission denied" on scripts**
- Linux/macOS: Run `chmod +x scripts/setup-database.sh`
- Windows PowerShell: Run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser`

**"Migration failed"**
- Check database connection details in .env
- Ensure the database user has proper permissions
- Check if all dependencies are installed: `npm install`

**"User already exists" errors**
- The scripts handle existing users gracefully
- If issues persist, you may need to drop and recreate the user manually

### Manual Cleanup (if needed)

```sql
-- Connect as postgres user
psql -U postgres

-- Drop database and user (WARNING: This will delete all data)
DROP DATABASE IF EXISTS payment_system_dev;
DROP USER IF EXISTS payment_user;
```

## Script Features

- **Interactive prompts** with sensible defaults
- **Secure key generation** for JWT and encryption
- **Backup existing .env** files before overwriting
- **Cross-platform compatibility**
- **Error handling** with helpful error messages
- **Color-coded output** for better readability
- **Connection testing** to verify setup

## Security Notes

- The scripts generate random secure keys for production use
- Database passwords are handled securely (though visibility varies by platform)
- Generated .env files should not be committed to version control
- Consider using environment-specific configuration for production deployments

## Support

If you encounter issues with these scripts:

1. Check the troubleshooting section above
2. Ensure all prerequisites are installed
3. Try the manual setup process
4. Check PostgreSQL logs for detailed error information