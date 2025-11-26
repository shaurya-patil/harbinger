const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const fs = require('fs').promises;

// Import RAG components
const EmbeddingService = require('./embeddings');
const VectorStore = require('./vector-store');
const QueryEngine = require('./query-engine');
const TextChunker = require('./chunker');

// Import file processors
const PDFProcessor = require('./processors/pdf-processor');
const DOCXProcessor = require('./processors/docx-processor');
const ExcelProcessor = require('./processors/excel-processor');
const CSVProcessor = require('./processors/csv-processor');
const JSONProcessor = require('./processors/json-processor');
const TextProcessor = require('./processors/text-processor');

// Load proto
const PROTO_PATH = path.join(__dirname, '../../libs/proto/task.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const taskProto = grpc.loadPackageDefinition(packageDefinition).jarvis;

// Initialize RAG components
const embeddingService = new EmbeddingService();
const vectorStore = new VectorStore(embeddingService);
const queryEngine = new QueryEngine(vectorStore, process.env.GROQ_API_KEY);
const chunker = new TextChunker();

// Initialize file processors
const processors = {
    '.pdf': new PDFProcessor(),
    '.docx': new DOCXProcessor(),
    '.doc': new DOCXProcessor(),
    '.xlsx': new ExcelProcessor(),
    '.xls': new ExcelProcessor(),
    '.csv': new CSVProcessor(),
    '.json': new JSONProcessor(),
    '.txt': new TextProcessor(),
    '.md': new TextProcessor(),
    '.markdown': new TextProcessor()
};

console.log('[RAG Agent] Initializing...');

/**
 * Ingest a file into the RAG system
 */
async function ingestFile(filePath, metadata = {}) {
    console.log(`[RAG Agent] Ingesting file: ${filePath}`);

    // Check if file exists
    try {
        await fs.access(filePath);
    } catch (error) {
        throw new Error(`File not found: ${filePath}`);
    }

    // Determine file type
    const extension = path.extname(filePath).toLowerCase();
    const processor = processors[extension];

    if (!processor) {
        throw new Error(`Unsupported file format: ${extension}`);
    }

    // Extract text and initial chunks
    const extracted = await processor.extract(filePath);

    // Re-chunk the text for optimal retrieval
    const allChunks = [];
    for (const chunk of extracted.chunks) {
        const subChunks = chunker.chunk(chunk.content, {
            ...chunk.metadata,
            ...metadata,
            fileName: path.basename(filePath),
            filePath
        });
        allChunks.push(...subChunks);
    }

    // Generate document ID
    const documentId = `doc_${Date.now()}_${path.basename(filePath)}`;

    // Add to vector store
    const result = await vectorStore.addDocument(documentId, allChunks, {
        fileName: path.basename(filePath),
        filePath,
        fileType: extension,
        ...extracted.metadata,
        ...metadata,
        ingestedAt: new Date().toISOString()
    });

    console.log(`[RAG Agent] Successfully ingested: ${documentId}`);

    return {
        success: true,
        documentId,
        fileName: path.basename(filePath),
        chunksCreated: result.chunksAdded,
        fileType: extension
    };
}

/**
 * Ingest all files in a directory
 */
async function ingestDirectory(directoryPath, metadata = {}) {
    console.log(`[RAG Agent] Ingesting directory: ${directoryPath}`);

    const files = await fs.readdir(directoryPath);
    const results = [];

    for (const file of files) {
        const filePath = path.join(directoryPath, file);
        const stats = await fs.stat(filePath);

        if (stats.isFile()) {
            const extension = path.extname(file).toLowerCase();
            if (processors[extension]) {
                try {
                    const result = await ingestFile(filePath, metadata);
                    results.push(result);
                } catch (error) {
                    console.error(`[RAG Agent] Failed to ingest ${file}:`, error.message);
                    results.push({
                        success: false,
                        fileName: file,
                        error: error.message
                    });
                }
            }
        }
    }

    return {
        success: true,
        filesProcessed: results.length,
        results
    };
}

/**
 * Execute RAG agent task
 */
async function executeTask(call, callback) {
    const task = call.request;
    const params = task.payload ? JSON.parse(task.payload.toString()) : {};

    console.log(`[RAG Agent] Received task: ${task.id} - ${task.type}`);
    console.log(`[RAG Agent] Params:`, params);

    try {
        let result;

        switch (task.type) {
            case 'rag.ingest_file':
                result = await ingestFile(params.file_path, params.metadata || {});
                break;

            case 'rag.ingest_directory':
                result = await ingestDirectory(params.directory_path, params.metadata || {});
                break;

            case 'rag.query':
                result = await queryEngine.query(
                    params.query,
                    params.top_k || 5,
                    params.filters || {}
                );
                break;

            case 'rag.summarize':
                const summary = await queryEngine.summarize(
                    params.document_id,
                    params.max_length || 500
                );
                result = { summary };
                break;

            case 'rag.extract':
                const extracted = await queryEngine.extract(
                    params.query,
                    params.document_id || null
                );
                result = { extracted };
                break;

            case 'rag.compare':
                const comparison = await queryEngine.compare(
                    params.document_ids,
                    params.aspect || 'key findings'
                );
                result = { comparison };
                break;

            case 'rag.search':
                const searchResults = await vectorStore.search(
                    params.query,
                    params.top_k || 10,
                    params.filters || {}
                );
                result = { results: searchResults };
                break;

            case 'rag.list_documents':
                const documents = vectorStore.listDocuments();
                result = { documents };
                break;

            case 'rag.delete_document':
                result = vectorStore.deleteDocument(params.document_id);
                break;

            case 'rag.get_stats':
                result = vectorStore.getStats();
                break;

            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }

        callback(null, {
            id: task.id,
            status: 'success',
            result_uri: `rag://${task.type}`,
            result_data: JSON.stringify(result)
        });
    } catch (error) {
        console.error(`[RAG Agent] Task failed:`, error);
        callback(null, {
            id: task.id,
            status: 'fail',
            error_message: error.message
        });
    }
}

/**
 * Health check
 */
function healthCheck(call, callback) {
    const stats = vectorStore.getStats();

    callback(null, {
        status: 'ok',
        capabilities: [
            'rag.ingest_file',
            'rag.ingest_directory',
            'rag.query',
            'rag.summarize',
            'rag.extract',
            'rag.compare',
            'rag.search',
            'rag.list_documents',
            'rag.delete_document',
            'rag.get_stats'
        ],
        metadata: JSON.stringify({
            supportedFormats: Object.keys(processors),
            ...stats,
            embeddingModel: embeddingService.modelName
        })
    });
}

/**
 * Start server
 */
async function main() {
    // Initialize embedding model
    console.log('[RAG Agent] Loading embedding model...');
    await embeddingService.initialize();
    console.log('[RAG Agent] Embedding model ready');

    const server = new grpc.Server();
    server.addService(taskProto.Agent.service, {
        ExecuteTask: executeTask,
        HealthCheck: healthCheck
    });

    const address = '0.0.0.0:50068';
    server.bindAsync(address, grpc.ServerCredentials.createInsecure(), () => {
        console.log(`[RAG Agent] Server running at ${address}`);
        console.log(`[RAG Agent] Supported formats:`, Object.keys(processors));
        console.log(`[RAG Agent] Ready to process documents`);
        server.start();
    });
}

main().catch(error => {
    console.error('[RAG Agent] Failed to start:', error);
    process.exit(1);
});
