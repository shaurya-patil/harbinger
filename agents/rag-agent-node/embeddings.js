/**
 * Embedding Service - Generate embeddings using local transformers
 */

const { pipeline } = require('@xenova/transformers');

class EmbeddingService {
    constructor() {
        this.model = null;
        this.modelName = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';
        this.initialized = false;
    }

    /**
     * Initialize the embedding model
     */
    async initialize() {
        if (this.initialized) return;

        console.log(`[Embeddings] Loading model: ${this.modelName}...`);
        try {
            this.model = await pipeline('feature-extraction', this.modelName);
            this.initialized = true;
            console.log(`[Embeddings] Model loaded successfully`);
        } catch (error) {
            console.error(`[Embeddings] Failed to load model:`, error);
            throw error;
        }
    }

    /**
     * Generate embedding for a single text
     */
    async generateEmbedding(text) {
        if (!this.initialized) {
            await this.initialize();
        }

        try {
            const output = await this.model(text, {
                pooling: 'mean',
                normalize: true
            });

            // Convert to regular array
            return Array.from(output.data);
        } catch (error) {
            console.error(`[Embeddings] Error generating embedding:`, error);
            throw error;
        }
    }

    /**
     * Generate embeddings for multiple texts (batch)
     */
    async generateEmbeddings(texts) {
        if (!this.initialized) {
            await this.initialize();
        }

        const embeddings = [];

        // Process in batches to avoid memory issues
        const batchSize = 10;
        for (let i = 0; i < texts.length; i += batchSize) {
            const batch = texts.slice(i, i + batchSize);
            const batchEmbeddings = await Promise.all(
                batch.map(text => this.generateEmbedding(text))
            );
            embeddings.push(...batchEmbeddings);

            console.log(`[Embeddings] Processed ${Math.min(i + batchSize, texts.length)}/${texts.length} texts`);
        }

        return embeddings;
    }

    /**
     * Calculate cosine similarity between two embeddings
     */
    cosineSimilarity(embedding1, embedding2) {
        if (embedding1.length !== embedding2.length) {
            throw new Error('Embeddings must have the same dimension');
        }

        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;

        for (let i = 0; i < embedding1.length; i++) {
            dotProduct += embedding1[i] * embedding2[i];
            norm1 += embedding1[i] * embedding1[i];
            norm2 += embedding2[i] * embedding2[i];
        }

        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
    }
}

module.exports = EmbeddingService;
