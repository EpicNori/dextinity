/**
 * Dextinity - Coder Agent
 *
 * Fourth in chain. Writes Antigravity code that transpiles to Luau.
 * Generates actual, functional game code - not placeholders.
 *
 * Ralph Wiggum Method: "I'm writing the code now! Each file does one thing!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Coder Agent for Dextinity, a Roblox game development system.
You write actual, functional Roblox Luau code for each file in the architecture.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "files": [
    {
      "path": "string - full path like ServerScriptService/Server/PlayerDataService.server.lua",
      "scriptType": "Script|LocalScript|ModuleScript",
      "antigravity": "string - the Antigravity source code for this file",
      "luau": "string - the final Luau code for this file",
      "description": "string - what this file does"
    }
  ],
  "narration": "string - explain what you coded and why"
}

CRITICAL CODING RULES:
1. Write REAL, FUNCTIONAL code. No placeholder comments like "-- TODO" or "-- implement later".
2. Every function must have a real implementation.
3. Use proper Roblox API calls: game:GetService(), Instance.new(), etc.
4. Server scripts must validate all client input.
5. DataStore code must handle errors with pcall.
6. UI code must create actual GUI elements programmatically.
7. Use ModuleScripts for shared logic - require() them properly.
8. Remote events must be created and connected properly.
9. Follow Roblox best practices:
   - Don't use wait(), use task.wait()
   - Don't use spawn(), use task.spawn()
   - Use :Connect() not :connect()
   - Players.PlayerAdded fires for each player
   - Clean up connections on player leaving
10. Include a reasonable amount of game content (items, configs, etc.)

For the Antigravity field, write code using Antigravity syntax:
- @ServiceName instead of game:GetService("ServiceName")
- var instead of local
- # for comments instead of --
- Arrow functions: (x) => x * 2
- on Event(args) do ... end for event connections

For the luau field, write the equivalent standard Roblox Luau code.`;

export class CoderAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Coder Agent',
      id: 'coder',
      description: 'Writes functional Antigravity and Luau code',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Time to write some code! Starting with the core systems...");

    const fileManifest = input.architecture?.fileManifest || [];
    const allFiles = [];

    // Process files in batches to avoid overwhelming the AI
    const batchSize = 6;
    for (let i = 0; i < fileManifest.length; i += batchSize) {
      const batch = fileManifest.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(fileManifest.length / batchSize);

      this.narrate(`Writing batch ${batchNum}/${totalBatches}: ${batch.map(f => f.path.split('/').pop()).join(', ')}`);

      const userMessage = `Write the code for these ${batch.length} files:

Game: ${input.gameTitle} (${input.gameType})
Core Loop: ${input.coreLoop}
Vibes: ${(input.vibes || []).join(', ')}

Files to write:
${batch.map(f => `- ${f.path} (${f.scriptType}): ${f.description}\n  Dependencies: ${(f.dependencies || []).join(', ') || 'none'}`).join('\n')}

All systems in this game:
${(input.plan?.systems || []).map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')}

Remote events available:
${(input.plan?.remoteEvents || []).map(r => `- ${r.name} (${r.direction})`).join('\n')}

Write complete, functional code for each file. No placeholders. No TODOs.
Every function must be implemented. Include actual game content and logic.`;

      const result = await this.callAI(userMessage, {
        intent: { gameTitle: input.gameTitle, gameType: input.gameType, coreLoop: input.coreLoop },
        plan: input.plan,
      });

      if (result.files) {
        allFiles.push(...result.files);
      }
    }

    this.narrate(`Done coding! Wrote ${allFiles.length} files with real, functional code.`);

    return { ...input, files: allFiles };
  }
}
