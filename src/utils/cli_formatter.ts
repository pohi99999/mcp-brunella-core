import Table from 'cli-table3';

export function formatToolsTable(tools: any[]): string {
    if (!tools || tools.length === 0) {
        return 'No tools available';
    }

    const table = new Table({
        head: ['Name', 'Description', 'Arguments'],
        wordWrap: true,
        style: {
            head: ['cyan'],
            border: ['grey']
        }
    });

    tools.forEach(tool => {
        const inputSchema = tool.inputSchema || {};
        const args = Object.keys(inputSchema.properties || {}).join(', ') || '(none)';
        // Truncate description if too long to avoid huge tables in terminal
        let description = tool.description || '';
        if (description.length > 100) {
            description = description.substring(0, 97) + '...';
        }
        
        table.push([tool.name, description, args]);
    });

    return table.toString();
}

export function formatToolsJson(tools: any[]): string {
    return JSON.stringify(tools, null, 2);
}