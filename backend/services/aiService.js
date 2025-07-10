const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');

/**
 * Unified AI Service supporting both OpenAI and Claude
 * Admin controls which provider to use via environment variables
 */
class AIService {
  constructor() {
    this.provider = process.env.AI_PROVIDER || 'claude';
    this.initializeClients();
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
- header : section header

OUTPUT FORMAT: Return a valid JSON array with this exact structure:
[
  {
    "id": 1,
    "question": "What is your name?",
    "type": "textField",
    "options": "",
    "required": true,
    "isDependent":true,
    "dependentOn":"type of watch",
    "dependentOptions":"mechanical"
  },
  {
    "id": 2,
    "question": "Select your state",
    "type": "dropdown", 
    "options": "Tamil Nadu,Kerala,Karnataka",
    "required": true,
    "isDependent":false,
    "dependentOn":"",
    "dependentOptions":""
  }
]

RULES:
1. Extract ONLY the question text (remove any prefixes like "Question:")
2. Map input types to supported types (if unsure, use "textField")
3. For dropdown/radio/checkbox: combine options with commas
4. Convert "Yes"/"No"/"True"/"False" to boolean for required field
5. Assign sequential IDs starting from 1
6. Return ONLY valid JSON - no explanations or markdown
7. If no valid data found, return empty array: []

Be precise and ensure the JSON is valid and parseable.`;
  }

  /**
   * Extract checklist using Claude
   */
  async extractWithClaude(excelText) {
    try {
      console.log('🤖 Processing with Claude...');
      
      const model = process.env.CLAUDE_MODEL || 'claude-3-haiku-20240307';
      
      const response = await this.anthropic.messages.create({
        model: model,
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

      console.log(`✅ Claude extracted ${parsed.length} items`);
      return parsed;

    } catch (error) {
      console.error('❌ Claude extraction failed:', error);
      throw new Error(`Claude processing failed: ${error.message}`);
    }
  }

  /**
   * Extract checklist using OpenAI
   */
  async extractWithOpenAI(excelText) {
    try {
      console.log('🤖 Processing with OpenAI...');
      
      const model = process.env.OPENAI_MODEL || 'gpt-3.5-turbo';
      
      const response = await this.openai.chat.completions.create({
        model: model,
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
        max_tokens: 4000,
        response_format: { type: "json_object" }
      });

      const content = response.choices[0].message.content;
      console.log(`📝 OpenAI response: ${content.substring(0, 200)}...`);

      // Parse JSON response - OpenAI returns wrapped in object
      const parsed = JSON.parse(content);
      console.log('📄 Raw Excel text:\n', excelText);
      const checklist = parsed.checklist || parsed.items || parsed;
      
      if (!Array.isArray(checklist)) {
        throw new Error('OpenAI response does not contain valid checklist array');
      }

      console.log(`✅ OpenAI extracted ${checklist.length} items`);
      return checklist;

    } catch (error) {
      console.error('❌ OpenAI extraction failed:', error);
      throw new Error(`OpenAI processing failed: ${error.message}`);
    }
  }

  /**
   * Main extraction method with provider fallback
   */
  async extractChecklist(excelText) {
    if (!excelText || excelText.trim().length === 0) {
      throw new Error('Excel text is empty or invalid');
    }

    console.log(`🎯 Using AI provider: ${this.provider}`);
    console.log(`📊 Processing ${excelText.length} characters of Excel data`);

    let lastError = null;

    // Try Claude first if configured
    if (this.shouldUseClaude() && this.anthropic) {
      try {
        return await this.extractWithClaude(excelText);
      } catch (error) {
        lastError = error;
        console.error('⚠️ Claude failed, trying fallback...');
        
        // If not using both providers, throw error
        if (this.provider !== 'both') {
          throw error;
        }
      }
    }

    // Try OpenAI as fallback or primary
    if (this.shouldUseOpenAI() && this.openai) {
      try {
        return await this.extractWithOpenAI(excelText);
      } catch (error) {
        lastError = error;
        console.error('⚠️ OpenAI also failed');
        
        // If we tried Claude first, mention both failed
        if (this.provider === 'both') {
          throw new Error(`Both AI providers failed. Claude: ${lastError?.message || 'Unknown error'}, OpenAI: ${error.message}`);
        } else {
          throw error;
        }
      }
    }

    // No valid provider configured
    throw new Error(`No AI provider available. Please configure ANTHROPIC_API_KEY or OPENAI_API_KEY and set AI_PROVIDER in environment variables.`);
  }

  /**
   * Validate extracted checklist items
   */
 // Fixed validateChecklist function in aiService.js
// Only showing the relevant parts that need to be updated

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
    'dropdown', 'checkbox', 'radio', 'multiImage', 'signature','header'
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