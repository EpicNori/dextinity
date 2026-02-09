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
      maxTokens: 12288,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Time to plan! I'm figuring out all the systems we need...");

    // Build creative context if the Creative Agent expanded the concept
    let creativeContext = '';
    if (input.creativeExpansion) {
      const ce = input.creativeExpansion;
      const mechanics = (ce.uniqueMechanics || [])
        .map(m => `- ${m.name}: ${m.description}`)
        .join('\n');
      const ideas = (ce.generativeIdeas || [])
        .map(idea => `- ${idea}`)
        .join('\n');
      creativeContext = `

Creative Direction (from Creative Agent):
Unique Mechanics to implement:
${mechanics || '(none)'}

Player Fantasy: ${ce.playerFantasy || 'N/A'}
Visual Style: ${ce.atmosphere?.visualStyle || 'N/A'}
World Building: ${ce.thematicElements?.worldBuilding || 'N/A'}

Generative Ideas to consider:
${ideas || '(none)'}

Incorporate these creative elements into the system design where they add genuine gameplay value.`;
    }

    const userMessage = `Plan the systems for this game:

Game Title: ${input.gameTitle}
Game Type: ${input.gameType}
Core Loop: ${input.coreLoop}
Vibes: ${(input.vibes || []).join(', ')}
Target Systems: ${(input.targetSystems || []).join(', ')}
Complexity: ${input.complexity}${creativeContext}

Break this down into specific Roblox systems with clear responsibilities and data flow.
Make sure every system is accounted for and nothing critical is missing.`;

    let result = await this.callAI(userMessage);

    // If JSON parsing failed (returned { raw: ... }), try to salvage structured data
    if (result.raw && !result.systems) {
      this.narrate('Warning: AI returned non-JSON response. Attempting to extract plan...');
      result = this._extractPlanFromRaw(result.raw, input);
    }

    // If we still have no systems, generate a minimal plan from the input
    if (!result.systems || result.systems.length === 0) {
      this.narrate('Warning: No systems in AI response. Generating default plan from input...');
      result = this._generateDefaultPlan(input);
    }

    if (result.narration) {
      this.narrate(result.narration);
    } else {
      const count = result.systems?.length || 0;
      this.narrate(`Plan ready! We need ${count} systems with ${result.remoteEvents?.length || 0} remote events.`);
    }

    return { ...input, plan: result };
  }

  /**
   * Try to extract a plan from raw text when JSON parsing fails.
   * Looks for system-like patterns in the text.
   */
  _extractPlanFromRaw(raw, input) {
    // The raw text might contain the plan described in prose.
    // We can't reliably parse prose into structured data,
    // so fall through to default plan generation.
    return { raw, systems: [], dataFlow: [], remoteEvents: [] };
  }

  /**
   * Generate a reasonable default plan based on game type when the AI fails.
   */
  _generateDefaultPlan(input) {
    const gameType = (input.gameType || 'custom').toLowerCase();
    const targetSystems = input.targetSystems || [];

    // Core systems every game needs
    const systems = [
      { name: 'GameInit', type: 'server', description: 'Server initialization and game setup', dependencies: [], priority: 'core' },
      { name: 'PlayerData', type: 'server', description: 'Player data saving/loading with DataStore', dependencies: [], priority: 'core' },
      { name: 'UIController', type: 'client', description: 'Client-side UI management', dependencies: [], priority: 'core' },
      { name: 'Config', type: 'shared', description: 'Shared game configuration and constants', dependencies: [], priority: 'core' },
    ];

    // Game-type specific systems
    const typeSystemMap = {
      simulator: [
        { name: 'Currency', type: 'server', description: 'Currency earning and spending', dependencies: ['PlayerData'], priority: 'core' },
        { name: 'Progression', type: 'server', description: 'Player progression and leveling', dependencies: ['PlayerData'], priority: 'core' },
        { name: 'Rebirth', type: 'server', description: 'Rebirth/prestige system', dependencies: ['PlayerData', 'Currency'], priority: 'important' },
        { name: 'Collection', type: 'server', description: 'Collectibles/pets system', dependencies: ['PlayerData'], priority: 'important' },
        { name: 'Shop', type: 'server', description: 'In-game shop for purchases', dependencies: ['Currency'], priority: 'important' },
      ],
      obby: [
        { name: 'Checkpoint', type: 'server', description: 'Checkpoint and spawn management', dependencies: ['PlayerData'], priority: 'core' },
        { name: 'Stage', type: 'server', description: 'Stage/level management', dependencies: ['Checkpoint'], priority: 'core' },
        { name: 'Timer', type: 'server', description: 'Speed-run timer system', dependencies: [], priority: 'important' },
        { name: 'Leaderboard', type: 'server', description: 'Time-based leaderboard', dependencies: ['Timer', 'PlayerData'], priority: 'important' },
      ],
      tycoon: [
        { name: 'Tycoon', type: 'server', description: 'Tycoon base and ownership', dependencies: ['PlayerData'], priority: 'core' },
        { name: 'Income', type: 'server', description: 'Income generation system', dependencies: ['Tycoon'], priority: 'core' },
        { name: 'Upgrades', type: 'server', description: 'Tycoon upgrades and unlocks', dependencies: ['Tycoon', 'Income'], priority: 'core' },
        { name: 'Dropper', type: 'server', description: 'Dropper/conveyor mechanics', dependencies: ['Tycoon'], priority: 'important' },
      ],
    };

    if (typeSystemMap[gameType]) {
      systems.push(...typeSystemMap[gameType]);
    }

    // Add systems from targetSystems that aren't already covered
    for (const target of targetSystems) {
      const normalized = target.toLowerCase();
      if (!systems.some(s => s.name.toLowerCase() === normalized)) {
        systems.push({
          name: target.charAt(0).toUpperCase() + target.slice(1),
          type: ['ui', 'map', 'effects'].includes(normalized) ? 'client' : 'server',
          description: `${target} system`,
          dependencies: [],
          priority: 'important',
        });
      }
    }

    const remoteEvents = [
      { name: 'PlayerDataUpdate', direction: 'serverToClient', payload: 'Updated player data' },
      { name: 'UIAction', direction: 'clientToServer', payload: 'UI button/action events' },
    ];

    return {
      systems,
      dataFlow: [],
      remoteEvents,
      narration: `Generated a default ${gameType} plan with ${systems.length} systems since AI response parsing failed.`,
    };
  }
}
