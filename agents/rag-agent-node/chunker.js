/**
 * Text Chunker - Intelligently split text into chunks for RAG
 */

class TextChunker {
    constructor(options = {}) {
        this.chunkSize = options.chunkSize || parseInt(process.env.RAG_CHUNK_SIZE) || 1000;
        this.chunkOverlap = options.chunkOverlap || parseInt(process.env.RAG_CHUNK_OVERLAP) || 200;
        this.strategy = options.strategy || 'sentence'; // 'fixed', 'sentence', 'paragraph'
    }

    /**
     * Chunk text using configured strategy
     */
    chunk(text, metadata = {}) {
        switch (this.strategy) {
            case 'fixed':
                return this.fixedSizeChunking(text, metadata);
            case 'sentence':
                return this.sentenceBasedChunking(text, metadata);
            case 'paragraph':
                return this.paragraphBasedChunking(text, metadata);
            default:
                return this.sentenceBasedChunking(text, metadata);
        }
    }

    /**
     * Fixed-size chunking with overlap
     */
    fixedSizeChunking(text, metadata) {
        const chunks = [];
        let start = 0;

        while (start < text.length) {
            const end = Math.min(start + this.chunkSize, text.length);
            const chunk = text.slice(start, end);

            chunks.push({
                content: chunk.trim(),
                metadata: {
                    ...metadata,
                    start_char: start,
                    end_char: end,
                    chunk_index: chunks.length
                }
            });

            start += this.chunkSize - this.chunkOverlap;
        }

        return chunks;
    }

    /**
     * Sentence-based chunking with overlap
     */
    sentenceBasedChunking(text, metadata) {
        // Split into sentences
        const sentences = this.splitIntoSentences(text);
        const chunks = [];
        let currentChunk = '';
        let currentSentences = [];

        for (const sentence of sentences) {
            const potentialChunk = currentChunk + (currentChunk ? ' ' : '') + sentence;

            if (potentialChunk.length > this.chunkSize && currentChunk.length > 0) {
                // Save current chunk
                chunks.push({
                    content: currentChunk.trim(),
                    metadata: {
                        ...metadata,
                        sentence_count: currentSentences.length,
                        chunk_index: chunks.length
                    }
                });

                // Start new chunk with overlap
                const overlapSentences = currentSentences.slice(-2); // Keep last 2 sentences
                currentChunk = overlapSentences.join(' ');
                currentSentences = [...overlapSentences];
            }

            currentChunk = potentialChunk;
            currentSentences.push(sentence);
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    sentence_count: currentSentences.length,
                    chunk_index: chunks.length
                }
            });
        }

        return chunks;
    }

    /**
     * Paragraph-based chunking
     */
    paragraphBasedChunking(text, metadata) {
        const paragraphs = text.split(/\n\s*\n/);
        const chunks = [];
        let currentChunk = '';

        for (const paragraph of paragraphs) {
            const trimmedPara = paragraph.trim();
            if (!trimmedPara) continue;

            const potentialChunk = currentChunk + (currentChunk ? '\n\n' : '') + trimmedPara;

            if (potentialChunk.length > this.chunkSize && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.trim(),
                    metadata: {
                        ...metadata,
                        chunk_index: chunks.length
                    }
                });
                currentChunk = trimmedPara;
            } else {
                currentChunk = potentialChunk;
            }
        }

        // Add final chunk
        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunk_index: chunks.length
                }
            });
        }

        return chunks;
    }

    /**
     * Split text into sentences
     */
    splitIntoSentences(text) {
        // Simple sentence splitter (can be improved with NLP library)
        return text
            .replace(/([.!?])\s+/g, '$1|')
            .split('|')
            .map(s => s.trim())
            .filter(s => s.length > 0);
    }

    /**
     * Chunk with custom separators (for code, structured data)
     */
    chunkWithSeparators(text, separators, metadata = {}) {
        const parts = text.split(new RegExp(separators.join('|')));
        const chunks = [];
        let currentChunk = '';

        for (const part of parts) {
            const trimmedPart = part.trim();
            if (!trimmedPart) continue;

            const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + trimmedPart;

            if (potentialChunk.length > this.chunkSize && currentChunk.length > 0) {
                chunks.push({
                    content: currentChunk.trim(),
                    metadata: {
                        ...metadata,
                        chunk_index: chunks.length
                    }
                });
                currentChunk = trimmedPart;
            } else {
                currentChunk = potentialChunk;
            }
        }

        if (currentChunk.trim()) {
            chunks.push({
                content: currentChunk.trim(),
                metadata: {
                    ...metadata,
                    chunk_index: chunks.length
                }
            });
        }

        return chunks;
    }
}

module.exports = TextChunker;
