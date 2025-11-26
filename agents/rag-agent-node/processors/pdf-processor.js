/**
 * PDF Processor - Extract text from PDF files
 */

const pdf = require('pdf-parse');
const fs = require('fs').promises;

class PDFProcessor {
    async extract(filePath) {
        try {
            const dataBuffer = await fs.readFile(filePath);
            const data = await pdf(dataBuffer);

            return {
                text: data.text,
                metadata: {
                    pages: data.numpages,
                    info: data.info,
                    format: 'pdf'
                },
                chunks: this.createPageChunks(data)
            };
        } catch (error) {
            throw new Error(`Failed to extract PDF: ${error.message}`);
        }
    }

    createPageChunks(data) {
        // Split by pages if possible
        const chunks = [];
        const text = data.text;

        // Simple page splitting (can be improved)
        const pageBreakPattern = /\f/g; // Form feed character
        const pages = text.split(pageBreakPattern);

        pages.forEach((pageText, index) => {
            if (pageText.trim()) {
                chunks.push({
                    content: pageText.trim(),
                    metadata: {
                        page: index + 1,
                        type: 'page'
                    }
                });
            }
        });

        // If no page breaks found, return whole text
        if (chunks.length === 0) {
            chunks.push({
                content: text.trim(),
                metadata: {
                    page: 1,
                    type: 'full_document'
                }
            });
        }

        return chunks;
    }
}

module.exports = PDFProcessor;
