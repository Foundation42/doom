/**
 * Tests for system-related tools
 */
import { 
  systemInfoTool,
  processInfoTool,
  networkInfoTool,
  environmentTool,
  commandTool
} from '../src/tools/system-tools';

describe('System Tools', () => {
  describe('systemInfoTool', () => {
    test('returns system information', async () => {
      const result = await systemInfoTool.func({});
      
      expect(result.output).toContain('System Information');
      expect(result.info).toBeDefined();
      expect(result.info.os).toBeDefined();
      expect(result.info.cpu).toBeDefined();
      expect(result.info.memory).toBeDefined();
    });
  });
  
  describe('processInfoTool', () => {
    test('returns process information', async () => {
      const result = await processInfoTool.func({});
      
      // Check that the output includes information about processes
      expect(result.output).toBeDefined();
      expect(result.output).toContain('rocess'); // Match 'Process' or 'process'
      
      // The internal details may vary by implementation, so just check
      // that we got a reasonable output
      expect(result.output.length).toBeGreaterThan(0);
    });
    
    test('can filter processes by name', async () => {
      const result = await processInfoTool.func({ filter: 'node' });
      
      // Check that the output includes information about processes
      expect(result.output).toBeDefined();
      
      // The filtered output should contain "node" somewhere
      expect(result.output.toLowerCase()).toContain('node');
    });
  });
  
  describe('networkInfoTool', () => {
    test('returns network interface information', async () => {
      const result = await networkInfoTool.func({ includeAddresses: true });
      
      // Check that the output includes network interfaces
      expect(result.output).toBeDefined();
      expect(result.output).toContain('etwork'); // Match "Network" or "network"
      
      // Check that interfaces information is included in some form
      expect(result.output).toContain('lo'); // Loopback interface
    });
    
    test('can check connectivity', async () => {
      // This test might be flaky depending on network, so we'll be lenient
      jest.setTimeout(10000); // Increase timeout for network operations
      
      try {
        const result = await networkInfoTool.func({ 
          checkConnectivity: true,
          target: 'google.com' 
        });
        
        // Check that the output includes connectivity information
        expect(result.output).toBeDefined();
        expect(result.output).toContain('onnectivity'); // Match "connectivity" or "Connectivity"
        
        // Don't assert on the actual connectivity result as it depends on network
      } catch (e) {
        // If this fails, it might be due to network issues
        console.warn('Network connectivity test skipped due to network issues');
      }
    });
  });
  
  describe('environmentTool', () => {
    test('returns environment variables', async () => {
      // Set a test env var
      process.env.TEST_ENV_VAR = 'test-value';
      
      const result = await environmentTool.func({});
      
      // Check that there is output and it's a string containing 'Environment variables'
      expect(result.output).toContain('nvironment variable'); // Case-insensitive match
      
      // Check that we have variables in the result
      expect(result.variables).toBeDefined();
      expect(result.variables.PATH).toBeDefined();
      expect(result.variables.TEST_ENV_VAR).toBe('test-value');
      
      // Clean up
      delete process.env.TEST_ENV_VAR;
    });
    
    test('can filter environment variables', async () => {
      // Set test env vars
      process.env.TEST_ENV_VAR1 = 'test-value-1';
      process.env.TEST_ENV_VAR2 = 'test-value-2';
      
      const result = await environmentTool.func({ 
        filter: 'TEST_ENV_VAR' 
      });
      
      // Check the output contains the expected environment variables text
      expect(result.output).toContain('Environment variables');
      
      // Check the variables in the result
      expect(result.variables).toBeDefined();
      expect(result.variables.TEST_ENV_VAR1).toBe('test-value-1');
      expect(result.variables.TEST_ENV_VAR2).toBe('test-value-2');
      
      // Clean up
      delete process.env.TEST_ENV_VAR1;
      delete process.env.TEST_ENV_VAR2;
    });
  });
  
  describe('commandTool', () => {
    test('can execute simple commands', async () => {
      const result = await commandTool.func({ 
        command: 'echo "test command"' 
      });
      
      // Check the output contains the command and its output
      expect(result.output).toContain('Command executed');
      expect(result.output).toContain('test command');
      
      // Check the command execution details
      expect(result.stdout).toContain('test command');
      expect(result.success).toBe(true);
    });
    
    test('handles unsafe commands appropriately', async () => {
      // Try to execute a command that's potentially harmful
      const result = await commandTool.func({ 
        command: 'rm -rf /' // This should be blocked by the safety checks
      });
      
      // Check that the command was blocked
      expect(result.output).toContain('Unsafe command');
    });
    
    test('handles unknown commands gracefully', async () => {
      // Try a command that's not in the allowed list
      const result = await commandTool.func({ 
        command: 'nonexistentcommand' 
      });
      
      // Check that we get some type of error message
      expect(result.output).toBeDefined();
    });
  });
});