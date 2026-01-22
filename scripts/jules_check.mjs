import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import process from 'process';

console.log("Checking Jules environment...");

// Check Node version
console.log(`Node version: ${process.version}`);

// Check for testing directory
if (!fs.existsSync('testing/TEST_BOOK.md')) {
    console.error("FAIL: testing/TEST_BOOK.md not found!");
    process.exit(1);
} else {
    console.log("PASS: testing/TEST_BOOK.md found.");
}

// Check for build
if (!fs.existsSync('build/index.js')) {
    console.warn("WARN: build/index.js not found. Running build...");
    try {
        execSync('npm run build', { stdio: 'inherit' });
    } catch (e) {
        console.error("FAIL: Build failed.");
        process.exit(1);
    }
} else {
    console.log("PASS: Build artifact found.");
}

// Check if tests pass
console.log("Running tests...");
try {
    execSync('npm test', { stdio: 'inherit' });
    console.log("PASS: All tests passed.");
} catch (e) {
    console.error("FAIL: Tests failed.");
    process.exit(1);
}

console.log("Jules environment is ready.");
