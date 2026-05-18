#!/bin/bash
# Setup script for Negentropy Perceives with uv

set -e

echo "🚀 Setting up Negentropy Perceives with uv..."

# Check Python version
PYTHON_VERSION=$(python --version 2>&1 | awk '{print $2}')
PYTHON_MAJOR=$(echo $PYTHON_VERSION | cut -d. -f1)
PYTHON_MINOR=$(echo $PYTHON_VERSION | cut -d. -f2)

if [[ $PYTHON_MAJOR -lt 3 ]] || [[ $PYTHON_MAJOR -eq 3 && $PYTHON_MINOR -lt 13 ]]; then
    echo "❌ Python 3.13+ is required. Current version: $PYTHON_VERSION"
    echo "   Please upgrade Python or use a virtual environment with Python 3.13+"
    exit 1
fi

echo "✅ Python $PYTHON_VERSION found"

# Check if uv is installed
if ! command -v uv &> /dev/null; then
    echo "❌ uv is not installed. Please install uv first:"
    echo "   curl -LsSf https://astral.sh/uv/install.sh | sh"
    exit 1
fi

echo "✅ uv found"

# Sync dependencies (--group dev includes base dependencies)
echo "📦 Installing dependencies (including dev group)..."
uv sync --group dev

# Install git pre-commit hooks
echo "🪝 Installing pre-commit hooks..."
uv run pre-commit install
echo "✅ Pre-commit hooks installed"

# Copy environment configuration if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating environment configuration..."
    cp .env.example .env
    echo "✏️  Please edit .env file to configure your settings"
else
    echo "ℹ️  .env file already exists"
fi

# Install playwright browsers if playwright is available
echo "🌐 Setting up browser dependencies..."
if uv run python -c "import playwright" 2>/dev/null; then
    echo "Installing Playwright browsers..."
    uv run playwright install chromium
else
    echo "⚠️  Playwright not available, skipping browser installation"
fi

echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your configuration"
echo "2. Run: uv run negentropy-perceives"
echo ""
echo "For development:"
echo "- Format code: uv run ruff format src/negentropy/perceives/ tests/"
echo "- Run tests: uv run pytest"
echo "- Type check: uv run mypy src/negentropy/perceives/"
echo "- Run all pre-commit checks: uv run pre-commit run --all-files"
