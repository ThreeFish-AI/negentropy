#!/bin/bash

# Setup script for Agentic AI Papers Platform
# This script sets up the development environment

set -e

echo "🚀 Setting up Agentic AI Papers Platform..."

# Check if Python is installed
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed. Please install Python 3.9+ first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is required but not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check if Docker is installed (optional)
if command -v docker &> /dev/null; then
    echo "✅ Docker found - you can use Docker Compose for easy setup"
    USE_DOCKER=true
else
    echo "⚠️  Docker not found - you'll need to setup PostgreSQL and Redis manually"
    USE_DOCKER=false
fi

# Create virtual environment
echo "📦 Creating Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies via uv
echo "📦 Installing Python dependencies..."
uv pip install -e .

# Install development dependencies
uv pip install -e ".[dev]"

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p logs
mkdir -p storage/papers
mkdir -p storage/temp
mkdir -p papers/source/LLM\ Agents
mkdir -p papers/source/Context\ Engineering
mkdir -p papers/source/Knowledge\ Graphs
mkdir -p papers/source/Multi-Agent\ Systems
mkdir -p papers/source/Survey\ Papers
mkdir -p papers/translation/LLM\ Agents
mkdir -p papers/translation/Context\ Engineering
mkdir -p papers/translation/Knowledge\ Graphs
mkdir -p papers/translation/Multi-Agent\ Systems
mkdir -p papers/translation/Survey\ Papers
mkdir -p papers/heartfelt/LLM\ Agents
mkdir -p papers/heartfelt/Context\ Engineering
mkdir -p papers/heartfelt/Knowledge\ Graphs
mkdir -p papers/heartfelt/Multi-Agent\ Systems
mkdir -p papers/heartfelt/Survey\ Papers

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please edit .env file with your API keys and configuration"
fi

# Setup Node.js dependencies for UI
if [ -d "ui" ]; then
    echo "📦 Installing UI dependencies..."
    cd ui
    pnpm install
    cd ..
fi

# Initialize Git hooks (if Git is initialized)
if [ -d ".git" ]; then
    echo "🔧 Setting up Git hooks..."
    uv run pre-commit install
fi

# Database setup
if [ "$USE_DOCKER" = true ]; then
    echo "🐳 Starting services with Docker Compose..."
    docker-compose up -d postgres redis minio

    echo "⏳ Waiting for services to be ready..."
    sleep 10

    # Run database migrations
    echo "🗄️ Running database migrations..."
    uv run alembic upgrade head
else
    echo "⚠️  Please setup PostgreSQL and Redis manually, then run:"
    echo "   uv run alembic upgrade head"
fi

# Create initial admin user (optional)
read -p "Do you want to create an admin user? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "👤 Creating admin user..."
    python -c "
from agentic_ai_papers.db import get_db
from agentic_ai_papers.models import User
from agentic_ai_papers.auth import get_password_hash
import asyncio

async def create_admin():
    db = next(get_db())
    admin = User(
        email='admin@example.com',
        username='admin',
        hashed_password=get_password_hash('admin123'),
        is_active=True,
        is_superuser=True
    )
    db.add(admin)
    db.commit()
    print('Admin user created: admin@example.com / admin123')

asyncio.run(create_admin())
"
fi

echo ""
echo "✅ Setup completed successfully!"
echo ""
echo "Next steps:"
if [ "$USE_DOCKER" = true ]; then
    echo "1. Start all services: docker-compose up -d"
else
    echo "1. Start PostgreSQL and Redis services"
fi
echo "2. Activate virtual environment: source venv/bin/activate"
echo "3. Start backend: cd ui && pnpm run dev:backend"
echo "4. Start frontend: cd ui && pnpm run dev:frontend"
echo "5. Access the UI at: http://localhost:9003"
echo ""
echo "For development:"
echo "- Run tests: uv run pytest"
echo "- Code formatting: ruff format . && ruff check ."
echo "- Type checking: uv run mypy agentic_ai_papers"
echo ""
