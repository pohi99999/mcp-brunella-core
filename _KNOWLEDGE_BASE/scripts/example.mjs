import fs from 'fs';
import path from 'path';

try {
  // Construct the path to the swagger.json file
  const specPath = path.resolve('node_modules', '@netlify/open-api', 'dist', 'swagger.json');

  // Read the file content
  const fileContent = fs.readFileSync(specPath, 'utf8');

  // Parse the JSON content
  const spec = JSON.parse(fileContent);

  console.log('Successfully loaded and parsed the Netlify OpenAPI spec.');
  console.log('Spec version:', spec.info.version);
  console.log('Available paths:', Object.keys(spec.paths).slice(0, 5).join(', ') + '...');
} catch (error) {
  console.error('Failed to load or parse the spec file:', error);
}