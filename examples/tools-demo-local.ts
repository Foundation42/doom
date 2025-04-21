/**
 * Simple local demo of standard tools without OpenAI
 */
import { 
  calculatorTool, 
  dateTimeTool, 
  jsonParserTool, 
  stringUtilsTool,
  hashingTool,
  createConsoleLogger
} from '../src';

const logger = createConsoleLogger('Local Demo: ', 'info');

async function demoTools() {
  try {
    logger.info('Demonstrating calculator tool...');
    const calcResult = await calculatorTool.func({ expression: '15% of 240' });
    console.log('Calculator result:', calcResult.output);
    
    logger.info('\nDemonstrating date tool...');
    const dateResult = await dateTimeTool.func({ 
      operation: 'add', 
      date: new Date().toISOString(), 
      unit: 'days', 
      amount: 45 
    });
    console.log('Date calculation result:', dateResult.output);
    
    logger.info('\nDemonstrating JSON parser...');
    const jsonData = `{"name": "John", "age": 30, "skills": ["JavaScript", "TypeScript", "React"]}`;
    const jsonResult = await jsonParserTool.func({ input: jsonData, prettify: true });
    console.log('JSON parsing result:', jsonResult.output);
    console.log('Parsed data:', jsonResult.data);
    
    logger.info('\nDemonstrating string utilities...');
    const stringResult = await stringUtilsTool.func({ 
      text: 'hello world example', 
      operation: 'titlecase' 
    });
    console.log('String manipulation result:', stringResult.output);
    
    logger.info('\nDemonstrating crypto hashing...');
    const hashResult = await hashingTool.func({ 
      operation: 'hash', 
      input: 'secret-password-123', 
      algorithm: 'sha256' 
    });
    console.log('Hashing result:', hashResult.output);
    
    logger.info('\nDemonstration completed successfully!');
  } catch (error) {
    logger.error('Error during demonstration:', error);
  }
}

// Run the demo
console.log('===== Standard Tools Local Demo =====');
console.log('This demo shows the tools working without requiring OpenAI API calls\n');
demoTools();