# Zuper Checklist Import Tool - Frontend

🔧 **Internal Tool for Zuper Implementation Team**

Convert Excel checklists to Zuper-compatible format with a modern, intuitive interface.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Backend server running on port 3001

### Installation

1. **Clone/Download the project files**
```bash
mkdir zuper-checklist-frontend
cd zuper-checklist-frontend
```

2. **Copy all the provided files into the directory:**
```
zuper-checklist-frontend/
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── index.html
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── App.css
│   ├── index.css
│   └── components/
│       └── ZuperChecklistTool.jsx
```

3. **Install dependencies**
```bash
npm install
```

4. **Start development server**
```bash
npm run dev
```

The app will be available at `http://localhost:3000`

## 📁 Project Structure

```
src/
├── main.jsx              # React entry point
├── App.jsx               # Main app component
├── App.css               # App-specific styles
├── index.css             # Global styles with Tailwind
└── components/
    └── ZuperChecklistTool.jsx  # Main tool component
```

## 🛠 Build Commands

### Development
```bash
npm run dev          # Start dev server on port 3000
```

### Production Build
```bash
npm run build        # Build for production
npm run preview      # Preview production build
npm start           # Serve production build
```

### Deployment Build
```bash
npm run build
# Files will be in ./dist/ directory
```

## 🔧 Features

### ✅ Implemented Features
- **Two-step workflow**: Config & Upload → Review & Submit
- **Excel file upload**: Drag & drop with 20MB limit
- **Real-time validation**: Form validation with error feedback
- **Payload preview**: View final JSON before submission
- **Editable checklist**: Add, remove, modify checklist items
- **Modern UI**: Tailwind CSS with animations and responsive design
- **Error handling**: Toast notifications for all errors
- **Loading states**: Smooth loading indicators

### 🎨 UI/UX Highlights
- **Modern Design**: Gradient backgrounds, card layouts, smooth animations
- **Progressive Workflow**: Tab-based navigation with smart validation
- **Interactive Elements**: Hover effects, transitions, drag & drop
- **Responsive Layout**: Works on all screen sizes
- **Internal Tool Branding**: Zuper team header and styling

## 🔌 Backend Integration

The frontend expects these API endpoints:

### POST `/api/extract-checklist`
- **Input**: FormData with Excel file + config
- **Output**: `{ checklist: [...] }`

### POST `/api/submit-checklist`
- **Input**: `{ checklist: [...], config: {...} }`
- **Output**: Success/error response

## 📋 Supported Question Types

| Frontend Label | Backend Value | Description |
|---|---|---|
| Multi Line Input | textArea | Large text input |
| Single Line Input | textField | Short text input |
| Date Input | date | Date picker |
| Time Input | time | Time picker |
| DateTime Input | dateTime | Date and time picker |
| Dropdown | dropdown | Select dropdown |
| Checkbox | checkbox | Multiple selection |
| Radio Button | radio | Single selection |
| Multiple Picture | multiImage | Image upload |
| Signature | signature | Signature field |

## 🔄 Excel Template Format

The tool expects Excel files with this structure:

**Row 1 (Header):** `question|type|option|required`

**Example rows:**
```
What is your name?|textField||Yes
Select your state|dropdown|Tamil Nadu,Kerala,Karnataka|Yes
Upload photo|multiImage||No
```

## 🚨 Error Handling

The frontend handles these error scenarios:
- **File validation**: Size limits, file type validation
- **Form validation**: Required field checking
- **Backend errors**: API error messages shown in UI
- **Network errors**: Connection failure handling

## 🌐 Deployment Options

### Option 1: Static Hosting (Recommended)
```bash
npm run build
# Deploy ./dist/ folder to:
# - Netlify, Vercel, GitHub Pages
# - AWS S3 + CloudFront
# - Any static hosting service
```

### Option 2: Node.js Hosting
```bash
npm run build
npm start  # Serves on port 3000
```

### Option 3: Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## ⚙️ Configuration

### Environment Variables
```env
# Backend API URL (if different from localhost:3001)
VITE_API_URL=http://your-backend-url:3001
```

### Vite Proxy Configuration
The `vite.config.js` is already configured to proxy `/api/*` requests to `localhost:3001`.

## 🔍 Troubleshooting

### Common Issues

1. **"Cannot connect to backend"**
   - Ensure backend server is running on port 3001
   - Check CORS configuration on backend

2. **"File upload fails"**
   - Check file size (max 20MB)
   - Ensure file is .xlsx or .xls format

3. **"Build errors"**
   - Run `npm install` to ensure all dependencies are installed
   - Check Node.js version (18+ required)

### Debug Mode
```bash
# Enable verbose logging
npm run dev -- --debug
```

## 📝 Development Notes

### Adding New Question Types
1. Update `questionTypes` array in `ZuperChecklistTool.jsx`
2. Update `mapTypeToComponent` function
3. Add backend mapping support

### Customizing Styles
- Modify `tailwind.config.js` for theme changes
- Update `src/index.css` for global styles
- Edit component styles in `ZuperChecklistTool.jsx`

### API Integration
- Backend endpoints are defined in the component
- Modify fetch URLs in `extractChecklist` and `submitToZuper` functions
- Add authentication headers if needed

## 🤝 Support

For issues or questions:
1. Check this README for common solutions
2. Review console logs for error details
3. Contact the Zuper Implementation Team

## 📄 License

Internal tool for Zuper Implementation Team use only.