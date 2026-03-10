<div align="center">

# 🎙️ CybrVox

**The open-source voice agent framework.**  
Build AI-powered voice agents in ~20 lines of TypeScript.

[![npm version](https://img.shields.io/npm/v/CybrVox.svg?style=flat-square)](https://www.npmjs.com/package/CybrVox)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Tests](https://img.shields.io/badge/tests-passing-brightgreen?style=flat-square)](#tests)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square&logo=node.js)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-orange?style=flat-square)](CONTRIBUTING.md)

[Quick Start](#quick-start) · [Examples](#examples) · [API Reference](#api-reference) · [Providers](#providers) · [Plugins](#plugins) · [Contributing](#contributing)

</div>

---

## What is CybrVox?

CybrVox is a TypeScript-first framework for building production-ready AI voice agents. It handles all the hard parts — WebSocket audio streaming, speech-to-text, text-to-speech, conversation state, lead extraction, and reconnection — so you can focus on what your agent *does*.

### Why CybrVox?

| Without CybrVox | With CybrVox |
|---|---|
| ❌ Wire up WebSocket servers manually | ✅ `agent.listen(3000)` |
| ❌ Handle audio buffering & VAD yourself | ✅ AudioPipeline handles it |
| ❌ Build conversation context from scratch | ✅ ConversationManager built-in |
| ❌ Write regex for lead extraction | ✅ LeadExtractor auto-runs |
| ❌ Implement reconnection logic | ✅ Automatic with exponential backoff |
| ❌ Learn 4 different provider APIs | ✅ One unified interface |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CybrVox Framework                        │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                       VoxAgent                          │   │
│  │   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │   │
│  │   │   WebSocket │  │ Conversation │  │    Lead      │  │   │
│  │   │   Server    │  │   Manager   │  │  Extractor   │  │   │
│  │   └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │   │
│  │          │                │                  │           │   │
│  │   ┌──────▼──────────────────────────────────▼──────┐    │   │
│  │   │              Audio Pipeline                     │    │   │
│  │   │   [Buffer] → [VAD] → [Format Conversion]       │    │   │
│  │   └──────────────────────┬──────────────────────────┘    │   │
│  └─────────────────────────┼────────────────────────────────┘   │
│                             │                                   │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │                    Provider Layer                         │  │
│  │  ┌───────────┐  ┌────────┐  ┌───────────┐  ┌──────────┐  │  │
│  │  │  OpenAI   │  │  xAI  │  │ Anthropic │  │ Deepgram │  │  │
│  │  │ Realtime  │  │  Grok  │  │  Claude   │  │  Nova-2  │  │  │
│  │  └───────────┘  └────────┘  └───────────┘  └──────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Plugin System                          │  │
│  │  [TranscriptLogger] [LeadWebhook] [Slack] [Metrics] ...   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

Client (Browser / Twilio / SIP)
    │
    │  WebSocket (ws://)
    │  Binary audio frames (PCM16)
    ▼
CybrVox Server
```

---

## Quick Start

### Installation

```bash
npm install CybrVox
# or
yarn add CybrVox
# or
pnpm add CybrVox
```

### Your first voice agent (20 lines)

```typescript
import { VoxAgent, OpenAIProvider } from 'CybrVox'

const agent = new VoxAgent({
  provider: new OpenAIProvider({ model: 'gpt-4o' }),
  voice: 'alloy',
  systemPrompt: 'You are a helpful assistant for a real estate company.',
  onTranscript: (text) => console.log('User said:', text),
  onLead:       (data) => saveLead(data),
})

agent.listen(3000)
```

That's it. Your agent is now:
- Accepting WebSocket audio connections on port 3000
- Transcribing speech with Whisper
- Generating responses with GPT-4o
- Speaking back with neural TTS
- Automatically extracting name, email, and phone from the conversation

---

## CLI

Scaffold, develop, and deploy with the `CybrVox` CLI.

```bash
# Create a new agent from a template
npx CybrVox init my-agent
npx CybrVox init my-agent --template real-estate --provider openai
npx CybrVox init my-agent --template customer-support --provider anthropic

# Run with hot reload (watches src/ for changes)
npx CybrVox dev
npx CybrVox dev --port 8080

# Deployment guide
npx CybrVox deploy
npx CybrVox deploy --platform railway
npx CybrVox deploy --platform render
npx CybrVox deploy --platform fly
npx CybrVox deploy --platform docker
```

Available templates: `basic` · `real-estate` · `customer-support`

---

## Examples

| Example | What it demonstrates |
|---|---|
| [`examples/basic-agent`](examples/basic-agent) | Minimal setup, one provider |
| [`examples/real-estate-agent`](examples/real-estate-agent) | Lead capture, CRM webhook, Slack notifications |
| [`examples/customer-support`](examples/customer-support) | Ticket creation, QA transcripts, support metrics |

```bash
cd examples/real-estate-agent
npm install
cp .env.example .env   # add your OpenAI key
npm run dev
```

---

## API Reference

### `new VoxAgent(config)`

The main class. Creates a fully configured voice agent.

```typescript
const agent = new VoxAgent({
  // Required
  provider: new OpenAIProvider({ model: 'gpt-4o' }),

  // Voice & persona
  voice: 'alloy',              // 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
  systemPrompt: 'You are…',   // LLM system prompt

  // Features
  enableLeadExtraction: true,         // Auto-extract name/email/phone (default: true)
  maxConversationDuration: 3600,      // Max call duration in seconds (default: 3600)
  silenceTimeoutMs: 30_000,           // End call after N ms of silence (default: 30000)

  // Audio
  audioConfig: {
    sampleRate: 24000,    // Default: 24000
    channels: 1,          // Default: 1 (mono)
    format: 'pcm16',      // 'pcm16' | 'g711_ulaw' | 'g711_alaw'
  },

  // Event callbacks
  onTranscript: (text, segment)        => { /* user spoke */ },
  onResponse:   (text, response)       => { /* agent replied */ },
  onLead:       (lead, conversation)   => { /* contact info captured */ },
  onError:      (error, context)       => { /* something went wrong */ },
  onConnect:    (connected)            => { /* connection state changed */ },
})
```

### Instance methods

```typescript
// Start the WebSocket server (most common usage)
await agent.listen(3000)
await agent.listen(3000, '0.0.0.0')

// Stop gracefully (drains connections, extracts final lead)
await agent.stop()

// Connect/disconnect the AI provider directly (no WS server)
await agent.connect()
await agent.disconnect()

// Send text without audio (useful for testing or text-only clients)
await agent.sendText('Hello, can you help me?')

// Plugin system
agent.use(new TranscriptLoggerPlugin())

// Retrieve state
agent.getTranscript()          // Full conversation as plain text
agent.exportConversation()     // Full conversation as JSON
agent.getCurrentLead()         // Best lead captured so far
agent.conversation             // ConversationState object
agent.isConnected              // boolean
```

### Events

```typescript
agent.on('transcript',      (text, segment)      => {})
agent.on('response',        (text, response)     => {})
agent.on('lead',            (lead, conversation) => {})
agent.on('error',           (error, context)     => {})
agent.on('connect',         (connected)          => {})
agent.on('disconnect',      ()                   => {})
agent.on('silenceTimeout',  (conversation)       => {})
agent.on('clientConnect',   (wsClient)           => {})
agent.on('clientDisconnect',(wsClient)           => {})
```

---

## Providers

All providers implement the `AIProvider` interface. Swap them with zero changes to your agent code.

### OpenAI (Realtime API) — best for voice

```typescript
import { OpenAIProvider } from 'CybrVox'

new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY,   // or set OPENAI_API_KEY env var
  model:  'gpt-4o-realtime-preview-2024-12-17',
  voice:  'alloy',
  temperature: 0.8,
  maxResponseOutputTokens: 4096,
})
```

Supported voices: `alloy` `echo` `fable` `onyx` `nova` `shimmer` `ash` `ballad` `coral` `sage` `verse`

### xAI / Grok

```typescript
import { XAIProvider } from 'CybrVox/providers'

new XAIProvider({
  apiKey: process.env.XAI_API_KEY,
  model: 'grok-2-1212',
  streaming: true,
})
```

### Anthropic / Claude

```typescript
import { AnthropicProvider } from 'CybrVox/providers'

new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  maxTokens: 4096,
  streaming: true,
})
```

### Deepgram (STT-only)

```typescript
import { DeepgramProvider } from 'CybrVox/providers'

new DeepgramProvider({
  apiKey: process.env.DEEPGRAM_API_KEY,
  model: 'nova-2',
  language: 'en-US',
  smartFormat: true,
  punctuate: true,
})
```

### Build your own provider

```typescript
import type { AIProvider, Voice, TranscriptSegment, ProviderResponse } from 'CybrVox'

class MyCustomProvider implements AIProvider {
  name = 'my-provider'

  async initialize(): Promise<void> { /* set up */ }
  async connect():    Promise<void> { /* open connection */ }
  async disconnect(): Promise<void> { /* close connection */ }

  async sendAudio(audio: Uint8Array): Promise<void> { /* stream audio */ }
  async sendText(text: string):       Promise<void> { /* send text */ }

  onResponse(cb: (r: ProviderResponse) => void):   void { /* register */ }
  onTranscript(cb: (s: TranscriptSegment) => void): void { /* register */ }
  onError(cb: (e: Error) => void):                 void { /* register */ }

  getSupportedVoices(): Voice[] { return ['alloy'] }
  setVoice(voice: Voice): void  { /* update */ }
}

// Use it just like any built-in provider:
const agent = new VoxAgent({ provider: new MyCustomProvider() })
```

---

## Plugins

Plugins extend VoxAgent's capabilities via lifecycle hooks.

### Built-in plugins

```typescript
import {
  TranscriptLoggerPlugin,
  LeadWebhookPlugin,
  SlackNotifierPlugin,
  MetricsPlugin
} from 'CybrVox'

// Save full transcripts to disk (JSONL)
agent.use(new TranscriptLoggerPlugin({
  filePath: './transcripts.jsonl',
  timestamps: true,
  tag: '[call]'
}))

// POST leads to any HTTP endpoint
agent.use(new LeadWebhookPlugin({
  url:     'https://your-crm.com/api/leads',
  secret:  process.env.CRM_SECRET,
  retries: 3
}))

// Ping Slack on every captured lead
agent.use(new SlackNotifierPlugin({
  webhookUrl: process.env.SLACK_WEBHOOK_URL,
  emoji: ':telephone_receiver:'
}))

// Track session metrics
const metrics = new MetricsPlugin({ printSummary: true })
agent.use(metrics)
// Later: metrics.getMetrics() → { turnCount, durationMs, leadCaptured, ... }
```

### Write your own plugin

```typescript
import type { CybrVoxPlugin, VoxAgent, ConversationMessage, LeadInfo } from 'CybrVox'

class MyCRMPlugin implements CybrVoxPlugin {
  name = 'my-crm'

  initialize(agent: VoxAgent): void {
    console.log('CRM plugin ready')
  }

  onMessage(message: ConversationMessage): void {
    // runs on every conversation turn
  }

  onLead(lead: LeadInfo): void {
    // runs when contact info is captured
    myCRM.createContact(lead)
  }

  async destroy(): Promise<void> {
    // cleanup on agent.stop()
  }
}

agent.use(new MyCRMPlugin())
```

---

## Lead Extraction

CybrVox automatically extracts contact information from natural speech — no regex work required.

```typescript
// Automatically detected patterns:
// "My name is Sarah Johnson"     → { name: 'Sarah Johnson' }
// "Email me at hello@example.com" → { email: 'hello@example.com' }
// "Call me at 415-555-1234"       → { phone: '+14155551234' }
// "I work at Acme Corp"           → { company: 'Acme Corp' }

agent.on('lead', (lead) => {
  console.log(lead)
  // {
  //   name:    'Sarah Johnson',
  //   email:   'sarah@example.com',
  //   phone:   '+14155551234',
  //   company: 'Acme Corp',
  //   confidence: { name: 0.85, email: 1.0, phone: 1.0 }
  // }
})
```

Lead extraction is additive — it builds up across multiple turns and fires `onLead` as new info arrives. You can also call `agent.getCurrentLead()` at any time.

---

## Types

CybrVox is fully typed. Key interfaces:

```typescript
interface LeadInfo {
  name?:    string
  email?:   string
  phone?:   string
  company?: string
  notes?:   string
  confidence: { name?: number; email?: number; phone?: number }
}

interface ConversationState {
  id:             string
  messages:       ConversationMessage[]
  isActive:       boolean
  startedAt:      number
  lastActivityAt: number
  metadata?:      Record<string, unknown>
}

interface ConversationMessage {
  role:      'system' | 'user' | 'assistant' | 'function'
  content:   string
  timestamp?: number
  metadata?:  Record<string, unknown>
}

interface TranscriptSegment {
  id:         string
  text:       string
  isFinal:    boolean
  timestamp:  number
  speaker?:   string
  confidence?: number
}
```

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENAI_API_KEY` | For OpenAI provider | Your OpenAI API key |
| `XAI_API_KEY` | For xAI provider | Your xAI API key |
| `ANTHROPIC_API_KEY` | For Anthropic provider | Your Anthropic API key |
| `DEEPGRAM_API_KEY` | For Deepgram provider | Your Deepgram API key |
| `PORT` | No | Server port (default: 3000) |
| `VOXKIT_DEBUG` | No | Enable debug logging (`true`/`false`) |

---

## Tests

```bash
# Run all tests
npm test

# Watch mode
npm test -- --watch

# Coverage report
npm run test:coverage
```

CybrVox uses [Vitest](https://vitest.dev/) and targets >90% coverage of core modules.

---

## Deployment

### Railway (recommended)

```bash
npm install -g @railway/cli
railway login
railway init
railway variables set OPENAI_API_KEY=sk-...
railway up
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/agent.js"]
```

```bash
docker build -t my-voice-agent .
docker run -p 3000:3000 -e OPENAI_API_KEY=sk-... my-voice-agent
```

### Render / Fly.io

```bash
npx CybrVox deploy --platform render
npx CybrVox deploy --platform fly
```

---

## Project Structure

```
CybrVox/
├── src/
│   ├── index.ts                  # Main exports
│   ├── voxagent.ts               # VoxAgent class
│   ├── types.ts                  # All TypeScript types
│   ├── logger.ts                 # Internal logger
│   ├── core/
│   │   ├── audio-pipeline.ts     # Audio streaming & buffering
│   │   ├── conversation-manager.ts # Conversation state
│   │   ├── lead-extractor.ts     # Contact info extraction
│   │   └── websocket-server.ts   # WS server with heartbeats
│   ├── providers/
│   │   ├── openai.ts             # OpenAI Realtime API
│   │   ├── xai.ts                # xAI / Grok
│   │   ├── anthropic.ts          # Anthropic Claude
│   │   ├── deepgram.ts           # Deepgram STT
│   │   └── index.ts
│   ├── plugins/
│   │   ├── transcript-logger.ts  # JSONL transcript logging
│   │   ├── lead-webhook.ts       # HTTP lead delivery
│   │   ├── slack-notifier.ts     # Slack lead notifications
│   │   ├── metrics.ts            # Session metrics
│   │   └── index.ts
│   └── cli/
│       ├── index.ts              # CLI entry point
│       └── commands/
│           ├── init.ts           # CybrVox init
│           ├── dev.ts            # CybrVox dev
│           ├── deploy.ts         # CybrVox deploy
│           └── version.ts        # CybrVox version
├── tests/
│   ├── core/
│   │   ├── audio-pipeline.test.ts
│   │   ├── conversation-manager.test.ts
│   │   └── lead-extractor.test.ts
│   ├── plugins/
│   │   ├── metrics.test.ts
│   │   └── transcript-logger.test.ts
│   └── providers/
│       └── lead-extractor-edge-cases.test.ts
├── examples/
│   ├── basic-agent/              # Minimal example
│   ├── real-estate-agent/        # Lead capture + CRM
│   └── customer-support/         # Ticketing + QA
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
└── README.md
```

---

## Contributing

Contributions are welcome! Here's how to get started:

```bash
git clone https://github.com/CybrVox/CybrVox.git
cd CybrVox
npm install
npm run dev          # watch mode build
npm test             # run tests
```

**Good first issues:**
- Add a new provider (ElevenLabs, Twilio, Groq…)
- Add a new plugin (HubSpot, Salesforce, Discord…)
- Improve VAD accuracy in AudioPipeline
- Add WebRTC support

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a PR.

---

## Roadmap

- [ ] WebRTC support (browser ↔ agent directly)
- [ ] Twilio Media Streams integration
- [ ] ElevenLabs TTS provider
- [ ] Groq Whisper STT provider
- [ ] Multi-language support
- [ ] Call recording & playback
- [ ] Built-in phone number provisioning
- [ ] Dashboard UI for monitoring live calls
- [ ] Multi-agent orchestration

---

## License

MIT © [CybrVox](https://github.com/CybrVox/CybrVox)

---

<div align="center">
  <strong>Built with ❤️ for the open-source community.</strong><br/>
  <sub>Star ⭐ this repo if CybrVox saved you time!</sub>
</div>
