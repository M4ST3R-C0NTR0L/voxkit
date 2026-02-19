/**
 * VoxKit - Open Source Voice Agent Framework
 * 
 * Build AI voice agents with minimal code
 * 
 * @example
 * ```typescript
 * import { VoxAgent, OpenAIProvider } from 'voxkit'
 * 
 * const agent = new VoxAgent({
 *   provider: new OpenAIProvider({ model: 'gpt-4o' }),
 *   voice: 'alloy',
 *   systemPrompt: 'You are a helpful assistant.'
 * })
 * 
 * agent.listen(3000)
 * ```
 */

// Core exports
export { VoxAgent } from './voxagent.js'

// Core components
export { AudioPipeline, type AudioPipelineConfig } from './core/audio-pipeline.js'
export { ConversationManager, type ConversationManagerConfig } from './core/conversation-manager.js'
export { LeadExtractor, type LeadExtractorConfig } from './core/lead-extractor.js'
export { VoxKitWSServer, type WSClient, type VoxKitWSServerOptions } from './core/websocket-server.js'

// Types
export type {
  Voice,
  AudioFormat,
  TranscriptSegment,
  ConversationMessage,
  LeadInfo,
  ConversationState,
  AudioConfig,
  ProviderResponse,
  TranscriptCallback,
  ResponseCallback,
  LeadCallback,
  ErrorCallback,
  ConnectionCallback,
  VoxAgentConfig,
  AIProvider,
  VoxKitPlugin,
  WSMessage,
  ServerConfig,
  Logger
} from './types.js'

// Plugins
export {
  TranscriptLoggerPlugin,
  LeadWebhookPlugin, type LeadWebhookConfig,
  SlackNotifierPlugin, type SlackNotifierConfig,
  MetricsPlugin, type MetricsPluginConfig, type SessionMetrics
} from './plugins/index.js'

// Logger
export { VoxKitLogger, logger } from './logger.js'

// Version
export const VERSION = '1.0.0'
