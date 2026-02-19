/**
 * Core types and interfaces for VoxKit
 */

// Voice options
export type Voice = 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' | string

// Audio format options
export type AudioFormat = 'pcm16' | 'g711_ulaw' | 'g711_alaw'

// Transcript segment from STT
export interface TranscriptSegment {
  id: string
  text: string
  isFinal: boolean
  timestamp: number
  speaker?: string
  confidence?: number
}

// Conversation message
export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant' | 'function'
  content: string
  timestamp?: number
  metadata?: Record<string, unknown>
}

// Lead information extracted from conversation
export interface LeadInfo {
  name?: string
  email?: string
  phone?: string
  company?: string
  notes?: string
  confidence: {
    name?: number
    email?: number
    phone?: number
  }
}

// Conversation state
export interface ConversationState {
  id: string
  messages: ConversationMessage[]
  isActive: boolean
  startedAt: number
  lastActivityAt: number
  metadata?: Record<string, unknown>
}

// Audio stream configuration
export interface AudioConfig {
  sampleRate: number
  channels: number
  format: AudioFormat
  bufferSize?: number
}

// Provider response
export interface ProviderResponse {
  text: string
  audio?: Uint8Array
  done: boolean
  metadata?: Record<string, unknown>
}

// Event callbacks
export type TranscriptCallback = (text: string, segment: TranscriptSegment) => void
export type ResponseCallback = (text: string, response: ProviderResponse) => void
export type LeadCallback = (lead: LeadInfo, conversation: ConversationState) => void
export type ErrorCallback = (error: Error, context?: string) => void
export type ConnectionCallback = (connected: boolean) => void

// VoxAgent configuration
export interface VoxAgentConfig {
  provider: AIProvider
  voice?: Voice
  systemPrompt?: string
  audioConfig?: Partial<AudioConfig>
  onTranscript?: TranscriptCallback
  onResponse?: ResponseCallback
  onLead?: LeadCallback
  onError?: ErrorCallback
  onConnect?: ConnectionCallback
  enableLeadExtraction?: boolean
  maxConversationDuration?: number
  silenceTimeoutMs?: number
}

// AI Provider interface
export interface AIProvider {
  name: string
  initialize(): Promise<void>
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendAudio(audioData: Uint8Array): Promise<void>
  sendText(text: string): Promise<void>
  onResponse(callback: (response: ProviderResponse) => void): void
  onTranscript(callback: (segment: TranscriptSegment) => void): void
  onError(callback: (error: Error) => void): void
  getSupportedVoices(): Voice[]
  setVoice(voice: Voice): void
}

// Plugin interface for extending functionality
export interface VoxKitPlugin {
  name: string
  initialize(agent: VoxAgent): Promise<void> | void
  onMessage?(message: ConversationMessage): void
  onTranscript?(segment: TranscriptSegment): void
  onLead?(lead: LeadInfo): void
  destroy?(): Promise<void> | void
}

// VoxAgent class placeholder for type reference
export interface VoxAgent {
  config: VoxAgentConfig
  conversation: ConversationState
  isConnected: boolean
  connect(): Promise<void>
  disconnect(): Promise<void>
  sendText(text: string): Promise<void>
  listen(port: number, host?: string): Promise<void>
  stop(): Promise<void>
  use(plugin: VoxKitPlugin): void
  // EventEmitter methods
  on(event: string, listener: (...args: unknown[]) => void): this
  off(event: string, listener: (...args: unknown[]) => void): this
  emit(event: string, ...args: unknown[]): boolean
}

// WebSocket message types
export interface WSMessage {
  type: 'audio' | 'text' | 'transcript' | 'response' | 'error' | 'ping' | 'pong' | 'config'
  data: unknown
  timestamp?: number
  id?: string
}

// Server configuration
export interface ServerConfig {
  port: number
  host?: string
  cors?: {
    origin: string | string[]
    methods?: string[]
  }
  ssl?: {
    cert: string
    key: string
  }
}

// Logger interface
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
