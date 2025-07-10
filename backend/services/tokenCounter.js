const { encode } = require('gpt-tokenizer');

/**
 * Token counting service for accurate chunking
 * Supports both OpenAI and Claude models
 */
class TokenCounter {
  constructor() {
    this.fallbackRatio = 3.5; // characters per token for fallback estimation
  }

  /**
   * Count tokens in text using GPT tokenizer
   * @param {string} text - Text to count tokens for
   * @param {string} model - Model name (for future model-specific counting)
   * @returns {number} - Number of tokens
   */
  countTokens(text, model = 'gpt-3.5-turbo') {
    try {
      if (!text || typeof text !== 'string') {
        return 0;
      }

      // Use GPT tokenizer as approximation for all models
      // For production, you might want model-specific tokenizers
      const tokens = encode(text);
      return tokens.length;

    } catch (error) {
      console.warn('⚠️ Token counting failed, using character-based estimation:', error.message);
      return this.estimateTokensFromChars(text);
    }
  }

  /**
   * Estimate tokens from character count (fallback method)
   * @param {string} text - Text to estimate
   * @returns {number} - Estimated token count
   */
  estimateTokensFromChars(text) {
    if (!text || typeof text !== 'string') {
      return 0;
    }
    return Math.ceil(text.length / this.fallbackRatio);
  }

  /**
   * Count tokens for multiple texts
   * @param {string[]} texts - Array of texts
   * @param {string} model - Model name
   * @returns {number[]} - Array of token counts
   */
  countTokensForTexts(texts, model = 'gpt-3.5-turbo') {
    return texts.map(text => this.countTokens(text, model));
  }

  /**
   * Check if text exceeds token limit
   * @param {string} text - Text to check
   * @param {number} limit - Token limit
   * @param {string} model - Model name
   * @returns {object} - Result with isValid and tokenCount
   */
  validateTokenLimit(text, limit, model = 'gpt-3.5-turbo') {
    const tokenCount = this.countTokens(text, model);
    
    return {
      isValid: tokenCount <= limit,
      tokenCount,
      limit,
      exceedsBy: tokenCount > limit ? tokenCount - limit : 0,
      utilizationPercent: Math.round((tokenCount / limit) * 100)
    };
  }

  /**
   * Split text into chunks based on token limits
   * @param {string} text - Text to split
   * @param {number} maxTokensPerChunk - Maximum tokens per chunk
   * @param {string} separator - Separator to split on (default: newline)
   * @returns {string[]} - Array of text chunks
   */
  splitTextByTokens(text, maxTokensPerChunk, separator = '\n') {
    const lines = text.split(separator);
    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const line of lines) {
      const lineTokens = this.countTokens(line + separator);
      
      // If adding this line would exceed limit, start new chunk
      if (currentTokens + lineTokens > maxTokensPerChunk && currentChunk) {
        chunks.push(currentChunk.trim());
        currentChunk = line + separator;
        currentTokens = lineTokens;
      } else {
        currentChunk += line + separator;
        currentTokens += lineTokens;
      }
    }

    // Add the last chunk
    if (currentChunk.trim()) {
      chunks.push(currentChunk.trim());
    }

    return chunks;
  }

  /**
   * Get optimal chunk size based on model and content type
   * @param {string} model - Model name
   * @param {string} contentType - Type of content (excel, text, code, etc.)
   * @returns {number} - Recommended max tokens per chunk
   */
  getOptimalChunkSize(model, contentType = 'excel') {
    const baseSettings = {
      'claude-3-haiku-20240307': { excel: 800, text: 1000, code: 600 },
      'claude-3-sonnet-20240229': { excel: 1500, text: 2000, code: 1200 },
      'claude-3-opus-20240229': { excel: 3000, text: 4000, code: 2500 },
      'gpt-3.5-turbo': { excel: 800, text: 1000, code: 600 },
      'gpt-4': { excel: 1500, text: 2000, code: 1200 },
      'gpt-4-turbo': { excel: 3000, text: 4000, code: 2500 }
    };

    const modelSettings = baseSettings[model] || baseSettings['claude-3-haiku-20240307'];
    return modelSettings[contentType] || modelSettings.excel;
  }

  /**
   * Analyze text for chunking recommendations
   * @param {string} text - Text to analyze
   * @param {string} model - Target model
   * @returns {object} - Analysis results
   */
  analyzeForChunking(text, model = 'claude-3-haiku-20240307') {
    const totalTokens = this.countTokens(text, model);
    const optimalChunkSize = this.getOptimalChunkSize(model, 'excel');
    const lines = text.split('\n');
    
    // Calculate line statistics
    const lineTokens = lines.map(line => this.countTokens(line));
    const avgLineTokens = lineTokens.reduce((sum, tokens) => sum + tokens, 0) / lineTokens.length;
    const maxLineTokens = Math.max(...lineTokens);
    
    const analysis = {
      totalTokens,
      totalLines: lines.length,
      avgLineTokens: Math.round(avgLineTokens),
      maxLineTokens,
      optimalChunkSize,
      recommendation: {
        needsChunking: totalTokens > optimalChunkSize,
        estimatedChunks: Math.ceil(totalTokens / optimalChunkSize),
        optimalLinesPerChunk: Math.floor(optimalChunkSize / avgLineTokens),
        efficiency: Math.round((totalTokens / optimalChunkSize) * 100) / 100
      },
      riskFactors: []
    };

    // Add risk factors
    if (maxLineTokens > optimalChunkSize * 0.8) {
      analysis.riskFactors.push('Some lines are very long and may cause chunking issues');
    }

    if (avgLineTokens < 10) {
      analysis.riskFactors.push('Very short lines detected - chunking may be inefficient');
    }

    if (analysis.recommendation.estimatedChunks > 20) {
      analysis.riskFactors.push('Very large file - consider preprocessing or breaking into smaller files');
    }

    return analysis;
  }

  /**
   * Get token usage statistics
   * @param {string[]} chunks - Array of text chunks
   * @param {string} model - Model name
   * @returns {object} - Usage statistics
   */
  getUsageStats(chunks, model = 'claude-3-haiku-20240307') {
    const chunkTokens = chunks.map(chunk => this.countTokens(chunk, model));
    const totalTokens = chunkTokens.reduce((sum, tokens) => sum + tokens, 0);
    const optimalChunkSize = this.getOptimalChunkSize(model, 'excel');

    return {
      totalChunks: chunks.length,
      totalTokens,
      averageTokensPerChunk: Math.round(totalTokens / chunks.length),
      maxTokensInChunk: Math.max(...chunkTokens),
      minTokensInChunk: Math.min(...chunkTokens),
      utilizationRate: Math.round((totalTokens / (chunks.length * optimalChunkSize)) * 100),
      chunkDetails: chunks.map((chunk, index) => ({
        chunkIndex: index,
        tokenCount: chunkTokens[index],
        utilizationPercent: Math.round((chunkTokens[index] / optimalChunkSize) * 100),
        characterCount: chunk.length
      }))
    };
  }
}

// Export singleton instance
const tokenCounter = new TokenCounter();

module.exports = {
  TokenCounter,
  tokenCounter
};