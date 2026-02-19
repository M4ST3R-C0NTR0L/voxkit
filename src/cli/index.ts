#!/usr/bin/env node
/**
 * VoxKit CLI
 * 
 * Commands:
 *   voxkit init <name>     - Scaffold a new voice agent
 *   voxkit dev             - Run locally with hot reload
 *   voxkit deploy          - Show deployment instructions
 */

import { Command } from 'commander'
import chalk from 'chalk'
import { initCommand } from './commands/init.js'
import { devCommand } from './commands/dev.js'
import { deployCommand } from './commands/deploy.js'
import { versionCommand } from './commands/version.js'

const program = new Command()

program
  .name('voxkit')
  .description('VoxKit - Open Source Voice Agent Framework')
  .version('1.0.0', '-v, --version', 'Show version number')

// Init command
program
  .command('init')
  .argument('<name>', 'Name of your voice agent project')
  .description('Scaffold a new voice agent project')
  .option('-t, --template <template>', 'Template to use (basic, real-estate, customer-support)', 'basic')
  .option('-p, --provider <provider>', 'AI provider (openai, xai, anthropic)', 'openai')
  .action(async (name, options) => {
    try {
      await initCommand(name, options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Dev command
program
  .command('dev')
  .description('Run the voice agent locally with hot reload')
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --host <host>', 'Host to bind to', 'localhost')
  .option('--no-reload', 'Disable hot reload')
  .action(async (options) => {
    try {
      await devCommand(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Deploy command
program
  .command('deploy')
  .description('Show deployment instructions for various platforms')
  .option('-p, --platform <platform>', 'Platform (railway, render, fly, docker)')
  .action(async (options) => {
    try {
      await deployCommand(options)
    } catch (error) {
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error)
      process.exit(1)
    }
  })

// Version command (explicit)
program
  .command('version')
  .description('Show version information')
  .action(() => {
    versionCommand()
  })

// Parse CLI arguments
program.parse()

// Show help if no command provided
if (!process.argv.slice(2).length) {
  program.outputHelp()
}
