/**
 * Dextinity - Planner Agent
 *
 * Second in chain. Takes intent and breaks it down into
 * concrete Roblox systems, modules, and their relationships.
 *
 * Ralph Wiggum Method: "I'm making a list of all the things we need!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Planner Agent for Dextinity, a Roblox game development system.
You receive a game intent specification and break it down into concrete systems and modules.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "systems": [
    {
      "name": "string - system name (e.g., 'PlayerData', 'Shop', 'Combat')",
      "type": "server|client|shared",
      "description": "string - what this system does",
      "dependencies": ["string array - other system names this depends on"],
      "priority": "core|important|nice-to-have"
    }
  ],
  "dataFlow": [
    {
      "from": "string - source system",
      "to": "string - target system",
      "data": "string - what data flows between them",
      "method": "RemoteEvent|RemoteFunction|ModuleRequire|BindableEvent"
    }
  ],
  "remoteEvents": [
    {
      "name": "string - event name",
      "direction": "serverToClient|clientToServer|bidirectional",
      "payload": "string - description of data sent"
    }
  ],
  "narration": "string - explain your plan in plain language"
}

CRITICAL RULES:
- Every game needs: GameInit (server), PlayerData (server), UIController (client), Config (shared)
- Simulators need: Currency, Progression, Rebirth, Pets/Collection systems
- Obbies need: Checkpoint, Stage, Timer, Leaderboard systems
- Tycoons need: Tycoon, Income, Upgrades, Dropper systems
- DataStore systems must handle saving/loading on join/leave and auto-save
- Always separate server authority from client display
- Remote events must be validated server-side
- Keep systems focused - one responsibility each`;

export class PlannerAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Planner Agent',
      id: 'planner',
      description: 'Breaks intent into concrete systems and modules',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Time to plan! I'm figuring out all the systems we need...");

    const userMessage = `Plan the systems for this game:

Game Title: ${input.gameTitle}
Game Type: ${input.gameType}
Core Loop: ${input.coreLoop}
Vibes: ${(input.vibes || []).join(', ')}
Target Systems: ${(input.targetSystems || []).join(', ')}
Complexity: ${input.complexity}

Break this down into specific Roblox systems with clear responsibilities and data flow.
Make sure every system is accounted for and nothing critical is missing.`;

    const result = await this.callAI(userMessage, { intent: input });

    if (result.narration) {
      this.narrate(result.narration);
    } else {
      const count = result.systems?.length || 0;
      this.narrate(`Plan ready! We need ${count} systems with ${result.remoteEvents?.length || 0} remote events.`);
    }

    return { ...input, plan: result };
  }
}
