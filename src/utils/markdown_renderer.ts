import chalk from 'chalk';

export function renderMarkdown(markdown: string): string {
    let output = markdown;

    // Code blocks (multiline)
    output = output.replace(/```[\s\S]*?```/g, (match) => {
        // Remove the backticks for the output
        const content = match.replace(/```/g, '');
        return chalk.bgGray(content);
    });

    // Headers (at start of line)
    output = output.replace(/^#\s+(.*$)/gm, (match, header) => {
        return chalk.bold.underline(header);
    });

    // Bold
    output = output.replace(/\*\*(.*?)\*\*/g, (match, text) => {
        return chalk.bold(text);
    });

    // Italic
    output = output.replace(/\*(.*?)\*/g, (match, text) => {
        return chalk.italic(text);
    });

    return output;
}