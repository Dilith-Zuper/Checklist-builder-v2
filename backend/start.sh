#!/bin/bash

# Zuper Checklist Backend Startup Script
# Usage: ./start.sh [environment]
# Environments: dev, prod

set -e  # Exit on any error

ENVIRONMENT=${1:-dev}

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_status "🚀 Starting Zuper Checklist Backend..."
print_status "Environment: $ENVIRONMENT"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18+ is required. Current version: $(node --version)"
    exit 1
fi

print_success "Node.js version check passed: $(node --version)"

# Check if package.json exists
if [ ! -f "package.json" ]; then
    print_error "package.json not found. Please run this script from the backend directory."
    exit 1
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        print_warning ".env file not found. Copying from .env.example..."
        cp .env.example .env
        print_warning "Please edit .env file with your API keys before running the server."
    else
        print_error ".env file not found and no .env.example available."
        exit 1
    fi
fi

# Check for required environment variables
if [ -f ".env" ]; then
    source .env
    
    if [ -z "$OPENAI_API_KEY" ] || [ "$OPENAI_API_KEY" = "sk-your-openai-api-key-here" ]; then
        print_error "OPENAI_API_KEY is not set in .env file."
        print_error "Please add your OpenAI API key to the .env file."
        exit 1
    fi
    
    print_success "Environment variables loaded"
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    print_status "Installing dependencies..."
    if npm install; then
        print_success "Dependencies installed successfully"
    else
        print_error "Failed to install dependencies"
        exit 1
    fi
else
    print_status "Dependencies already installed"
fi

# Create upload directory if it doesn't exist
UPLOAD_DIR=${UPLOAD_DIR:-/tmp/zuper-uploads}
if [ ! -d "$UPLOAD_DIR" ]; then
    print_status "Creating upload directory: $UPLOAD_DIR"
    mkdir -p "$UPLOAD_DIR"
    print_success "Upload directory created"
fi

# Set environment variables
export NODE_ENV=$ENVIRONMENT

case $ENVIRONMENT in
    "dev")
        export NODE_ENV=development
        print_status "Starting development server with auto-reload..."
        
        # Check if nodemon is available
        if command -v nodemon &> /dev/null; then
            npm run dev
        else
            print_warning "nodemon not found globally. Installing locally..."
            npm install --save-dev nodemon
            npm run dev
        fi
        ;;
    "prod")
        export NODE_ENV=production
        print_status "Starting production server..."
        npm start
        ;;
    *)
        print_error "Unknown environment: $ENVIRONMENT"
        print_error "Supported environments: dev, prod"
        exit 1
        ;;
esac