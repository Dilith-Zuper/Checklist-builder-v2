const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Use cross-platform temporary directory
const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  
  // Use OS temp directory for cross-platform compatibility
  return path.join(os.tmpdir(), 'zuper-uploads');
};

const uploadDir = getUploadDir();

// Ensure upload directory exists
try {
  fs.ensureDirSync(uploadDir);
  console.log(`📁 Upload directory created: ${uploadDir}`);
} catch (error) {
  console.error('❌ Failed to create upload directory:', error);
  // Fallback to current directory
  const fallbackDir = path.join(__dirname, '..', 'uploads');
  fs.ensureDirSync(fallbackDir);
  console.log(`📁 Using fallback upload directory: ${fallbackDir}`);
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `checklist-${uniqueSuffix}${ext}`);
  }
});

// File filter for Excel files only
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel' // .xls
  ];
  
  const allowedExtensions = ['.xlsx', '.xls'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) && allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    const error = new Error('Invalid file type. Only Excel files (.xlsx, .xls) are allowed.');
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 20971520, // 20MB default
    files: 1
  }
});

// Cleanup function for temporary files
const cleanupTempFiles = async () => {
  try {
    if (!fs.existsSync(uploadDir)) {
      return;
    }
    
    const files = await fs.readdir(uploadDir);
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    
    for (const file of files) {
      const filePath = path.join(uploadDir, file);
      const stats = await fs.stat(filePath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        await fs.remove(filePath);
        console.log(`🗑️ Cleaned up old temp file: ${file}`);
      }
    }
  } catch (error) {
    console.error('❌ Error cleaning up temp files:', error);
  }
};

// Schedule cleanup every hour
setInterval(cleanupTempFiles, 60 * 60 * 1000);

// Initial cleanup on startup
cleanupTempFiles();

// Export the multer instance directly
module.exports = upload;