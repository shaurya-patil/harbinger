/**
 * Query Engine - Handle RAG queries with Groq LLM
 */

const Groq = require('groq-sdk');

class QueryEngine {
    constructor(vectorStore, groqApiKey) {
        this.vectorStore = vectorStore;
        this.groq = new Groq({ apiKey: groqApiKey });
        this.maxContextLength = parseInt(process.env.RAG_MAX_CONTEXT_LENGTH) || 4000;
    }

    /**
     * Answer a query using RAG
     */
    async query(question, topK = 5, filters = {}) {
        // 1. Retrieve relevant chunks
        const results = await this.vectorStore.search(question, topK, filters);

        if (results.length === 0) {
            return {
                answer: "I don't have any information to answer this question. Please ingest relevant documents first.",
                sources: [],
                confidence: 0
            };
        }

        // 2. Build context from retrieved chunks
        const context = this.buildContext(results);

        // 3. Generate answer using Groq
        const answer = await this.generateAnswer(question, context);

        // 4. Return answer with sources
        return {
            answer,
            sources: results.map(r => ({
                document: r.documentId,
                content: r.content.substring(0, 200) + '...',
                score: r.score,
                metadata: r.metadata
            })),
            confidence: results[0]?.score || 0
        };
    }

    /**
     * Build context from retrieved chunks
     */
    buildContext(results) {
        let context = '';
        let currentLength = 0;

        for (const result of results) {
            const chunk = `[Document: ${result.documentId}]\n${result.content}\n\n`;

            if (currentLength + chunk.length > this.maxContextLength) {
                break;
            }

            context += chunk;
            currentLength += chunk.length;
        }

        return context.trim();
    }

    /**
     * Generate answer using Groq LLM
     */
    async generateAnswer(question, context) {
        const prompt = `You are a helpful assistant answering questions based on the provided context.

Context:
${context}

Question: ${question}

Instructions:
- Answer the question based ONLY on the information in the context above
- If the answer is not in the context, say "I don't have enough information to answer this question"
- Be concise and accurate
- Cite specific parts of the context when relevant

Answer:`;

        try {
            const completion = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 1000
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('[QueryEngine] Error generating answer:', error);
            throw error;
        }
    }

    /**
     * Summarize a document
     */
    async summarize(documentId, maxLength = 500) {
        const chunks = this.vectorStore.getDocumentChunks(documentId);

        if (chunks.length === 0) {
            throw new Error(`Document not found: ${documentId}`);
        }

        // Combine all chunks
        const fullText = chunks.map(c => c.content).join('\n\n');

        const prompt = `Summarize the following document in ${maxLength} words or less:

${fullText.substring(0, 10000)} 

Provide a clear, concise summary that captures the main points.`;

        try {
            const completion = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: Math.ceil(maxLength * 1.5)
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('[QueryEngine] Error generating summary:', error);
            throw error;
        }
    }

    /**
     * Extract specific information from documents
     */
    async extract(query, documentId = null) {
        let results;

        if (documentId) {
            // Search within specific document
            const chunks = this.vectorStore.getDocumentChunks(documentId);
            const fullText = chunks.map(c => c.content).join('\n\n');

            const prompt = `Extract the following information from the document:

${query}

Document:
${fullText.substring(0, 10000)}

Provide the extracted information in a structured format.`;

            const completion = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.1,
                max_tokens: 1000
            });

            return completion.choices[0].message.content.trim();
        } else {
            // Search across all documents
            results = await this.vectorStore.search(query, 10);
            const context = this.buildContext(results);

            const prompt = `Extract the following information:

${query}

From this context:
${context}

Provide the extracted information in a structured format.`;

            const completion = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.1,
                max_tokens: 1000
            });

            return completion.choices[0].message.content.trim();
        }
    }

    /**
     * Compare multiple documents
     */
    async compare(documentIds, aspect = 'key findings') {
        const documentsText = [];

        for (const docId of documentIds) {
            const chunks = this.vectorStore.getDocumentChunks(docId);
            const text = chunks.map(c => c.content).join('\n\n');
            documentsText.push(`Document ${docId}:\n${text.substring(0, 5000)}`);
        }

        const prompt = `Compare the following documents focusing on: ${aspect}

${documentsText.join('\n\n---\n\n')}

Provide a comparison highlighting:
1. Similarities
2. Differences
3. Key insights from each document`;

        try {
            const completion = await this.groq.chat.completions.create({
                messages: [{ role: 'user', content: prompt }],
                model: 'llama-3.3-70b-versatile',
                temperature: 0.3,
                max_tokens: 1500
            });

            return completion.choices[0].message.content.trim();
        } catch (error) {
            console.error('[QueryEngine] Error comparing documents:', error);
            throw error;
        }
    }
}

module.exports = QueryEngine;
