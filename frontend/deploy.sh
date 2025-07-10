#!/bin/bash

# Zuper Checklist Frontend Deployment Script
# Usage: ./deploy.sh [environment]
# Environments: dev, staging, prod

set -e  # Exit on any error

ENVIRONMENT=${1:-dev}
BUILD_DIR="dist"
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"

echo "🚀 Starting deployment for environment: $ENVIRONMENT"

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
    print_error "package.json not found. Please run this script from the project root."
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
if npm ci --silent; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Backup existing build if it exists
if [ -d "$BUILD_DIR" ]; then
    print_status "Backing up existing build..."
    mv "$BUILD_DIR" "$BACKUP_DIR"
    print_success "Backup created: $BACKUP_DIR"
fi

# Set environment variables based on deployment environment
case $ENVIRONMENT in
    "dev")
        export VITE_API_URL="http://localhost:3001"
        export VITE_ENV="development"
        ;;
    "staging")
        export VITE_API_URL="https://staging-api.zuper.com"
        export VITE_ENV="staging"
        ;;
    "prod")
        export VITE_API_URL="https://api.zuper.com"
        export VITE_ENV="production"
        ;;
    *)
        print_warning "Unknown environment: $ENVIRONMENT. Using default settings."
        export VITE_API_URL="http://localhost:3001"
        export VITE_ENV="development"
        ;;
esac

print_status "Environment: $ENVIRONMENT"
print_status "API URL: $VITE_API_URL"

# Run build
print_status "Building application..."
if npm run build; then
    print_success "Build completed successfully"
else
    print_error "Build failed"
    # Restore backup if build fails
    if [ -d "$BACKUP_DIR" ]; then
        print_status "Restoring previous build..."
        mv "$BACKUP_DIR" "$BUILD_DIR"
        print_success "Previous build restored"
    fi
    exit 1
fi

# Verify build output
if [ ! -d "$BUILD_DIR" ]; then
    print_error "Build directory not found"
    exit 1
fi

if [ ! -f "$BUILD_DIR/index.html" ]; then
    print_error "index.html not found in build directory"
    exit 1
fi

# Check build size
BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
print_success "Build size: $BUILD_SIZE"

# Clean up old backups (keep only last 5)
print_status "Cleaning up old backups..."
ls -t backup-* 2>/dev/null | tail -n +6 | xargs rm -rf 2>/dev/null || true

# Optional: Run preview server for testing
if [ "$ENVIRONMENT" = "dev" ]; then
    echo ""
    print_status "Build completed! You can now:"
    echo "  1. Run 'npm run preview' to test the production build locally"
    echo "  2. Deploy the '$BUILD_DIR' folder to your hosting service"
    echo "  3. Or run 'npm start' to serve the production build"
    echo ""
    
    read -p "Would you like to start the preview server now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Starting preview server..."
        npm run preview
    fi
else
    echo ""
    print_success "🎉 Deployment build completed successfully!"
    echo "📁 Build files are ready in: $BUILD_DIR"
    echo "🌐 Deploy this folder to your hosting service"
    echo ""
    
    # Display deployment instructions based on environment
    case $ENVIRONMENT in
        "staging")
            echo "📋 Staging Deployment Instructions:"
            echo "   1. Upload $BUILD_DIR contents to staging server"
            echo "   2. Verify staging API connectivity"
            echo "   3. Run smoke tests"
            ;;
        "prod")
            echo "📋 Production Deployment Instructions:"
            echo "   1. Upload $BUILD_DIR contents to production server"
            echo "   2. Verify production API connectivity"
            echo "   3. Run full test suite"
            echo "   4. Monitor for errors"
            ;;
    esac
fi

print_success "Deployment script completed successfully! 🚀"