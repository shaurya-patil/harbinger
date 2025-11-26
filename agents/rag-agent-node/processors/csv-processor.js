/**
 * CSV Processor - Extract data from CSV files
 */

const fs = require('fs').promises;
const { parse } = require('csv-parse/sync');

class CSVProcessor {
    async extract(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            const records = parse(content, {
                columns: true,
                skip_empty_lines: true
            });

            // Convert to text format
            const headers = Object.keys(records[0] || {});
            let text = headers.join('\t') + '\n';

            records.forEach(record => {
                text += headers.map(h => record[h]).join('\t') + '\n';
            });

            return {
                text: text.trim(),
                metadata: {
                    format: 'csv',
                    rowCount: records.length,
                    columnCount: headers.length,
                    columns: headers
                },
                chunks: [{
                    content: text.trim(),
                    metadata: {
                        type: 'table',
                        rowCount: records.length
                    }
                }]
            };
        } catch (error) {
            throw new Error(`Failed to extract CSV: ${error.message}`);
        }
    }
}

module.exports = CSVProcessor;
