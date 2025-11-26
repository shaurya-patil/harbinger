/**
 * In-Memory Vector Store - Store and search document chunks with embeddings
 */

class VectorStore {
    constructor(embeddingService) {
        this.embeddingService = embeddingService;
        this.documents = new Map(); // documentId -> document metadata
        this.chunks = []; // Array of {id, documentId, content, embedding, metadata}
        this.nextChunkId = 1;
    }

    /**
     * Add a document with its chunks
     */
    async addDocument(documentId, chunks, documentMetadata = {}) {
        console.log(`[VectorStore] Adding document: ${documentId} with ${chunks.length} chunks`);

        // Store document metadata
        this.documents.set(documentId, {
            id: documentId,
            ...documentMetadata,
            chunkCount: chunks.length,
            addedAt: new Date().toISOString()
        });

        // Generate embeddings for all chunks
        const texts = chunks.map(chunk => chunk.content);
        const embeddings = await this.embeddingService.generateEmbeddings(texts);

        // Store chunks with embeddings
        for (let i = 0; i < chunks.length; i++) {
            this.chunks.push({
                id: `chunk_${this.nextChunkId++}`,
                documentId,
                content: chunks[i].content,
                embedding: embeddings[i],
                metadata: {
                    ...chunks[i].metadata,
                    documentMetadata
                }
            });
        }

        console.log(`[VectorStore] Document added: ${documentId} (${this.chunks.length} total chunks)`);

        return {
            documentId,
            chunksAdded: chunks.length,
            totalChunks: this.chunks.length
        };
    }

    /**
     * Search for similar chunks using semantic similarity
     */
    async search(query, topK = 5, filters = {}) {
        console.log(`[VectorStore] Searching for: "${query}" (top ${topK})`);

        // Generate query embedding
        const queryEmbedding = await this.embeddingService.generateEmbedding(query);

        // Calculate similarity for all chunks
        let results = this.chunks.map(chunk => ({
            ...chunk,
            score: this.embeddingService.cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Apply filters
        if (Object.keys(filters).length > 0) {
            results = results.filter(chunk => {
                return Object.entries(filters).every(([key, value]) => {
                    return chunk.metadata?.documentMetadata?.[key] === value ||
                        chunk.metadata?.[key] === value;
                });
            });
        }

        // Sort by similarity score (descending)
        results.sort((a, b) => b.score - a.score);

        // Return top K results
        const topResults = results.slice(0, topK);

        console.log(`[VectorStore] Found ${topResults.length} results (scores: ${topResults.map(r => r.score.toFixed(3)).join(', ')})`);

        return topResults.map(result => ({
            documentId: result.documentId,
            content: result.content,
            score: result.score,
            metadata: result.metadata
        }));
    }

    /**
     * Get all chunks for a specific document
     */
    getDocumentChunks(documentId) {
        return this.chunks
            .filter(chunk => chunk.documentId === documentId)
            .map(chunk => ({
                content: chunk.content,
                metadata: chunk.metadata
            }));
    }

    /**
     * Delete a document and its chunks
     */
    deleteDocument(documentId) {
        // Remove document metadata
        const doc = this.documents.get(documentId);
        if (!doc) {
            return { success: false, error: 'Document not found' };
        }

        this.documents.delete(documentId);

        // Remove all chunks for this document
        const initialCount = this.chunks.length;
        this.chunks = this.chunks.filter(chunk => chunk.documentId !== documentId);
        const removedCount = initialCount - this.chunks.length;

        console.log(`[VectorStore] Deleted document: ${documentId} (removed ${removedCount} chunks)`);

        return {
            success: true,
            documentId,
            chunksRemoved: removedCount
        };
    }

    /**
     * List all documents
     */
    listDocuments() {
        return Array.from(this.documents.values());
    }

    /**
     * Get document by ID
     */
    getDocument(documentId) {
        return this.documents.get(documentId);
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            totalDocuments: this.documents.size,
            totalChunks: this.chunks.length,
            averageChunksPerDocument: this.documents.size > 0
                ? (this.chunks.length / this.documents.size).toFixed(2)
                : 0
        };
    }

    /**
     * Clear all data
     */
    clear() {
        this.documents.clear();
        this.chunks = [];
        this.nextChunkId = 1;
        console.log(`[VectorStore] Cleared all data`);
    }
}

module.exports = VectorStore;
