# Zuper Checklist Backend

🔧 **Backend API for Zuper Checklist Import Tool**

Process Excel files and convert them to Zuper-compatible checklists using OpenAI.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- OpenAI API Key
- Zuper API credentials

### Installation

1. **Install dependencies**
```bash
npm install
```

2. **Configure environment**
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. **Start server**
```bash
# Development
npm run dev

# Production
npm start
```

## 🔧 Environment Variables

```env
# Required
OPENAI_API_KEY=sk-your-openai-key-here
PORT=3001

# Optional
OPENAI_MODEL=gpt-3.5-turbo
MAX_FILE_SIZE=20971520
UPLOAD_DIR=/tmp/zuper-uploads
```

## 📡 API Endpoints

### Health Check
```http
GET /health
```

### Extract Checklist
```http
POST /api/extract-checklist
Content-Type: multipart/form-data

Fields:
- file: Excel file (.xlsx/.xls)
- categoryUid: Zuper category UID
- statusUid: Zuper status UID  
- apiKey: Zuper API key
- region: Zuper region
```

### Submit Checklist
```http
POST /api/submit-checklist
Content-Type: application/json

{
  "checklist": [...],
  "config": {
    "categoryUid": "...",
    "statusUid": "...",
    "apiKey": "...",
    "region": "..."
  }
}
```

### Preview Payload
```http
POST /api/preview-payload
Content-Type: application/json

{
  "checklist": [...],
  "config": {...}
}
```

## 📊 Excel File Format

Expected Excel structure:

**Row 1 (Header):** `question|type|option|required`

**Example:**
```
What is your name?|textField||Yes
Select state|dropdown|Tamil Nadu,Kerala,Karnataka|Yes
Upload photo|multiImage||No
```

## 🔄 Processing Flow

1. **File Upload** → Multer handles file storage
2. **Excel Parsing** → XLSX library extracts text
3. **OpenAI Processing** → GPT converts to structured data
4. **Validation** → Joi validates all inputs
5. **Zuper Submission** → Axios posts to Zuper API

## 🛡️ Security Features

- **Rate limiting** (100 requests/15min)
- **File validation** (type, size limits)
- **Input sanitization** with Joi
- **Helmet** security headers
- **CORS** protection

## 📁 Project Structure

```
backend/
├── server.js              # Main server
├── routes/
│   └── checklist.js       # API routes
├── services/
│   ├── excelParser.js     # Excel processing
│   ├── openaiService.js   # OpenAI integration
│   └── zuperService.js    # Zuper API calls
├── middleware/
│   ├── upload.js          # File upload
│   ├── validation.js      # Input validation
│   └── errorHandler.js    # Error handling
└── utils/
    └── helpers.js         # Utility functions
```

## 🔍 Supported Question Types

| Input Type | Zuper Component | Description |
|------------|-----------------|-------------|
| textField | textField | Single line text |
| textArea | textArea | Multi-line text |
| date | date | Date picker |
| time | time | Time picker |
| dateTime | dateTime | Date & time |
| dropdown | dropdown | Select dropdown |
| checkbox | checkbox | Multiple choice |
| radio | radio | Single choice |
| multiImage | multiImage | Image upload |
| signature | signature | Signature field |

## ❌ Error Handling

All errors return JSON format:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "message": "Detailed description",
    "timestamp": "2024-01-01T00:00:00.000Z"
  }
}
```

### Error Codes
- `VALIDATION_ERROR` - Invalid input data
- `OPENAI_ERROR` - AI processing failed
- `ZUPER_API_ERROR` - Zuper submission failed
- `EXCEL_PARSE_ERROR` - File parsing failed
- `FILE_NOT_FOUND` - Missing file
- `RATE_LIMIT_ERROR` - Too many requests

## 🧪 Testing

### Manual Testing
```bash
# Health check
curl http://localhost:3001/health

# File upload test
curl -X POST \
  http://localhost:3001/api/extract-checklist \
  -F "file=@sample.xlsx" \
  -F "categoryUid=test-category" \
  -F "statusUid=test-status" \
  -F "apiKey=test-key" \
  -F "region=us-east-1"
```

## 🚀 Deployment

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Setup
```bash
# Production environment
NODE_ENV=production
PORT=3001
OPENAI_API_KEY=your-production-key
```

## 📊 Monitoring

- **Request logging** with Morgan
- **Error tracking** with custom handler
- **Performance metrics** via middleware
- **Health endpoint** for uptime monitoring

## 🔧 Configuration

### OpenAI Settings
- Model: Configurable via `OPENAI_MODEL`
- Temperature: 0.1 (for consistent output)
- Max tokens: 4000
- Response format: JSON

### File Upload Limits
- Max size: 20MB (configurable)
- Allowed types: .xlsx, .xls
- Temporary storage: `/tmp` (auto-cleanup)

### Rate Limiting
- Window: 15 minutes
- Max requests: 100 per IP
- Customizable via environment variables

## 🆘 Troubleshooting

### Common Issues

1. **OpenAI API errors**
   - Check API key validity
   - Verify quota availability
   - Monitor rate limits

2. **Excel parsing failures**
   - Ensure correct file format
   - Check header row structure
   - Validate data completeness

3. **Zuper API errors**
   - Verify API key permissions
   - Check region configuration
   - Validate UIDs format

### Debug Mode
```bash
NODE_ENV=development npm run dev
```

## 📄 License

Internal tool for Zuper Implementation Team use only.