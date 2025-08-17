-- Initialize database for payment system
-- This script is automatically executed when PostgreSQL container starts

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE payment_system_dev'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'payment_system_dev')\gexec

-- Create user if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'payment_user') THEN
        CREATE USER payment_user WITH PASSWORD 'your_secure_password';
    END IF;
END
$$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE payment_system_dev TO payment_user;
GRANT ALL ON SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO payment_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO payment_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO payment_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO payment_user;