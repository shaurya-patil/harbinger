const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const fsSync = require('fs');

const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Helper function to ensure directory exists
async function ensureDir(filePath) {
    const dir = path.dirname(filePath);
    try {
        await fs.mkdir(dir, { recursive: true });
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
}

// Helper function to resolve file path
// Helper function to resolve file path
function resolveFilePath(filePath, baseDir = null) {
    if (path.isAbsolute(filePath)) {
        return filePath;
    }
    if (baseDir) {
        const userHome = require('os').homedir();
        const resolvedBaseDir = path.isAbsolute(baseDir) ? baseDir : path.join(userHome, baseDir);
        return path.join(resolvedBaseDir, filePath);
    }
    // Default to parent directory of harbinger
    const defaultDir = 'C:\\Users\\shaur\\OneDrive\\Desktop\\DL_Projects\\Agentic AI\\';
    return path.join(defaultDir, filePath);
}

// ==================== EXCEL OPERATIONS ====================

async function createWorkbook(params) {
    const workbook = new ExcelJS.Workbook();
    const filePath = resolveFilePath(params.path || `${params.name}.xlsx`, params.output_dir);

    // Add default worksheet if specified
    if (params.sheet_name) {
        workbook.addWorksheet(params.sheet_name);
    } else {
        workbook.addWorksheet('Sheet1');
    }

    await ensureDir(filePath);
    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Created workbook: ${filePath}`);
    return { success: true, file_path: filePath };
}

async function readRange(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    const range = worksheet.getCell(params.range);
    const values = [];

    // If range is a single cell
    if (!params.range.includes(':')) {
        return { values: [[range.value]] };
    }

    // Parse range (e.g., "A1:C10")
    const [start, end] = params.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end);

    for (let row = startCell.row; row <= endCell.row; row++) {
        const rowValues = [];
        for (let col = startCell.col; col <= endCell.col; col++) {
            const cell = worksheet.getCell(row, col);
            rowValues.push(cell.value);
        }
        values.push(rowValues);
    }

    console.log(`[Excel Agent] Read range ${params.range} from ${params.sheet}`);
    return { values };
}

async function writeRange(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();

    // Load existing workbook or create new one
    if (fsSync.existsSync(filePath)) {
        await workbook.xlsx.readFile(filePath);
    }

    let worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        worksheet = workbook.addWorksheet(params.sheet);
    }

    // Parse starting cell
    const startCell = worksheet.getCell(params.range.split(':')[0]);
    const startRow = startCell.row;
    const startCol = startCell.col;

    // Write values
    params.values.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            const cell = worksheet.getCell(startRow + rowIndex, startCol + colIndex);
            cell.value = value;
        });
    });

    await ensureDir(filePath);
    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Wrote data to range ${params.range} in ${params.sheet}`);
    return { success: true, rows_written: params.values.length };
}

async function addSheet(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    workbook.addWorksheet(params.sheet_name);
    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Added worksheet: ${params.sheet_name}`);
    return { success: true, sheet_name: params.sheet_name };
}

async function createTable(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    // Add table
    worksheet.addTable({
        name: params.table_name,
        ref: params.range,
        headerRow: true,
        totalsRow: params.totals_row || false,
        style: {
            theme: params.style || 'TableStyleMedium2',
            showRowStripes: true,
        },
        columns: params.columns || [],
        rows: params.rows || []
    });

    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Created table: ${params.table_name}`);
    return { success: true, table_name: params.table_name };
}

async function addChart(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    // Note: ExcelJS has limited chart support, this is a basic implementation
    // For advanced charts, consider using officegen or python interop
    console.log(`[Excel Agent] Chart creation requested for ${params.chart_type}`);
    console.log(`[Excel Agent] Note: Advanced chart features may require additional libraries`);

    // Add a comment indicating where the chart should be
    const chartCell = worksheet.getCell(params.position || 'A1');
    chartCell.note = `Chart: ${params.chart_type} using data from ${params.data_range}`;

    await workbook.xlsx.writeFile(filePath);

    return {
        success: true,
        note: 'Chart placeholder added. For full chart support, consider using Python with openpyxl or xlsxwriter',
        chart_type: params.chart_type
    };
}

async function applyFormula(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    const cell = worksheet.getCell(params.cell);

    // Handle different formula types
    if (params.formula.startsWith('=')) {
        cell.value = { formula: params.formula.substring(1) };
    } else {
        cell.value = { formula: params.formula };
    }

    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Applied formula to ${params.cell}: ${params.formula}`);
    return { success: true, cell: params.cell, formula: params.formula };
}

async function formatCells(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    // Parse range
    const [start, end] = params.range.includes(':') ? params.range.split(':') : [params.range, params.range];
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end || start);

    // Apply formatting to range
    for (let row = startCell.row; row <= endCell.row; row++) {
        for (let col = startCell.col; col <= endCell.col; col++) {
            const cell = worksheet.getCell(row, col);

            if (params.format.font) {
                cell.font = { ...cell.font, ...params.format.font };
            }
            if (params.format.fill) {
                cell.fill = params.format.fill;
            }
            if (params.format.alignment) {
                cell.alignment = params.format.alignment;
            }
            if (params.format.border) {
                cell.border = params.format.border;
            }
            if (params.format.numFmt) {
                cell.numFmt = params.format.numFmt;
            }
        }
    }

    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Applied formatting to range ${params.range}`);
    return { success: true, range: params.range };
}

async function mergeCells(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    worksheet.mergeCells(params.range);
    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Merged cells: ${params.range}`);
    return { success: true, range: params.range };
}

async function autoFilter(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    worksheet.autoFilter = params.range;
    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Applied auto-filter to: ${params.range}`);
    return { success: true, range: params.range };
}

async function freezePanes(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    // Freeze rows and/or columns
    const freezeCell = params.cell || 'A1';
    const cell = worksheet.getCell(freezeCell);

    worksheet.views = [
        { state: 'frozen', xSplit: cell.col - 1, ySplit: cell.row - 1 }
    ];

    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Froze panes at: ${freezeCell}`);
    return { success: true, cell: freezeCell };
}

async function sortData(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    // Read data from range
    const [start, end] = params.range.split(':');
    const startCell = worksheet.getCell(start);
    const endCell = worksheet.getCell(end);

    const data = [];
    for (let row = startCell.row; row <= endCell.row; row++) {
        const rowData = [];
        for (let col = startCell.col; col <= endCell.col; col++) {
            rowData.push(worksheet.getCell(row, col).value);
        }
        data.push(rowData);
    }

    // Sort data (simple implementation)
    const sortCol = params.sort_column || 0;
    const sortOrder = params.sort_order || 'asc';

    const header = data[0];
    const rows = data.slice(1);

    rows.sort((a, b) => {
        const aVal = a[sortCol];
        const bVal = b[sortCol];
        if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
        } else {
            return aVal < bVal ? 1 : -1;
        }
    });

    // Write sorted data back
    const sortedData = [header, ...rows];
    sortedData.forEach((rowValues, rowIndex) => {
        rowValues.forEach((value, colIndex) => {
            const cell = worksheet.getCell(startCell.row + rowIndex, startCell.col + colIndex);
            cell.value = value;
        });
    });

    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Sorted data in range ${params.range}`);
    return { success: true, rows_sorted: rows.length };
}

async function findAndReplace(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const worksheet = workbook.getWorksheet(params.sheet);
    if (!worksheet) {
        throw new Error(`Worksheet '${params.sheet}' not found`);
    }

    let replacements = 0;

    worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
            if (cell.value && cell.value.toString().includes(params.find)) {
                cell.value = cell.value.toString().replace(
                    new RegExp(params.find, 'g'),
                    params.replace
                );
                replacements++;
            }
        });
    });

    await workbook.xlsx.writeFile(filePath);

    console.log(`[Excel Agent] Replaced ${replacements} occurrences`);
    return { success: true, replacements };
}

async function getWorkbookInfo(params) {
    const filePath = resolveFilePath(params.file_path, params.output_dir);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = workbook.worksheets.map(ws => ({
        name: ws.name,
        row_count: ws.rowCount,
        column_count: ws.columnCount,
        has_tables: ws.tables ? ws.tables.length > 0 : false
    }));

    console.log(`[Excel Agent] Retrieved workbook info for ${filePath}`);
    return {
        file_path: filePath,
        sheet_count: sheets.length,
        sheets
    };
}

// ==================== TASK EXECUTION ====================

async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};

    // Inject output_dir from metadata
    if (task.metadata && task.metadata.output_dir) {
        params.output_dir = task.metadata.output_dir;
    }

    console.log(`[Excel Agent] Received task: ${task.id} - ${task.type}`);
    console.log(`[Excel Agent] Params:`, params);

    try {
        let result;

        switch (task.type) {
            case 'excel.create_workbook':
                result = await createWorkbook(params);
                break;
            case 'excel.read_range':
                result = await readRange(params);
                break;
            case 'excel.write_range':
                result = await writeRange(params);
                break;
            case 'excel.add_sheet':
                result = await addSheet(params);
                break;
            case 'excel.create_table':
                result = await createTable(params);
                break;
            case 'excel.add_chart':
                result = await addChart(params);
                break;
            case 'excel.apply_formula':
                result = await applyFormula(params);
                break;
            case 'excel.format_cells':
                result = await formatCells(params);
                break;
            case 'excel.merge_cells':
                result = await mergeCells(params);
                break;
            case 'excel.auto_filter':
                result = await autoFilter(params);
                break;
            case 'excel.freeze_panes':
                result = await freezePanes(params);
                break;
            case 'excel.sort_data':
                result = await sortData(params);
                break;
            case 'excel.find_replace':
                result = await findAndReplace(params);
                break;
            case 'excel.get_info':
                result = await getWorkbookInfo(params);
                break;
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }

        callback(null, {
            id: task.id,
            status: 'success',
            result_uri: `excel://${task.type}`,
            result_data: JSON.stringify(result)
        });
    } catch (error) {
        console.error(`[Excel Agent] Task failed:`, error);
        callback(null, {
            id: task.id,
            status: 'fail',
            error_message: error.message
        });
    }
}

function healthCheck(call, callback) {
    callback(null, {
        status: 'ok',
        capabilities: [
            'excel.create_workbook',
            'excel.read_range',
            'excel.write_range',
            'excel.add_sheet',
            'excel.create_table',
            'excel.add_chart',
            'excel.apply_formula',
            'excel.format_cells',
            'excel.merge_cells',
            'excel.auto_filter',
            'excel.freeze_panes',
            'excel.sort_data',
            'excel.find_replace',
            'excel.get_info'
        ]
    });
}

function main() {
    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50067'; // Port 50067 for Excel Agent
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[Excel Agent] Server running at ${address}`);
        console.log(`[Excel Agent] Ready to handle Excel automation tasks`);
        server.start();
    });
}

main();
