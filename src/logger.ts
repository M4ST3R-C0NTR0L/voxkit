/**
 * Logger utility for VoxKit
 */

import type { Logger } from './types.js'

export class VoxKitLogger implements Logger {
  private namespace: string
  private debugEnabled: boolean

  constructor(namespace: string = 'voxkit', debugEnabled = false) {
    this.namespace = namespace
    this.debugEnabled = debugEnabled || process.env.VOXKIT_DEBUG === 'true'
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString()
    return `[${timestamp}] [${level.toUpperCase()}] [${this.namespace}] ${message}`
  }

  debug(message: string, ...args: unknown[]): void {
    if (this.debugEnabled) {
      console.debug(this.formatMessage('debug', message), ...args)
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.info(this.formatMessage('info', message), ...args)
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.formatMessage('warn', message), ...args)
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.formatMessage('error', message), ...args)
  }

  child(namespace: string): VoxKitLogger {
    return new VoxKitLogger(`${this.namespace}:${namespace}`, this.debugEnabled)
  }
}

export const logger = new VoxKitLogger('voxkit')
