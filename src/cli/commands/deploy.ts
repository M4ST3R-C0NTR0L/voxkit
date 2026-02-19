/**
 * VoxKit CLI - Deploy Command
 * Show deployment instructions for various platforms
 */

import chalk from 'chalk'

interface DeployOptions {
  platform?: string
}

export async function deployCommand(options: DeployOptions): Promise<void> {
  if (options.platform) {
    showPlatformInstructions(options.platform)
  } else {
    showAllInstructions()
  }
}

function showAllInstructions(): void {
  console.log(chalk.blue('\n🚀 VoxKit Deployment Options\n'))
  
  console.log(chalk.cyan('Available platforms:\n'))
  
  console.log(chalk.white('1. Railway (Recommended)'))
  console.log(chalk.gray('   Easy deployment with automatic SSL\n'))
  
  console.log(chalk.white('2. Render'))
  console.log(chalk.gray('   Free tier available with WebSocket support\n'))
  
  console.log(chalk.white('3. Fly.io'))
  console.log(chalk.gray('   Edge deployment with global distribution\n'))
  
  console.log(chalk.white('4. Docker'))
  console.log(chalk.gray('   Self-host anywhere\n'))

  console.log(chalk.cyan('Run one of the following for specific instructions:\n'))
  console.log(chalk.white('  voxkit deploy -p railway'))
  console.log(chalk.white('  voxkit deploy -p render'))
  console.log(chalk.white('  voxkit deploy -p fly'))
  console.log(chalk.white('  voxkit deploy -p docker\n'))
}

function showPlatformInstructions(platform: string): void {
  switch (platform.toLowerCase()) {
    case 'railway':
      showRailwayInstructions()
      break
    case 'render':
      showRenderInstructions()
      break
    case 'fly':
    case 'fly.io':
      showFlyInstructions()
      break
    case 'docker':
      showDockerInstructions()
      break
    default:
      console.log(chalk.red(`Unknown platform: ${platform}`))
      console.log(chalk.yellow('Available platforms: railway, render, fly, docker'))
  }
}

function showRailwayInstructions(): void {
  console.log(chalk.blue('\n🚂 Deploy to Railway\n'))
  
  console.log(chalk.cyan('Prerequisites:'))
  console.log(chalk.white('  • Railway CLI: npm install -g @railway/cli'))
  console.log(chalk.white('  • Railway account: https://railway.app\n'))

  console.log(chalk.cyan('Steps:\n'))
  
  console.log(chalk.white('1. Login to Railway:'))
  console.log(chalk.gray('   railway login\n'))
  
  console.log(chalk.white('2. Initialize project:'))
  console.log(chalk.gray('   railway init\n'))
  
  console.log(chalk.white('3. Add environment variables:'))
  console.log(chalk.gray('   railway variables set OPENAI_API_KEY=your_key_here'))
  console.log(chalk.gray('   railway variables set PORT=3000\n'))
  
  console.log(chalk.white('4. Deploy:'))
  console.log(chalk.gray('   railway up\n'))

  console.log(chalk.green('Your voice agent will be available at the Railway URL!\n'))
}

function showRenderInstructions(): void {
  console.log(chalk.blue('\n🎨 Deploy to Render\n'))
  
  console.log(chalk.cyan('Steps:\n'))
  
  console.log(chalk.white('1. Push your code to GitHub'))
  console.log(chalk.gray('   git add .'))
  console.log(chalk.gray('   git commit -m "Initial commit"'))
  console.log(chalk.gray('   git push origin main\n'))
  
  console.log(chalk.white('2. Create a new Web Service on Render'))
  console.log(chalk.gray('   Go to https://dashboard.render.com\n'))
  
  console.log(chalk.white('3. Configure the service:'))
  console.log(chalk.gray('   • Build Command: npm install && npm run build'))
  console.log(chalk.gray('   • Start Command: npm start'))
  console.log(chalk.gray('   • Environment: Node'))
  console.log(chalk.gray('   • Plan: Starter (WebSocket support required)\n'))
  
  console.log(chalk.white('4. Add environment variables:'))
  console.log(chalk.gray('   • OPENAI_API_KEY'))
  console.log(chalk.gray('   • PORT=3000\n'))

  console.log(chalk.green('Render will auto-deploy on every push to GitHub!\n'))
}

function showFlyInstructions(): void {
  console.log(chalk.blue('\n🚀 Deploy to Fly.io\n'))
  
  console.log(chalk.cyan('Prerequisites:'))
  console.log(chalk.white('  • Fly CLI: brew install flyctl'))
  console.log(chalk.white('  • Fly account: https://fly.io\n'))

  console.log(chalk.cyan('Steps:\n'))
  
  console.log(chalk.white('1. Login to Fly:'))
  console.log(chalk.gray('   fly auth login\n'))
  
  console.log(chalk.white('2. Create app:'))
  console.log(chalk.gray('   fly launch --name my-voice-agent\n'))
  
  console.log(chalk.white('3. Set secrets:'))
  console.log(chalk.gray('   fly secrets set OPENAI_API_KEY=your_key_here\n'))
  
  console.log(chalk.white('4. Deploy:'))
  console.log(chalk.gray('   fly deploy\n'))

  console.log(chalk.green('Your voice agent will be available globally on Fly.io!\n'))
  
  console.log(chalk.cyan('Create a fly.toml file:\n'))
  console.log(chalk.gray(`app = "my-voice-agent"
primary_region = "iad"

[build]

[env]
  PORT = "8080"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
`))
}

function showDockerInstructions(): void {
  console.log(chalk.blue('\n🐳 Deploy with Docker\n'))

  console.log(chalk.cyan('Create a Dockerfile:\n'))
  console.log(chalk.gray(`FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
`))

  console.log(chalk.cyan('\nCreate docker-compose.yml (optional):\n'))
  console.log(chalk.gray(`version: '3.8'

services:
  voice-agent:
    build: .
    ports:
      - "3000:3000"
    environment:
      - OPENAI_API_KEY=\${OPENAI_API_KEY}
      - PORT=3000
    restart: unless-stopped
`))

  console.log(chalk.cyan('\nBuild and run:\n'))
  console.log(chalk.gray('  docker build -t my-voice-agent .'))
  console.log(chalk.gray('  docker run -p 3000:3000 -e OPENAI_API_KEY=your_key my-voice-agent\n'))
  console.log(chalk.gray('  # Or with docker-compose:'))
  console.log(chalk.gray('  docker-compose up -d\n'))

  console.log(chalk.green('Your voice agent is running in Docker!\n'))
}
