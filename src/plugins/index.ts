/**
 * VoxKit Plugin System
 *
 * Plugins extend VoxAgent with additional capabilities.
 * Built-in plugins are exported here; community plugins
 * can implement the VoxKitPlugin interface from 'voxkit'.
 */

export { TranscriptLoggerPlugin } from './transcript-logger.js'
export { LeadWebhookPlugin, type LeadWebhookConfig } from './lead-webhook.js'
export { SlackNotifierPlugin, type SlackNotifierConfig } from './slack-notifier.js'
export { MetricsPlugin, type MetricsPluginConfig, type SessionMetrics } from './metrics.js'
