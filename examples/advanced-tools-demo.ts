/**
 * Demo showcasing the advanced AI tools (LLM and TTS)
 */
import { 
  speakTextTool, 
  narrateContentTool, 
  expressiveSpeechTool,
  multiProviderCompletionTool,
  adaptiveCompletionTool,
  transformTextTool,
  compareLLMResponsesTool,
  chainOfThoughtTool,
  createConsoleLogger
} from '../src';
import * as dotenv from 'dotenv';
import * as os from 'os';

// Load environment variables from both home directory and project directory
dotenv.config(); // Project .env
dotenv.config({ path: `${os.homedir()}/.env` }); // Home directory .env

const logger = createConsoleLogger('Advanced AI Demo: ', 'info');

async function demoTTS() {
  logger.info('SECTION 1: DEMONSTRATING TEXT-TO-SPEECH TOOLS');
  
  try {
    logger.info('\nDemonstrating basic text-to-speech...');
    const result1 = await speakTextTool.func({ 
      text: 'Hello! This is a demonstration of the text to speech tool. It converts text to lifelike speech.',
      voice: 'nova'
    });
    console.log(result1.output);
    
    // Give time for the first audio to finish
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    logger.info('\nDemonstrating content narration in storytelling style...');
    const result2 = await narrateContentTool.func({
      content: 'Once upon a time, in a land far away, there lived a curious explorer who discovered a magical library. The books in this library could speak and share their wisdom with anyone who listened carefully.',
      style: 'storytelling',
      voice: 'onyx'
    });
    console.log(result2.output);
    
    // Give time for the second audio to finish
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    logger.info('\nDemonstrating expressive speech with character and emotion...');
    const result3 = await expressiveSpeechTool.func({
      text: 'Oh my goodness! I can\'t believe what I just saw! This is absolutely the most incredible technology I\'ve ever experienced in my entire life!',
      character: 'excited technology enthusiast',
      emotion: 'surprised',
      voice: 'shimmer'
    });
    console.log(result3.output);
    
    // Give time for the third audio to finish
    await new Promise(resolve => setTimeout(resolve, 8000));
    
  } catch (error) {
    logger.error('\nError in TTS demo:', error);
  }
}

async function demoAdvancedLLM() {
  logger.info('\n\nSECTION 2: DEMONSTRATING ADVANCED LLM TOOLS');
  
  try {
    logger.info('\nDemonstrating multi-provider completion...');
    const result1 = await multiProviderCompletionTool.func({
      prompt: 'Explain in one paragraph why quantum computing is important for the future of technology.',
      provider: 'openai',
      temperature: 0.7
    });
    console.log(result1.output);
    console.log('Provider metadata:', result1.metadata);
    
    logger.info('\nDemonstrating adaptive task-specific completion...');
    const result2 = await adaptiveCompletionTool.func({
      prompt: 'Write a function in Python to calculate the Fibonacci sequence up to n terms.',
      taskType: 'code_generation'
    });
    console.log(result2.output);
    console.log('Task metadata:', result2.metadata);
    
    logger.info('\nDemonstrating text transformation...');
    const longText = `Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals. The term "artificial intelligence" had previously been used to describe machines that mimic and display "human" cognitive skills that are associated with the human mind, such as "learning" and "problem-solving". This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.`;
    
    const result3 = await transformTextTool.func({
      text: longText,
      transformation: 'bulletize',
      outputLength: 'short'
    });
    console.log(result3.output);
    
    logger.info('\nDemonstrating chain-of-thought reasoning...');
    const result4 = await chainOfThoughtTool.func({
      problem: 'If a train travels at 120 km/h for 2.5 hours and then increases its speed to 150 km/h for another 1.5 hours, what is the total distance traveled?',
      numSteps: 3,
      includeSteps: true
    });
    console.log(result4.output);
    
    // Only run the comparison if multiple API keys are available
    const hasMultipleKeys = Boolean(process.env.OPENAI_API_KEY && 
      (process.env.ANTHROPIC_API_KEY || process.env.GOOGLE_API_KEY || process.env.MISTRAL_API_KEY));
    
    if (hasMultipleKeys) {
      logger.info('\nDemonstrating LLM response comparison...');
      const providers = [];
      if (process.env.OPENAI_API_KEY) providers.push('openai');
      if (process.env.ANTHROPIC_API_KEY) providers.push('anthropic');
      if (process.env.GOOGLE_API_KEY) providers.push('google');
      if (process.env.MISTRAL_API_KEY) providers.push('mistral');
      
      const result5 = await compareLLMResponsesTool.func({
        prompt: 'What are three potential ethical concerns about artificial general intelligence?',
        providers: providers.slice(0, 2), // Use only first two available providers
        compareResponses: true
      });
      console.log(result5.output);
    } else {
      logger.info('\nSkipping LLM comparison demo (requires multiple provider API keys)');
    }
    
  } catch (error) {
    logger.error('\nError in Advanced LLM demo:', error);
  }
}

async function runDemo() {
  console.log('\n=== ADVANCED AI TOOLS DEMO ===\n');
  console.log('This demo showcases the advanced TTS and LLM tools\n');
  
  // Check for API keys
  if (process.env.OPENAI_API_KEY) {
    logger.info('Found OpenAI API key');
    
    try {
      // Run TTS demo if OpenAI key is available (required for TTS)
      await demoTTS();
      
      // Run LLM demo (requires at least one LLM provider key)
      await demoAdvancedLLM();
      
      console.log('\n=== DEMO COMPLETED SUCCESSFULLY ===');
    } catch (error) {
      logger.error('Demo failed:', error);
    }
  } else {
    logger.error('OpenAI API key not found. Please set the OPENAI_API_KEY environment variable.');
    console.log('\nTo use these tools, you need to set API keys in your environment or ~/.env file:');
    console.log('- OPENAI_API_KEY (required for all demos)');
    console.log('- ANTHROPIC_API_KEY (optional for multi-provider demos)');
    console.log('- GOOGLE_API_KEY (optional for multi-provider demos)');
    console.log('- MISTRAL_API_KEY (optional for multi-provider demos)');
  }
}

// Run the demo
runDemo().catch(console.error);