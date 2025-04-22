import OpenAI from 'openai';
import { playAudio } from 'openai/helpers/audio';
import * as dotenv from 'dotenv';
import os from 'os';

const homeDir = os.homedir();
const envPath = `${homeDir}/.env`;
dotenv.config({ path: envPath });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Queue to store speech requests
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

  while (speechQueue.length > 0) {
    const { input, instructions, voice } = speechQueue.shift()!;

    try {
      const response = await openai.audio.speech.create({
        model: 'gpt-4o-mini-tts',
        voice,
        input,
        instructions,
      });

      await playAudio(response);
    } catch (error) {
      console.error('Error processing speech request:', error);
    }
  }

  isProcessing = false;
}

/**
 * Adds a speech request to the queue and starts processing if not already running.
 * @param input - The text to convert to speech.
 * @param instructions - Instructions for the voice style, tone, and pacing.
 * @param voice - (Optional) The voice to use for TTS. Defaults to 'coral'.
 */
export function generateSpeech(input: string, instructions: string, voice: string = 'coral'): void {
  speechQueue.push({ input, instructions, voice });
  processQueue().catch((error) => console.error('Error in processQueue:', error));
}