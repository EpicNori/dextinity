/**
 * Dextinity - Intent Agent
 *
 * First in the chain. Interprets user goals and translates them
 * into a structured game intent specification.
 *
 * Ralph Wiggum Method: "I'm reading what you want and figuring out the game!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Intent Agent for Dextinity, a Roblox game development system.
Your job is to interpret the user's game description and produce a structured intent specification.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "gameTitle": "string - a catchy game title",
  "gameType": "string - simulator|obby|tycoon|rpg|horror|battleRoyale|sandbox|social|racing|puzzle|custom",
  "coreLoop": "string - one sentence describing the main gameplay loop",
  "vibes": ["string array - aesthetic/mood keywords like 'neon', 'chill', 'fast-paced'"],
  "targetSystems": ["string array - game systems needed: 'datastore', 'shop', 'inventory', 'pets', 'combat', 'progression', 'monetization', 'leaderboard', 'ui', 'multiplayer', 'anticheat', 'map', 'npc', 'quests'"],
  "complexity": "simple|medium|complex",
  "narration": "string - explain your reasoning in plain, simple language (Ralph Wiggum style - think childlike clarity)"
}

Be thorough in identifying needed systems. A simulator needs datastores, progression, UI, and usually pets/rebirth.
An obby needs checkpoints, stages, a timer, and leaderboards.

Always include 'map' and 'ui' in targetSystems - every game needs them.

Think simple first, then make sure you haven't missed important systems.`;

export class IntentAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Intent Agent',
      id: 'intent',
      description: 'Interprets user goals into structured game intent',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("I'm looking at what you want to build... let me figure this out!");

    const { prompt, mode, options } = input;

    let userMessage = '';

    if (mode === 'vibe') {
      userMessage = `The user described their game with a vibe/mood. Interpret this into a full game concept.
User's vibe: "${prompt}"

Think about what game mechanics match this vibe. Be creative but practical.`;
    } else if (mode === 'detailed') {
      const optList = options
        ? `\nRequested features: ${Object.entries(options).filter(([,v]) => v).map(([k]) => k).join(', ')}`
        : '';
      userMessage = `The user gave a detailed game description. Parse it into a structured intent.
User's description: "${prompt}"${optList}`;
    } else if (mode === 'upload') {
      userMessage = `The user uploaded an existing project and wants improvements.
Improvement request: "${prompt}"
Existing files: ${JSON.stringify(input.uploadedFiles?.map(f => f.name) || [])}

Analyze what type of game this is and what the improvement intent is.`;
    }

    const result = await this.callAI(userMessage);

    if (result.narration) {
      this.narrate(result.narration);
    } else {
      this.narrate(`Got it! This is a ${result.gameType || 'custom'} game called "${result.gameTitle || 'Untitled'}".`);
    }

    return result;
  }
}
