# Basic Voice Agent Example

This is the simplest possible VoxKit voice agent.

## Setup

```bash
npm install
```

## Environment Variables

Create a `.env` file:

```
OPENAI_API_KEY=your_openai_api_key
PORT=3000
```

## Run

```bash
# Development mode with hot reload
npm run dev

# Or build and run
npm run build
npm start
```

## Usage

Connect via WebSocket to `ws://localhost:3000` and send audio data.

The agent will:
- Transcribe speech using OpenAI's Whisper
- Generate responses using GPT-4o
- Speak responses using OpenAI's TTS
- Automatically extract contact information (name, email, phone)
