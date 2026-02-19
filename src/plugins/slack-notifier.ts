/**
 * SlackNotifierPlugin
 *
 * Sends a Slack message (via Incoming Webhook) whenever
 * a new lead is captured or a conversation ends.
 */

import type { VoxKitPlugin, VoxAgent, LeadInfo } from '../types.js'
import { logger } from '../logger.js'

export interface SlackNotifierConfig {
  /** Slack Incoming Webhook URL */
  webhookUrl: string
  /** Notify on new lead (default: true) */
  notifyOnLead?: boolean
  /** Emoji prefix for lead messages (default: ':telephone_receiver:') */
  emoji?: string
}

export class SlackNotifierPlugin implements VoxKitPlugin {
  name = 'slack-notifier'

  private config: Required<SlackNotifierConfig>
  private log = logger.child('slack-notifier')

  constructor(config: SlackNotifierConfig) {
    this.config = {
      webhookUrl: config.webhookUrl,
      notifyOnLead: config.notifyOnLead ?? true,
      emoji: config.emoji ?? ':telephone_receiver:'
    }
  }

  initialize(_agent: VoxAgent): void {
    this.log.info('SlackNotifierPlugin initialized')
  }

  onLead(lead: LeadInfo): void {
    if (!this.config.notifyOnLead) return

    const lines: string[] = [`${this.config.emoji} *New Lead Captured*`]
    if (lead.name)    lines.push(`• *Name:* ${lead.name}`)
    if (lead.email)   lines.push(`• *Email:* ${lead.email}`)
    if (lead.phone)   lines.push(`• *Phone:* ${lead.phone}`)
    if (lead.company) lines.push(`• *Company:* ${lead.company}`)

    this.postToSlack(lines.join('\n'))
  }

  private async postToSlack(text: string): Promise<void> {
    try {
      const res = await fetch(this.config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      this.log.info('Slack notification sent')
    } catch (err) {
      this.log.error('Slack notification failed:', err)
    }
  }
}
