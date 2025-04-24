/**
 * Text-to-speech tools for generating audio from text
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution } from './index';
import OpenAI from 'openai';
import { playAudio } from 'openai/helpers/audio';
import * as dotenv from 'dotenv';
import * as os from 'os';

// Set up queue for speech processing
interface SpeechRequest {
  input: string;
  instructions: string;
  voice: string;
}

const speechQueue: SpeechRequest[] = [];
let isProcessing = false;

/**
 * Processes the speech queue sequentially.
 */
async function processQueue(): Promise<void> {
  if (isProcessing || speechQueue.length === 0) {
    return;
  }

  isProcessing = true;

  try {
    // Load environment variables from user's home directory
    const homeDir = os.homedir();
    const envPath = `${homeDir}/.env`;
    dotenv.config({ path: envPath });

    // Initialize OpenAI client
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    while (speechQueue.length > 0) {
      const { input, instructions, voice } = speechQueue.shift()!;

      try {
        const response = await openai.audio.speech.create({
          model: 'tts-1',
          voice,
          input,
          instructions,
        });

        await playAudio(response);
      } catch (error) {
        console.error('Error processing speech request:', error);
      }
    }
  } catch (error) {
    console.error('Error initializing TTS:', error);
  } finally {
    isProcessing = false;
  }
}

/**
 * Adds a speech request to the queue and starts processing if not already running.
 * @param input - The text to convert to speech.
 * @param instructions - Instructions for the voice style, tone, and pacing.
 * @param voice - The voice to use for TTS.
 */
function generateSpeech(input: string, instructions: string, voice: string): void {
  speechQueue.push({ input, instructions, voice });
  processQueue().catch((error) => console.error('Error in processQueue:', error));
}

/**
 * Creates a set of text-to-speech tools
 * @returns An array of TTS-related tools
 */
export function createTTSTools(): Tool[] {
  return [
    speakTextTool,
    narrateContentTool,
    expressiveSpeechTool
  ];
}

/**
 * A tool for converting text to speech using OpenAI's TTS API
 */
export const speakTextTool: Tool = {
  name: 'SpeakText',
  description: 'Converts text to speech and plays it using OpenAI\'s text-to-speech API',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to convert to speech' 
      },
      voice: { 
        type: 'string',
        enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'sage', 'ash'],
        description: 'The voice to use for the speech',
        default: 'nova'
      },
      instructions: {
        type: 'string',
        description: 'Optional instructions for how the voice should be styled (e.g., "speak slowly", "cheerful tone")',
        default: ''
      }
    },
    required: ['text'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string; 
    voice?: string;
    instructions?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        text, 
        voice = 'nova',
        instructions = ''
      } = args;
      
      // Validate inputs
      if (!text || text.trim().length === 0) {
        return {
          output: 'Cannot generate speech for empty text',
          error: 'Empty text'
        };
      }
      
      // Limit text length for API constraints
      const maxLength = 4000;
      const trimmedText = text.length > maxLength 
        ? text.substring(0, maxLength) + '...' 
        : text;
      
      // Generate speech using the TTS module
      try {
        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
          return {
            output: 'OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.',
            error: 'Missing API key'
          };
        }
        
        generateSpeech(trimmedText, instructions, voice);
        
        return {
          output: `Successfully generated speech for text (${trimmedText.length} chars) using voice "${voice}"${instructions ? ` with custom instructions: "${instructions}"` : ''}`,
          textSpoken: trimmedText,
          voice,
          instructions
        };
      } catch (error) {
        throw new Error(`Error generating speech: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `Speech generation failed: ${error.message}`;
    });
  }
};

/**
 * A tool for narrating content in a specialized way
 */
export const narrateContentTool: Tool = {
  name: 'narrateContent',
  description: 'Narrates content in a specialized way (storytelling, education, etc.)',
  parameters: {
    type: 'object',
    properties: {
      content: { 
        type: 'string', 
        description: 'The content to narrate' 
      },
      style: { 
        type: 'string',
        enum: [
          'storytelling', 
          'educational', 
          'professional', 
          'casual', 
          'dramatic', 
          'news', 
          'meditation'
        ],
        description: 'The narration style to use',
        default: 'storytelling'
      },
      voice: { 
        type: 'string',
        enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'sage', 'ash'],
        description: 'The voice to use for the narration',
        default: 'onyx'
      }
    },
    required: ['content'],
    additionalProperties: false
  },
  func: async (args: { 
    content: string; 
    style?: string;
    voice?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        content, 
        style = 'storytelling',
        voice = 'onyx'
      } = args;
      
      // Validate inputs
      if (!content || content.trim().length === 0) {
        return {
          output: 'Cannot narrate empty content',
          error: 'Empty content'
        };
      }
      
      // Map style to voice instructions
      const styleInstructions: Record<string, string> = {
        storytelling: 'Narrate this story in an engaging, dynamic way with appropriate emotional inflection for different characters and scenes. Pause briefly between paragraphs.',
        educational: 'Explain this content clearly with an educational tone. Emphasize key terms and concepts with slight pauses before important points.',
        professional: 'Present this information in a professional, authoritative manner with a measured pace and clear articulation. Maintain a consistent tone throughout.',
        casual: 'Speak in a relaxed, conversational way as if chatting with a friend. Use natural inflection and a slightly faster pace.',
        dramatic: 'Deliver this with dramatic emphasis and emotional intensity. Use dramatic pauses, volume variation, and an engaging performance style.',
        news: 'Present this information in the style of a news anchor with a clear, authoritative tone. Emphasize key facts with a professional cadence.',
        meditation: 'Speak in a calm, soothing voice with a slow, measured pace. Include longer pauses between sentences and a gentle, relaxing tone throughout.'
      };
      
      // Get the appropriate instructions for the selected style
      const instructions = styleInstructions[style] || styleInstructions.storytelling;
      
      // Limit content length for API constraints
      const maxLength = 4000;
      const trimmedContent = content.length > maxLength 
        ? content.substring(0, maxLength) + '...' 
        : content;
      
      // Generate speech
      try {
        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
          return {
            output: 'OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.',
            error: 'Missing API key'
          };
        }
        
        generateSpeech(trimmedContent, instructions, voice);
        
        return {
          output: `Successfully narrated content in ${style} style (${trimmedContent.length} chars) using voice "${voice}"`,
          contentNarrated: trimmedContent.substring(0, 200) + (trimmedContent.length > 200 ? '...' : ''),
          style,
          voice,
          instructions
        };
      } catch (error) {
        throw new Error(`Error generating narration: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `Content narration failed: ${error.message}`;
    });
  }
};

/**
 * A tool for generating expressive speech for specific contexts
 */
export const expressiveSpeechTool: Tool = {
  name: 'expressiveSpeech',
  description: 'Generates expressive speech for specific contexts like character dialogue or emotional expressions',
  parameters: {
    type: 'object',
    properties: {
      text: { 
        type: 'string', 
        description: 'The text to speak expressively' 
      },
      character: { 
        type: 'string',
        description: 'Character or persona to emulate (e.g., "excited child", "wise elder", "news anchor")'
      },
      emotion: { 
        type: 'string',
        enum: [
          'neutral', 
          'happy', 
          'sad', 
          'angry', 
          'surprised', 
          'fearful', 
          'disgusted',
          'excited',
          'contemplative',
          'urgent'
        ],
        description: 'The primary emotion to convey',
        default: 'neutral'
      },
      voice: { 
        type: 'string',
        enum: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer', 'coral', 'sage', 'ash'],
        description: 'The voice to use as a base',
        default: 'nova'
      }
    },
    required: ['text'],
    additionalProperties: false
  },
  func: async (args: { 
    text: string; 
    character?: string;
    emotion?: string;
    voice?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { 
        text, 
        character,
        emotion = 'neutral',
        voice = 'nova'
      } = args;
      
      // Validate inputs
      if (!text || text.trim().length === 0) {
        return {
          output: 'Cannot generate expressive speech for empty text',
          error: 'Empty text'
        };
      }
      
      // Map emotions to voice instructions
      const emotionInstructions: Record<string, string> = {
        neutral: 'Speak in a balanced, even tone.',
        happy: 'Speak with an upbeat, cheerful tone and slightly faster pace. Add subtle laughter where appropriate.',
        sad: 'Speak in a somber, lower tone with a slightly slower pace. Add subtle sighs where appropriate.',
        angry: 'Speak with intensity and emphasis on key words. Use a slightly louder voice with sharp articulation.',
        surprised: 'Speak with raised pitch and emphasis. Add gasps where appropriate and use an energetic tone.',
        fearful: 'Speak with a trembling quality, slightly higher pitch, and occasional hesitations.',
        disgusted: 'Speak with a slightly lower pitch and add subtle tone of revulsion.',
        excited: 'Speak quickly with high energy, varied pitch, and enthusiastic emphasis on key words.',
        contemplative: 'Speak slowly and thoughtfully with meaningful pauses between phrases.',
        urgent: 'Speak quickly with a serious tone and strong emphasis on important words.'
      };
      
      // Build instructions based on character and emotion
      let instructions = '';
      
      if (character) {
        instructions += `Speak as a ${character}. `;
      }
      
      instructions += emotionInstructions[emotion] || emotionInstructions.neutral;
      
      // Limit text length for API constraints
      const maxLength = 4000;
      const trimmedText = text.length > maxLength 
        ? text.substring(0, maxLength) + '...' 
        : text;
      
      // Generate speech
      try {
        // Check if OpenAI API key is available
        if (!process.env.OPENAI_API_KEY) {
          return {
            output: 'OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.',
            error: 'Missing API key'
          };
        }
        
        generateSpeech(trimmedText, instructions, voice);
        
        return {
          output: `Successfully generated expressive speech${character ? ` as a ${character}` : ''} with ${emotion} emotion (${trimmedText.length} chars) using voice "${voice}"`,
          textSpoken: trimmedText.substring(0, 200) + (trimmedText.length > 200 ? '...' : ''),
          character,
          emotion,
          voice,
          instructions
        };
      } catch (error) {
        throw new Error(`Error generating expressive speech: ${error instanceof Error ? error.message : String(error)}`);
      }
    }, (error) => {
      return `Expressive speech generation failed: ${error.message}`;
    });
  }
};