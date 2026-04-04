const fs = require('fs');
const file = 'src/dashboard/components/cean/components/PipelineVisualizer.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `onClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();`;

const replacement = `onClick={(e: React.MouseEvent<HTMLCanvasElement>) => {
            const rect = canvasRef.current?.getBoundingClientRect();`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
console.log('Patched types in PipelineVisualizer.tsx');
