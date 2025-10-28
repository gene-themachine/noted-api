/**
 * Native Pinecone Service
 *
 * Low-level Pinecone operations for the RAG system.
 *
 * Core Operations:
 * - **Upsert**: Store vector embeddings in Pinecone (batched for performance)
 * - **Query**: Search for similar vectors (for RAG Q&A)
 * - **Delete**: Remove vectors when documents are deleted
 * - **Update Metadata**: Change document metadata without re-embedding
 *
 * Used by: NativeVectorService (high-level vectorization orchestrator)
 *
 * Architecture:
 * - NativeVectorService → NativePineconeService → Pinecone Cloud
 * - This service is a thin wrapper around Pinecone SDK
 * - Handles batching, error handling, and logging
 *
 * Debug Methods:
 * Several methods are marked as "DEBUG UTILITY" - these are kept for troubleshooting
 * but aren't used in normal operation. See individual method docs.
 */

import { Pinecone } from '@pinecone-database/pinecone'
import env from '#start/env'
import { getEmbedding } from '../utils/openai.js'
import type { NativeSearchResult, VectorRecord } from '#types/vector.types'

export default class NativePineconeService {
  private client: Pinecone
  private indexName: string
  private index: any

  constructor() {
    this.validateEnvironment()

    this.client = new Pinecone({
      apiKey: env.get('PINECONE_API_KEY'),
    })

    this.indexName = env.get('PINECONE_INDEX')
    this.index = this.client.index(this.indexName)
  }

  // ========== Core Vector Operations ==========

  /**
   * Validate required environment variables on startup
   */
  private validateEnvironment(): void {
    const required = ['PINECONE_API_KEY', 'PINECONE_INDEX', 'OPENAI_API_KEY']
    const missing = required.filter((key) => !env.get(key))

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }

    console.log('✅ Pinecone environment variables validated')
  }

  /**
   * Upsert vectors to Pinecone (batched for performance)
   *
   * @param vectors - Array of vectors with embeddings and metadata
   * Batch size: 100 vectors per request (Pinecone recommended)
   */
  async upsert(vectors: VectorRecord[]): Promise<void> {
    try {
      // Batch upsert for better performance
      const batchSize = 100
      for (let i = 0; i < vectors.length; i += batchSize) {
        const batch = vectors.slice(i, i + batchSize)

        const records = batch.map((v) => ({
          id: v.id,
          values: v.values,
          metadata: v.metadata,
        }))

        await this.index.upsert(records)
        console.log(`✅ Upserted batch ${Math.floor(i / batchSize) + 1} (${batch.length} vectors)`)
      }

      console.log(`✅ Total upserted ${vectors.length} vectors to Pinecone`)
    } catch (error) {
      console.error('❌ Failed to upsert vectors:', error)
      throw new Error(`Pinecone upsert failed: ${error.message}`)
    }
  }

  /**
   * Query similar vectors
   */
  async query(
    queryText: string,
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<NativeSearchResult[]> {
    try {
      // Generate embedding for query text
      const queryVector = await getEmbedding(queryText)

      // Build query parameters
      const queryParams: any = {
        vector: queryVector,
        topK,
        includeMetadata: true,
        includeValues: false,
      }

      // Add filter if provided
      if (filter && Object.keys(filter).length > 0) {
        queryParams.filter = filter
      }

      // Execute query
      const response = await this.index.query(queryParams)

      // Transform results
      const results: NativeSearchResult[] = response.matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
        content: match.metadata?.text || match.metadata?.content || '',
      }))

      console.log(
        `✅ Found ${results.length} similar vectors (filter: ${JSON.stringify(filter || {})})`
      )
      return results
    } catch (error) {
      console.error('❌ Failed to query vectors:', error)
      throw new Error(`Pinecone query failed: ${error.message}`)
    }
  }

  /**
   * Query with raw vector (when embedding is already computed)
   *
   * DEBUG UTILITY: This method is kept for debugging/troubleshooting purposes.
   * Production code should use the query() method instead.
   */
  async queryByVector(
    vector: number[],
    topK: number = 5,
    filter?: Record<string, any>
  ): Promise<NativeSearchResult[]> {
    try {
      const queryParams: any = {
        vector,
        topK,
        includeMetadata: true,
        includeValues: false,
      }

      if (filter && Object.keys(filter).length > 0) {
        queryParams.filter = filter
      }

      const response = await this.index.query(queryParams)

      const results: NativeSearchResult[] = response.matches.map((match: any) => ({
        id: match.id,
        score: match.score,
        metadata: match.metadata || {},
        content: match.metadata?.text || match.metadata?.content || '',
      }))

      return results
    } catch (error) {
      console.error('❌ Failed to query by vector:', error)
      throw new Error(`Pinecone query failed: ${error.message}`)
    }
  }

  /**
   * Delete vectors by IDs
   */
  async deleteByIds(ids: string[]): Promise<void> {
    if (ids.length === 0) return

    try {
      await this.index.deleteMany(ids)
      console.log(`✅ Deleted ${ids.length} vectors from Pinecone`)
    } catch (error) {
      console.error('❌ Failed to delete vectors:', error)
      throw new Error(`Pinecone delete failed: ${error.message}`)
    }
  }

  /**
   * Delete vectors by filter
   */
  async deleteByFilter(filter: Record<string, any>): Promise<void> {
    try {
      // First query to get IDs matching the filter
      const results = await this.queryByVector(
        new Array(1536).fill(0), // Dummy vector for metadata-only query
        10000, // Max results
        filter
      )

      if (results.length > 0) {
        const ids = results.map((r) => r.id)
        await this.deleteByIds(ids)
        console.log(`✅ Deleted ${ids.length} vectors matching filter: ${JSON.stringify(filter)}`)
      } else {
        console.log(`ℹ️ No vectors found matching filter: ${JSON.stringify(filter)}`)
      }
    } catch (error) {
      console.error('⚠️ Filter-based deletion failed, skipping:', error.message)
      // Don't throw - this is a non-critical operation
    }
  }

  /**
   * Fetch vectors by IDs
   *
   * DEBUG UTILITY: Direct fetch method for troubleshooting.
   * Use with caution - typically wrapped by other methods.
   */
  async fetch(ids: string[]): Promise<Record<string, any>> {
    try {
      const response = await this.index.fetch(ids)
      return response.records || {}
    } catch (error) {
      console.error('❌ Failed to fetch vectors:', error)
      throw new Error(`Pinecone fetch failed: ${error.message}`)
    }
  }

  /**
   * Update metadata for specific vector IDs
   */
  async updateMetadataByIds(
    vectorIds: string[],
    metadataUpdates: Record<string, any>
  ): Promise<void> {
    try {
      if (vectorIds.length === 0) {
        console.log(`ℹ️ No vector IDs provided for metadata update`)
        return
      }

      console.log(`🔄 Updating metadata for ${vectorIds.length} vectors`)

      // Process in batches to avoid overwhelming Pinecone
      const batchSize = 100
      let totalUpdated = 0

      for (let i = 0; i < vectorIds.length; i += batchSize) {
        const batch = vectorIds.slice(i, i + batchSize)

        try {
          // Fetch existing vectors to get their values and current metadata
          const fetchResponse = await this.fetchWithLogging(batch)
          const records = fetchResponse.records || {}

          // Prepare updates with preserved values and updated metadata
          const upsertData = []
          for (const id of batch) {
            if (records[id] && records[id].values) {
              upsertData.push({
                id,
                values: records[id].values,
                metadata: {
                  ...records[id].metadata,
                  ...metadataUpdates,
                },
              })
            } else {
              console.warn(`⚠️ Vector ${id} not found or missing values, skipping`)
            }
          }

          // Upsert with preserved values and updated metadata
          if (upsertData.length > 0) {
            await this.index.upsert(upsertData)
            totalUpdated += upsertData.length
            console.log(
              `✅ Updated batch ${Math.floor(i / batchSize) + 1} (${upsertData.length} vectors)`
            )
          }
        } catch (error) {
          console.error(
            `⚠️ Failed to update batch ${Math.floor(i / batchSize) + 1}:`,
            error.message
          )
          // Continue with next batch
        }
      }

      console.log(`✅ Metadata updated for ${totalUpdated}/${vectorIds.length} vectors`)
    } catch (error) {
      console.error('❌ Failed to update metadata:', error)
      throw new Error(`Metadata update failed: ${error.message}`)
    }
  }

  /**
   * Debug method to check what vectors actually exist in Pinecone
   *
   * DEBUG UTILITY: Helps troubleshoot vectorization issues by listing vectors.
   * Useful for verifying if vectors were stored correctly.
   */
  async debugVectorIds(prefix?: string, limit: number = 10): Promise<string[]> {
    try {
      console.log(`🔍 Debugging vectors in Pinecone${prefix ? ` with prefix: ${prefix}` : ''}`)

      // Try to list some vectors to see what's actually there
      const listResult = await this.index.listPaginated({
        prefix: prefix || '',
        limit,
      })

      const vectorIds = listResult.vectors || []
      console.log(`🔍 Found ${vectorIds.length} vectors in Pinecone:`)
      vectorIds.slice(0, 5).forEach((id: string, i: number) => {
        console.log(`  ${i + 1}. ${id}`)
      })

      return vectorIds
    } catch (error) {
      console.error('❌ Failed to debug vector IDs:', error)
      return []
    }
  }

  /**
   * Enhanced fetch with detailed logging
   */
  async fetchWithLogging(vectorIds: string[]): Promise<any> {
    try {
      console.log(`🔍 Attempting to fetch ${vectorIds.length} vectors:`)
      vectorIds.slice(0, 3).forEach((id: string, i: number) => {
        console.log(`  ${i + 1}. ${id}`)
      })

      const response = await this.index.fetch(vectorIds)
      const foundCount = Object.keys(response.records || {}).length
      console.log(`🔍 Pinecone fetch result: ${foundCount}/${vectorIds.length} vectors found`)

      if (foundCount === 0 && vectorIds.length > 0) {
        console.log('🔍 No vectors found, checking what actually exists...')
        // Check with a broader prefix to see what's there
        const firstId = vectorIds[0]
        const parts = firstId.split('_')
        if (parts.length > 1) {
          const prefix = parts[0] + '_'
          await this.debugVectorIds(prefix, 5)
        }
      }

      return response
    } catch (error) {
      console.error('❌ Failed to fetch with logging:', error)
      throw error
    }
  }

  /**
   * Get index statistics
   *
   * DEBUG UTILITY: Returns Pinecone index statistics for monitoring.
   * Useful for checking total vector count and namespace information.
   */
  async describeIndexStats(): Promise<any> {
    try {
      const stats = await this.index.describeIndexStats()
      console.log('📊 Pinecone index stats:', stats)
      return stats
    } catch (error) {
      console.error('❌ Failed to get index stats:', error)
      throw new Error(`Pinecone stats failed: ${error.message}`)
    }
  }
}
