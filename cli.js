#!/usr/bin/env node

/**
 * Dextinity CLI
 * 
 * Command-line interface for the Dextinity Agent Chain.
 * Allows running the agent loop headlessly and saving files to disk.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Polyfill localStorage BEFORE importing api.js
if (typeof localStorage === 'undefined') {
    global.localStorage = {
        _data: {},
        getItem(key) { return this._data[key] || null; },
        setItem(key, value) { this._data[key] = String(value); },
        removeItem(key) { delete this._data[key]; },
        clear() { this._data = {}; }
    };
}

// Polyfill performance.now if needed (Node < 16, though usually present in modern Node)
if (typeof performance === 'undefined') {
    global.performance = { now: () => Date.now() };
}

// Import core modules
import { apiClient } from './src/core/api.js';
import { AgentChain } from './src/agents/chain.js';

// --- Configuration ---

const API_KEY = process.env.DEXTINITY_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;
const OUTPUT_DIR = path.resolve(process.cwd(), 'output');

// --- Helper Functions ---

function log(agent, message) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${agent}] ${message}`);
}

async function saveFiles(files) {
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    log('System', `Saving ${files.length} files to ${OUTPUT_DIR}...`);

    for (const file of files) {
        // Determine full path
        // valid paths: 'src/server/init.server.lua', 'Workspace/Part.json', etc.
        // We treat the file.path as relative to OUTPUT_DIR
        const safePath = file.path.replace(/^(\/|\\)+/, ''); // remove leading slashes
        const fullPath = path.join(OUTPUT_DIR, safePath);
        const dir = path.dirname(fullPath);

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, file.luau || file.content || '');
        log('System', `Saved: ${safePath}`);
    }
}

// --- Main Execution ---

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];
    const prompt = args[1]; // e.g. "Create a tycoon game"

    if (!command || (command === 'task' && !prompt)) {
        console.log(`
Usage:
  node cli.js task "Your game description"
  
Environment Variables:
  DEXTINITY_API_KEY  - Your API Key (Anthropic or OpenAI)
    `);
        process.exit(1);
    }

    // Configure API Client
    const API_KEY = process.env.DEXTINITY_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!API_KEY) {
        console.error('Error: No API key found. Set DEXTINITY_API_KEY environment variable.');
        process.exit(1);
    }

    // Auto-detect provider based on key format or default to anthropic
    let provider = 'anthropic';
    let model = 'claude-sonnet-4-20250514';

    if (API_KEY.startsWith('sk-proj') || API_KEY.startsWith('sk-')) {
        provider = 'openai';
        model = 'gpt-4o';
    } else if (API_KEY.startsWith('sk-ant')) {
        provider = 'anthropic';
    }

    // Save settings so apiClient picks them up
    apiClient.saveSettings({
        provider,
        apiKey: API_KEY,
        model,
        maxIterations: 3,
        creativity: 0.5
    });

    console.log(`[System] Starting task: "${prompt}"`);
    console.log(`[System] Provider: ${provider} (${model})`);

    // Initialize Chain
    const chain = new AgentChain({
        onNarrate: (entry) => {
            const timestamp = new Date().toISOString();
            console.log(`[${timestamp}] [${entry.agentName}] ${entry.message}`);
        },
        onAgentError: (id, err) => console.error(`[ERROR] ${id}:`, err),
        onChainError: (err) => console.error(`[FATAL]:`, err)
    });

    try {
        const input = {
            prompt,
            mode: 'vibe' // Default to vibe mode for CLI
        };

        console.log('[System] Running agent chain...');
        const result = await chain.run(input);

        if (result.files && result.files.length > 0) {
            await saveFiles(result.files);
            console.log('[System] Done! Files saved to output/ directory.');
            process.exit(0);
        } else {
            console.log('[System] Warning: Chain finished but produced no files.');
            process.exit(0);
        }

    } catch (error) {
        console.error('Execution Failed:', error);
        process.exit(1);
    }
}

main();
