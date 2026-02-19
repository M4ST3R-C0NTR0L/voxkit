/**
 * LeadWebhookPlugin
 *
 * POSTs captured lead data to any HTTP endpoint whenever
 * a new lead is extracted from the conversation.
 */

import type { VoxKitPlugin, VoxAgent, LeadInfo } from '../types.js'
import { logger } from '../logger.js'

export interface LeadWebhookConfig {
  /** URL to POST lead data to */
  url: string
  /** Optional bearer token for Authorization header */
  secret?: string
  /** Extra headers to include */
  headers?: Record<string, string>
  /** Retry count on failure (default: 3) */
  retries?: number
}

export class LeadWebhookPlugin implements VoxKitPlugin {
  name = 'lead-webhook'

  private config: Required<LeadWebhookConfig>
  private log = logger.child('lead-webhook')
  private seen = new Set<string>()

  constructor(config: LeadWebhookConfig) {
    this.config = {
      url: config.url,
      secret: config.secret ?? '',
      headers: config.headers ?? {},
      retries: config.retries ?? 3
    }
  }

  initialize(_agent: VoxAgent): void {
    this.log.info(`LeadWebhookPlugin → ${this.config.url}`)
  }

  onLead(lead: LeadInfo): void {
    // Deduplicate by email+phone combo
    const key = `${lead.email ?? ''}:${lead.phone ?? ''}`
    if (this.seen.has(key)) return
    this.seen.add(key)

    this.sendWebhook(lead)
  }

  private async sendWebhook(lead: LeadInfo, attempt = 1): Promise<void> {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...this.config.headers
      }
      if (this.config.secret) {
        headers['Authorization'] = `Bearer ${this.config.secret}`
      }

      const res = await fetch(this.config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ lead, timestamp: new Date().toISOString() })
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      this.log.info(`Lead posted (attempt ${attempt})`)
    } catch (err) {
      this.log.error(`Webhook failed (attempt ${attempt}):`, err)
      if (attempt < this.config.retries) {
        const delay = 1000 * 2 ** (attempt - 1)
        setTimeout(() => this.sendWebhook(lead, attempt + 1), delay)
      }
    }
  }
}
