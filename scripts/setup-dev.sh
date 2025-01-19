#!/bin/bash

# Install dependencies
npm install

# Create necessary directories
mkdir -p packages/core/dist
mkdir -p packages/protocol/dist
mkdir -p packages/crypto/dist
mkdir -p packages/ai/dist
mkdir -p packages/ui/dist

# Copy environment configuration
cp .env.example .env

# Start Docker services
docker-compose up -d

echo "Development environment setup completed!"
