/**
 * Advanced demo of standard tools without OpenAI
 */
import { 
  systemInfoTool, 
  textSummarizerTool, 
  sentimentAnalyzerTool, 
  fileInfoTool,
  keywordExtractorTool,
  createConsoleLogger
} from '../src';

const logger = createConsoleLogger('Advanced Demo: ', 'info');

async function demoAdvancedTools() {
  try {
    logger.info('Demonstrating system info tool...');
    const sysInfoResult = await systemInfoTool.func({ type: 'os' });
    console.log('System info result:', sysInfoResult.output);
    
    logger.info('\nDemonstrating file info tool...');
    const fileResult = await fileInfoTool.func({ 
      path: __filename
    });
    console.log('File info result:', fileResult.output);
    
    logger.info('\nDemonstrating text summarization...');
    const longText = `Artificial intelligence (AI) is intelligence demonstrated by machines, as opposed to the natural intelligence displayed by animals including humans. AI research has been defined as the field of study of intelligent agents, which refers to any system that perceives its environment and takes actions that maximize its chance of achieving its goals. The term "artificial intelligence" had previously been used to describe machines that mimic and display "human" cognitive skills that are associated with the human mind, such as "learning" and "problem-solving". This definition has since been rejected by major AI researchers who now describe AI in terms of rationality and acting rationally, which does not limit how intelligence can be articulated.`;
    const summaryResult = await textSummarizerTool.func({ 
      text: longText,
      maxLength: 150,
      format: 'paragraph'
    });
    console.log('Summary result:', summaryResult.output);
    
    logger.info('\nDemonstrating sentiment analysis...');
    const sentimentResult = await sentimentAnalyzerTool.func({ 
      text: 'I really love using these amazing tools! They make development so much easier.',
      detailed: true
    });
    console.log('Sentiment result:', sentimentResult.output);
    
    logger.info('\nDemonstrating keyword extraction...');
    const keywordResult = await keywordExtractorTool.func({
      text: longText,
      maxKeywords: 8
    });
    console.log('Keyword extraction result:', keywordResult.output);
    
    logger.info('\nAdvanced demonstration completed successfully!');
  } catch (error) {
    logger.error('Error during demonstration:', error);
  }
}

// Run the demo
console.log('===== Advanced Tools Demo =====');
console.log('This demo shows the new tools working without requiring OpenAI API calls\n');
demoAdvancedTools();