/**
 * Excel Processor - Extract data from Excel files
 */

const ExcelJS = require('exceljs');

class ExcelProcessor {
    async extract(filePath) {
        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);

            let fullText = '';
            const chunks = [];

            workbook.eachSheet((worksheet, sheetId) => {
                let sheetText = `Sheet: ${worksheet.name}\n\n`;
                const rows = [];

                worksheet.eachRow((row, rowNumber) => {
                    const rowValues = row.values.slice(1); // Skip index 0
                    rows.push(rowValues.join('\t'));
                });

                sheetText += rows.join('\n');
                fullText += sheetText + '\n\n';

                chunks.push({
                    content: sheetText.trim(),
                    metadata: {
                        sheet: worksheet.name,
                        sheetId,
                        rowCount: worksheet.rowCount,
                        columnCount: worksheet.columnCount
                    }
                });
            });

            return {
                text: fullText.trim(),
                metadata: {
                    format: 'excel',
                    sheetCount: workbook.worksheets.length
                },
                chunks
            };
        } catch (error) {
            throw new Error(`Failed to extract Excel: ${error.message}`);
        }
    }
}

module.exports = ExcelProcessor;
