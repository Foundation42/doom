/**
 * Debug test to check the actual output of tools
 */
import { 
  jsonParserTool, 
  csvTool,
  filterDataTool
} from '../src/tools/data-tools';

import {
  systemInfoTool,
  environmentTool,
  commandTool
} from '../src/tools/system-tools';

describe('Debug Tool Output', () => {
  test('jsonParserTool output format', async () => {
    const input = `{"name":"Test","values":[1,2,3]}`;
    const result = await jsonParserTool.func({ 
      input,
      prettify: true
    });
    console.log('JSON Parser Tool Output:', JSON.stringify(result, null, 2));
  });

  test('csvTool output format', async () => {
    const input = `name,age,city
John,30,New York`;
    const result = await csvTool.func({ 
      input,
      outputFormat: 'json'
    });
    console.log('CSV Tool Output:', JSON.stringify(result, null, 2));
  });

  test('filterDataTool output format', async () => {
    const testData = [
      { id: 1, name: 'John', age: 30 },
      { id: 2, name: 'Alice', age: 25 }
    ];
    
    const result = await filterDataTool.func({
      data: testData,
      filters: [{
        field: 'age',
        operator: '>',
        value: 25
      }]
    });
    console.log('Filter Data Tool Output:', JSON.stringify(result, null, 2));
  });

  test('environmentTool output format', async () => {
    // Set test env var
    process.env.TEST_DEBUG_VAR = 'test-value';
    
    const result = await environmentTool.func({ 
      filter: 'TEST_DEBUG' 
    });
    console.log('Environment Tool Output:', JSON.stringify(result, null, 2));
    
    // Clean up
    delete process.env.TEST_DEBUG_VAR;
  });

  test('commandTool output format', async () => {
    const result = await commandTool.func({ 
      command: 'echo "test command"' 
    });
    console.log('Command Tool Output:', JSON.stringify(result, null, 2));
  });
});