/**
 * VoxKit CLI - Dev Command
 * Run the voice agent locally with hot reload
 */

import { spawn } from 'child_process'
import { watch } from 'chokidar'
import { existsSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'

interface DevOptions {
  port: string
  host: string
  reload: boolean
}

let childProcess: ReturnType<typeof spawn> | null = null

export async function devCommand(options: DevOptions): Promise<void> {
  const agentPath = resolve(process.cwd(), 'src', 'agent.ts')
  
  if (!existsSync(agentPath)) {
    throw new Error('No agent.ts found in src/. Run `voxkit init` first.')
  }

  console.log(chalk.blue('🎙️  Starting VoxKit development server...\n'))
  console.log(chalk.gray(`Port: ${options.port}`))
  console.log(chalk.gray(`Host: ${options.host}`))
  console.log(chalk.gray(`Hot reload: ${options.reload ? 'enabled' : 'disabled'}\n`))

  // Start the agent
  await startAgent(agentPath, options)

  // Set up file watching if hot reload is enabled
  if (options.reload) {
    const watcher = watch('src/**/*.ts', {
      cwd: process.cwd(),
      ignoreInitial: true
    })

    watcher.on('change', async (path) => {
      console.log(chalk.yellow(`\\n📝 File changed: ${path}`))
      console.log(chalk.blue('🔄 Restarting agent...\\n'))
      
      await stopAgent()
      await startAgent(agentPath, options)
    })

    console.log(chalk.cyan('👀 Watching for file changes...\n'))
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\\n👋 Shutting down development server...'))
    await stopAgent()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    await stopAgent()
    process.exit(0)
  })
}

async function startAgent(agentPath: string, options: DevOptions): Promise<void> {
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      PORT: options.port,
      HOST: options.host,
      NODE_ENV: 'development'
    }

    // Use tsx or ts-node to run TypeScript directly
    const tsxPath = resolve(process.cwd(), 'node_modules', '.bin', 'tsx')
    const tsNodePath = resolve(process.cwd(), 'node_modules', '.bin', 'ts-node')
    
    let runner: string
    if (existsSync(tsxPath)) {
      runner = tsxPath
    } else if (existsSync(tsNodePath)) {
      runner = tsNodePath
    } else {
      // Fallback to node with --loader
      runner = 'node'
    }

    const args = runner === 'node' 
      ? ['--loader', 'ts-node/esm', agentPath]
      : [agentPath]

    childProcess = spawn(runner, args, {
      env,
      stdio: 'inherit',
      shell: true
    })

    childProcess.on('error', (error) => {
      console.error(chalk.red('Failed to start agent:'), error.message)
      if (error.message.includes('ENOENT')) {
        console.error(chalk.yellow('\\n💡 Tip: Install tsx for better TypeScript support:'))
        console.error(chalk.white('   npm install --save-dev tsx\n'))
      }
      reject(error)
    })

    // Give it a moment to start
    setTimeout(resolve, 1000)
  })
}

async function stopAgent(): Promise<void> {
  if (childProcess) {
    childProcess.kill('SIGTERM')
    
    // Force kill after 5 seconds
    setTimeout(() => {
      if (childProcess) {
        childProcess.kill('SIGKILL')
      }
    }, 5000)

    childProcess = null
  }
}
