const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const { tokenCounter } = require('./tokenCounter');

/**
 * Unified AI Service supporting both OpenAI and Claude with intelligent chunking
 * Admin controls which provider to use via environment variables
 */
class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'claude';
    this.initializeClients();
    
    // Chunking configuration
    this.chunkingConfig = {
      // Conservative character limits per model (accounting for system prompt + response)
      maxCharsPerChunk: {
        'claude-3-haiku-20240307': 3000,     // ~750 tokens for input
        'claude-3-sonnet-20240229': 6000,    // ~1500 tokens for input  
        'claude-3-opus-20240229': 12000,     // ~3000 tokens for input
        'gpt-3.5-turbo': 3000,               // ~750 tokens for input
        'gpt-4': 6000,                       // ~1500 tokens for input
        'gpt-4-turbo': 12000                 // ~3000 tokens for input
      },
      minRowsPerChunk: 5,                     // Minimum rows to make chunking worthwhile
      maxRetries: 2                           // Max retries per failed chunk
    };
  }

  /**
   * Initialize AI clients based on configuration
   */
  initializeClients() {
    // Initialize OpenAI client if needed
    if (this.shouldUseOpenAI()) {
      if (!process.env.OPENAI_API_KEY) {
        console.error('❌ OPENAI_API_KEY is required when using OpenAI provider');
      } else {
        this.openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        console.log('✅ OpenAI client initialized');
      }
    }

    // Initialize Claude client if needed
    if (this.shouldUseClaude()) {
      if (!process.env.ANTHROPIC_API_KEY) {
        console.error('❌ ANTHROPIC_API_KEY is required when using Claude provider');
      } else {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        console.log('✅ Claude client initialized');
      }
    }
  }

  /**
   * Check if OpenAI should be used
   */
  shouldUseOpenAI() {
    return ['openai', 'both'].includes(this.provider.toLowerCase());
  }

  /**
   * Check if Claude should be used
   */
  shouldUseClaude() {
    return ['claude', 'both'].includes(this.provider.toLowerCase());
  }

  /**
   * Get the system prompt for checklist extraction
   */
  getSystemPrompt() {
    return `You are an expert at parsing Excel data and converting it into structured checklist items.

TASK: Convert Excel text data into a JSON array of checklist items.

INPUT FORMAT: The Excel data follows this pattern:
- Header row: question|type|option|required|isDependent|dependentOn|dependentOptions
- Each subsequent row represents one checklist item

SUPPORTED TYPES:
- textField: Single line text input
- textArea: Multi-line text input  
- date: Date picker
- time: Time picker
- dateTime: Date and time picker
- dropdown: Single selection dropdown
- radio: Single selection radio buttons
- checkbox: Multiple selection checkboxes
- multiImage: Image upload field
- signature: Signature capture field
- header: Section header 

OUTPUT FORMAT: Return a valid JSON array with this exact structure:
[
  {
    "id": 1,
    "question": "What is your name?",
    "type": "textField",
    "options": "",
    "required": true,
    "isDependent": false,
    "dependentOn": "",
    "dependentOptions": ""
  },
  {
    "id": 2,
    "question": "Select your state",
    "type": "dropdown", 
    "options": "Tamil Nadu,Kerala,Karnataka",
    "required": true,
    "isDependent": false,
    "dependentOn": "",
    "dependentOptions": ""
  }
]

RULES:
1. Extract ONLY the question text (remove any prefixes like "Question:")
2. Map input types to supported types (if unsure, use "textField")
3. For dropdown/radio/checkbox: combine options with commas
4. Convert "Yes"/"No"/"True"/"False" to boolean for required field
5. DO NOT assign IDs - they will be handled externally
6. Return ONLY valid JSON array - no explanations or markdown
7. If no valid data found, return empty array: []
8. Ensure all required fields are present with proper defaults

Be precise and ensure the JSON is valid and parseable.`;
  }

  /**
   * Parse Excel text into structured data for chunking
   */
  parseExcelToRows(excelText) {
    const lines = excelText.trim().split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      throw new Error('No data found in Excel text');
    }

    // First line is header
    const header = lines[0];
    const dataRows = lines.slice(1);

    console.log(`📊 Parsed ${dataRows.length} data rows with header: ${header.substring(0, 100)}...`);

    return {
      header,
      dataRows,
      totalRows: dataRows.length
    };
  }

  /**
   * Estimate character count for a chunk
   */
  estimateChunkSize(header, rows) {
    const headerSize = header.length;
    const rowsSize = rows.reduce((total, row) => total + row.length + 1, 0); // +1 for newline
    return headerSize + rowsSize + 100; // +100 for formatting overhead
  }

  /**
   * Create chunks from parsed Excel data
   */
  createChunks(parsedData, maxCharsPerChunk) {
    const { header, dataRows } = parsedData;
    const chunks = [];
    let currentChunk = [];
    let currentChunkSize = header.length + 100; // Start with header size

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowSize = row.length + 1; // +1 for newline

      // Check if adding this row would exceed the limit
      if (currentChunkSize + rowSize > maxCharsPerChunk && currentChunk.length >= this.chunkingConfig.minRowsPerChunk) {
        // Save current chunk and start new one
        chunks.push({
          header,
          rows: [...currentChunk],
          startIndex: chunks.length === 0 ? 0 : chunks[chunks.length - 1].endIndex,
          endIndex: chunks.length === 0 ? currentChunk.length - 1 : chunks[chunks.length - 1].endIndex + currentChunk.length,
          estimatedSize: currentChunkSize
        });

        currentChunk = [row];
        currentChunkSize = header.length + rowSize + 100;
      } else {
        currentChunk.push(row);
        currentChunkSize += rowSize;
      }
    }

    // Add the last chunk if it has data
    if (currentChunk.length > 0) {
      chunks.push({
        header,
        rows: currentChunk,
        startIndex: chunks.length === 0 ? 0 : chunks[chunks.length - 1].endIndex + 1,
        endIndex: chunks.length === 0 ? currentChunk.length - 1 : chunks[chunks.length - 1].endIndex + currentChunk.length,
        estimatedSize: currentChunkSize
      });
    }

    console.log(`📦 Created ${chunks.length} chunks:`);
    chunks.forEach((chunk, index) => {
      console.log(`   Chunk ${index + 1}: ${chunk.rows.length} rows, ~${chunk.estimatedSize} chars`);
    });

    return chunks;
  }

  /**
   * Convert chunk to text format for AI processing
   */
  chunkToText(chunk) {
    return [chunk.header, ...chunk.rows].join('\n');
  }

  /**
   * Select optimal model based on chunk size and provider
   */
  selectModelForChunk(chunkSize, provider) {
    const models = {
      claude: {
        small: 'claude-3-haiku-20240307',
        medium: 'claude-3-sonnet-20240229', 
        large: 'claude-3-opus-20240229'
      },
      openai: {
        small: 'gpt-3.5-turbo',
        medium: 'gpt-4',
        large: 'gpt-4-turbo'
      }
    };

    const providerModels = models[provider] || models.claude;
    
    if (chunkSize <= 3000) {
      return providerModels.small;
    } else if (chunkSize <= 6000) {
      return providerModels.medium;
    } else {
      return providerModels.large;
    }
  }

  /**
   * Process a single chunk with retry logic
   */
  // async processChunkWithRetry(chunk, chunkIndex, totalChunks, progressCallback) {
  //   const maxRetries = this.chunkingConfig.maxRetries;
  //   let lastError = null;

  //   for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
  //     try {
  //       if (progressCallback) {
  //         progressCallback({
  //           chunkIndex,
  //           totalChunks,
  //           attempt,
  //           maxAttempts: maxRetries + 1,
  //           status: `Processing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${attempt})`
  //         });
  //       }

  //       console.log(`🔄 Processing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${attempt})`);
        
  //       const chunkText = this.chunkToText(chunk);
  //       const result = await this.processSingleChunk(chunkText, chunk.estimatedSize);
        
  //       console.log(`✅ Chunk ${chunkIndex + 1} processed successfully: ${result.length} items`);
  //       return {
  //         success: true,
  //         data: result,
  //         chunkIndex,
  //         itemCount: result.length,
  //         startIndex: chunk.startIndex,
  //         endIndex: chunk.endIndex
  //       };

  //     } catch (error) {
  //       lastError = error;
  //       console.error(`❌ Chunk ${chunkIndex + 1} attempt ${attempt} failed:`, error.message);
        
  //       if (attempt <= maxRetries) {
  //         console.log(`🔄 Retrying chunk ${chunkIndex + 1} (attempt ${attempt + 1}/${maxRetries + 1})`);
  //         // Wait before retry (exponential backoff)
  //         await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
  //       }
  //     }
  //   }

  //   // All retries failed
  //   console.error(`💥 Chunk ${chunkIndex + 1} failed after ${maxRetries + 1} attempts`);
  //   return {
  //     success: false,
  //     error: lastError.message,
  //     chunkIndex,
  //     startIndex: chunk.startIndex,
  //     endIndex: chunk.endIndex,
  //     rowCount: chunk.rows.length
  //   };
  // }

    // MODIFY YOUR AI SERVICE - Update the processChunkWithRetry method

async processChunkWithRetry(chunk, chunkIndex, totalChunks, progressCallback) {
  const maxRetries = this.chunkingConfig.maxRetries;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      // CALL PROGRESS CALLBACK - MODIFY THIS BLOCK
      if (progressCallback) {
        progressCallback({
          chunkIndex,
          totalChunks,
          attempt,
          maxAttempts: maxRetries + 1,
          status: `Processing chunk ${chunkIndex + 1}/${totalChunks} with Claude Sonnet (attempt ${attempt})`
        });
      }

      console.log(`🔄 Processing chunk ${chunkIndex + 1}/${totalChunks} (attempt ${attempt})`);
      
      const chunkText = this.chunkToText(chunk);
      const result = await this.processSingleChunk(chunkText, chunk.estimatedSize);
      
      console.log(`✅ Chunk ${chunkIndex + 1} processed successfully: ${result.length} items`);
      
      // SEND SUCCESS UPDATE - ADD THIS
      if (progressCallback) {
        progressCallback({
          chunkIndex,
          totalChunks,
          attempt,
          maxAttempts: maxRetries + 1,
          status: `Chunk ${chunkIndex + 1}/${totalChunks} completed successfully`
        });
      }
      
      return {
        success: true,
        data: result,
        chunkIndex,
        itemCount: result.length,
        startIndex: chunk.startIndex,
        endIndex: chunk.endIndex
      };

    } catch (error) {
      lastError = error;
      console.error(`❌ Chunk ${chunkIndex + 1} attempt ${attempt} failed:`, error.message);
      
      // SEND RETRY UPDATE - ADD THIS
      if (progressCallback && attempt <= maxRetries) {
        progressCallback({
          chunkIndex,
          totalChunks,
          attempt,
          maxAttempts: maxRetries + 1,
          status: `Chunk ${chunkIndex + 1} failed, retrying... (attempt ${attempt + 1}/${maxRetries + 1})`
        });
      }
      
      if (attempt <= maxRetries) {
        console.log(`🔄 Retrying chunk ${chunkIndex + 1} (attempt ${attempt + 1}/${maxRetries + 1})`);
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
      }
    }
  }

  // All retries failed
  console.error(`💥 Chunk ${chunkIndex + 1} failed after ${maxRetries + 1} attempts`);
  
  // SEND FAILURE UPDATE - ADD THIS
  if (progressCallback) {
    progressCallback({
      chunkIndex,
      totalChunks,
      attempt: maxRetries + 1,
      maxAttempts: maxRetries + 1,
      status: `Chunk ${chunkIndex + 1} failed after all retries`
    });
  }
  
  return {
    success: false,
    error: lastError.message,
    chunkIndex,
    startIndex: chunk.startIndex,
    endIndex: chunk.endIndex,
    rowCount: chunk.rows.length
  };
}

// ALSO UPDATE THE extractChecklist METHOD TO SEND INITIAL PROGRESS
async extractChecklist(excelText, progressCallback = null) {
  if (!excelText || excelText.trim().length === 0) {
    throw new Error('Excel text is empty or invalid');
  }

  console.log(`🎯 Using AI provider: ${this.provider}`);
  console.log(`📊 Processing ${excelText.length} characters of Excel data`);

  try {
    // SEND INITIAL STATUS - ADD THIS
    if (progressCallback) {
      progressCallback({
        chunkIndex: 0,
        totalChunks: 1,
        attempt: 1,
        maxAttempts: 1,
        status: 'Analyzing file structure...'
      });
    }

    // Parse Excel text into structured data
    const parsedData = this.parseExcelToRows(excelText);
    
    // Determine if chunking is needed
    const estimatedSize = this.estimateChunkSize(parsedData.header, parsedData.dataRows);
    const maxCharsForProvider = this.getMaxCharsForCurrentProvider();

    console.log(`📏 Estimated size: ${estimatedSize} chars, Max allowed: ${maxCharsForProvider} chars`);

    // If data is small enough, process without chunking
    if (estimatedSize <= maxCharsForProvider && parsedData.totalRows <= 20) {
      console.log('📄 Processing without chunking (small dataset)');
      
      if (progressCallback) {
        progressCallback({
          chunkIndex: 0,
          totalChunks: 1,
          attempt: 1,
          maxAttempts: 1,
          status: 'Processing with Claude Sonnet...'
        });
      }

      const result = await this.processSingleChunk(excelText, estimatedSize);
      
      // Assign sequential IDs
      const resultWithIds = result.map((item, index) => ({
        ...item,
        id: index + 1
      }));

      return resultWithIds;
    }

    // Large dataset - use chunking
    console.log('📦 Large dataset detected, using chunking approach');
    
    const chunks = this.createChunks(parsedData, maxCharsForProvider);
    
    // SEND CHUNKING INFO - ADD THIS
    if (progressCallback) {
      progressCallback({
        chunkIndex: 0,
        totalChunks: chunks.length,
        attempt: 1,
        maxAttempts: 1,
        status: `File split into ${chunks.length} chunks for processing...`
      });
    }
    
    const chunkResults = [];

    // Process chunks sequentially
    for (let i = 0; i < chunks.length; i++) {
      const result = await this.processChunkWithRetry(chunks[i], i, chunks.length, progressCallback);
      chunkResults.push(result);
    }

    // Rest of your existing merge logic...
    const mergeResult = this.mergeChunkResults(chunkResults);
    
    console.log('📊 Final processing statistics:');
    console.log(`   Total items extracted: ${mergeResult.stats.totalItems}`);
    console.log(`   Successful chunks: ${mergeResult.stats.successfulChunks}/${mergeResult.stats.totalChunks}`);
    console.log(`   Failed chunks: ${mergeResult.stats.failedChunks}`);

    if (mergeResult.failed.length > 0) {
      console.warn('⚠️ Some chunks failed:', mergeResult.failed);
    }

    return mergeResult.merged;

  } catch (error) {
    console.error('❌ Error in extractChecklist:', error);
    throw error;
  }
}


  /**
   * Process a single chunk of data
   */
  async processSingleChunk(chunkText, estimatedSize) {
    // Try Claude first if configured
    if (this.shouldUseClaude() && this.anthropic) {
      try {
        const model = this.selectModelForChunk(estimatedSize, 'claude');
        return await this.extractWithClaude(chunkText, model);
      } catch (error) {
        if (this.provider !== 'both') {
          throw error;
        }
        console.error('⚠️ Claude failed for chunk, trying OpenAI...');
      }
    }

    // Try OpenAI as fallback or primary
    if (this.shouldUseOpenAI() && this.openai) {
      const model = this.selectModelForChunk(estimatedSize, 'openai');
      return await this.extractWithOpenAI(chunkText, model);
    }

    throw new Error('No AI provider available for chunk processing');
  }

  /**
   * Extract checklist using Claude
   */
  async extractWithClaude(excelText, model = null) {
    try {
      const modelToUse = model || process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';
      console.log(`🤖 Processing with Claude (${modelToUse})...`);
      
      const response = await this.anthropic.messages.create({
        model: modelToUse,
        max_tokens: 4000,
        temperature: 0.1,
        system: this.getSystemPrompt(),
        messages: [
          {
            role: 'user',
            content: `Extract checklist items from this Excel data:\n\n${excelText}`
          }
        ]
      });

      const content = response.content[0].text;
      console.log(`📝 Claude response: ${content.substring(0, 200)}...`);

      // Parse JSON response
      const parsed = JSON.parse(content);
      
      if (!Array.isArray(parsed)) {
        throw new Error('Claude response is not an array');
      }

      return parsed;

    } catch (error) {
      console.error('❌ Claude extraction failed:', error);
      throw new Error(`Claude processing failed: ${error.message}`);
    }
  }

  /**
   * Extract checklist using OpenAI
   */
  async extractWithOpenAI(excelText, model = null) {
    try {
      const modelToUse = model || process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      console.log(`🤖 Processing with OpenAI (${modelToUse})...`);
      
      const response = await this.openai.chat.completions.create({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: this.getSystemPrompt()
          },
          {
            role: 'user',
            content: `Extract checklist items from this Excel data:\n\n${excelText}`
          }
        ],
        temperature: 0.1,
        max_tokens: 8000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      console.log(`📝 OpenAI response: ${content.substring(0, 200)}...`);

      // Parse JSON response - OpenAI returns wrapped in object
      const parsed = JSON.parse(content);
      const checklist = parsed.checklist || parsed.items || parsed;
      
      if (!Array.isArray(checklist)) {
        throw new Error('OpenAI response does not contain valid checklist array');
      }

      return checklist;

    } catch (error) {
      console.error('❌ OpenAI extraction failed:', error);
      throw new Error(`OpenAI processing failed: ${error.message}`);
    }
  }

  /**
   * Merge results from multiple chunks with sequential ID assignment
   */
  mergeChunkResults(chunkResults) {
    const merged = [];
    const failed = [];
    let currentId = 1;

    // Sort chunk results by chunk index to maintain order
    const sortedResults = chunkResults.sort((a, b) => a.chunkIndex - b.chunkIndex);

    for (const result of sortedResults) {
      if (result.success && result.data) {
        // Assign sequential IDs to items in this chunk
        const itemsWithIds = result.data.map(item => ({
          ...item,
          id: currentId++
        }));
        
        merged.push(...itemsWithIds);
        console.log(`✅ Merged chunk ${result.chunkIndex + 1}: ${itemsWithIds.length} items (IDs ${currentId - itemsWithIds.length}-${currentId - 1})`);
      } else {
        failed.push({
          chunkIndex: result.chunkIndex + 1,
          error: result.error,
          affectedRows: `${result.startIndex + 1}-${result.endIndex + 1}`,
          rowCount: result.rowCount
        });
        console.error(`❌ Failed chunk ${result.chunkIndex + 1}: ${result.error}`);
      }
    }

    return {
      merged,
      failed,
      stats: {
        totalItems: merged.length,
        successfulChunks: sortedResults.filter(r => r.success).length,
        failedChunks: failed.length,
        totalChunks: sortedResults.length
      }
    };
  }

  /**
   * Main extraction method with intelligent chunking
   */
  async extractChecklist(excelText, progressCallback = null) {
    if (!excelText || excelText.trim().length === 0) {
      throw new Error('Excel text is empty or invalid');
    }

    console.log(`🎯 Using AI provider: ${this.provider}`);
    console.log(`📊 Processing ${excelText.length} characters of Excel data`);

    try {
      // Parse Excel text into structured data
      const parsedData = this.parseExcelToRows(excelText);
      
      // Determine if chunking is needed
      const estimatedSize = this.estimateChunkSize(parsedData.header, parsedData.dataRows);
      const maxCharsForProvider = this.getMaxCharsForCurrentProvider();

      console.log(`📏 Estimated size: ${estimatedSize} chars, Max allowed: ${maxCharsForProvider} chars`);

      // If data is small enough, process without chunking
      if (estimatedSize <= maxCharsForProvider && parsedData.totalRows <= 50) {
        console.log('📄 Processing without chunking (small dataset)');
        
        if (progressCallback) {
          progressCallback({
            chunkIndex: 0,
            totalChunks: 1,
            attempt: 1,
            maxAttempts: 1,
            status: 'Processing single dataset'
          });
        }

        const result = await this.processSingleChunk(excelText, estimatedSize);
        
        // Assign sequential IDs
        const resultWithIds = result.map((item, index) => ({
          ...item,
          id: index + 1
        }));

        return resultWithIds;
      }

      // Large dataset - use chunking
      console.log('📦 Large dataset detected, using chunking approach');
      
      const chunks = this.createChunks(parsedData, maxCharsForProvider);
      const chunkResults = [];

      // Process chunks sequentially
      for (let i = 0; i < chunks.length; i++) {
        const result = await this.processChunkWithRetry(chunks[i], i, chunks.length, progressCallback);
        chunkResults.push(result);
      }

      // Merge all results
      const mergeResult = this.mergeChunkResults(chunkResults);
      
      // Log final statistics
      console.log('📊 Final processing statistics:');
      console.log(`   Total items extracted: ${mergeResult.stats.totalItems}`);
      console.log(`   Successful chunks: ${mergeResult.stats.successfulChunks}/${mergeResult.stats.totalChunks}`);
      console.log(`   Failed chunks: ${mergeResult.stats.failedChunks}`);

      if (mergeResult.failed.length > 0) {
        console.warn('⚠️ Some chunks failed:', mergeResult.failed);
      }

      return mergeResult.merged;

    } catch (error) {
      console.error('❌ Error in extractChecklist:', error);
      throw error;
    }
  }

  /**
   * Get maximum characters allowed for current provider
   */
  getMaxCharsForCurrentProvider() {
    if (this.shouldUseClaude() && this.anthropic) {
      const model = process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';
      return this.chunkingConfig.maxCharsPerChunk[model] || 3000;
    }
    
    if (this.shouldUseOpenAI() && this.openai) {
      const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      return this.chunkingConfig.maxCharsPerChunk[model] || 3000;
    }

    return 3000; // Conservative default
  }

  /**
   * Validate extracted checklist items
   */
  validateChecklist(checklist) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: []
    };

    if (!Array.isArray(checklist)) {
      validation.isValid = false;
      validation.errors.push('Checklist must be an array');
      return validation;
    }

    if (checklist.length === 0) {
      validation.warnings.push('Checklist is empty');
      return validation;
    }

    const validTypes = [
      'textArea', 'textField', 'date', 'time', 'dateTime',
      'dropdown', 'checkbox', 'radio', 'multiImage', 'signature', 'header'
    ];

    checklist.forEach((item, index) => {
      const itemNumber = index + 1;

      // Check required fields
      if (!item.question || typeof item.question !== 'string' || item.question.trim() === '') {
        validation.isValid = false;
        validation.errors.push(`Item ${itemNumber}: Question is required`);
      }

      if (!item.type || !validTypes.includes(item.type)) {
        validation.warnings.push(`Item ${itemNumber}: Invalid type "${item.type}", defaulting to textField`);
        item.type = 'textField'; // Auto-fix
      }

      if (typeof item.required !== 'boolean') {
        validation.warnings.push(`Item ${itemNumber}: Required field converted to boolean`);
        item.required = Boolean(item.required); // Auto-fix
      }

      // FIXED: Ensure dependency fields are properly handled
      if (typeof item.isDependent !== 'boolean') {
        item.isDependent = Boolean(item.isDependent); // Auto-fix
      }

      if (!item.dependentOn) {
        item.dependentOn = ''; // Auto-fix
      }

      if (!item.dependentOptions) {
        item.dependentOptions = ''; // Auto-fix
      }

      // Validate options for choice types
      if (['dropdown', 'radio', 'checkbox'].includes(item.type)) {
        if (!item.options || item.options.trim() === '') {
          validation.warnings.push(`Item ${itemNumber}: ${item.type} should have options`);
        }
      }

      // Validate dependent fields
      if (item.isDependent) {
        if (!item.dependentOn || typeof item.dependentOn !== 'string' || item.dependentOn.trim() === '') {
          validation.warnings.push(`Item ${itemNumber}: Missing parent dependent question`);
        }

        if (!item.dependentOptions || typeof item.dependentOptions !== 'string' || item.dependentOptions.trim() === '') {
          validation.warnings.push(`Item ${itemNumber}: Missing parent dependent options`);
        }
      }

      // Ensure ID is present
      if (!item.id) {
        item.id = itemNumber; // Auto-fix
      }
    });

    return validation;
  }

  /**
   * Get service status and configuration
   */
  getStatus() {
    return {
      provider: this.provider,
      chunking: {
        enabled: true,
        maxCharsPerChunk: this.getMaxCharsForCurrentProvider(),
        minRowsPerChunk: this.chunkingConfig.minRowsPerChunk,
        maxRetries: this.chunkingConfig.maxRetries
      },
      models: {
        claude: process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307',
        openai: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
      },
      available: {
        claude: !!(this.anthropic && process.env.ANTHROPIC_API_KEY),
        openai: !!(this.openai && process.env.OPENAI_API_KEY)
      }
    };
  }
}

// Export singleton instance
const aiService = new AIService();
module.exports = aiService;