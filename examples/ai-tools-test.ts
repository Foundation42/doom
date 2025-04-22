/**
 * Quick test of the AI tools with real LLM integration
 */
import { 
  createConsoleLogger,
  textSummarizerTool,
  sentimentAnalyzerTool, 
  keywordExtractorTool,
  textClassifierTool,
  aiTranslationTool
} from '../src';

// Create a logger for our demo
const logger = createConsoleLogger('AI Tools Test: ', 'info');

// Sample text for testing
const sampleText = `Artificial intelligence (AI) is transforming our world in unprecedented ways. 
From self-driving cars to medical diagnosis, AI systems are becoming increasingly sophisticated 
and integrated into daily life. While these advancements bring tremendous benefits, they also raise
important ethical concerns about privacy, bias, and the future of work. Researchers and policymakers 
are working to establish frameworks that maximize AI's potential while mitigating risks.`;

// Sample negative text for sentiment analysis
const negativeText = `The customer service was absolutely terrible. I waited for over an hour on the phone 
and when I finally spoke to someone, they were unhelpful and rude. The product arrived damaged 
and they refused to issue a refund. I'm extremely disappointed and will never purchase from this company again.`;

/**
 * Demo for running each AI tool
 */
async function runDemo() {
  try {
    // Text summarization
    logger.info('\n--- Testing Text Summarizer ---');
    const summaryResult = await textSummarizerTool.func({
      text: sampleText,
      maxLength: 100,
      format: 'paragraph'
    });
    console.log(summaryResult.output);

    // Sentiment analysis
    logger.info('\n--- Testing Sentiment Analyzer ---');
    const sentimentResult = await sentimentAnalyzerTool.func({
      text: negativeText,
      detailed: true
    });
    console.log(sentimentResult.output);
    console.log('Analysis details:', sentimentResult.analysis);

    // Keyword extraction
    logger.info('\n--- Testing Keyword Extractor ---');
    const keywordResult = await keywordExtractorTool.func({
      text: sampleText,
      maxKeywords: 5
    });
    console.log(keywordResult.output);

    // Text classification
    logger.info('\n--- Testing Text Classifier ---');
    const classifierResult = await textClassifierTool.func({
      text: sampleText,
      mode: 'topic'
    });
    console.log(classifierResult.output);

    // Translation
    logger.info('\n--- Testing AI Translation ---');
    const translationResult = await aiTranslationTool.func({
      text: 'Hello, how are you today? I hope you are doing well.',
      sourceLanguage: 'en',
      targetLanguage: 'es'
    });
    console.log(translationResult.output);

  } catch (error) {
    logger.error('Demo failed:', error);
  }
}

// Run the demo
console.log('=== TESTING AI TOOLS WITH REAL LLM INTEGRATION ===\n');
runDemo();