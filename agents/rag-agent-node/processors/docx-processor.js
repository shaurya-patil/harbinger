/**
 * DOCX Processor - Extract text from Word documents
 */

const mammoth = require('mammoth');

class DOCXProcessor {
    async extract(filePath) {
        try {
            const result = await mammoth.extractRawText({ path: filePath });

            return {
                text: result.value,
                metadata: {
                    format: 'docx',
                    messages: result.messages
                },
                chunks: [{
                    content: result.value.trim(),
                    metadata: {
                        type: 'full_document'
                    }
                }]
            };
        } catch (error) {
            throw new Error(`Failed to extract DOCX: ${error.message}`);
        }
    }
}

module.exports = DOCXProcessor;
