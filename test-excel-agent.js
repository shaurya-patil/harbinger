const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const PROTO_PATH = path.join(__dirname, 'libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

const excelClient = new taskProto.Agent('localhost:50067', grpc.credentials.createInsecure());

async function testExcelAgent() {
    console.log('=== Testing Excel Agent ===\n');

    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    await new Promise((resolve, reject) => {
        excelClient.HealthCheck({}, (err, response) => {
            if (err) {
                console.error('❌ Health check failed:', err.message);
                reject(err);
            } else {
                console.log('✓ Health check passed');
                console.log('  Capabilities:', response.capabilities.join(', '));
                resolve();
            }
        });
    });

    // Test 2: Create Workbook
    console.log('\n2. Testing Create Workbook...');
    await new Promise((resolve, reject) => {
        excelClient.ExecuteTask({
            id: 'test-1',
            type: 'excel.create_workbook',
            payload: Buffer.from(JSON.stringify({
                name: 'test_workbook',
                path: 'test_workbook.xlsx',
                sheet_name: 'Sales Data'
            }))
        }, (err, response) => {
            if (err) {
                console.error('❌ Create workbook failed:', err.message);
                reject(err);
            } else if (response.status === 'success') {
                console.log('✓ Workbook created successfully');
                const result = JSON.parse(response.result_data);
                console.log('  File path:', result.file_path);
                resolve();
            } else {
                console.error('❌ Create workbook failed:', response.error_message);
                reject(new Error(response.error_message));
            }
        });
    });

    // Test 3: Write Data
    console.log('\n3. Testing Write Range...');
    await new Promise((resolve, reject) => {
        excelClient.ExecuteTask({
            id: 'test-2',
            type: 'excel.write_range',
            payload: Buffer.from(JSON.stringify({
                file_path: 'test_workbook.xlsx',
                sheet: 'Sales Data',
                range: 'A1',
                values: [
                    ['Product', 'Q1', 'Q2', 'Q3', 'Q4'],
                    ['Laptop', 1200, 1350, 1500, 1600],
                    ['Phone', 800, 900, 950, 1000],
                    ['Tablet', 400, 450, 500, 550]
                ]
            }))
        }, (err, response) => {
            if (err) {
                console.error('❌ Write range failed:', err.message);
                reject(err);
            } else if (response.status === 'success') {
                console.log('✓ Data written successfully');
                const result = JSON.parse(response.result_data);
                console.log('  Rows written:', result.rows_written);
                resolve();
            } else {
                console.error('❌ Write range failed:', response.error_message);
                reject(new Error(response.error_message));
            }
        });
    });

    // Test 4: Apply Formula
    console.log('\n4. Testing Apply Formula...');
    await new Promise((resolve, reject) => {
        excelClient.ExecuteTask({
            id: 'test-3',
            type: 'excel.apply_formula',
            payload: Buffer.from(JSON.stringify({
                file_path: 'test_workbook.xlsx',
                sheet: 'Sales Data',
                cell: 'F1',
                formula: '=SUM(B2:E2)'
            }))
        }, (err, response) => {
            if (err) {
                console.error('❌ Apply formula failed:', err.message);
                reject(err);
            } else if (response.status === 'success') {
                console.log('✓ Formula applied successfully');
                resolve();
            } else {
                console.error('❌ Apply formula failed:', response.error_message);
                reject(new Error(response.error_message));
            }
        });
    });

    // Test 5: Format Cells
    console.log('\n5. Testing Format Cells...');
    await new Promise((resolve, reject) => {
        excelClient.ExecuteTask({
            id: 'test-4',
            type: 'excel.format_cells',
            payload: Buffer.from(JSON.stringify({
                file_path: 'test_workbook.xlsx',
                sheet: 'Sales Data',
                range: 'A1:E1',
                format: {
                    font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
                    fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0070C0' } },
                    alignment: { horizontal: 'center', vertical: 'middle' }
                }
            }))
        }, (err, response) => {
            if (err) {
                console.error('❌ Format cells failed:', err.message);
                reject(err);
            } else if (response.status === 'success') {
                console.log('✓ Cells formatted successfully');
                resolve();
            } else {
                console.error('❌ Format cells failed:', response.error_message);
                reject(new Error(response.error_message));
            }
        });
    });

    // Test 6: Auto Filter
    console.log('\n6. Testing Auto Filter...');
    await new Promise((resolve, reject) => {
        excelClient.ExecuteTask({
            id: 'test-5',
            type: 'excel.auto_filter',
            payload: Buffer.from(JSON.stringify({
                file_path: 'test_workbook.xlsx',
                sheet: 'Sales Data',
                range: 'A1:E4'
            }))
        }, (err, response) => {
            if (err) {
                console.error('❌ Auto filter failed:', err.message);
                reject(err);
            } else if (response.status === 'success') {
                console.log('✓ Auto filter applied successfully');
                resolve();
            } else {
                console.error('❌ Auto filter failed:', response.error_message);
                reject(new Error(response.error_message));
            }
        });
    });

    // Test 7: Get Workbook Info
    console.log('\n7. Testing Get Workbook Info...');
    await new Promise((resolve, reject) => {
        excelClient.ExecuteTask({
            id: 'test-6',
            type: 'excel.get_info',
            payload: Buffer.from(JSON.stringify({
                file_path: 'test_workbook.xlsx'
            }))
        }, (err, response) => {
            if (err) {
                console.error('❌ Get info failed:', err.message);
                reject(err);
            } else if (response.status === 'success') {
                console.log('✓ Workbook info retrieved successfully');
                const result = JSON.parse(response.result_data);
                console.log('  Sheet count:', result.sheet_count);
                console.log('  Sheets:', result.sheets.map(s => s.name).join(', '));
                resolve();
            } else {
                console.error('❌ Get info failed:', response.error_message);
                reject(new Error(response.error_message));
            }
        });
    });

    console.log('\n=== All Excel Agent Tests Passed! ===');
    console.log('\nCheck the generated file: C:\\Users\\shaur\\OneDrive\\Desktop\\DL_Projects\\Agentic AI\\test_workbook.xlsx');
}

// Run tests
testExcelAgent().catch(err => {
    console.error('\n❌ Test suite failed:', err);
    process.exit(1);
});
