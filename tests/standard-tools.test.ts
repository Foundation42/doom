/**
 * Tests for standard tools library
 */
import { 
  createStandardTools, 
  createHttpTools,
  createDataTools,
  createUtilityTools,
  // Individual tools
  fetchUrlTool,
  calculatorTool,
  jsonParserTool
} from '../src';

describe('Standard Tools Library', () => {
  describe('Tool Collections', () => {
    test('createStandardTools returns all tools', () => {
      const tools = createStandardTools();
      expect(tools.length).toBeGreaterThan(0);
      
      // Verify we have tools from all categories
      const toolNames = tools.map(t => t.name);
      expect(toolNames).toContain('fetchUrl'); // HTTP tool
      expect(toolNames).toContain('parseJson'); // Data tool
      expect(toolNames).toContain('calculator'); // Utility tool
    });
    
    test('Individual category functions return specific tools', () => {
      const httpTools = createHttpTools();
      const dataTools = createDataTools();
      const utilityTools = createUtilityTools();
      
      expect(httpTools.length).toBeGreaterThan(0);
      expect(dataTools.length).toBeGreaterThan(0);
      expect(utilityTools.length).toBeGreaterThan(0);
      
      // Verify specific tools in each category
      expect(httpTools.find(t => t.name === 'fetchUrl')).toBeDefined();
      expect(dataTools.find(t => t.name === 'parseJson')).toBeDefined();
      expect(utilityTools.find(t => t.name === 'calculator')).toBeDefined();
    });
  });
  
  describe('Individual Tools', () => {
    test('fetchUrlTool has correct interface', () => {
      expect(fetchUrlTool.name).toBe('fetchUrl');
      expect(fetchUrlTool.description).toBeDefined();
      expect(fetchUrlTool.parameters).toBeDefined();
      expect(typeof fetchUrlTool.func).toBe('function');
    });
    
    test('calculatorTool has correct interface', () => {
      expect(calculatorTool.name).toBe('calculator');
      expect(calculatorTool.description).toBeDefined();
      expect(calculatorTool.parameters).toBeDefined();
      expect(typeof calculatorTool.func).toBe('function');
    });
    
    test('jsonParserTool has correct interface', () => {
      expect(jsonParserTool.name).toBe('parseJson');
      expect(jsonParserTool.description).toBeDefined();
      expect(jsonParserTool.parameters).toBeDefined();
      expect(typeof jsonParserTool.func).toBe('function');
    });
  });
  
  describe('Tool Functionality', () => {
    test('calculatorTool can perform basic calculations', async () => {
      const result = await calculatorTool.func({ expression: '2 + 2' });
      expect(result.output).toContain('4');
    });
    
    test('jsonParserTool can parse valid JSON', async () => {
      const validJson = '{"name":"Test","value":123}';
      const result = await jsonParserTool.func({ input: validJson });
      expect(result.output).toContain('Successfully parsed');
      expect(result.data).toEqual({ name: 'Test', value: 123 });
    });
    
    test('jsonParserTool handles invalid JSON gracefully', async () => {
      const invalidJson = '{name:"Test",value:123}'; // Missing quotes
      const result = await jsonParserTool.func({ input: invalidJson });
      expect(result.output).toContain('failed');
      expect(result.error).toBeDefined();
    });
  });
});