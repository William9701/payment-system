#!/bin/bash

# Payment System Database Setup Script
# This script automates the database setup process for the iRecharge Payment System

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_DB_NAME="payment_system_dev"
DEFAULT_DB_USER="payment_user"
DEFAULT_DB_HOST="localhost"
DEFAULT_DB_PORT="5432"

echo -e "${BLUE}🚀 iRecharge Payment System Database Setup${NC}"
echo "=================================================="

# Function to check if PostgreSQL is installed
check_postgresql() {
    if ! command -v psql &> /dev/null; then
        echo -e "${RED}❌ PostgreSQL is not installed or not in PATH${NC}"
        echo "Please install PostgreSQL first:"
        echo "  - Windows: https://www.postgresql.org/download/windows/"
        echo "  - macOS: brew install postgresql"
        echo "  - Ubuntu/Debian: sudo apt-get install postgresql postgresql-contrib"
        exit 1
    fi
    echo -e "${GREEN}✅ PostgreSQL found${NC}"
}

# Function to check if PostgreSQL service is running
check_postgresql_service() {
    if ! pg_isready -h localhost -p 5432 &> /dev/null; then
        echo -e "${YELLOW}⚠️  PostgreSQL service is not running${NC}"
        echo "Please start PostgreSQL service:"
        echo "  - Windows: Start PostgreSQL service from Services"
        echo "  - macOS: brew services start postgresql"
        echo "  - Ubuntu/Debian: sudo systemctl start postgresql"
        exit 1
    fi
    echo -e "${GREEN}✅ PostgreSQL service is running${NC}"
}

# Function to prompt for database configuration
get_database_config() {
    echo ""
    echo -e "${BLUE}📝 Database Configuration${NC}"
    echo "Press Enter to use default values shown in brackets"
    
    read -p "Database name [$DEFAULT_DB_NAME]: " DB_NAME
    DB_NAME=${DB_NAME:-$DEFAULT_DB_NAME}
    
    read -p "Database user [$DEFAULT_DB_USER]: " DB_USER
    DB_USER=${DB_USER:-$DEFAULT_DB_USER}
    
    read -p "Database host [$DEFAULT_DB_HOST]: " DB_HOST
    DB_HOST=${DB_HOST:-$DEFAULT_DB_HOST}
    
    read -p "Database port [$DEFAULT_DB_PORT]: " DB_PORT
    DB_PORT=${DB_PORT:-$DEFAULT_DB_PORT}
    
    read -s -p "Database password for $DB_USER: " DB_PASSWORD
    echo ""
    
    read -s -p "PostgreSQL admin password (for user creation): " ADMIN_PASSWORD
    echo ""
    
    echo ""
    echo "Configuration:"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo "  Host: $DB_HOST"
    echo "  Port: $DB_PORT"
    echo ""
}

# Function to create database and user
create_database() {
    echo -e "${BLUE}🔧 Creating database and user...${NC}"
    
    # Create user if it doesn't exist
    echo "Creating user '$DB_USER'..."
    PGPASSWORD=$ADMIN_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        DO \$\$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = '$DB_USER') THEN
                CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
                ALTER USER $DB_USER CREATEDB;
                GRANT ALL PRIVILEGES ON DATABASE postgres TO $DB_USER;
            END IF;
        END
        \$\$;
    " 2>/dev/null || {
        echo -e "${RED}❌ Failed to create user. Please check admin password.${NC}"
        exit 1
    }
    
    # Create database if it doesn't exist
    echo "Creating database '$DB_NAME'..."
    PGPASSWORD=$ADMIN_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
        WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\\gexec
    " 2>/dev/null || {
        echo -e "${RED}❌ Failed to create database.${NC}"
        exit 1
    }
    
    # Grant privileges
    echo "Granting privileges..."
    PGPASSWORD=$ADMIN_PASSWORD psql -h $DB_HOST -p $DB_PORT -U postgres -c "
        GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
        ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
    " 2>/dev/null
    
    echo -e "${GREEN}✅ Database and user created successfully${NC}"
}

# Function to test database connection
test_connection() {
    echo -e "${BLUE}🔍 Testing database connection...${NC}"
    
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "SELECT version();" &> /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
    else
        echo -e "${RED}❌ Failed to connect to database${NC}"
        exit 1
    fi
}

# Function to create or update .env file
create_env_file() {
    echo -e "${BLUE}📄 Creating .env file...${NC}"
    
    # Check if .env already exists
    if [ -f ".env" ]; then
        echo -e "${YELLOW}⚠️  .env file already exists${NC}"
        read -p "Do you want to backup and recreate it? (y/N): " backup_env
        if [[ $backup_env =~ ^[Yy]$ ]]; then
            mv .env .env.backup.$(date +%Y%m%d_%H%M%S)
            echo "Backed up existing .env file"
        else
            echo "Keeping existing .env file. Please update database settings manually."
            return
        fi
    fi
    
    # Generate secure keys
    JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    JWT_REFRESH_SECRET=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    ENCRYPTION_KEY=$(openssl rand -base64 32 2>/dev/null || head -c 32 /dev/urandom | base64)
    WEBHOOK_SECRET=$(openssl rand -base64 24 2>/dev/null || head -c 24 /dev/urandom | base64)
    
    # Create .env file
    cat > .env << EOF
# Application Configuration
NODE_ENV=development
PORT=3000
API_PREFIX=api/v1

# Database Configuration
DATABASE_TYPE=postgres
DATABASE_HOST=$DB_HOST
DATABASE_PORT=$DB_PORT
DATABASE_USERNAME=$DB_USER
DATABASE_PASSWORD=$DB_PASSWORD
DATABASE_NAME=$DB_NAME
DATABASE_SYNC=false
DATABASE_LOGGING=true

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=7d

# AWS Configuration (Optional for local development)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_SQS_QUEUE_URL=https://sqs.us-east-1.amazonaws.com/123456789/payment-events

# Encryption Configuration
ENCRYPTION_KEY=$ENCRYPTION_KEY
BCRYPT_ROUNDS=10

# Webhook Configuration
WEBHOOK_SECRET=$WEBHOOK_SECRET

# API Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=combined
EOF
    
    echo -e "${GREEN}✅ .env file created with secure keys${NC}"
}

# Function to run database migrations
run_migrations() {
    echo -e "${BLUE}🔄 Running database migrations...${NC}"
    
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ package.json not found. Please run this script from the project root.${NC}"
        exit 1
    fi
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo "Installing dependencies..."
        npm install
    fi
    
    # Run migrations
    npm run migration:run
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Database migrations completed${NC}"
    else
        echo -e "${RED}❌ Migration failed${NC}"
        exit 1
    fi
}

# Function to display next steps
show_next_steps() {
    echo ""
    echo -e "${GREEN}🎉 Database setup completed successfully!${NC}"
    echo "=================================================="
    echo ""
    echo -e "${BLUE}Next steps:${NC}"
    echo "1. Start the development server:"
    echo "   ${YELLOW}npm run start:dev${NC}"
    echo ""
    echo "2. Access the API documentation:"
    echo "   ${YELLOW}http://localhost:3000/api/docs${NC}"
    echo ""
    echo "3. Test the API endpoints using the Swagger UI or your preferred API client"
    echo ""
    echo -e "${BLUE}Available commands:${NC}"
    echo "  ${YELLOW}npm run start:dev${NC}     - Start development server"
    echo "  ${YELLOW}npm run test${NC}          - Run tests"
    echo "  ${YELLOW}npm run build${NC}         - Build for production"
    echo "  ${YELLOW}npm run migration:run${NC} - Run new migrations"
    echo ""
    echo -e "${BLUE}Database connection details:${NC}"
    echo "  Host: $DB_HOST:$DB_PORT"
    echo "  Database: $DB_NAME"
    echo "  User: $DB_USER"
    echo ""
}

# Main execution
main() {
    echo "Starting database setup process..."
    echo ""
    
    # Check prerequisites
    check_postgresql
    check_postgresql_service
    
    # Get configuration
    get_database_config
    
    # Create database and user
    create_database
    
    # Test connection
    test_connection
    
    # Create .env file
    create_env_file
    
    # Run migrations
    run_migrations
    
    # Show next steps
    show_next_steps
}

# Handle script interruption
trap 'echo -e "\n${RED}❌ Setup interrupted${NC}"; exit 1' INT TERM

# Run main function
main