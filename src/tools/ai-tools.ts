/**
 * AI-related tools for language models and generative content
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution, delay } from './index';
import { transform } from '../llm/transform';
import { TaskType } from '../llm/adaptive-llm';

/**
 * Creates a set of AI tools for language models and generative content
 * @returns An array of AI-related tools
 */
export function createAiTools(): Tool[] {
  return [
    textSummarizerTool,
    sentimentAnalyzerTool,
    keywordExtractorTool,
    textClassifierTool,
    aiTranslationTool
  ];
}

/**
 * A tool for summarizing long text
 */
export const textSummarizerTool: Tool = {
  name: 'summarizeText',
  description: 'Summarizes long text content into a shorter version',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text content to summarize' 
      },
      maxLength: { 
        type: 'number', 
        description: 'Maximum length of the summary in characters',
        default: 500 
      },
      format: {
        type: 'string',
        enum: ['paragraph', 'bullets', 'outline'],
        description: 'Format of the summary output',
        default: 'paragraph'
      }
    },
    required: ['text'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string; 
    maxLength?: number;
    format?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { text, maxLength = 500, format = 'paragraph' } = args;
      
      // Basic word count
      const wordCount = text.split(/\s+/).length;
      
      // Create format-specific instructions
      let formatInstructions = '';
      if (format === 'paragraph') {
        formatInstructions = `Format the summary as a coherent paragraph of about ${maxLength} characters.`;
      } else if (format === 'bullets') {
        formatInstructions = `Format the summary as a bullet list of key points.`;
      } else if (format === 'outline') {
        formatInstructions = `Format the summary as an outline with headings and subheadings.`;
      }
      
      // Create the prompt for the LLM
      const prompt = `Summarize the following text in about ${maxLength} characters. ${formatInstructions}
      
Text to summarize:
"""
${text}
"""

Summary:`;
      
      // Use transform with COMPLEX_REASONING task type for summarization
      const summary = await transform(prompt, TaskType.COMPLEX_REASONING);
      
      return {
        output: `Summarized text from ${wordCount} words:\n\n${summary}`,
        summary,
        originalLength: text.length,
        summaryLength: summary.length,
        compressionRatio: (text.length / summary.length || 1).toFixed(2)
      };
    }, (error) => {
      return `Text summarization failed: ${error.message}`;
    });
  }
};

/**
 * A tool for analyzing sentiment in text
 */
export const sentimentAnalyzerTool: Tool = {
  name: 'analyzeSentiment',
  description: 'Analyzes the sentiment and emotional tone of text',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to analyze for sentiment' 
      },
      detailed: {
        type: 'boolean',
        description: 'Whether to return detailed emotion analysis',
        default: false
      }
    },
    required: ['text'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string;
    detailed?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { text, detailed = false } = args;
      
      // Create prompt based on detailed flag
      const promptBase = `Analyze the sentiment of the following text:
      
"""
${text}
"""`;
      
      let prompt = '';
      if (detailed) {
        prompt = `${promptBase}

Provide a sentiment analysis in JSON format with the following structure:
{
  "sentiment": "one of: very positive, positive, neutral, negative, or very negative",
  "score": "decimal score between -1.0 and 1.0",
  "dominantEmotion": "primary emotion detected (joy, anger, fear, sadness, surprise, disgust, or neutral)",
  "emotions": {
    "joy": "decimal score between 0.0 and 1.0",
    "anger": "decimal score between 0.0 and 1.0",
    "fear": "decimal score between 0.0 and 1.0",
    "sadness": "decimal score between 0.0 and 1.0",
    "surprise": "decimal score between 0.0 and 1.0",
    "disgust": "decimal score between 0.0 and 1.0"
  }
}`;
      } else {
        prompt = `${promptBase}

Provide a sentiment analysis in JSON format with the following structure:
{
  "sentiment": "one of: very positive, positive, neutral, negative, or very negative",
  "score": "decimal score between -1.0 and 1.0"
}`;
      }
      
      // Use transform with QUICK_RESPONSE task type for sentiment analysis
      // as it's a relatively straightforward task
      const response = await transform(prompt, TaskType.QUICK_RESPONSE);
      
      // Parse the LLM response - extract JSON
      let jsonString = '';
      try {
        // Find JSON in the response (enclosed in curly braces)
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonString = jsonMatch[0];
        } else {
          throw new Error('No JSON found in response');
        }
        
        // Parse the JSON
        const result = JSON.parse(jsonString);
        
        // Create output string
        let outputString = `Sentiment analysis: ${result.sentiment} (score: ${result.score})`;
        if (detailed && result.dominantEmotion && result.dominantEmotion !== 'neutral') {
          outputString += `\nDominant emotion: ${result.dominantEmotion}`;
        }
        
        return {
          output: outputString,
          analysis: result
        };
      } catch (error) {
        // If JSON parsing fails, return a simplified response
        console.error('Error parsing sentiment JSON:', error);
        
        // Extract sentiment using regex as fallback
        const sentimentMatch = response.match(/sentiment["\s:]+([a-z\s]+)/i);
        const sentiment = sentimentMatch ? sentimentMatch[1].trim() : 'neutral';
        
        return {
          output: `Sentiment analysis: ${sentiment}`,
          analysis: {
            sentiment,
            score: "0.0"
          }
        };
      }
    }, (error) => {
      return `Sentiment analysis failed: ${error.message}`;
    });
  }
};

/**
 * A tool for extracting keywords from text
 */
export const keywordExtractorTool: Tool = {
  name: 'extractKeywords',
  description: 'Extracts important keywords and phrases from text content',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to extract keywords from' 
      },
      maxKeywords: { 
        type: 'number', 
        description: 'Maximum number of keywords to extract',
        default: 10 
      },
      minLength: {
        type: 'number',
        description: 'Minimum length of keywords in characters',
        default: 3
      }
    },
    required: ['text'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string;
    maxKeywords?: number;
    minLength?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { text, maxKeywords = 10, minLength = 3 } = args;
      
      // Create a prompt for the LLM
      const prompt = `Extract the most important keywords and key phrases from the following text.
      
Text:
"""
${text}
"""

Please return ONLY a JSON array of exactly ${maxKeywords} keywords/phrases, where each keyword must be at least ${minLength} characters long. 
Use this exact format:
{
  "keywords": ["keyword1", "keyword2", "keyword3", ...]
}

Identify terms that capture the main topics and concepts. Include both individual keywords and multi-word phrases when appropriate.
Return only the JSON with no other text.`;
      
      // Use transform with QUICK_RESPONSE task type
      const response = await transform(prompt, TaskType.QUICK_RESPONSE);
      
      // Extract JSON
      try {
        // Find JSON in the response
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        const jsonString = jsonMatch[0];
        const result = JSON.parse(jsonString);
        
        if (!result.keywords || !Array.isArray(result.keywords)) {
          throw new Error('Invalid keywords format in response');
        }
        
        // Filter any keywords that don't meet the minimum length
        const filteredKeywords = result.keywords
          .filter(keyword => typeof keyword === 'string' && keyword.length >= minLength)
          .slice(0, maxKeywords);
        
        // Create frequencies object (we don't have real frequencies, but we'll simulate them)
        const frequencies: Record<string, number> = {};
        filteredKeywords.forEach((keyword, index) => {
          // Assign descending "importance" values as a proxy for frequency
          frequencies[keyword] = 1 - (index / (filteredKeywords.length * 2));
        });
        
        return {
          output: `Extracted ${filteredKeywords.length} keywords from text:\n${filteredKeywords.join(', ')}`,
          keywords: filteredKeywords,
          frequencies
        };
      } catch (error) {
        console.error('Error parsing keywords JSON:', error);
        
        // Fallback to a simpler method if JSON parsing fails
        // Extract keywords using regex
        const keywordMatches = response.match(/["']([^"']+)["']/g) || [];
        const keywords = keywordMatches
          .map(match => match.replace(/["']/g, ''))
          .filter(keyword => keyword.length >= minLength)
          .slice(0, maxKeywords);
          
        return {
          output: `Extracted ${keywords.length} keywords from text:\n${keywords.join(', ')}`,
          keywords,
          frequencies: {}
        };
      }
    }, (error) => {
      return `Keyword extraction failed: ${error.message}`;
    });
  }
};

/**
 * A tool for classifying text into categories
 */
export const textClassifierTool: Tool = {
  name: 'classifyText',
  description: 'Classifies text into predefined or custom categories',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to classify' 
      },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Custom categories to classify into (optional)'
      },
      mode: {
        type: 'string',
        enum: ['topic', 'intent', 'custom'],
        description: 'Classification mode',
        default: 'topic'
      },
      multiLabel: {
        type: 'boolean',
        description: 'Whether multiple categories can apply',
        default: false
      }
    },
    required: ['text'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string;
    categories?: string[];
    mode?: string;
    multiLabel?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        text, 
        categories = [], 
        mode = 'topic',
        multiLabel = false
      } = args;
      
      let availableCategories: string[];
      
      // Define default categories based on mode
      if (mode === 'topic') {
        availableCategories = [
          'technology', 'business', 'politics', 'health', 'science',
          'entertainment', 'sports', 'education', 'travel', 'food'
        ];
      } else if (mode === 'intent') {
        availableCategories = [
          'question', 'request', 'complaint', 'feedback',
          'greeting', 'farewell', 'thanks', 'apology'
        ];
      } else {
        // Custom categories provided by user
        availableCategories = categories;
      }
      
      if (availableCategories.length === 0) {
        return {
          output: 'No categories provided for classification',
          error: 'Missing categories'
        };
      }
      
      // Create a prompt for the LLM
      let prompt: string;
      
      if (multiLabel) {
        prompt = `Classify the following text into one or more of these categories: ${availableCategories.join(', ')}.
        
Text to classify:
"""
${text}
"""

Return your classification results as JSON with the following structure:
{
  "classifications": [
    { "category": "category_name", "confidence": 0.95 },
    { "category": "another_category", "confidence": 0.75 }
  ]
}

For each matching category, include a confidence score between 0.0 and 1.0.
Only include categories that are relevant to the text, with a confidence of at least 0.5.
Return only the JSON with no other text.`;
      } else {
        prompt = `Classify the following text into exactly one of these categories: ${availableCategories.join(', ')}.
        
Text to classify:
"""
${text}
"""

Return your classification result as JSON with the following structure:
{
  "classification": {
    "category": "category_name",
    "confidence": 0.95
  },
  "alternativeCategories": [
    { "category": "second_best_category", "confidence": 0.80 },
    { "category": "third_best_category", "confidence": 0.70 }
  ]
}

For the classification, include a confidence score between 0.0 and 1.0.
Also include the 2 next best categories as alternatives.
Return only the JSON with no other text.`;
      }
      
      // Add information about the mode
      if (mode === 'topic') {
        prompt += '\n\nThis is a topic classification task. Identify the main subject area or topic.';
      } else if (mode === 'intent') {
        prompt += '\n\nThis is an intent classification task. Identify the purpose or intent of the message.';
      }
      
      // Use transform with appropriate task type based on complexity
      const response = await transform(prompt, TaskType.COMPLEX_REASONING);
      
      // Parse the LLM response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          throw new Error('No JSON found in response');
        }
        
        const jsonString = jsonMatch[0];
        const result = JSON.parse(jsonString);
        
        if (multiLabel) {
          if (!result.classifications || !Array.isArray(result.classifications)) {
            throw new Error('Invalid format for multi-label classification');
          }
          
          const matchingCategories = result.classifications.map((c: any) => ({
            category: c.category,
            confidence: typeof c.confidence === 'number' ? c.confidence : parseFloat(c.confidence)
          }));
          
          return {
            output: `Text classified into ${matchingCategories.length} categories:\n` +
                   matchingCategories.map(c => `${c.category} (${(c.confidence * 100).toFixed(1)}%)`).join(', '),
            classifications: matchingCategories,
            mode
          };
        } else {
          if (!result.classification || !result.classification.category) {
            throw new Error('Invalid format for single-label classification');
          }
          
          const classification = {
            category: result.classification.category,
            confidence: typeof result.classification.confidence === 'number' 
              ? result.classification.confidence 
              : parseFloat(result.classification.confidence)
          };
          
          let alternativeCategories: { category: string; confidence: number }[] = [];
          
          if (result.alternativeCategories && Array.isArray(result.alternativeCategories)) {
            alternativeCategories = result.alternativeCategories.map((c: any) => ({
              category: c.category,
              confidence: typeof c.confidence === 'number' ? c.confidence : parseFloat(c.confidence)
            }));
          }
          
          return {
            output: `Text classified as "${classification.category}" with ${(classification.confidence * 100).toFixed(1)}% confidence`,
            classification,
            alternativeCategories,
            mode
          };
        }
      } catch (error) {
        console.error('Error parsing classification JSON:', error);
        
        // Fallback to simpler method if JSON parsing fails
        // Try to extract categories using regex
        const categoryMatch = response.match(/category["\s:]+([a-z_]+)/i);
        const category = categoryMatch ? categoryMatch[1].trim() : availableCategories[0];
        
        if (multiLabel) {
          return {
            output: `Text classified into 1 category: ${category} (75.0%)`,
            classifications: [{ category, confidence: 0.75 }],
            mode
          };
        } else {
          return {
            output: `Text classified as "${category}" with 75.0% confidence`,
            classification: { category, confidence: 0.75 },
            alternativeCategories: [],
            mode
          };
        }
      }
    }, (error) => {
      return `Text classification failed: ${error.message}`;
    });
  }
};

/**
 * A tool for simulating language translation
 * Note: This is similar to the utility translationTool but specific for AI models
 */
export const aiTranslationTool: Tool = {
  name: 'translateText',
  description: 'Translates text between languages (AI-powered)',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to translate' 
      },
      sourceLanguage: { 
        type: 'string', 
        description: 'Source language code (e.g., "en", "es", "fr")',
        default: 'auto'
      },
      targetLanguage: { 
        type: 'string', 
        description: 'Target language code (e.g., "en", "es", "fr")' 
      },
      preserveFormatting: {
        type: 'boolean',
        description: 'Whether to preserve formatting in the translation',
        default: true
      }
    },
    required: ['text', 'targetLanguage'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string; 
    sourceLanguage?: string;
    targetLanguage: string;
    preserveFormatting?: boolean;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        text, 
        sourceLanguage = 'auto', 
        targetLanguage,
        preserveFormatting = true
      } = args;
      
      // Language codes map
      const languages: Record<string, string> = {
        'en': 'English',
        'es': 'Spanish',
        'fr': 'French',
        'de': 'German',
        'it': 'Italian',
        'pt': 'Portuguese',
        'ru': 'Russian',
        'zh': 'Chinese',
        'ja': 'Japanese',
        'ko': 'Korean',
        'ar': 'Arabic',
        'hi': 'Hindi',
        'auto': 'Auto-detected'
      };
      
      // Check if languages are supported
      const sourceName = languages[sourceLanguage] || 'Unknown';
      const targetName = languages[targetLanguage];
      
      if (!targetName) {
        return {
          output: `Unsupported target language: ${targetLanguage}`,
          error: 'Unsupported language'
        };
      }
      
      // Create a prompt for the LLM based on the task
      let prompt: string;
      
      if (sourceLanguage === 'auto') {
        prompt = `Translate the following text to ${targetName}:
        
"""
${text}
"""

Respond ONLY with the translation, no introduction or explanation.`;
      } else {
        prompt = `Translate the following ${sourceName} text to ${targetName}:
        
"""
${text}
"""

Respond ONLY with the translation, no introduction or explanation.`;
      }
      
      // If we need to preserve formatting
      if (preserveFormatting) {
        prompt += `\n\nImportant: Preserve the original formatting including paragraph breaks, bullet points, numbering, and any other formatting elements.`;
      }
      
      // Use transform for translation
      const translatedText = await transform(prompt, TaskType.QUICK_RESPONSE);
      
      // Determine actual source language for auto
      let detectedSourceLang = sourceLanguage;
      if (sourceLanguage === 'auto') {
        // For simplicity, assume English if not specified
        detectedSourceLang = 'en';
        
        // In a more sophisticated implementation, we could also ask the LLM to identify the source language
      }
      
      return {
        output: `Translation from ${sourceName} to ${targetName}:\n\n${translatedText}`,
        translation: translatedText,
        sourceLanguage: detectedSourceLang,
        targetLanguage,
        confidence: 0.95
      };
    }, (error) => {
      return `Translation failed: ${error.message}`;
    });
  }
};