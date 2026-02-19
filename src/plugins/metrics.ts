/**
 * MetricsPlugin
 *
 * Tracks per-session metrics: conversation duration, turn count,
 * token estimates, and lead conversion rate.
 *
 * Exposes a simple getMetrics() method and optionally pushes
 * metrics to a URL on conversation end.
 */

import type { VoxKitPlugin, VoxAgent, ConversationMessage, LeadInfo } from '../types.js'
import { logger } from '../logger.js'

export interface MetricsPluginConfig {
  /** Optional endpoint to POST metrics to on conversation end */
  reportUrl?: string
  /** Print summary to console at conversation end (default: true) */
  printSummary?: boolean
}

export interface SessionMetrics {
  sessionId: string
  startedAt: number
  endedAt?: number
  durationMs?: number
  turnCount: number
  userTurns: number
  assistantTurns: number
  leadCaptured: boolean
  estimatedInputTokens: number
  estimatedOutputTokens: number
}

export class MetricsPlugin implements VoxKitPlugin {
  name = 'metrics'

  private config: Required<MetricsPluginConfig>
  private log = logger.child('metrics')
  private metrics: SessionMetrics
  private agent!: VoxAgent

  constructor(config: MetricsPluginConfig = {}) {
    this.config = {
      reportUrl: config.reportUrl ?? '',
      printSummary: config.printSummary ?? true
    }
    this.metrics = this.createMetrics()
  }

  initialize(agent: VoxAgent): void {
    this.agent = agent
    this.metrics = this.createMetrics()

    agent.on('disconnect', () => this.finalize())
  }

  onMessage(message: ConversationMessage): void {
    this.metrics.turnCount++
    if (message.role === 'user') {
      this.metrics.userTurns++
      this.metrics.estimatedInputTokens += Math.ceil(message.content.length / 4)
    } else if (message.role === 'assistant') {
      this.metrics.assistantTurns++
      this.metrics.estimatedOutputTokens += Math.ceil(message.content.length / 4)
    }
  }

  onLead(_lead: LeadInfo): void {
    this.metrics.leadCaptured = true
  }

  getMetrics(): Readonly<SessionMetrics> {
    return { ...this.metrics }
  }

  private createMetrics(): SessionMetrics {
    return {
      sessionId: `sess-${Date.now()}`,
      startedAt: Date.now(),
      turnCount: 0,
      userTurns: 0,
      assistantTurns: 0,
      leadCaptured: false,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0
    }
  }

  private async finalize(): Promise<void> {
    this.metrics.endedAt = Date.now()
    this.metrics.durationMs = this.metrics.endedAt - this.metrics.startedAt

    if (this.config.printSummary) {
      const dur = (this.metrics.durationMs / 1000).toFixed(1)
      console.log('\n📊 Session Metrics')
      console.log(`   Duration:   ${dur}s`)
      console.log(`   Turns:      ${this.metrics.turnCount} (${this.metrics.userTurns} user / ${this.metrics.assistantTurns} assistant)`)
      console.log(`   Est tokens: ~${this.metrics.estimatedInputTokens} in / ~${this.metrics.estimatedOutputTokens} out`)
      console.log(`   Lead:       ${this.metrics.leadCaptured ? '✅ captured' : '❌ not captured'}`)
    }

    if (this.config.reportUrl) {
      try {
        await fetch(this.config.reportUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.metrics)
        })
      } catch (err) {
        this.log.error('Failed to report metrics:', err)
      }
    }
  }
}
