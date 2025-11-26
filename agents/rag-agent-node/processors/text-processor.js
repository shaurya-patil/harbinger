/**
 * Text Processor - Extract text from plain text and markdown files
 */

const fs = require('fs').promises;
const { marked } = require('marked');

class TextProcessor {
    async extract(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const extension = filePath.split('.').pop().toLowerCase();

            let text = content;
            let metadata = { format: extension };

            // If markdown, optionally convert to plain text
            if (extension === 'md' || extension === 'markdown') {
                metadata.isMarkdown = true;
                // Keep markdown as-is for better context
                // Or convert: text = marked.parse(content);
            }

            return {
                text: text.trim(),
                metadata,
                chunks: [{
                    content: text.trim(),
                    metadata: {
                        type: 'text_document'
                    }
                }]
            };
        } catch (error) {
            throw new Error(`Failed to extract text: ${error.message}`);
        }
    }
}

module.exports = TextProcessor;
