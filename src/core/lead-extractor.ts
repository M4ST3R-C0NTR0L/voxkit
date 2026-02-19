/**
 * Lead Extractor for VoxKit
 * Automatically extracts contact information from conversations
 */

import EventEmitter from 'events'
import type { LeadInfo, ConversationMessage, ConversationState } from '../types.js'
import { logger } from '../logger.js'

export interface LeadExtractorConfig {
  minConfidence?: number
  extractOnEveryMessage?: boolean
  extractOnConversationEnd?: boolean
  customExtractors?: Array<(text: string) => Partial<LeadInfo>>
}

export class LeadExtractor extends EventEmitter {
  private config: Required<LeadExtractorConfig>
  private currentLead: Partial<LeadInfo> = {}
  private logger = logger.child('lead-extractor')

  // Regex patterns for information extraction
  private patterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /(\+?1?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4})/g,
    nameIndicators: [
      /my name(?:'s| is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /i(?:'m| am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /this is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /call me\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
      /i(?:'m| am) called\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i
    ],
    companyIndicators: [
      /work (?:at|for)\s+([A-Z][^,.]+)/i,
      /company is\s+([A-Z][^,.]+)/i,
      /from\s+([A-Z][^,.]+(?:inc|llc|corp|company|co\.|ltd)\.?)/i
    ]
  }

  constructor(config: LeadExtractorConfig = {}) {
    super()
    this.config = {
      minConfidence: config.minConfidence ?? 0.7,
      extractOnEveryMessage: config.extractOnEveryMessage ?? true,
      extractOnConversationEnd: config.extractOnConversationEnd ?? true,
      customExtractors: config.customExtractors ?? []
    }
  }

  /**
   * Process a single message for lead information
   */
  processMessage(message: ConversationMessage): LeadInfo | null {
    if (message.role !== 'user') {
      return null
    }

    const text = message.content
    const updates: Partial<LeadInfo> = {}

    // Extract email
    const emails = text.match(this.patterns.email)
    if (emails && emails.length > 0) {
      updates.email = emails[0]
      this.logger.debug(`Extracted email: ${updates.email}`)
    }

    // Extract phone
    const phones = text.match(this.patterns.phone)
    if (phones && phones.length > 0) {
      updates.phone = this.normalizePhone(phones[0])
      this.logger.debug(`Extracted phone: ${updates.phone}`)
    }

    // Extract name
    const name = this.extractName(text)
    if (name) {
      updates.name = name
      this.logger.debug(`Extracted name: ${updates.name}`)
    }

    // Extract company
    const company = this.extractCompany(text)
    if (company) {
      updates.company = company
      this.logger.debug(`Extracted company: ${updates.company}`)
    }

    // Apply custom extractors
    for (const extractor of this.config.customExtractors) {
      const customData = extractor(text)
      Object.assign(updates, customData)
    }

    // Merge updates
    this.currentLead = { ...this.currentLead, ...updates }

    // Build result if we have valid data
    const lead = this.buildLeadInfo()
    
    if (this.hasMinimumInfo(lead) && this.config.extractOnEveryMessage) {
      this.emit('lead', lead)
      return lead
    }

    return null
  }

  /**
   * Process entire conversation history
   */
  processConversation(state: ConversationState): LeadInfo | null {
    this.reset()

    for (const message of state.messages) {
      this.processMessage(message)
    }

    const lead = this.buildLeadInfo()
    
    if (this.hasMinimumInfo(lead)) {
      this.emit('lead', lead)
      return lead
    }

    return null
  }

  /**
   * Get current lead information
   */
  getCurrentLead(): LeadInfo | null {
    return this.buildLeadInfo()
  }

  /**
   * Reset extractor state
   */
  reset(): void {
    this.currentLead = {}
    this.logger.debug('Lead extractor reset')
  }

  /**
   * Check if we have a complete lead
   */
  hasCompleteLead(): boolean {
    const lead = this.buildLeadInfo()
    return !!(lead.name && lead.email && lead.phone)
  }

  private extractName(text: string): string | undefined {
    for (const pattern of this.patterns.nameIndicators) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }

    // Try to extract name from greeting patterns
    const greetingMatch = text.match(/^(?:hi|hello|hey)\s+([A-Z][a-z]+)/i)
    if (greetingMatch) {
      return greetingMatch[1].trim()
    }

    return undefined
  }

  private extractCompany(text: string): string | undefined {
    for (const pattern of this.patterns.companyIndicators) {
      const match = text.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    return undefined
  }

  private normalizePhone(phone: string): string {
    // Remove non-numeric characters except +
    const digits = phone.replace(/[^\d+]/g, '')
    
    // Format as +1XXXXXXXXXX if starts with 1
    if (digits.length === 11 && digits.startsWith('1')) {
      return `+${digits}`
    }
    
    // Add +1 if 10 digits
    if (digits.length === 10) {
      return `+1${digits}`
    }
    
    return digits
  }

  private buildLeadInfo(): LeadInfo {
    const confidence: LeadInfo['confidence'] = {}

    // Calculate confidence scores
    if (this.currentLead.name) {
      confidence.name = 0.85 // High confidence for explicit name extraction
    }
    if (this.currentLead.email) {
      confidence.email = this.validateEmail(this.currentLead.email) ? 1.0 : 0.5
    }
    if (this.currentLead.phone) {
      confidence.phone = this.validatePhone(this.currentLead.phone) ? 1.0 : 0.5
    }

    return {
      name: this.currentLead.name,
      email: this.currentLead.email,
      phone: this.currentLead.phone,
      company: this.currentLead.company,
      notes: this.currentLead.notes,
      confidence
    }
  }

  private validateEmail(email: string): boolean {
    return this.patterns.email.test(email)
  }

  private validatePhone(phone: string): boolean {
    const digits = phone.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 15
  }

  private hasMinimumInfo(lead: LeadInfo): boolean {
    const score = (lead.name ? 1 : 0) + (lead.email ? 1 : 0) + (lead.phone ? 1 : 0)
    return score >= 1 // At least one piece of contact info
  }
}
