const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');

/**
 * Extract text content from Excel file for OpenAI processing
 * @param {string} filePath - Path to the uploaded Excel file
 * @returns {Promise<string>} - Plain text representation of Excel data
 */
const extractExcelText = async (filePath) => {
  try {
    console.log(`📊 Parsing Excel file: ${filePath}`);
    
    // Check if file exists
    if (!await fs.pathExists(filePath)) {
      const error = new Error('Excel file not found');
      error.code = 'FILE_NOT_FOUND';
      throw error;
    }

    // Read the Excel file
    let workbook;
    try {
      workbook = XLSX.readFile(filePath);
    } catch (readError) {
      console.error('❌ Failed to read Excel file:', readError);
      const error = new Error('Invalid or corrupted Excel file');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    // Get the first sheet (as per requirements)
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length === 0) {
      const error = new Error('Excel file contains no sheets');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    const firstSheetName = sheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`📋 Processing sheet: ${firstSheetName}`);

    // Convert sheet to JSON format for easier processing
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, // Use first row as header
      defval: '', // Default value for empty cells
      raw: false // Get formatted strings
    });

    if (jsonData.length === 0) {
      const error = new Error('Excel sheet is empty');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    // Filter out completely empty rows
    const filteredData = jsonData.filter(row => 
      row && row.some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '')
    );

    if (filteredData.length === 0) {
      const error = new Error('Excel sheet contains no data');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    console.log(`📊 Found ${filteredData.length} rows with data`);

    // Convert to plain text format for OpenAI
    let allText = '';
    
    filteredData.forEach((row, index) => {
      if (Array.isArray(row)) {
        // Clean and join row data with pipe separator
        const cleanRow = row.map(cell => {
          if (cell === null || cell === undefined) return '';
          return cell.toString().trim();
        });
        
        // Only include rows that have at least one non-empty cell
        if (cleanRow.some(cell => cell !== '')) {
          const line = cleanRow.join(' | ');
          // allText += `Row ${index + 1}: ${line}\n`;
          allText += `${line}\n`;
        }
      }
    });

    if (allText.trim().length === 0) {
      const error = new Error('No readable data found in Excel file');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    console.log(`✅ Successfully extracted ${allText.length} characters from Excel`);
    console.log(`📝 Preview: ${allText.substring(0, 200)}...`);

    return allText;

  } catch (error) {
    console.error('❌ Error extracting Excel text:', error);
    
    // If it's already a known error, re-throw it
    if (error.code) {
      throw error;
    }
    
    // Otherwise, wrap in a generic Excel parsing error
    const parseError = new Error(`Failed to parse Excel file: ${error.message}`);
    parseError.code = 'EXCEL_PARSE_ERROR';
    throw parseError;
  }
};

/**
 * Cleanup uploaded file
 * @param {string} filePath - Path to the file to delete
 * @returns {Promise<void>}
 */
const cleanupFile = async (filePath) => {
  try {
    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      console.log(`🗑️ Cleaned up file: ${path.basename(filePath)}`);
    }
  } catch (error) {
    console.error(`❌ Failed to cleanup file ${filePath}:`, error);
    // Don't throw error for cleanup failures
  }
};

/**
 * Validate Excel file format and structure
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<object>} - Validation result with details
 */
const validateExcelFormat = async (filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' });
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        sheetCount: workbook.SheetNames.length,
        rowCount: jsonData.length,
        hasHeader: false,
        expectedFormat: 'question|type|option|required|isDependent|dependentOn|dependentOptions'
      }
    };

    // Check if file has data
    if (jsonData.length === 0) {
      validation.isValid = false;
      validation.errors.push('Excel file is empty');
      return validation;
    }

    // Check header format (first row should be question|type|option|required)
    const headerRow = jsonData[0];
    if (headerRow && headerRow.length >= 7) {
      const header = headerRow.map(cell => cell.toString().toLowerCase().trim());
      const expectedHeader = ['question', 'type', 'option', 'required','isDependent','dependentOn','dependentOptions'];
      
      const headerMatches = expectedHeader.every(expected => 
        header.some(actual => actual.includes(expected))
      );
      
      if (headerMatches) {
        validation.metadata.hasHeader = true;
      } else {
        validation.warnings.push('Header row may not match expected format: question|type|option|required|isDependent|dependentOn|dependentOptions');
      }
    } else {
      validation.warnings.push('Header row not found or incomplete');
    }

    // Check for minimum data rows
    const dataRows = jsonData.slice(1).filter(row => 
      row && row.some(cell => cell && cell.toString().trim() !== '')
    );
    
    if (dataRows.length === 0) {
      validation.isValid = false;
      validation.errors.push('No data rows found after header');
    } else if (dataRows.length < 1) {
      validation.warnings.push('Very few data rows found');
    }

    validation.metadata.dataRowCount = dataRows.length;

    return validation;

  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to validate Excel format: ${error.message}`],
      warnings: [],
      metadata: {}
    };
  }
};

/**
 * Get Excel file metadata
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<object>} - File metadata
 */
const getExcelMetadata = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const workbook = XLSX.readFile(filePath);
    
    const metadata = {
      fileSize: stats.size,
      fileSizeMB: (stats.size / 1024 / 1024).toFixed(2),
      createdAt: stats.birthtime,
      modifiedAt: stats.mtime,
      sheetNames: workbook.SheetNames,
      sheetCount: workbook.SheetNames.length
    };

    // Get row count for each sheet
    metadata.sheets = workbook.SheetNames.map(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      return {
        name: sheetName,
        rowCount: jsonData.length,
        hasData: jsonData.length > 0
      };
    });

    return metadata;

  } catch (error) {
    console.error('❌ Failed to get Excel metadata:', error);
    return {
      error: error.message
    };
  }
};

module.exports = {
  extractExcelText,
  cleanupFile,
  validateExcelFormat,
  getExcelMetadata
};