import { Logger, LogLevel } from '../logger.js';
import fs from 'fs';
import path from 'path';
import { config } from '../../config/index.js';

// Mock fs module
jest.mock('fs/promises');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('Logger', () => {
  let logger: Logger;
  const testLogFile = path.join(config.systemLogDir, 'test.log');

  beforeEach(() => {
    logger = new Logger('test.log', true); // Use structured logging
    jest.clearAllMocks();
    (mockedFs.mkdir as jest.Mock).mockResolvedValue(undefined);
    (mockedFs.appendFile as jest.Mock).mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Structured Logging', () => {
    it('should log info messages in JSON format', async () => {
      await logger.log('Test message');

      expect(mockedFs.mkdir).toHaveBeenCalled();
      expect(mockedFs.appendFile).toHaveBeenCalled();
      
      const appendCall = (mockedFs.appendFile as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(appendCall[1]);
      
      expect(logEntry.level).toBe(LogLevel.INFO);
      expect(logEntry.message).toBe('Test message');
      expect(logEntry.timestamp).toBeDefined();
    });

    it('should log debug messages', async () => {
      await logger.debug('Debug message', { key: 'value' });

      const appendCall = (mockedFs.appendFile as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(appendCall[1]);
      
      expect(logEntry.level).toBe(LogLevel.DEBUG);
      expect(logEntry.message).toBe('Debug message');
      expect(logEntry.meta).toEqual({ key: 'value' });
    });

    it('should log warn messages', async () => {
      await logger.warn('Warning message');

      const appendCall = (mockedFs.appendFile as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(appendCall[1]);
      
      expect(logEntry.level).toBe(LogLevel.WARN);
    });

    it('should log error messages with error details', async () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      
      await logger.error('Error occurred', error, { context: 'test' });

      const appendCall = (mockedFs.appendFile as jest.Mock).mock.calls[0];
      const logEntry = JSON.parse(appendCall[1]);
      
      expect(logEntry.level).toBe(LogLevel.ERROR);
      expect(logEntry.error).toBeDefined();
      expect(logEntry.error.message).toBe('Test error');
      expect(logEntry.error.stack).toBe('Error stack trace');
      expect(logEntry.meta).toEqual({ context: 'test' });
    });

    it('should handle write failures gracefully', async () => {
      (mockedFs.appendFile as jest.Mock).mockRejectedValue(new Error('Write failed'));
      
      // Should not throw
      await expect(logger.log('Test')).resolves.not.toThrow();
    });
  });

  describe('Plain Text Logging', () => {
    it('should log in plain text format when structured logging is disabled', async () => {
      const plainLogger = new Logger('test.log', false);
      await plainLogger.log('Test message');

      const appendCall = (mockedFs.appendFile as jest.Mock).mock.calls[0];
      const logEntry = appendCall[1];
      
      expect(logEntry).toContain('[INFO]');
      expect(logEntry).toContain('Test message');
      expect(() => JSON.parse(logEntry)).toThrow(); // Should not be valid JSON
    });
  });
});
