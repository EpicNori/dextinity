/**
 * Dextinity - Architect Agent
 *
 * Third in chain. Designs the folder structure, ModuleScripts,
 * services, and data flow for the Roblox project.
 *
 * Ralph Wiggum Method: "I'm drawing the blueprint for where everything goes!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Architect Agent for Dextinity, a Roblox game development system.
You receive a system plan and design the complete Roblox project file structure.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "structure": {
    "ServerScriptService": {
      "type": "folder",
      "children": {
        "Server": {
          "type": "folder",
          "children": {
            "ExampleService.server.lua": {
              "type": "Script",
              "description": "What this script does"
            }
          }
        }
      }
    },
    "StarterPlayer": {
      "type": "folder",
      "children": {
        "StarterPlayerScripts": {
          "type": "folder",
          "children": {
            "Client": {
              "type": "folder",
              "children": {
                "ExampleClient.client.lua": {
                  "type": "LocalScript",
                  "description": "What this script does"
                }
              }
            }
          }
        }
      }
    },
    "ReplicatedStorage": {
      "type": "folder",
      "children": {
        "Shared": {
          "type": "folder",
          "children": {
            "Config.lua": {
              "type": "ModuleScript",
              "description": "Shared configuration"
            }
          }
        },
        "Remotes": {
          "type": "folder",
          "children": {}
        }
      }
    }
  },
  "fileManifest": [
    {
      "path": "ServerScriptService/Server/ExampleService.server.lua",
      "scriptType": "Script|LocalScript|ModuleScript",
      "system": "string - which system from the plan",
      "description": "What this file does",
      "dependencies": ["path/to/dependency.lua"]
    }
  ],
  "narration": "string - explain the architecture in plain language"
}

ROBLOX STRUCTURE RULES:
- Server scripts go in ServerScriptService (*.server.lua)
- Client scripts go in StarterPlayer/StarterPlayerScripts (*.client.lua)
- Shared modules go in ReplicatedStorage/Shared (*.lua)
- Remote events go in ReplicatedStorage/Remotes
- UI goes in StarterGui
- Keep a clean separation: Server/, Client/, Shared/ folders
- Name files descriptively: PlayerDataService.server.lua, ShopUI.client.lua
- Every script should have a clear single responsibility`;

export class ArchitectAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Architect Agent',
      id: 'architect',
      description: 'Designs folder structure and file layout for Roblox',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Let me draw up the blueprints for this project...");

    const userMessage = `Design the complete Roblox project architecture for this game:

Game: ${input.gameTitle} (${input.gameType})
Core Loop: ${input.coreLoop}

Systems to implement:
${(input.plan?.systems || []).map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')}

Data Flow:
${(input.plan?.dataFlow || []).map(d => `- ${d.from} -> ${d.to}: ${d.data} via ${d.method}`).join('\n')}

Remote Events:
${(input.plan?.remoteEvents || []).map(r => `- ${r.name} (${r.direction}): ${r.payload}`).join('\n')}

Design a clean, organized Roblox folder structure with all necessary files.`;

    const result = await this.callAI(userMessage, { intent: input, plan: input.plan });

    if (result.narration) {
      this.narrate(result.narration);
    } else {
      const fileCount = result.fileManifest?.length || 0;
      this.narrate(`Architecture done! ${fileCount} files organized into a clean Roblox structure.`);
    }

    return { ...input, architecture: result };
  }
}
