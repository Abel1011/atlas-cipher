# Atlas Cipher

Atlas Cipher is a browser-based, voice-first detective experience built in Zed for a Zed + ElevenLabs hackathon.

You play as a field agent working a global investigation: receive a mission from your handler, travel between cities, question witnesses in live voice conversations, gather evidence, manage pressure, and decide who to arrest before the case collapses.

Atlas Cipher was designed to show what happens when voice is treated as the main mechanic, not as decoration. The strongest moments in the game come from speaking with characters, hearing the world respond, and feeling the case tighten around each decision.

## How Zed Was Used To Build Atlas Cipher

Zed is a core part of how Atlas Cipher was developed.

This project moved quickly between concept, interface, logic, and voice behavior. Zed made that possible by giving the project one fast workspace where the app could be shaped while it was being written.

Atlas Cipher was vibecoded in Zed using its AI-native workflow to iterate on both the product and the implementation at the same time.

In practice, the Zed AI functions that mattered most were:

- agentic editing for moving across frontend screens, backend routes, and voice orchestration without treating them like separate silos
- inline AI assistance for rewriting mission framing, witness tone, prompt language, and product copy directly in place
- edit prediction for accelerating repetitive TypeScript, UI, and flow changes while the playable loop was still evolving
- fast multi-file iteration for keeping interface changes, backend behavior, and voice logic aligned during rapid vibecoding

That let Atlas Cipher evolve as one cohesive experience instead of a disconnected stack of features. For this hackathon, Zed represents the AI-assisted development environment and ElevenLabs represents the live voice experience the player actually feels.

## Why ElevenLabs Is At The Center

ElevenLabs is the backbone of the experience. Atlas Cipher is not a text adventure with audio layered on top. The project uses ElevenLabs to make the player feel connected to real characters, real tension, and a living investigation flow.

The product goal is simple: the player should feel like they are inside an international intelligence operation, not clicking through static dialogue trees.

## How ElevenLabs APIs Are Used

### 1. Conversational AI For Live Characters

The live handler and witness interactions are powered by ElevenLabs Conversational AI. This allows Atlas Cipher to present its most important characters as spoken, reactive voices instead of scripted button menus.

That changes the feel of the game in three ways:

- the handler can brief, pressure, and redirect the player in a more natural way
- witnesses feel like people under stress, not database entries
- the act of gathering evidence becomes performance-driven, not only UI-driven

### 2. Agent Provisioning And Browser Sessions

The backend creates and refreshes ElevenLabs conversational agents for the handler and witnesses, then requests signed browser session URLs so the frontend can open live voice channels safely.

This gives the project role-specific behavior:

- the handler can sound precise, composed, and mission-focused
- witnesses can have distinct personalities and attitudes
- each voice channel can be shaped around the current investigation context

### 3. Text To Speech For Mission Delivery

ElevenLabs Text to Speech is used for spoken mission delivery and other narrated moments where the game needs clean, intentional audio output.

This helps Atlas Cipher feel more like a premium briefing experience than a prototype with placeholder voice.

### 4. Sound Generation For Atmosphere

ElevenLabs Sound Generation is used to produce ambient and interface-oriented audio such as travel cues, comms moments, and investigation atmosphere.

That matters because Atlas Cipher depends on mood. The player is supposed to hear the difference between an active case board, a city visit, a comms connection, and a major outcome.

### 5. Voice Design For Character Identity

ElevenLabs voice design workflows are used to shape witness voices so the cast does not collapse into one generic tone.

That allows the project to build a stronger identity for each witness and keep the world feeling broader, more human, and more memorable.

### 6. Speech Work Beyond The Main Loop

The primary experience is the live browser conversation flow, but the project also keeps support for other speech-oriented paths where transcription or alternate voice processing may be useful.

## What The Player Experiences

Atlas Cipher currently delivers a complete investigation loop:

- receive a mission from a live handler
- review a case file
- travel across multiple cities
- question witnesses through live voice
- gather clues and separate signal from noise
- manage time, money, and support pressure
- issue an arrest warrant
- win, fail, or abandon the case based on your decisions

## Why The Demo Lands

Atlas Cipher works well as a hackathon demo because it does not only mention voice AI. It makes voice the center of pacing, tone, and decision making.

The project combines:

- live character interaction
- strong atmosphere
- replayable missions
- global investigation fantasy
- AI-assisted content generation around the core voice loop

## Running The Project Locally

### Requirements

- Node.js 22 or newer
- npm
- ElevenLabs API key
- Azure OpenAI credentials

### Local Setup

1. Install backend dependencies.

```bash
cd backend
npm install
```

2. Create the backend environment file from `backend/.env.example`.

Required keys:

- `ELEVENLABS_API_KEY`
- `AZURE_OPENAI_ENDPOINT`
- `AZURE_OPENAI_API_KEY`

3. Install frontend dependencies.

```bash
cd frontend
npm install
```

4. Start the backend.

```bash
cd backend
npm run dev
```

5. Start the frontend.

```bash
cd frontend
npm run dev
```

The app uses the frontend dev server locally, while API requests are proxied to the backend.

## Docker Deployment

This repository includes a single-container Docker setup. The image builds the frontend, packages the backend, and serves the compiled frontend and API from the same Hono server on port `3000`.

### Build The Image

```bash
docker build -t atlas-cipher .
```

### Run The Container

```bash
docker run --env-file backend/.env -p 3000:3000 atlas-cipher
```

At runtime, the container expects the same backend environment variables used in local development.

## Atlas Cipher In One Sentence

Atlas Cipher is a voice-first detective game where ElevenLabs is not just a feature provider, but the core medium through which the player experiences the investigation.