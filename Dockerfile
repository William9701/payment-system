# Multi-stage Dockerfile for NestJS Payment System

# Base stage with common dependencies
FROM node:18-alpine AS base
WORKDIR /usr/src/app

# Install system dependencies
RUN apk add --no-cache \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Copy package files
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development

# Install all dependencies (including dev dependencies)
RUN npm ci

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Change ownership of the app directory
RUN chown -R nestjs:nodejs /usr/src/app
USER nestjs

# Expose port
EXPOSE 3000

# Start development server
CMD ["dumb-init", "npm", "run", "start:dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production

# Install all dependencies for building
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production dependencies stage
FROM base AS production-deps
ENV NODE_ENV=production

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:18-alpine AS production
ENV NODE_ENV=production

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init && rm -rf /var/cache/apk/*

# Create app directory
WORKDIR /usr/src/app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Copy production dependencies
COPY --from=production-deps --chown=nestjs:nodejs /usr/src/app/node_modules ./node_modules

# Copy built application
COPY --from=build --chown=nestjs:nodejs /usr/src/app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /usr/src/app/package*.json ./

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node dist/health-check.js || exit 1

# Start the application
CMD ["dumb-init", "node", "dist/main.js"]