/**
 * JSON Processor - Extract data from JSON files
 */

const fs = require('fs').promises;

class JSONProcessor {
    async extract(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const data = JSON.parse(content);

            // Convert JSON to readable text
            const text = this.jsonToText(data);

            return {
                text,
                metadata: {
                    format: 'json',
                    structure: Array.isArray(data) ? 'array' : 'object'
                },
                chunks: [{
                    content: text.trim(),
                    metadata: {
                        type: 'structured_data'
                    }
                }]
            };
        } catch (error) {
            throw new Error(`Failed to extract JSON: ${error.message}`);
        }
    }

    jsonToText(obj, indent = 0) {
        const spaces = '  '.repeat(indent);
        let text = '';

        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                text += `${spaces}Item ${index + 1}:\n`;
                text += this.jsonToText(item, indent + 1);
            });
        } else if (typeof obj === 'object' && obj !== null) {
            Object.entries(obj).forEach(([key, value]) => {
                if (typeof value === 'object') {
                    text += `${spaces}${key}:\n`;
                    text += this.jsonToText(value, indent + 1);
                } else {
                    text += `${spaces}${key}: ${value}\n`;
                }
            });
        } else {
            text += `${spaces}${obj}\n`;
        }

        return text;
    }
}

module.exports = JSONProcessor;
