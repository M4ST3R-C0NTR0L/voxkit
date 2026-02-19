import { VoxAgent, OpenAIProvider } from 'voxkit'

/**
 * Basic Voice Agent Example
 * 
 * This is the simplest possible VoxKit voice agent.
 * It uses OpenAI's Realtime API for voice conversations.
 */

const agent = new VoxAgent({
  provider: new OpenAIProvider({
    model: 'gpt-4o-realtime-preview-2024-12-17',
    voice: 'alloy'
  }),
  voice: 'alloy',
  systemPrompt: 'You are a helpful, friendly assistant. Answer questions concisely and accurately.',
  enableLeadExtraction: true,
  
  // Event callbacks
  onTranscript: (text) => {
    console.log('🎤 User:', text)
  },
  
  onResponse: (text) => {
    console.log('🤖 Assistant:', text)
  },
  
  onLead: (lead, conversation) => {
    console.log('📋 Lead captured:')
    console.log('   Name:', lead.name || 'Not provided')
    console.log('   Email:', lead.email || 'Not provided')
    console.log('   Phone:', lead.phone || 'Not provided')
  },
  
  onError: (error, context) => {
    console.error(`❌ Error (${context}):`, error.message)
  },
  
  onConnect: (connected) => {
    console.log(connected ? '✅ Connected' : '❌ Disconnected')
  }
})

// Start the agent
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000

agent.listen(PORT)
  .then(() => {
    console.log(`\n🚀 Basic Voice Agent running!`)
    console.log(`🔗 WebSocket: ws://localhost:${PORT}`)
    console.log(`\n📖 Try connecting with a WebSocket client and sending audio data.`)
    console.log(`   The agent will respond with both text and audio.\n`)
  })
  .catch((error) => {
    console.error('Failed to start agent:', error)
    process.exit(1)
  })

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down...')
  await agent.stop()
  process.exit(0)
})
