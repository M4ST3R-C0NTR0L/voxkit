/**
 * Main VoxAgent class for VoxKit
 * Orchestrates audio pipeline, conversation management, and AI providers
 */

import EventEmitter from 'events'
import type { 
  VoxAgentConfig, 
  VoxAgent as IVoxAgent,
  VoxKitPlugin,
  ConversationState,
  LeadInfo,
  ServerConfig
} from './types.js'
import { AudioPipeline } from './core/audio-pipeline.js'
import { ConversationManager } from './core/conversation-manager.js'
import { LeadExtractor } from './core/lead-extractor.js'
import { VoxKitWSServer, type WSClient } from './core/websocket-server.js'
import { logger } from './logger.js'

export class VoxAgent extends EventEmitter implements IVoxAgent {
  public config: VoxAgentConfig
  public conversation: ConversationState
  public isConnected = false

  private audioPipeline: AudioPipeline
  private conversationManager: ConversationManager
  private leadExtractor: LeadExtractor
  private wsServer: VoxKitWSServer | null = null
  private plugins: VoxKitPlugin[] = []
  private logger = logger.child('voxagent')
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000

  constructor(config: VoxAgentConfig) {
    super()
    this.config = {
      voice: 'alloy',
      enableLeadExtraction: true,
      maxConversationDuration: 3600,
      silenceTimeoutMs: 30000,
      ...config
    }

    // Initialize components
    this.audioPipeline = new AudioPipeline(this.config.audioConfig)
    this.conversationManager = new ConversationManager({
      maxConversationDuration: this.config.maxConversationDuration,
      silenceTimeoutMs: this.config.silenceTimeoutMs
    })
    this.leadExtractor = new LeadExtractor()
    this.conversation = this.conversationManager.getState()

    this.setupEventHandlers()
  }

  /**
   * Set up internal event handlers
   */
  private setupEventHandlers(): void {
    // Provider callbacks
    this.config.provider.onTranscript((segment) => {
      this.conversationManager.addTranscript(segment)
      this.emit('transcript', segment.text, segment)
      this.config.onTranscript?.(segment.text, segment)
    })

    this.config.provider.onResponse((response) => {
      this.conversationManager.addMessage('assistant', response.text)
      this.emit('response', response.text, response)
      this.config.onResponse?.(response.text, response)
    })

    this.config.provider.onError((error) => {
      this.handleError(error, 'provider')
    })

    // Conversation events
    this.conversationManager.on('message', (message) => {
      if (this.config.enableLeadExtraction && message.role === 'user') {
        const lead = this.leadExtractor.processMessage(message)
        if (lead) {
          this.emit('lead', lead, this.conversation)
          this.config.onLead?.(lead, this.conversation)
        }
      }

      // Notify plugins
      for (const plugin of this.plugins) {
        plugin.onMessage?.(message)
      }
    })

    this.conversationManager.on('silenceTimeout', () => {
      this.emit('silenceTimeout', this.conversation)
      this.logger.warn('Conversation silence timeout')
    })

    // Audio pipeline events
    this.audioPipeline.on('buffer', (audioData) => {
      if (this.isConnected) {
        this.config.provider.sendAudio(audioData).catch((error) => {
          this.handleError(error, 'audio-send')
        })
      }
    })

    // Lead extraction
    this.leadExtractor.on('lead', (lead) => {
      this.emit('lead', lead, this.conversation)
      this.config.onLead?.(lead, this.conversation)

      // Notify plugins
      for (const plugin of this.plugins) {
        plugin.onLead?.(lead)
      }
    })
  }

  /**
   * Connect to AI provider
   */
  async connect(): Promise<void> {
    try {
      this.logger.info('Initializing AI provider...')
      await this.config.provider.initialize()
      
      this.logger.info('Connecting to AI provider...')
      await this.config.provider.connect()
      
      this.isConnected = true
      this.reconnectAttempts = 0
      
      this.conversationManager.start()
      this.conversation = this.conversationManager.getState()
      
      // Send system prompt if provided
      if (this.config.systemPrompt) {
        this.conversationManager.addMessage('system', this.config.systemPrompt)
      }

      this.config.onConnect?.(true)
      this.emit('connect', true)
      
      this.logger.info('Connected to AI provider')
    } catch (error) {
      this.handleError(error as Error, 'connect')
      throw error
    }
  }

  /**
   * Disconnect from AI provider
   */
  async disconnect(): Promise<void> {
    try {
      // Extract final lead before disconnecting
      if (this.config.enableLeadExtraction) {
        const finalLead = this.leadExtractor.processConversation(this.conversationManager.getState())
        if (finalLead) {
          this.emit('lead', finalLead, this.conversation)
          this.config.onLead?.(finalLead, this.conversation)
        }
      }

      await this.config.provider.disconnect()
      this.conversationManager.end()
      
      this.isConnected = false
      this.config.onConnect?.(false)
      this.emit('disconnect')
      
      this.logger.info('Disconnected from AI provider')
    } catch (error) {
      this.handleError(error as Error, 'disconnect')
      throw error
    }
  }

  /**
   * Send text message to the agent
   */
  async sendText(text: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Agent not connected')
    }

    this.conversationManager.addMessage('user', text)
    await this.config.provider.sendText(text)
  }

  /**
   * Start listening for WebSocket connections
   */
  async listen(port: number, host?: string): Promise<void> {
    const serverConfig: ServerConfig = {
      port,
      host: host ?? '0.0.0.0'
    }

    this.wsServer = new VoxKitWSServer({
      serverConfig,
      audioConfig: this.audioPipeline.getConfig(),
      
      onConnect: (client) => {
        this.logger.info(`WebSocket client connected: ${client.id}`)
        this.emit('clientConnect', client)
        
        // Start new conversation for this client
        this.conversationManager.start()
        this.conversation = this.conversationManager.getState()
        
        if (this.config.systemPrompt) {
          this.conversationManager.addMessage('system', this.config.systemPrompt)
        }
      },

      onDisconnect: (client) => {
        this.logger.info(`WebSocket client disconnected: ${client.id}`)
        this.emit('clientDisconnect', client)
        
        // Extract lead on disconnect
        if (this.config.enableLeadExtraction) {
          const lead = this.leadExtractor.processConversation(this.conversationManager.getState())
          if (lead) {
            this.emit('lead', lead, this.conversation)
            this.config.onLead?.(lead, this.conversation)
          }
        }
      },

      onAudio: (client, audioData) => {
        this.audioPipeline.processAudioChunk(audioData)
      },

      onError: (client, error) => {
        this.handleError(error, `websocket-client-${client.id}`)
      }
    })

    // Connect to AI provider
    await this.connect()

    // Start WebSocket server
    await this.wsServer.start()
    
    this.logger.info(`VoxAgent listening on ${serverConfig.host}:${port}`)
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (this.wsServer) {
      await this.wsServer.stop()
      this.wsServer = null
    }
    await this.disconnect()
  }

  /**
   * Add a plugin
   */
  use(plugin: VoxKitPlugin): void {
    this.plugins.push(plugin)
    plugin.initialize(this)
    this.logger.info(`Plugin loaded: ${plugin.name}`)
  }

  /**
   * Get conversation transcript
   */
  getTranscript(): string {
    return this.conversationManager.getMessages()
      .map(m => `${m.role}: ${m.content}`)
      .join('\n')
  }

  /**
   * Export conversation as JSON
   */
  exportConversation(): string {
    return this.conversationManager.export()
  }

  /**
   * Get current lead information
   */
  getCurrentLead(): LeadInfo | null {
    return this.leadExtractor.getCurrentLead()
  }

  /**
   * Handle errors with optional reconnection
   */
  private handleError(error: Error, context: string): void {
    this.logger.error(`Error in ${context}:`, error)
    this.emit('error', error, context)
    this.config.onError?.(error, context)

    // Attempt reconnection if appropriate
    if (this.isConnected && this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      this.logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`)
      
      setTimeout(() => {
        this.connect().catch((err) => {
          this.logger.error('Reconnection failed', err)
        })
      }, this.reconnectDelay * this.reconnectAttempts)
    }
  }
}
