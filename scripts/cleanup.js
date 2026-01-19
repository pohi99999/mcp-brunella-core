/**
 * Cleanup Script - Cache and Log Management
 * Cleans temporary files, old logs, and cache to maintain system health
 */

const fs = require('fs').promises;
const path = require('path');

const CONFIG = {
  logDir: path.join(__dirname, '..', 'logs'),
  maxLogAgeDays: 30,
  maxLogSizeMB: 100,
  cacheDir: path.join(__dirname, '..', 'cache'),
  tempPatterns: ['*.tmp', '*.temp', '*.cache']
};

/**
 * Get file size in MB
 */
async function getFileSizeMB(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size / (1024 * 1024);
  } catch (e) {
    return 0;
  }
}

/**
 * Get file age in days
 */
async function getFileAgeDays(filePath) {
  try {
    const stats = await fs.stat(filePath);
    const now = Date.now();
    const ageMs = now - stats.mtime.getTime();
    return ageMs / (1000 * 60 * 60 * 24);
  } catch (e) {
    return 0;
  }
}

/**
 * Clean old log files
 */
async function cleanLogs() {
  console.log('🧹 Cleaning log files...');
  
  try {
    const files = await fs.readdir(CONFIG.logDir);
    let cleaned = 0;
    let totalSizeFreed = 0;
    
    for (const file of files) {
      const filePath = path.join(CONFIG.logDir, file);
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) continue;
      
      const ageDays = await getFileAgeDays(filePath);
      const sizeMB = await getFileSizeMB(filePath);
      
      // Remove if too old or too large
      if (ageDays > CONFIG.maxLogAgeDays || sizeMB > CONFIG.maxLogSizeMB) {
        totalSizeFreed += sizeMB;
        await fs.unlink(filePath);
        console.log(`  ✓ Removed ${file} (${sizeMB.toFixed(2)}MB, ${ageDays.toFixed(0)} days old)`);
        cleaned++;
      }
    }
    
    console.log(`  ✓ Cleaned ${cleaned} log file(s), freed ${totalSizeFreed.toFixed(2)}MB`);
  } catch (e) {
    console.error(`  ✗ Error cleaning logs: ${e.message}`);
  }
}

/**
 * Clean cache directory
 */
async function cleanCache() {
  console.log('🧹 Cleaning cache...');
  
  try {
    // Check if cache directory exists
    try {
      await fs.access(CONFIG.cacheDir);
    } catch {
      console.log('  ℹ No cache directory found');
      return;
    }
    
    const files = await fs.readdir(CONFIG.cacheDir);
    let cleaned = 0;
    let totalSizeFreed = 0;
    
    for (const file of files) {
      const filePath = path.join(CONFIG.cacheDir, file);
      const stats = await fs.stat(filePath);
      
      if (!stats.isFile()) continue;
      
      const sizeMB = await getFileSizeMB(filePath);
      totalSizeFreed += sizeMB;
      
      await fs.unlink(filePath);
      console.log(`  ✓ Removed ${file} (${sizeMB.toFixed(2)}MB)`);
      cleaned++;
    }
    
    console.log(`  ✓ Cleaned ${cleaned} cache file(s), freed ${totalSizeFreed.toFixed(2)}MB`);
  } catch (e) {
    console.error(`  ✗ Error cleaning cache: ${e.message}`);
  }
}

/**
 * Clean temporary files
 */
async function cleanTempFiles() {
  console.log('🧹 Cleaning temporary files...');
  
  const rootDir = path.join(__dirname, '..');
  let cleaned = 0;
  
  try {
    const files = await fs.readdir(rootDir);
    
    for (const file of files) {
      // Check if matches temp patterns
      const isTemp = CONFIG.tempPatterns.some(pattern => {
        const regex = new RegExp(pattern.replace('*', '.*'));
        return regex.test(file);
      });
      
      if (isTemp) {
        const filePath = path.join(rootDir, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isFile()) {
          await fs.unlink(filePath);
          console.log(`  ✓ Removed ${file}`);
          cleaned++;
        }
      }
    }
    
    console.log(`  ✓ Cleaned ${cleaned} temporary file(s)`);
  } catch (e) {
    console.error(`  ✗ Error cleaning temp files: ${e.message}`);
  }
}

/**
 * Display cleanup summary
 */
async function showSummary() {
  console.log('\n📊 Cleanup Summary:');
  
  try {
    // Log directory size
    const logFiles = await fs.readdir(CONFIG.logDir);
    let logTotalSize = 0;
    
    for (const file of logFiles) {
      const filePath = path.join(CONFIG.logDir, file);
      const stats = await fs.stat(filePath);
      if (stats.isFile()) {
        logTotalSize += await getFileSizeMB(filePath);
      }
    }
    
    console.log(`  Logs: ${logFiles.length} file(s), ${logTotalSize.toFixed(2)}MB`);
  } catch (e) {
    console.log(`  Logs: Directory not accessible`);
  }
  
  // Cache directory size
  try {
    await fs.access(CONFIG.cacheDir);
    const cacheFiles = await fs.readdir(CONFIG.cacheDir);
    console.log(`  Cache: ${cacheFiles.length} file(s)`);
  } catch {
    console.log(`  Cache: No cache directory`);
  }
}

/**
 * Main cleanup function
 */
async function main() {
  console.log('🚀 MCP Brunella Core - Cleanup Utility\n');
  
  const startTime = Date.now();
  
  await cleanLogs();
  await cleanCache();
  await cleanTempFiles();
  await showSummary();
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✅ Cleanup completed in ${duration}s`);
}

// Run cleanup
main().catch(error => {
  console.error('Fatal error during cleanup:', error);
  process.exit(1);
});
