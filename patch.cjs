const fs = require('fs');
const file = 'src/dashboard/components/cean/components/PipelineVisualizer.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `          onClick={(e) => {
            // TODO: Add click handling for node selection
          }}`;

const replacement = `          onClick={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;

            let clickedNodeId = null;

            for (const node of pipeline.nodes) {
              const nodeWidth = 120;
              const nodeHeight = 60;

              const col = Math.floor((node.id.charCodeAt(0) + node.id.length) % 5);
              const row = Math.floor(
                (node.id.charCodeAt(0) + node.id.length * 2) % 4,
              );

              const x = 50 + col * 150;
              const y = 50 + row * 80;

              if (
                clickX >= x &&
                clickX <= x + nodeWidth &&
                clickY >= y &&
                clickY <= y + nodeHeight
              ) {
                clickedNodeId = node.id;
                break;
              }
            }

            setSelectedNode(clickedNodeId);
          }}`;

content = content.replace(target, replacement);
fs.writeFileSync(file, content);
console.log('Patched PipelineVisualizer.tsx');
