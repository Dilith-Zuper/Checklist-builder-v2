const XLSX = require('xlsx');
const fs = require('fs-extra');
const path = require('path');

/**
 * Extract text content from Excel file optimized for chunking
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
      raw: false, // Get formatted strings
      blankrows: false // Skip completely blank rows
    });

    if (jsonData.length === 0) {
      const error = new Error('Excel sheet is empty');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    // Filter out completely empty rows and clean data
    const filteredData = jsonData
      .map(row => {
        // Clean each cell in the row
        if (!Array.isArray(row)) return null;
        
        const cleanedRow = row.map(cell => {
          if (cell === null || cell === undefined) return '';
          return cell.toString().trim();
        });
        
        // Check if row has any meaningful content
        const hasContent = cleanedRow.some(cell => cell !== '');
        return hasContent ? cleanedRow : null;
      })
      .filter(row => row !== null);

    if (filteredData.length === 0) {
      const error = new Error('Excel sheet contains no data');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    console.log(`📊 Found ${filteredData.length} rows with data`);

    // Enhanced text conversion optimized for AI processing
    let allText = '';
    
    filteredData.forEach((row, index) => {
      // Ensure consistent column count (pad with empty strings if needed)
      const maxColumns = Math.max(...filteredData.map(r => r.length));
      const paddedRow = [...row];
      while (paddedRow.length < maxColumns) {
        paddedRow.push('');
      }
      
      // Join with pipe separator for clear column delimitation
      const line = paddedRow.join(' | ');
      allText += `${line}\n`;
    });

    if (allText.trim().length === 0) {
      const error = new Error('No readable data found in Excel file');
      error.code = 'EXCEL_PARSE_ERROR';
      throw error;
    }

    console.log(`✅ Successfully extracted ${allText.length} characters from Excel`);
    console.log(`📝 Preview: ${allText.substring(0, 300)}...`);

    // Validate basic structure for chunking
    const lines = allText.trim().split('\n');
    if (lines.length < 2) {
      console.warn('⚠️ Excel file has less than 2 rows (header + data)');
    }

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
 * Extract structured data from Excel file (for advanced processing)
 * @param {string} filePath - Path to the uploaded Excel file
 * @returns {Promise<object>} - Structured Excel data
 */
const extractStructuredData = async (filePath) => {
  try {
    console.log(`📊 Extracting structured data from: ${filePath}`);
    
    if (!await fs.pathExists(filePath)) {
      const error = new Error('Excel file not found');
      error.code = 'FILE_NOT_FOUND';
      throw error;
    }

    const workbook = XLSX.readFile(filePath);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Get raw data
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: '',
      raw: false,
      blankrows: false
    });

    if (jsonData.length === 0) {
      throw new Error('Excel sheet is empty');
    }

    // Clean and structure the data
    const cleanedData = jsonData
      .map(row => {
        if (!Array.isArray(row)) return null;
        
        const cleanedRow = row.map(cell => {
          if (cell === null || cell === undefined) return '';
          return cell.toString().trim();
        });
        
        const hasContent = cleanedRow.some(cell => cell !== '');
        return hasContent ? cleanedRow : null;
      })
      .filter(row => row !== null);

    if (cleanedData.length < 1) {
      throw new Error('No valid data rows found');
    }

    // Separate header and data rows
    const header = cleanedData[0];
    const dataRows = cleanedData.slice(1);

    // Normalize column count
    const maxColumns = Math.max(header.length, ...dataRows.map(row => row.length));
    
    const normalizedHeader = [...header];
    while (normalizedHeader.length < maxColumns) {
      normalizedHeader.push(`Column${normalizedHeader.length + 1}`);
    }

    const normalizedDataRows = dataRows.map(row => {
      const normalizedRow = [...row];
      while (normalizedRow.length < maxColumns) {
        normalizedRow.push('');
      }
      return normalizedRow;
    });

    console.log(`✅ Structured data: ${normalizedDataRows.length} data rows, ${maxColumns} columns`);

    return {
      header: normalizedHeader,
      dataRows: normalizedDataRows,
      totalRows: normalizedDataRows.length,
      totalColumns: maxColumns,
      metadata: {
        fileName: path.basename(filePath),
        sheetName: firstSheetName,
        hasHeader: true,
        estimatedSize: JSON.stringify(cleanedData).length
      }
    };

  } catch (error) {
    console.error('❌ Error extracting structured data:', error);
    
    if (error.code) {
      throw error;
    }
    
    const parseError = new Error(`Failed to extract structured data: ${error.message}`);
    parseError.code = 'EXCEL_PARSE_ERROR';
    throw parseError;
  }
};

/**
 * Analyze Excel file for chunking optimization
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<object>} - Analysis results
 */
const analyzeExcelForChunking = async (filePath) => {
  try {
    const structuredData = await extractStructuredData(filePath);
    
    // Calculate row size statistics
    const rowSizes = structuredData.dataRows.map(row => {
      return row.join(' | ').length;
    });

    const avgRowSize = rowSizes.reduce((sum, size) => sum + size, 0) / rowSizes.length;
    const maxRowSize = Math.max(...rowSizes);
    const minRowSize = Math.min(...rowSizes);
    
    // Estimate total content size
    const headerSize = structuredData.header.join(' | ').length;
    const totalContentSize = headerSize + rowSizes.reduce((sum, size) => sum + size, 0);

    // Chunking recommendations
    const analysis = {
      fileStats: {
        totalRows: structuredData.totalRows,
        totalColumns: structuredData.totalColumns,
        headerSize,
        totalContentSize,
        avgRowSize: Math.round(avgRowSize),
        maxRowSize,
        minRowSize
      },
      chunkingRecommendation: {
        needsChunking: totalContentSize > 3000 || structuredData.totalRows > 50,
        estimatedChunks: Math.ceil(totalContentSize / 3000),
        optimalRowsPerChunk: Math.floor(3000 / (avgRowSize + headerSize)),
        riskFactors: []
      },
      qualityChecks: {
        hasVariableRowSizes: (maxRowSize - minRowSize) > (avgRowSize * 0.5),
        hasLargeRows: maxRowSize > 1000,
        hasEmptyRows: structuredData.dataRows.some(row => row.every(cell => cell === '')),
        headerComplete: structuredData.header.length >= 4 // Minimum expected columns
      }
    };

    // Add risk factors
    if (analysis.qualityChecks.hasVariableRowSizes) {
      analysis.chunkingRecommendation.riskFactors.push('Variable row sizes may affect chunking efficiency');
    }

    if (analysis.qualityChecks.hasLargeRows) {
      analysis.chunkingRecommendation.riskFactors.push('Some rows are very large and may need special handling');
    }

    if (!analysis.qualityChecks.headerComplete) {
      analysis.chunkingRecommendation.riskFactors.push('Header may be incomplete or malformed');
    }

    console.log('📊 Excel analysis completed:');
    console.log(`   Total size: ${totalContentSize} chars`);
    console.log(`   Avg row size: ${Math.round(avgRowSize)} chars`);
    console.log(`   Needs chunking: ${analysis.chunkingRecommendation.needsChunking}`);
    console.log(`   Estimated chunks: ${analysis.chunkingRecommendation.estimatedChunks}`);

    return analysis;

  } catch (error) {
    console.error('❌ Error analyzing Excel file:', error);
    return {
      error: error.message,
      fileStats: null,
      chunkingRecommendation: {
        needsChunking: true, // Default to safe chunking
        estimatedChunks: 1,
        optimalRowsPerChunk: 20,
        riskFactors: ['Analysis failed - using conservative chunking']
      }
    };
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
 * Validate Excel file format and structure for checklist processing
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<object>} - Validation result with details
 */
const validateExcelFormat = async (filePath) => {
  try {
    const structuredData = await extractStructuredData(filePath);
    
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        ...structuredData.metadata,
        rowCount: structuredData.totalRows,
        columnCount: structuredData.totalColumns,
        expectedFormat: 'question|type|option|required|isDependent|dependentOn|dependentOptions'
      }
    };

    // Check if file has sufficient data
    if (structuredData.totalRows === 0) {
      validation.isValid = false;
      validation.errors.push('Excel file contains no data rows');
      return validation;
    }

    // Validate header format
    const header = structuredData.header.map(cell => cell.toLowerCase().trim());
    const expectedColumns = ['question', 'type', 'option', 'required', 'isdependent', 'dependenton', 'dependentoptions'];
    
    // Check for minimum required columns
    const hasRequiredColumns = expectedColumns.slice(0, 4).every(expected => 
      header.some(actual => actual.includes(expected) || expected.includes(actual))
    );
    
    if (hasRequiredColumns) {
      validation.metadata.hasValidHeader = true;
      
      // Check for extended columns (dependency support)
      const hasExtendedColumns = expectedColumns.slice(4).every(expected => 
        header.some(actual => actual.includes(expected) || expected.includes(actual))
      );
      
      if (!hasExtendedColumns) {
        validation.warnings.push('Missing dependency columns (isDependent, dependentOn, dependentOptions) - will use defaults');
      }
    } else {
      validation.warnings.push(`Header format may not match expected: ${validation.metadata.expectedFormat}`);
      validation.metadata.hasValidHeader = false;
    }

    // Validate data quality
    const emptyRowCount = structuredData.dataRows.filter(row => 
      row.every(cell => cell === '')
    ).length;

    if (emptyRowCount > 0) {
      validation.warnings.push(`Found ${emptyRowCount} empty rows that will be skipped`);
    }

    // Check for minimum viable data
    const viableRows = structuredData.dataRows.filter(row => 
      row[0] && row[0].trim() !== '' // At least question column has content
    );

    if (viableRows.length === 0) {
      validation.isValid = false;
      validation.errors.push('No rows contain valid question data');
    } else if (viableRows.length < structuredData.totalRows) {
      validation.warnings.push(`${structuredData.totalRows - viableRows.length} rows missing question data`);
    }

    validation.metadata.viableRowCount = viableRows.length;

    // Size-based warnings
    if (structuredData.metadata.estimatedSize > 10000) {
      validation.warnings.push('Large file detected - processing may take longer with chunking');
    }

    return validation;

  } catch (error) {
    return {
      isValid: false,
      errors: [`Failed to validate Excel format: ${error.message}`],
      warnings: [],
      metadata: {
        error: error.message
      }
    };
  }
};

/**
 * Get comprehensive Excel file metadata
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<object>} - File metadata including chunking analysis
 */
const getExcelMetadata = async (filePath) => {
  try {
    const stats = await fs.stat(filePath);
    const workbook = XLSX.readFile(filePath);
    const analysis = await analyzeExcelForChunking(filePath);
    
    const metadata = {
      file: {
        name: path.basename(filePath),
        size: stats.size,
        sizeMB: (stats.size / 1024 / 1024).toFixed(2),
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        extension: path.extname(filePath)
      },
      workbook: {
        sheetNames: workbook.SheetNames,
        sheetCount: workbook.SheetNames.length,
        sheets: workbook.SheetNames.map(sheetName => {
          const sheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
          return {
            name: sheetName,
            rowCount: jsonData.length,
            hasData: jsonData.length > 0,
            range: sheet['!ref'] || 'A1:A1'
          };
        })
      },
      analysis: analysis.error ? { error: analysis.error } : analysis,
      processing: {
        supportsChunking: true,
        recommendedChunking: analysis.chunkingRecommendation?.needsChunking || false,
        estimatedProcessingTime: this.estimateProcessingTime(analysis)
      }
    };

    return metadata;

  } catch (error) {
    console.error('❌ Failed to get Excel metadata:', error);
    return {
      file: { error: error.message },
      workbook: { error: error.message },
      analysis: { error: error.message },
      processing: { error: error.message }
    };
  }
};

/**
 * Estimate processing time based on file analysis
 * @param {object} analysis - File analysis results
 * @returns {string} - Estimated processing time
 */
const estimateProcessingTime = (analysis) => {
  if (analysis.error) return 'Unknown';
  
  const { totalRows } = analysis.fileStats || {};
  const { estimatedChunks } = analysis.chunkingRecommendation || {};
  
  if (!totalRows) return 'Unknown';
  
  if (totalRows <= 50) {
    return '< 30 seconds';
  } else if (totalRows <= 200) {
    return '30-60 seconds';
  } else if (totalRows <= 500) {
    return '1-2 minutes';
  } else {
    const estimatedMinutes = Math.ceil(estimatedChunks * 0.5); // ~30 seconds per chunk
    return `${estimatedMinutes}-${estimatedMinutes + 1} minutes`;
  }
};

/**
 * Pre-process Excel file for optimal AI processing
 * @param {string} filePath - Path to the Excel file
 * @returns {Promise<object>} - Pre-processed data optimized for chunking
 */
const preprocessExcelForAI = async (filePath) => {
  try {
    console.log('🔄 Pre-processing Excel for AI optimization...');
    
    const structuredData = await extractStructuredData(filePath);
    const analysis = await analyzeExcelForChunking(filePath);
    
    // Create optimized text representation
    const headerText = structuredData.header.join(' | ');
    const dataText = structuredData.dataRows
      .filter(row => row[0] && row[0].trim() !== '') // Filter out rows without questions
      .map(row => row.join(' | '))
      .join('\n');
    
    const optimizedText = headerText + '\n' + dataText;
    
    const result = {
      text: optimizedText,
      structured: structuredData,
      analysis,
      metadata: {
        originalSize: optimizedText.length,
        processedRows: structuredData.dataRows.filter(row => row[0] && row[0].trim() !== '').length,
        skippedRows: structuredData.dataRows.length - structuredData.dataRows.filter(row => row[0] && row[0].trim() !== '').length,
        processingRecommendation: analysis.chunkingRecommendation
      }
    };
    
    console.log(`✅ Pre-processing completed:`);
    console.log(`   Processed rows: ${result.metadata.processedRows}`);
    console.log(`   Skipped rows: ${result.metadata.skippedRows}`);
    console.log(`   Final size: ${result.metadata.originalSize} chars`);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error pre-processing Excel file:', error);
    throw new Error(`Pre-processing failed: ${error.message}`);
  }
};

module.exports = {
  extractExcelText,
  extractStructuredData,
  analyzeExcelForChunking,
  cleanupFile,
  validateExcelFormat,
  getExcelMetadata,
  preprocessExcelForAI,
  estimateProcessingTime
};