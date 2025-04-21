/**
 * AI-related tools for language models and generative content
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution, delay } from './index';

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
      
      // Simulate AI processing time
      await delay(1000);
      
      // Basic word count
      const wordCount = text.split(/\s+/).length;
      
      // In a real implementation, this would call an LLM API
      // For this demo, we'll simulate summarization with a simple algorithm
      
      // Split into sentences
      const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
      
      // Simple extractive summary by taking first few sentences
      // In real implementation, use a proper summarization API or algorithm
      let summary = '';
      let currentLength = 0;
      
      // Generate different formats
      if (format === 'paragraph') {
        // Take sentences until we reach max length
        for (const sentence of sentences) {
          if (currentLength + sentence.length <= maxLength) {
            summary += sentence;
            currentLength += sentence.length;
          } else {
            break;
          }
        }
      } else if (format === 'bullets') {
        // Create bullet points from sentences
        summary = sentences.slice(0, 5).map(s => `• ${s.trim()}`).join('\n');
      } else if (format === 'outline') {
        // Create an outline with main points
        summary = '# Summary\n\n';
        
        // Extract what seem like main points (longer sentences)
        const mainPoints = sentences
          .filter(s => s.length > 50)
          .slice(0, 3);
        
        mainPoints.forEach((point, i) => {
          summary += `## Point ${i + 1}\n${point.trim()}\n\n`;
        });
      }
      
      return {
        output: `Summarized text from ${wordCount} words:\n\n${summary}`,
        summary,
        originalLength: text.length,
        summaryLength: summary.length,
        compressionRatio: (text.length / summary.length).toFixed(2)
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
      
      // Simulate processing time
      await delay(800);
      
      // In a real implementation, this would use a sentiment analysis API or library
      // This is a simple simulation for demonstration purposes
      
      // Basic word-based sentiment analysis
      const positiveWords = ['good', 'great', 'excellent', 'amazing', 'happy', 'love', 'like', 'best', 'fantastic', 'wonderful', 'positive', 'awesome'];
      const negativeWords = ['bad', 'awful', 'terrible', 'horrible', 'sad', 'hate', 'dislike', 'worst', 'negative', 'poor', 'disappointed'];
      
      const words = text.toLowerCase().match(/\w+/g) || [];
      
      let positiveCount = 0;
      let negativeCount = 0;
      
      words.forEach(word => {
        if (positiveWords.includes(word)) positiveCount++;
        if (negativeWords.includes(word)) negativeCount++;
      });
      
      // Simple sentiment score between -1 and 1
      const sentimentScore = words.length > 0 
        ? (positiveCount - negativeCount) / words.length 
        : 0;
      
      // Map to sentiment categories
      let sentiment = 'neutral';
      if (sentimentScore > 0.05) sentiment = 'positive';
      if (sentimentScore > 0.15) sentiment = 'very positive';
      if (sentimentScore < -0.05) sentiment = 'negative';
      if (sentimentScore < -0.15) sentiment = 'very negative';
      
      // Basic result
      const result: any = {
        sentiment,
        score: sentimentScore.toFixed(2)
      };
      
      // Add detailed emotion analysis if requested
      if (detailed) {
        // Emotion detection (very simplified)
        const emotions = {
          joy: ['happy', 'excited', 'delighted', 'joy', 'celebrate'],
          anger: ['angry', 'mad', 'furious', 'rage', 'annoyed'],
          fear: ['afraid', 'scared', 'terrified', 'worried', 'fear'],
          sadness: ['sad', 'unhappy', 'depressed', 'grief', 'miserable'],
          surprise: ['surprised', 'amazed', 'astonished', 'unexpected'],
          disgust: ['disgusted', 'revolted', 'gross', 'repulsed']
        };
        
        const emotionScores: Record<string, number> = {};
        
        // Count emotion words
        Object.entries(emotions).forEach(([emotion, emotionWords]) => {
          const count = words.filter(word => emotionWords.includes(word)).length;
          emotionScores[emotion] = count / words.length;
        });
        
        result.emotions = emotionScores;
        
        // Find dominant emotion
        const dominantEmotion = Object.entries(emotionScores)
          .reduce((max, [emotion, score]) => score > max.score ? { emotion, score } : max, { emotion: 'neutral', score: 0 });
        
        result.dominantEmotion = dominantEmotion.score > 0 ? dominantEmotion.emotion : 'neutral';
      }
      
      return {
        output: `Sentiment analysis: ${result.sentiment} (score: ${result.score})${
          detailed && result.dominantEmotion !== 'neutral' 
            ? `\nDominant emotion: ${result.dominantEmotion}` 
            : ''
        }`,
        analysis: result
      };
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
      
      // Simulate processing time
      await delay(700);
      
      // In a real implementation, this would use NLP techniques or an API
      // Simple implementation for demonstration
      
      // Remove common stop words
      const stopWords = ['a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 
                         'by', 'about', 'as', 'of', 'from', 'is', 'was', 'be', 'been', 'being', 'are',
                         'were', 'am', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'this', 'that'];
      
      // Tokenize and clean text
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length >= minLength && !stopWords.includes(word));
      
      // Count word frequency
      const wordFrequency: Record<string, number> = {};
      words.forEach(word => {
        wordFrequency[word] = (wordFrequency[word] || 0) + 1;
      });
      
      // Sort by frequency
      const sortedWords = Object.entries(wordFrequency)
        .sort((a, b) => b[1] - a[1])
        .slice(0, maxKeywords)
        .map(([word, count]) => ({ word, count }));
      
      // Try to extract phrases (2-3 word combinations)
      const phrases: string[] = [];
      const textLower = text.toLowerCase();
      
      sortedWords.forEach(({ word }) => {
        // Look for 2-word phrases
        const phrasePattern = new RegExp(`\\b${word}\\s+\\w+\\b`, 'g');
        const matches = [...textLower.matchAll(phrasePattern)];
        
        if (matches.length > 0) {
          // Get the most common phrase
          const phrase = matches[0][0].trim();
          if (!phrases.includes(phrase) && !stopWords.includes(phrase.split(/\s+/)[1])) {
            phrases.push(phrase);
          }
        }
      });
      
      // Combine single words and phrases
      const keywords = [
        ...sortedWords.slice(0, maxKeywords - phrases.length),
        ...phrases.slice(0, maxKeywords / 2).map(phrase => ({ word: phrase, count: 1 }))
      ];
      
      return {
        output: `Extracted ${keywords.length} keywords from text:\n${keywords.map(k => k.word).join(', ')}`,
        keywords: keywords.map(k => k.word),
        frequencies: sortedWords.reduce((obj, { word, count }) => ({ ...obj, [word]: count }), {})
      };
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
      
      // Simulate processing delay
      await delay(1200);
      
      // In a real implementation, this would use a text classification API or model
      // Simple simulation for demonstration
      
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
      
      // Simple keyword-based classification
      const keywordMap: Record<string, string[]> = {
        // Topics
        'technology': ['computer', 'software', 'hardware', 'app', 'tech', 'digital', 'internet', 'code', 'program'],
        'business': ['company', 'market', 'finance', 'invest', 'stock', 'economic', 'industry', 'trade', 'profit'],
        'politics': ['government', 'election', 'president', 'democrat', 'republican', 'vote', 'political', 'policy', 'law'],
        'health': ['doctor', 'medical', 'disease', 'patient', 'healthy', 'hospital', 'treatment', 'symptom', 'medication'],
        'science': ['research', 'scientist', 'study', 'experiment', 'discovery', 'theory', 'physics', 'chemistry', 'biology'],
        'entertainment': ['movie', 'film', 'music', 'actor', 'celebrity', 'hollywood', 'television', 'show', 'drama'],
        'sports': ['player', 'team', 'game', 'score', 'win', 'championship', 'tournament', 'athletic', 'coach'],
        'education': ['school', 'student', 'teacher', 'learn', 'class', 'education', 'academic', 'study', 'college'],
        'travel': ['trip', 'vacation', 'hotel', 'flight', 'tourist', 'destination', 'travel', 'visit', 'country'],
        'food': ['restaurant', 'recipe', 'cook', 'meal', 'ingredient', 'food', 'dish', 'cuisine', 'flavor'],
        
        // Intents
        'question': ['who', 'what', 'when', 'where', 'why', 'how', '?', 'could you', 'tell me'],
        'request': ['please', 'would you', 'can you', 'help', 'need', 'want', 'looking for', 'assist'],
        'complaint': ['problem', 'issue', 'broken', 'disappointed', 'unhappy', 'failure', 'complaint', 'bad', 'wrong'],
        'feedback': ['think', 'opinion', 'suggest', 'feedback', 'review', 'rating', 'experience', 'improve'],
        'greeting': ['hello', 'hi', 'hey', 'morning', 'afternoon', 'evening', 'welcome', 'greet'],
        'farewell': ['goodbye', 'bye', 'see you', 'later', 'take care', 'night', 'leaving'],
        'thanks': ['thank', 'appreciate', 'grateful', 'thankful', 'helped', 'thanks'],
        'apology': ['sorry', 'apologize', 'apology', 'mistake', 'regret', 'fault', 'forgive']
      };
      
      // Count keyword matches for each category
      const categoryScores: Record<string, number> = {};
      const textLower = text.toLowerCase();
      
      availableCategories.forEach(category => {
        // Skip categories without keyword definitions
        if (!keywordMap[category]) {
          categoryScores[category] = 0;
          return;
        }
        
        // Count matches
        const keywords = keywordMap[category];
        const matches = keywords.filter(keyword => textLower.includes(keyword)).length;
        
        // Calculate score (normalized by number of keywords)
        categoryScores[category] = matches / keywords.length;
      });
      
      // Sort by score
      const sortedCategories = Object.entries(categoryScores)
        .sort((a, b) => b[1] - a[1]);
      
      if (multiLabel) {
        // Return all categories with non-zero scores
        const matchingCategories = sortedCategories
          .filter(([_, score]) => score > 0)
          .map(([category, score]) => ({ 
            category, 
            confidence: parseFloat((score * 100).toFixed(1)) 
          }));
        
        return {
          output: `Text classified into ${matchingCategories.length} categories:\n` +
                  matchingCategories.map(c => `${c.category} (${c.confidence}%)`).join(', '),
          classifications: matchingCategories,
          mode
        };
      } else {
        // Return only top category
        const topCategory = sortedCategories[0];
        
        if (!topCategory || topCategory[1] === 0) {
          return {
            output: `Unable to classify text into any of the provided categories`,
            classifications: [],
            mode
          };
        }
        
        return {
          output: `Text classified as "${topCategory[0]}" with ${(topCategory[1] * 100).toFixed(1)}% confidence`,
          classification: {
            category: topCategory[0],
            confidence: parseFloat((topCategory[1] * 100).toFixed(1))
          },
          alternativeCategories: sortedCategories.slice(1, 3)
            .map(([category, score]) => ({ 
              category, 
              confidence: parseFloat((score * 100).toFixed(1)) 
            })),
          mode
        };
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
      
      // Simulate translation delay
      await delay(1000);
      
      // This is a simulation - in a real implementation, this would call a translation API
      // For demo purposes, we'll just add a language marker
      
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
      
      // Simulate translation
      // In a real implementation, this would use a translation API
      
      // Simple preservation of basic formatting
      let formattedText = text;
      let translatedText = `[AI Translation to ${targetName}: "${text}"]`;
      
      if (preserveFormatting) {
        // Preserve paragraph breaks
        const paragraphs = text.split(/\n\s*\n/);
        translatedText = paragraphs.map(p => `[AI Translation to ${targetName}: "${p}"]`).join('\n\n');
        
        // Preserve bullet points
        translatedText = translatedText.replace(/^(\s*[-*•]\s*)/gm, match => match);
        
        // Preserve numbering
        translatedText = translatedText.replace(/^(\s*\d+\.\s*)/gm, match => match);
      }
      
      return {
        output: `Translation from ${sourceName} to ${targetName}:\n\n${translatedText}`,
        translation: translatedText,
        sourceLanguage: sourceLanguage === 'auto' ? 'en' : sourceLanguage, // In a real impl, this would be detected
        targetLanguage,
        confidence: 0.95 // Simulated confidence score
      };
    }, (error) => {
      return `Translation failed: ${error.message}`;
    });
  }
};