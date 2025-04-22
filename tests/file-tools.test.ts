/**
 * Tests for file-related tools
 */
import { 
  readFileTool,
  writeFileTool,
  listFilesTool,
  fileInfoTool,
  searchFilesTool
} from '../src/tools/file-tools';

import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

// Create a temporary directory for file tests
const TEST_DIR = path.join(os.tmpdir(), 'chatrunner-test-' + Math.random().toString(36).substring(2, 10));

describe('File Tools', () => {
  beforeAll(() => {
    // Create test directory and files
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR);
    }
    
    // Create a subdirectory
    const subDir = path.join(TEST_DIR, 'subdir');
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir);
    }
    
    // Create test files
    fs.writeFileSync(path.join(TEST_DIR, 'test1.txt'), 'This is test file 1');
    fs.writeFileSync(path.join(TEST_DIR, 'test2.txt'), 'This is test file 2');
    fs.writeFileSync(path.join(TEST_DIR, 'test3.json'), '{"name": "Test", "value": 123}');
    fs.writeFileSync(path.join(subDir, 'subtest.txt'), 'This is a file in a subdirectory');
  });
  
  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      // Recursive delete
      const deleteDir = (dirPath: string) => {
        if (fs.existsSync(dirPath)) {
          fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              deleteDir(curPath);
            } else {
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(dirPath);
        }
      };
      
      deleteDir(TEST_DIR);
    }
  });
  
  describe('readFileTool', () => {
    test('can read a file', async () => {
      const filePath = path.join(TEST_DIR, 'test1.txt');
      const result = await readFileTool.func({ path: filePath });
      
      expect(result.output).toContain('Successfully read');
      expect(result.content).toBe('This is test file 1');
      expect(result.truncated).toBe(false);
    });
    
    test('handles non-existent files', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');
      const result = await readFileTool.func({ path: filePath });
      
      expect(result.error).toBeDefined();
      expect(result.output).toContain('not found');
    });
  });
  
  describe('writeFileTool', () => {
    test('can write to a file', async () => {
      const filePath = path.join(TEST_DIR, 'write-test.txt');
      const content = 'This is a test write';
      
      const result = await writeFileTool.func({ 
        path: filePath, 
        content
      });
      
      expect(result.output).toContain('Successfully wrote');
      
      // Verify the file was written
      const writtenContent = fs.readFileSync(filePath, 'utf8');
      expect(writtenContent).toBe(content);
    });
    
    test('can append to a file', async () => {
      const filePath = path.join(TEST_DIR, 'append-test.txt');
      const initialContent = 'Initial content\n';
      const appendContent = 'Appended content';
      
      // First write
      await writeFileTool.func({ 
        path: filePath, 
        content: initialContent
      });
      
      // Then append
      const result = await writeFileTool.func({ 
        path: filePath, 
        content: appendContent, 
        append: true 
      });
      
      expect(result.output).toContain('Successfully appended');
      
      // Verify the file was appended
      const finalContent = fs.readFileSync(filePath, 'utf8');
      expect(finalContent).toBe(initialContent + appendContent);
    });
    
    test('can create parent directories', async () => {
      const nestedDir = path.join(TEST_DIR, 'nested', 'subdirectory');
      const filePath = path.join(nestedDir, 'nested-file.txt');
      const content = 'This is in a nested directory';
      
      const result = await writeFileTool.func({ 
        path: filePath, 
        content,
        createDir: true
      });
      
      expect(result.output).toContain('Successfully wrote');
      
      // Verify the file was written
      expect(fs.existsSync(nestedDir)).toBe(true);
      const writtenContent = fs.readFileSync(filePath, 'utf8');
      expect(writtenContent).toBe(content);
    });
  });
  
  describe('listFilesTool', () => {
    test('can list files in a directory', async () => {
      const result = await listFilesTool.func({ path: TEST_DIR });
      
      expect(result.output).toContain('Found');
      expect(result.files.length).toBeGreaterThan(0);
      
      // Verify it found our test files
      const fileNames = result.files.map((f: any) => f.name);
      expect(fileNames).toContain('test1.txt');
      expect(fileNames).toContain('test2.txt');
      expect(fileNames).toContain('test3.json');
      expect(fileNames).toContain('subdir');
    });
    
    test('can filter files with a pattern', async () => {
      const result = await listFilesTool.func({ 
        path: TEST_DIR,
        pattern: '*.txt'
      });
      
      expect(result.output).toContain('matching *.txt');
      
      // Verify it only found text files
      const fileNames = result.files.map((f: any) => f.name);
      expect(fileNames).toContain('test1.txt');
      expect(fileNames).toContain('test2.txt');
      expect(fileNames).not.toContain('test3.json');
    });
    
    test('includes file details when requested', async () => {
      const result = await listFilesTool.func({ 
        path: TEST_DIR,
        details: true
      });
      
      // Verify we have a details field in the result
      const firstFile = result.files.find((f: any) => f.type === 'file');
      expect(firstFile.size).toBeDefined();
      expect(firstFile.modified).toBeDefined();
      expect(firstFile.created).toBeDefined();
    });
    
    test('can list files recursively', async () => {
      const result = await listFilesTool.func({ 
        path: TEST_DIR,
        recursive: true
      });
      
      // Verify it found our files in subdirectories
      const filePaths = result.files.map((f: any) => f.path);
      expect(filePaths).toContain(path.join(TEST_DIR, 'subdir', 'subtest.txt'));
    });
  });
  
  describe('fileInfoTool', () => {
    test('returns detailed info about a file', async () => {
      const filePath = path.join(TEST_DIR, 'test1.txt');
      const result = await fileInfoTool.func({ path: filePath });
      
      expect(result.output).toContain('File information');
      expect(result.info.type).toBe('file');
      expect(result.info.size).toBeDefined();
      expect(result.info.name).toBe('test1.txt');
      expect(result.info.modified).toBeDefined();
    });
    
    test('returns info about a directory', async () => {
      const result = await fileInfoTool.func({ path: TEST_DIR });
      
      expect(result.output).toContain('File information');
      expect(result.info.type).toBe('directory');
      expect(result.info.items).toBeDefined();
    });
    
    test('handles non-existent paths', async () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.txt');
      const result = await fileInfoTool.func({ path: filePath });
      
      expect(result.error).toBeDefined();
      expect(result.output).toContain('not found');
    });
  });
  
  describe('searchFilesTool', () => {
    test('can search for patterns in files', async () => {
      const result = await searchFilesTool.func({ 
        path: TEST_DIR,
        pattern: 'test file',
        filePattern: '*.txt'
      });
      
      expect(result.output).toContain('Found');
      expect(result.results.length).toBeGreaterThan(0);
      
      // Verify it found matches in our test files
      const matchFilePaths = result.results.map((r: any) => r.file);
      expect(matchFilePaths).toContain(path.join(TEST_DIR, 'test1.txt'));
      expect(matchFilePaths).toContain(path.join(TEST_DIR, 'test2.txt'));
    });
    
    test('respects file pattern filters', async () => {
      const result = await searchFilesTool.func({ 
        path: TEST_DIR,
        pattern: 'test',
        filePattern: '*.json'
      });
      
      // Should only search in JSON files
      const matchFilePaths = result.results.map((r: any) => r.file);
      expect(matchFilePaths).toContain(path.join(TEST_DIR, 'test3.json'));
      expect(matchFilePaths).not.toContain(path.join(TEST_DIR, 'test1.txt'));
    });
    
    test('searches recursively when requested', async () => {
      const result = await searchFilesTool.func({ 
        path: TEST_DIR,
        pattern: 'subdirectory',
        recursive: true
      });
      
      // Should find matches in subdirectories
      const matchFilePaths = result.results.map((r: any) => r.file);
      expect(matchFilePaths).toContain(path.join(TEST_DIR, 'subdir', 'subtest.txt'));
    });
  });
});