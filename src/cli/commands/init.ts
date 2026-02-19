/**
 * VoxKit CLI - Init Command
 * Scaffold a new voice agent project
 */

import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { resolve } from 'path'
import chalk from 'chalk'
import inquirer from 'inquirer'

interface InitOptions {
  template: string
  provider: string
}

export async function initCommand(name: string, options: InitOptions): Promise<void> {
  console.log(chalk.blue(`\n🎙️  Creating VoxKit project: ${name}\n`))

  const projectPath = resolve(process.cwd(), name)

  // Check if directory exists
  if (existsSync(projectPath)) {
    const { overwrite } = await inquirer.prompt([{
      type: 'confirm',
      name: 'overwrite',
      message: `Directory ${name} already exists. Overwrite?`,
      default: false
    }])

    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'))
      return
    }
  }

  // Create project directory
  await mkdir(projectPath, { recursive: true })
  await mkdir(resolve(projectPath, 'src'), { recursive: true })

  // Create package.json
  const packageJson = generatePackageJson(name, options)
  await writeFile(resolve(projectPath, 'package.json'), packageJson)

  // Create tsconfig.json
  const tsConfig = generateTsConfig()
  await writeFile(resolve(projectPath, 'tsconfig.json'), tsConfig)

  // Create main agent file
  const agentCode = generateAgentCode(options)
  await writeFile(resolve(projectPath, 'src', 'agent.ts'), agentCode)

  // Create .env.example
  const envExample = generateEnvExample(options)
  await writeFile(resolve(projectPath, '.env.example'), envExample)

  // Create .gitignore
  const gitignore = generateGitignore()
  await writeFile(resolve(projectPath, '.gitignore'), gitignore)

  // Create README
  const readme = generateReadme(name, options)
  await writeFile(resolve(projectPath, 'README.md'), readme)

  console.log(chalk.green('✓ Project created successfully!\n'))
  console.log(chalk.cyan('Next steps:'))
  console.log(chalk.white(`  cd ${name}`))
  console.log(chalk.white('  npm install'))
  console.log(chalk.white('  cp .env.example .env'))
  console.log(chalk.white('  # Edit .env with your API keys'))
  console.log(chalk.white('  npx voxkit dev\n'))
}

function generatePackageJson(name: string, options: InitOptions): string {
  return JSON.stringify({
    name: name.toLowerCase().replace(/\s+/g, '-'),
    version: '1.0.0',
    description: 'Voice agent powered by VoxKit',
    type: 'module',
    scripts: {
      dev: 'voxkit dev',
      start: 'node dist/agent.js',
      build: 'tsc'
    },
    dependencies: {
      voxkit: '^1.0.0'
    },
    devDependencies: {
      '@types/node': '^20.0.0',
      typescript: '^5.0.0'
    }
  }, null, 2)
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      lib: ['ES2022'],
      outDir: './dist',
      rootDir: './src',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true
    },
    include: ['src/**/*']
  }, null, 2)
}

function generateAgentCode(options: InitOptions): string {
  const providerImport = options.provider.charAt(0).toUpperCase() + options.provider.slice(1)
  
  const systemPrompts: Record<string, string> = {
    'real-estate': 'You are a helpful real estate assistant. Help potential buyers and sellers with their questions about properties. Collect their contact information when appropriate.',
    'customer-support': 'You are a customer support representative. Help customers with their inquiries and resolve issues efficiently. Collect contact details for follow-up.',
    'basic': 'You are a helpful voice assistant. Answer questions and provide assistance to the best of your ability.'
  }

  const prompt = systemPrompts[options.template] || systemPrompts.basic

  return `import { VoxAgent, ${providerImport}Provider } from 'voxkit'

const agent = new VoxAgent({
  provider: new ${providerImport}Provider({
    model: '${options.provider === 'openai' ? 'gpt-4o' : options.provider === 'xai' ? 'grok-2' : 'claude-3-5-sonnet-20241022'}'
  }),
  voice: 'alloy',
  systemPrompt: \`${prompt}\`,
  enableLeadExtraction: true,
  onTranscript: (text) => {
    console.log('🎤 User:', text)
  },
  onResponse: (text) => {
    console.log('🤖 Assistant:', text)
  },
  onLead: (lead) => {
    console.log('📋 Lead captured:', lead)
  },
  onError: (error) => {
    console.error('❌ Error:', error.message)
  }
})

// Start the agent
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

agent.listen(PORT)
  .then(() => {
    console.log(\`🚀 Voice agent running on port \${PORT}\`)
    console.log(\`🔗 WebSocket endpoint: ws://localhost:\${PORT}\`)
  })
  .catch((error) => {
    console.error('Failed to start agent:', error)
    process.exit(1)
  })

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\\n👋 Shutting down...')
  await agent.stop()
  process.exit(0)
})
`
}

function generateEnvExample(options: InitOptions): string {
  const envVars: Record<string, string> = {
    openai: 'OPENAI_API_KEY=your_openai_api_key_here',
    xai: 'XAI_API_KEY=your_xai_api_key_here',
    anthropic: 'ANTHROPIC_API_KEY=your_anthropic_api_key_here'
  }

  return `${envVars[options.provider] || envVars.openai}
PORT=3000
VOXKIT_DEBUG=false
`
}

function generateGitignore(): string {
  return `node_modules/
dist/
.env
.env.local
*.log
.DS_Store
.vscode/
.idea/
*.swp
*.swo
`
}

function generateReadme(name: string, options: InitOptions): string {
  return `# ${name}

Voice agent powered by [VoxKit](https://github.com/voxkit/voxkit).

## Getting Started

1. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

2. Set up environment variables:
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your API keys
   \`\`\`

3. Run the development server:
   \`\`\`bash
   npx voxkit dev
   \`\`\`

## Deployment

See deployment instructions:
\`\`\`bash
npx voxkit deploy
\`\`\`

## Project Structure

- \`src/agent.ts\` - Main voice agent code
- \`.env\` - Environment variables

## Learn More

- [VoxKit Documentation](https://github.com/voxkit/voxkit#readme)
- [API Reference](https://github.com/voxkit/voxkit/blob/main/docs/api.md)
`
}
