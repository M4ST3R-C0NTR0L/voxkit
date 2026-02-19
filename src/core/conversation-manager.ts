/**
 * Conversation Manager for VoxKit
 * Handles conversation state, history, and context management
 */

import EventEmitter from 'events'
import type { ConversationState, ConversationMessage, TranscriptSegment } from '../types.js'
import { logger } from '../logger.js'

export interface ConversationManagerConfig {
  maxMessages?: number
  maxConversationDuration?: number // in seconds
  silenceTimeoutMs?: number
  enableMetadata?: boolean
}

export class ConversationManager extends EventEmitter {
  private state: ConversationState
  private config: Required<ConversationManagerConfig>
  private logger = logger.child('conversation')
  private silenceTimer: NodeJS.Timeout | null = null

  constructor(config: ConversationManagerConfig = {}) {
    super()
    this.config = {
      maxMessages: config.maxMessages ?? 100,
      maxConversationDuration: config.maxConversationDuration ?? 3600, // 1 hour
      silenceTimeoutMs: config.silenceTimeoutMs ?? 30000, // 30 seconds
      enableMetadata: config.enableMetadata ?? true
    }

    this.state = this.createNewConversation()
  }

  /**
   * Create a new conversation state
   */
  private createNewConversation(): ConversationState {
    const now = Date.now()
    return {
      id: this.generateConversationId(),
      messages: [],
      isActive: true,
      startedAt: now,
      lastActivityAt: now,
      metadata: {}
    }
  }

  /**
   * Start a new conversation
   */
  start(): ConversationState {
    this.state = this.createNewConversation()
    this.logger.info(`Started new conversation: ${this.state.id}`)
    this.emit('started', this.state)
    this.resetSilenceTimer()
    return this.state
  }

  /**
   * End the current conversation
   */
  end(): ConversationState {
    this.state.isActive = false
    this.clearSilenceTimer()
    this.logger.info(`Ended conversation: ${this.state.id}`)
    this.emit('ended', this.state)
    return this.state
  }

  /**
   * Add a message to the conversation
   */
  addMessage(role: ConversationMessage['role'], content: string, metadata?: Record<string, unknown>): void {
    if (!this.state.isActive) {
      this.logger.warn('Attempted to add message to inactive conversation')
      return
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: Date.now(),
      metadata: this.config.enableMetadata ? metadata : undefined
    }

    this.state.messages.push(message)
    this.state.lastActivityAt = Date.now()

    // Trim messages if exceeding max
    if (this.state.messages.length > this.config.maxMessages) {
      this.state.messages = this.state.messages.slice(-this.config.maxMessages)
    }

    this.emit('message', message)
    this.resetSilenceTimer()

    this.logger.debug(`Added ${role} message: ${content.substring(0, 50)}...`)
  }

  /**
   * Add a transcript segment to the conversation
   */
  addTranscript(segment: TranscriptSegment): void {
    if (!this.state.isActive) {
      return
    }

    if (segment.isFinal) {
      this.addMessage('user', segment.text, {
        transcriptId: segment.id,
        confidence: segment.confidence,
        speaker: segment.speaker
      })
    }

    this.emit('transcript', segment)
  }

  /**
   * Get current conversation state
   */
  getState(): ConversationState {
    return { ...this.state }
  }

  /**
   * Get conversation messages
   */
  getMessages(): ConversationMessage[] {
    return [...this.state.messages]
  }

  /**
   * Get messages formatted for LLM context
   */
  getContextMessages(systemPrompt?: string): Array<{ role: string; content: string }> {
    const messages: Array<{ role: string; content: string }> = []

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push(...this.state.messages.map(m => ({
      role: m.role,
      content: m.content
    })))

    return messages
  }

  /**
   * Get the last N messages
   */
  getLastMessages(count: number): ConversationMessage[] {
    return this.state.messages.slice(-count)
  }

  /**
   * Clear conversation history
   */
  clear(): void {
    this.state.messages = []
    this.state.metadata = {}
    this.logger.info('Conversation history cleared')
    this.emit('cleared')
  }

  /**
   * Check if conversation is still valid (within time limits)
   */
  isValid(): boolean {
    if (!this.state.isActive) return false

    const duration = (Date.now() - this.state.startedAt) / 1000
    if (duration > this.config.maxConversationDuration) {
      return false
    }

    return true
  }

  /**
   * Update conversation metadata
   */
  updateMetadata(metadata: Record<string, unknown>): void {
    if (this.config.enableMetadata) {
      this.state.metadata = { ...this.state.metadata, ...metadata }
    }
  }

  /**
   * Export conversation as JSON
   */
  export(): string {
    return JSON.stringify(this.state, null, 2)
  }

  private resetSilenceTimer(): void {
    this.clearSilenceTimer()
    
    if (this.config.silenceTimeoutMs > 0) {
      this.silenceTimer = setTimeout(() => {
        this.logger.warn('Conversation silence timeout reached')
        this.emit('silenceTimeout', this.state)
      }, this.config.silenceTimeoutMs)
    }
  }

  private clearSilenceTimer(): void {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }
  }

  private generateConversationId(): string {
    return `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
