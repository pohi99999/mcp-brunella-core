const fs = require('fs');
const file = 'src/dashboard/components/cean/components/PipelineVisualizer.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `onClick={(e: React.MouseEvent<HTMLCanvasElement>) => {`;
const replacement = `onClick={(e: any) => {`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
console.log('Reverted React.MouseEvent to any to fix missing namespace error.');
