#!/bin/bash

# 🚀 HokieNest Startup Script
# This script sets up and runs the full application

echo "🏠 Starting HokieNest Application..."

# Check if .env files exist
if [ ! -f ".env" ]; then
    echo "⚠️  Frontend .env not found. Creating from example..."
    cp env.example .env
    echo "📝 Please edit .env with your Supabase credentials"
fi

if [ ! -f "server/.env" ]; then
    echo "⚠️  Backend .env not found. Creating from example..."
    cp server/env.example server/.env
    echo "📝 Please edit server/.env with your API keys and secrets"
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing frontend dependencies..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "📦 Installing backend dependencies..."
    cd server && npm install && cd ..
fi

# Start the application
echo "🚀 Starting both frontend and backend..."
npm run dev:full
