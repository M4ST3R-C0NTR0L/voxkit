/**
 * WebSocket Server for VoxKit
 * Handles client connections and audio streaming
 */

import { WebSocketServer, WebSocket } from 'ws'
import { createServer, Server as HTTPServer } from 'http'
import { readFileSync } from 'fs'
import type { ServerConfig, WSMessage, AudioConfig } from '../types.js'
import { logger } from '../logger.js'

export interface WSClient {
  id: string
  ws: WebSocket
  isAlive: boolean
  connectedAt: number
  audioConfig?: AudioConfig
}

export interface VoxKitWSServerOptions {
  serverConfig: ServerConfig
  audioConfig?: Partial<AudioConfig>
  onConnect?: (client: WSClient) => void
  onDisconnect?: (client: WSClient) => void
  onMessage?: (client: WSClient, message: WSMessage) => void
  onAudio?: (client: WSClient, audioData: Uint8Array) => void
  onError?: (client: WSClient, error: Error) => void
}

export class VoxKitWSServer {
  private wss: WebSocketServer | null = null
  private httpServer: HTTPServer | null = null
  private clients = new Map<string, WSClient>()
  private options: VoxKitWSServerOptions
  private logger = logger.child('websocket-server')
  private heartbeatInterval: NodeJS.Timeout | null = null

  constructor(options: VoxKitWSServerOptions) {
    this.options = options
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    const { serverConfig } = this.options

    // Create HTTP server
    if (serverConfig.ssl) {
      const https = await import('https')
      this.httpServer = https.createServer({
        cert: readFileSync(serverConfig.ssl.cert),
        key: readFileSync(serverConfig.ssl.key)
      })
    } else {
      this.httpServer = createServer()
    }

    return new Promise((resolve, reject) => {
      try {

        // Create WebSocket server
        this.wss = new WebSocketServer({ 
          server: this.httpServer!,
          perMessageDeflate: false
        })

        this.setupWebSocketHandlers()

        // Start listening
        this.httpServer!.listen(serverConfig.port, serverConfig.host ?? '0.0.0.0', () => {
          this.logger.info(`WebSocket server listening on ${serverConfig.host ?? '0.0.0.0'}:${serverConfig.port}`)
          this.startHeartbeat()
          resolve()
        })

      } catch (error) {
        reject(error)
      }
    })
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.stopHeartbeat()

      // Close all client connections
      for (const [id, client] of this.clients) {
        this.closeClient(id, 1000, 'Server shutting down')
      }

      // Close WebSocket server
      if (this.wss) {
        this.wss.close(() => {
          this.logger.info('WebSocket server closed')
        })
      }

      // Close HTTP server
      if (this.httpServer) {
        this.httpServer.close(() => {
          this.logger.info('HTTP server closed')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  /**
   * Send message to a specific client
   */
  sendToClient(clientId: string, message: WSMessage): boolean {
    const client = this.clients.get(clientId)
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return false
    }

    try {
      client.ws.send(JSON.stringify(message))
      return true
    } catch (error) {
      this.logger.error(`Failed to send message to client ${clientId}`, error)
      return false
    }
  }

  /**
   * Broadcast message to all clients
   */
  broadcast(message: WSMessage, excludeClientId?: string): void {
    const messageStr = JSON.stringify(message)
    
    for (const [id, client] of this.clients) {
      if (id !== excludeClientId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(messageStr)
        } catch (error) {
          this.logger.error(`Failed to broadcast to client ${id}`, error)
        }
      }
    }
  }

  /**
   * Close a specific client connection
   */
  closeClient(clientId: string, code?: number, reason?: string): boolean {
    const client = this.clients.get(clientId)
    if (!client) {
      return false
    }

    try {
      client.ws.close(code, reason)
      this.clients.delete(clientId)
      this.options.onDisconnect?.(client)
      return true
    } catch (error) {
      this.logger.error(`Failed to close client ${clientId}`, error)
      return false
    }
  }

  /**
   * Get all connected clients
   */
  getClients(): Map<string, WSClient> {
    return new Map(this.clients)
  }

  /**
   * Get client count
   */
  getClientCount(): number {
    return this.clients.size
  }

  /**
   * Check if server is running
   */
  isRunning(): boolean {
    return this.wss !== null && this.httpServer !== null
  }

  private setupWebSocketHandlers(): void {
    if (!this.wss) return

    this.wss.on('connection', (ws, req) => {
      const clientId = this.generateClientId()
      const client: WSClient = {
        id: clientId,
        ws,
        isAlive: true,
        connectedAt: Date.now()
      }

      this.clients.set(clientId, client)
      this.logger.info(`Client connected: ${clientId} from ${req.socket.remoteAddress}`)

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'config',
        data: { 
          clientId,
          audioConfig: this.options.audioConfig 
        }
      })

      this.options.onConnect?.(client)

      // Handle messages
      ws.on('message', (data) => {
        this.handleMessage(client, data)
      })

      // Handle pong
      ws.on('pong', () => {
        client.isAlive = true
      })

      // Handle close
      ws.on('close', (code, reason) => {
        this.logger.info(`Client disconnected: ${clientId}, code: ${code}, reason: ${reason}`)
        this.clients.delete(clientId)
        this.options.onDisconnect?.(client)
      })

      // Handle errors
      ws.on('error', (error) => {
        this.logger.error(`WebSocket error for client ${clientId}`, error)
        this.options.onError?.(client, error)
      })
    })

    this.wss.on('error', (error) => {
      this.logger.error('WebSocket server error', error)
    })
  }

  private handleMessage(client: WSClient, data: Buffer | ArrayBuffer | Buffer[]): void {
    try {
      const message = JSON.parse(data.toString()) as WSMessage

      switch (message.type) {
        case 'audio':
          // Parse base64 audio
          if (typeof message.data === 'string') {
            const audioData = new Uint8Array(Buffer.from(message.data, 'base64'))
            this.options.onAudio?.(client, audioData)
          }
          break

        case 'ping':
          this.sendToClient(client.id, { type: 'pong', data: null })
          break

        case 'config':
          // Update client audio config
          if (message.data && typeof message.data === 'object') {
            client.audioConfig = { ...client.audioConfig, ...message.data as AudioConfig }
          }
          break

        default:
          this.options.onMessage?.(client, message)
      }
    } catch (error) {
      this.logger.error(`Failed to parse message from client ${client.id}`, error)
      this.sendToClient(client.id, {
        type: 'error',
        data: 'Invalid message format'
      })
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      for (const [id, client] of this.clients) {
        if (!client.isAlive) {
          this.logger.warn(`Client ${id} heartbeat timeout`)
          this.closeClient(id, 1001, 'Heartbeat timeout')
          continue
        }

        client.isAlive = false
        client.ws.ping()
      }
    }, 30000) // 30 seconds
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  private generateClientId(): string {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}
