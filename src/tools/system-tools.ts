/**
 * System-related tools for operating system information and operations
 */
import { Tool, ToolResult } from '../types';
import { safeToolExecution } from './index';
import * as os from 'os';
import * as process from 'process';
import * as child_process from 'child_process';
import * as util from 'util';

// Promisified exec
const exec = util.promisify(child_process.exec);

/**
 * Creates a set of system-related tools
 * @returns An array of system tools
 */
export function createSystemTools(): Tool[] {
  return [
    systemInfoTool,
    processInfoTool,
    environmentTool,
    networkInfoTool,
    commandTool
  ];
}

/**
 * A tool for getting system information
 */
export const systemInfoTool: Tool = {
  name: 'systemInfo',
  description: 'Gets information about the operating system and hardware',
  parameters: {
    type: 'object',
    properties: {
      type: { 
        type: 'string', 
        enum: ['all', 'os', 'cpu', 'memory', 'disk'],
        description: 'Type of system information to retrieve',
        default: 'all'
      }
    },
    additionalProperties: false
  },
  func: async (args: { type?: string }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { type = 'all' } = args;
      
      // Get OS information
      const osInfo = {
        platform: os.platform(),
        type: os.type(),
        release: os.release(),
        version: os.version(),
        arch: os.arch(),
        hostname: os.hostname(),
        uptime: os.uptime()
      };
      
      // Format uptime
      const formatUptime = (seconds: number): string => {
        const days = Math.floor(seconds / (3600 * 24));
        const hours = Math.floor((seconds % (3600 * 24)) / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${days}d ${hours}h ${minutes}m`;
      };
      
      const uptimeFormatted = formatUptime(osInfo.uptime);
      
      // Get CPU information
      const cpuInfo = {
        model: os.cpus()[0].model,
        speed: os.cpus()[0].speed,
        cores: os.cpus().length,
        loadAvg: os.loadavg()
      };
      
      // Get memory information
      const memInfo = {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem()
      };
      
      // Format memory sizes
      const formatMemory = (bytes: number): string => {
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(2)} GB`;
      };
      
      // Get disk information (simplified)
      // In a real implementation, use a disk space library
      let diskInfo: Record<string, string> = {};
      try {
        if (os.platform() !== 'win32') {
          const { stdout } = await exec('df -h / | tail -1 | awk \'{print $2, $3, $4, $5}\'');
          const parts = stdout.trim().split(/\s+/);
          if (parts.length >= 4) {
            diskInfo = { 
              total: parts[0], 
              used: parts[1], 
              free: parts[2], 
              percentage: parts[3] 
            };
          } else {
            diskInfo = { note: 'Failed to parse disk information' };
          }
        } else {
          // Simplified for Windows
          diskInfo = { note: 'Detailed disk info not available on Windows in this simplified example' };
        }
      } catch (error) {
        diskInfo = { error: 'Failed to retrieve disk information' };
      }
      
      // Build result based on requested type
      let result: any = {};
      let output = '';
      
      if (type === 'all' || type === 'os') {
        result.os = osInfo;
        output += `OS: ${osInfo.type} ${osInfo.release} (${osInfo.platform}, ${osInfo.arch})\n`;
        output += `Hostname: ${osInfo.hostname}\n`;
        output += `Uptime: ${uptimeFormatted}\n\n`;
      }
      
      if (type === 'all' || type === 'cpu') {
        result.cpu = cpuInfo;
        output += `CPU: ${cpuInfo.model}\n`;
        output += `Cores: ${cpuInfo.cores}\n`;
        output += `CPU Speed: ${cpuInfo.speed} MHz\n`;
        output += `Load Average: ${cpuInfo.loadAvg.map(load => load.toFixed(2)).join(', ')}\n\n`;
      }
      
      if (type === 'all' || type === 'memory') {
        result.memory = memInfo;
        output += `Memory Total: ${formatMemory(memInfo.total)}\n`;
        output += `Memory Used: ${formatMemory(memInfo.used)} (${((memInfo.used / memInfo.total) * 100).toFixed(1)}%)\n`;
        output += `Memory Free: ${formatMemory(memInfo.free)}\n\n`;
      }
      
      if (type === 'all' || type === 'disk') {
        result.disk = diskInfo;
        if ('total' in diskInfo && 'used' in diskInfo && 'free' in diskInfo && 'percentage' in diskInfo) {
          output += `Disk Total: ${diskInfo.total}\n`;
          output += `Disk Used: ${diskInfo.used} (${diskInfo.percentage})\n`;
          output += `Disk Free: ${diskInfo.free}\n`;
        } else if ('note' in diskInfo) {
          output += `Disk: ${diskInfo.note}\n`;
        } else if ('error' in diskInfo) {
          output += `Disk: Error retrieving disk information\n`;
        }
      }
      
      return {
        output: `System Information:\n${output}`,
        info: result
      };
    }, (error) => {
      return `Failed to get system information: ${error.message}`;
    });
  }
};

/**
 * A tool for getting information about running processes
 */
export const processInfoTool: Tool = {
  name: 'processInfo',
  description: 'Gets information about running processes or the current process',
  parameters: {
    type: 'object',
    properties: {
      type: { 
        type: 'string', 
        enum: ['current', 'top', 'find'],
        description: 'Type of process information to retrieve',
        default: 'current'
      },
      find: {
        type: 'string',
        description: 'Process name or pattern to find (for type=find)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of processes to return (for type=top)',
        default: 10
      }
    },
    additionalProperties: false
  },
  func: async (args: { 
    type?: string;
    find?: string;
    limit?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { type = 'current', find, limit = 10 } = args;
      
      // Get current process info
      if (type === 'current') {
        // We need to handle uptime() as a function
        const uptimeValue = typeof process.uptime === 'function' ? process.uptime() : 0;
        
        // Store the current directory as a string instead of a function
        const currentDir = typeof process.cwd === 'function' ? process.cwd() : '';
        
        const currentProcess = {
          pid: process.pid,
          title: process.title,
          uptime: uptimeValue,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage(),
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          execPath: process.execPath,
          cwd: currentDir // Store as string, not as function
        };
        
        // Format memory usage
        const formatMemory = (bytes: number): string => {
          const mb = bytes / (1024 * 1024);
          return `${mb.toFixed(2)} MB`;
        };
        
        // Formatted output
        const uptime = typeof currentProcess.uptime === 'number' 
                      ? currentProcess.uptime.toFixed(2)
                      : '0.00';
                      
        const output = `Current Process Information:\n` +
                      `PID: ${currentProcess.pid}\n` +
                      `Title: ${currentProcess.title}\n` +
                      `Uptime: ${uptime} seconds\n` +
                      `Memory RSS: ${formatMemory(currentProcess.memoryUsage.rss)}\n` +
                      `Memory Heap Total: ${formatMemory(currentProcess.memoryUsage.heapTotal)}\n` +
                      `Memory Heap Used: ${formatMemory(currentProcess.memoryUsage.heapUsed)}\n` +
                      `Node.js Version: ${currentProcess.version}\n` +
                      `Platform: ${currentProcess.platform}\n` +
                      `Architecture: ${currentProcess.arch}\n` +
                      `Executable Path: ${currentProcess.execPath}\n` +
                      `Current Directory: ${currentProcess.cwd}`;
        
        return {
          output,
          process: currentProcess
        };
      }
      
      // Get top processes or find specific processes
      // This is OS-specific and requires running external commands
      
      try {
        let command: string;
        let processes: any[] = [];
        
        if (os.platform() === 'win32') {
          // Windows
          if (type === 'top') {
            command = `powershell "Get-Process | Sort-Object -Descending CPU | Select-Object -First ${limit} | Format-Table -Property Id, ProcessName, CPU, WorkingSet -AutoSize"`;
          } else if (type === 'find' && find) {
            command = `powershell "Get-Process -Name *${find}* | Format-Table -Property Id, ProcessName, CPU, WorkingSet -AutoSize"`;
          } else {
            return {
              output: 'Missing or invalid parameters for process lookup',
              error: 'Invalid parameters'
            };
          }
          
          const { stdout } = await exec(command);
          return {
            output: `Process Information:\n${stdout}`,
            // Windows process parsing is complex - we're just returning raw output
            raw: stdout
          };
        } else {
          // Unix-like systems (Linux, macOS)
          if (type === 'top') {
            if (os.platform() === 'darwin') {
              // macOS
              command = `ps -Ao pid,comm,%cpu,%mem,time -r | head -n ${limit + 1}`;
            } else {
              // Linux
              command = `ps aux --sort=-%cpu | head -n ${limit + 1}`;
            }
          } else if (type === 'find' && find) {
            if (os.platform() === 'darwin') {
              // macOS
              command = `ps -Ao pid,comm,%cpu,%mem,time | grep -i "${find}"`;
            } else {
              // Linux
              command = `ps aux | grep -i "${find}" | grep -v grep`;
            }
          } else {
            return {
              output: 'Missing or invalid parameters for process lookup',
              error: 'Invalid parameters'
            };
          }
          
          const { stdout } = await exec(command);
          return {
            output: `Process Information:\n${stdout}`,
            // Unix process parsing - returning raw output
            raw: stdout
          };
        }
      } catch (error) {
        return {
          output: `Error retrieving process information: ${error instanceof Error ? error.message : String(error)}`,
          error: 'Process lookup failed'
        };
      }
    }, (error) => {
      return `Failed to get process information: ${error.message}`;
    });
  }
};

/**
 * A tool for working with environment variables
 */
export const environmentTool: Tool = {
  name: 'environment',
  description: 'Gets or sets environment variables',
  parameters: {
    type: 'object',
    properties: {
      action: { 
        type: 'string', 
        enum: ['get', 'list'],
        description: 'Action to perform',
        default: 'list'
      },
      name: {
        type: 'string',
        description: 'Name of the environment variable (for get action)'
      },
      prefix: {
        type: 'string',
        description: 'Prefix to filter environment variables (for list action)'
      }
    },
    additionalProperties: false
  },
  func: async (args: { 
    action?: string;
    name?: string;
    prefix?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { action = 'list', name, prefix } = args;
      
      // Get a specific environment variable
      if (action === 'get' && name) {
        const value = process.env[name];
        
        if (value === undefined) {
          return {
            output: `Environment variable "${name}" not found`,
            found: false
          };
        }
        
        return {
          output: `${name}=${value}`,
          name,
          value,
          found: true
        };
      }
      
      // List environment variables
      if (action === 'list') {
        // Filter environment variables if prefix is provided
        const envVars = Object.entries(process.env)
          .filter(([key]) => !prefix || key.startsWith(prefix))
          .sort(([a], [b]) => a.localeCompare(b));
        
        // Mask sensitive values
        const sensitiveKeys = ['key', 'secret', 'password', 'token', 'credential', 'auth'];
        // Explicitly type as tuple array to avoid undefined index issues
        const maskedVars: [string, string][] = envVars.map(([key, value]) => {
          // Check if the key contains any sensitive terms
          const isSensitive = sensitiveKeys.some(term => 
            key.toLowerCase().includes(term.toLowerCase())
          );
          
          // Make sure value is always a string
          const safeValue = value === undefined ? '' : String(value);
          
          return [key, isSensitive ? '********' : safeValue];
        });
        
        if (maskedVars.length === 0) {
          return {
            output: prefix 
              ? `No environment variables found with prefix "${prefix}"`
              : 'No environment variables found',
            variables: {}
          };
        }
        
        // Format the output
        const formattedVars = maskedVars
          .map(([key, value]) => `${key}=${value}`)
          .join('\n');
        
        // Convert to object for structured data
        const varsObject = maskedVars.reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {} as Record<string, string>);
        
        return {
          output: prefix 
            ? `Environment variables with prefix "${prefix}":\n${formattedVars}`
            : `Environment variables:\n${formattedVars}`,
          variables: varsObject,
          count: maskedVars.length
        };
      }
      
      return {
        output: 'Invalid action specified',
        error: 'Invalid action'
      };
    }, (error) => {
      return `Failed to access environment variables: ${error.message}`;
    });
  }
};

/**
 * A tool for getting network information
 */
export const networkInfoTool: Tool = {
  name: 'networkInfo',
  description: 'Gets information about network interfaces and connectivity',
  parameters: {
    type: 'object',
    properties: {
      type: { 
        type: 'string', 
        enum: ['interfaces', 'connectivity', 'all'],
        description: 'Type of network information to retrieve',
        default: 'all'
      },
      testHost: {
        type: 'string',
        description: 'Hostname to test connectivity with (for connectivity type)',
        default: 'example.com'
      }
    },
    additionalProperties: false
  },
  func: async (args: { 
    type?: string;
    testHost?: string;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { type = 'all', testHost = 'example.com' } = args;
      
      // Get network interfaces information
      let interfacesInfo: any = {};
      let connectivityInfo: any = {};
      let output = '';
      
      // Get network interfaces
      if (type === 'all' || type === 'interfaces') {
        const networkInterfaces = os.networkInterfaces();
        
        // Process and clean up the interface data
        interfacesInfo = Object.entries(networkInterfaces || {}).reduce((result, [name, interfaces]) => {
          if (!interfaces) return result;
          
          result[name] = interfaces.map(iface => ({
            address: iface.address,
            netmask: iface.netmask,
            family: iface.family,
            mac: iface.mac,
            internal: iface.internal,
            cidr: iface.cidr
          }));
          
          return result;
        }, {} as Record<string, any[]>);
        
        // Formatted output for interfaces
        output += 'Network Interfaces:\n';
        
        Object.entries(interfacesInfo).forEach(([name, interfaces]) => {
          output += `\n${name}:\n`;
          
          (interfaces as Array<{
            address: string;
            family: string;
            mac: string;
            internal: boolean;
          }>).forEach((iface, i) => {
            output += `  Interface ${i + 1}:\n`;
            output += `    Address: ${iface.address}\n`;
            output += `    Family: IPv${iface.family === 'IPv4' ? '4' : '6'}\n`;
            output += `    MAC: ${iface.mac}\n`;
            output += `    Internal: ${iface.internal ? 'Yes' : 'No'}\n`;
          });
        });
      }
      
      // Test connectivity
      if (type === 'all' || type === 'connectivity') {
        try {
          // Test DNS resolution
          const { stdout: nslookupOutput } = await exec(`nslookup ${testHost}`);
          connectivityInfo.dns = { success: true, target: testHost, output: nslookupOutput };
          
          // Test ping
          try {
            // Different ping syntax based on platform
            const pingCmd = os.platform() === 'win32'
              ? `ping -n 3 ${testHost}`
              : `ping -c 3 ${testHost}`;
            
            const { stdout: pingOutput } = await exec(pingCmd);
            
            // Extract ping statistics (simplified)
            const pingStats = pingOutput.includes('Average')
              ? pingOutput.match(/Average = (\d+)ms/) || pingOutput.match(/avg.*?=.*?\/(\d+\.\d+)/)
              : null;
              
            const avgPing = pingStats ? pingStats[1] : 'Unknown';
            
            connectivityInfo.ping = { 
              success: true, 
              target: testHost, 
              averageMs: avgPing,
              output: pingOutput
            };
          } catch (pingError) {
            connectivityInfo.ping = { 
              success: false, 
              target: testHost, 
              error: String(pingError) 
            };
          }
          
          // Add to output
          output += '\nConnectivity Information:\n';
          output += `DNS Resolution: ${connectivityInfo.dns.success ? 'Success' : 'Failed'}\n`;
          output += `Ping to ${testHost}: ${
            connectivityInfo.ping.success 
              ? `Success (avg: ${connectivityInfo.ping.averageMs}ms)` 
              : 'Failed'
          }\n`;
          
        } catch (error) {
          connectivityInfo.error = String(error);
          output += '\nConnectivity Test Failed.\n';
        }
      }
      
      return {
        output: output.trim(),
        interfaces: type === 'all' || type === 'interfaces' ? interfacesInfo : undefined,
        connectivity: type === 'all' || type === 'connectivity' ? connectivityInfo : undefined
      };
    }, (error) => {
      return `Failed to get network information: ${error.message}`;
    });
  }
};

/**
 * A tool for executing system commands (with safety limitations)
 */
export const commandTool: Tool = {
  name: 'executeCommand',
  description: 'Executes a safe system command (limited to non-destructive operations)',
  parameters: {
    type: 'object',
    properties: {
      command: { 
        type: 'string', 
        description: 'The command to execute' 
      },
      cwd: {
        type: 'string',
        description: 'Working directory for the command',
        default: process.cwd()
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds',
        default: 10000 // 10 seconds
      }
    },
    required: ['command'],
    additionalProperties: false
  },
  func: async (args: { 
    command: string;
    cwd?: string;
    timeout?: number;
  }): Promise<ToolResult> => {
    return safeToolExecution(async () => {
      const { command, cwd = process.cwd(), timeout = 10000 } = args;
      
      // SECURITY: Check for unsafe commands
      const unsafeCommands = [
        'rm', 'rmdir', 'del', 'format',
        'mkfs', 'dd', 'sudo', 'su',
        ':(){', 'wget', 'curl',
        'chmod', 'chown', 'chgrp',
        'mv', 'kill', 'pkill',
        '>', '>>', '|', ';', '&',
        'bash -c', 'sh -c', 'xterm',
        'wget', 'curl', 'nc', 'ncat',
        'ssh', 'ftp', 'telnet'
      ];
      
      // Check if command contains any unsafe patterns
      const lowerCommand = command.toLowerCase();
      const containsUnsafe = unsafeCommands.some(cmd => 
        lowerCommand.includes(cmd.toLowerCase())
      );
      
      if (containsUnsafe) {
        return {
          output: `Unsafe command detected. For security reasons, this command cannot be executed.`,
          error: 'Unsafe command',
          command
        };
      }
      
      // Only allow specific safe commands
      const safeCommandPrefixes = [
        'echo', 'cat', 'ls', 'dir',
        'date', 'time', 'whoami',
        'hostname', 'pwd', 'ps',
        'uname', 'env', 'ping',
        'nslookup', 'dig', 'traceroute',
        'ipconfig', 'ifconfig', 'netstat'
      ];
      
      // Check if command starts with safe prefix
      const isSafeCommand = safeCommandPrefixes.some(safePrefix => 
        lowerCommand.trim().startsWith(safePrefix.toLowerCase())
      );
      
      if (!isSafeCommand) {
        return {
          output: `Command not in allowed list. For security reasons, only specific information commands are allowed.`,
          error: 'Command not allowed',
          command,
          allowedCommands: safeCommandPrefixes
        };
      }
      
      // Execute the command with timeout
      try {
        const { stdout, stderr } = await exec(command, { 
          cwd, 
          timeout,
          maxBuffer: 1024 * 1024 // 1MB buffer
        });
        
        return {
          output: `Command executed successfully:\n\n${stdout}${stderr ? `\nStderr: ${stderr}` : ''}`,
          stdout,
          stderr,
          command,
          success: true
        };
      } catch (error) {
        const errObj = error as any;
        return {
          output: `Error executing command: ${errObj.message}\n${errObj.stderr || ''}`,
          error: errObj.message,
          stderr: errObj.stderr,
          stdout: errObj.stdout,
          command,
          success: false
        };
      }
    }, (error) => {
      return `Failed to execute command: ${error.message}`;
    });
  }
};