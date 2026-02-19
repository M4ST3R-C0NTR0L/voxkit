/**
 * TranscriptLoggerPlugin
 *
 * Logs every conversation turn to stdout and optionally
 * appends a JSON-L transcript file for later review.
 */

import { appendFileSync } from 'fs'
import type { VoxKitPlugin, VoxAgent, ConversationMessage, TranscriptSegment } from '../types.js'

export interface TranscriptLoggerConfig {
  /** Write transcripts to a file (JSON-L format). Omit to log to console only. */
  filePath?: string
  /** Show timestamps in console output (default: true) */
  timestamps?: boolean
  /** Prefix every line with a tag (default: '[transcript]') */
  tag?: string
}

export class TranscriptLoggerPlugin implements VoxKitPlugin {
  name = 'transcript-logger'

  private config: Required<TranscriptLoggerConfig>
  private agent!: VoxAgent

  constructor(config: TranscriptLoggerConfig = {}) {
    this.config = {
      filePath: config.filePath ?? '',
      timestamps: config.timestamps ?? true,
      tag: config.tag ?? '[transcript]'
    }
  }

  initialize(agent: VoxAgent): void {
    this.agent = agent
  }

  onMessage(message: ConversationMessage): void {
    const ts = this.config.timestamps ? `[${new Date().toISOString()}] ` : ''
    const prefix = `${this.config.tag} ${ts}${message.role.padEnd(9)}`
    console.log(`${prefix}: ${message.content}`)

    if (this.config.filePath) {
      const line = JSON.stringify({
        ts: Date.now(),
        role: message.role,
        content: message.content
      })
      appendFileSync(this.config.filePath, line + '\n', 'utf8')
    }
  }

  onTranscript(segment: TranscriptSegment): void {
    if (!segment.isFinal) {
      process.stdout.write(`\r${this.config.tag} interim: ${segment.text}`)
    }
  }
}
