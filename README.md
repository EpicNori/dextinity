# Dextinity

Autonomous Roblox game development system powered by AI agent chains.

## What It Does

Dextinity is a browser-based tool that generates complete, playable Roblox games from natural language descriptions. It uses a multi-agent AI pipeline to design, code, validate, test, and improve games automatically.

## Features

- **VibeCode Mode** - Describe a game mood ("chill pet simulator with neon island") and get a full game
- **Detailed Mode** - Specify exact systems (DataStore, shop, combat, UI) with fine control
- **Project Upload & Improve** - Upload existing Roblox projects for automatic analysis and improvement
- **7-Agent Chain** - Intent, Planner, Architect, Coder, Roblox Adapter, Tester, Improver
- **Antigravity DSL** - High-level language that transpiles to Roblox Luau
- **Roblox Studio Export** - ZIP with Luau files, Rojo project, RBXMX model, and import instructions
- **Iterative Self-Improvement** - Test/improve loop runs multiple passes to raise quality
- **Agent Narration** - Every agent explains its reasoning in plain language (Ralph Wiggum Method)

## Quick Start

1. Open `index.html` in a browser
2. Click the gear icon and add your AI API key (Anthropic Claude or OpenAI)
3. Type a game description or pick a preset
4. Click **Generate Game**
5. Watch the agent chain work through each stage
6. Click **Export to Roblox** to download the project

## Architecture

```
src/
  agents/          # 7 specialized AI agents + chain orchestrator
    base-agent.js     Base class with AI calling and narration
    intent-agent.js   Interprets user goals
    planner-agent.js  Designs game systems
    architect-agent.js Designs file structure
    coder-agent.js    Writes Antigravity + Luau code
    adapter-agent.js  Validates Roblox compatibility
    tester-agent.js   Simulates play sessions
    improver-agent.js Fixes issues and upgrades
    chain.js          Orchestrates the full pipeline
  core/
    api.js            Provider-agnostic AI API client
    memory.js         Persistent memory between sessions
  transpiler/
    antigravity.js    Antigravity DSL to Luau transpiler
  export/
    roblox-export.js  ZIP/RBXMX/Rojo export
  ui/
    app.js            Main application logic
    styles.css        UI styles
```

## API Key Security

Your API key is stored only in your browser's `localStorage`. It is never sent anywhere except directly to your chosen AI provider (Anthropic or OpenAI). No backend server is involved.

## Supported AI Providers

- **Anthropic** (Claude) - Recommended
- **OpenAI** (GPT-4o, etc.)
- **Custom** - Any OpenAI-compatible endpoint
