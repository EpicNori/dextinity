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

CRITICAL: The fileManifest array MUST contain at least one file entry for each system. Do NOT return an empty fileManifest.

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
      maxTokens: 12288,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Let me draw up the blueprints for this project...");

    const systems = input.plan?.systems || [];
    const dataFlow = input.plan?.dataFlow || [];
    const remoteEvents = input.plan?.remoteEvents || [];

    const userMessage = `Design the complete Roblox project architecture for this game:

Game: ${input.gameTitle} (${input.gameType})
Core Loop: ${input.coreLoop}

Systems to implement:
${systems.map(s => `- ${s.name} (${s.type}): ${s.description}`).join('\n')}

Data Flow:
${dataFlow.map(d => `- ${d.from} -> ${d.to}: ${d.data} via ${d.method}`).join('\n')}

Remote Events:
${remoteEvents.map(r => `- ${r.name} (${r.direction}): ${r.payload}`).join('\n')}

Design a clean, organized Roblox folder structure with all necessary files.
IMPORTANT: You MUST include a fileManifest with one or more files for EACH system listed above. Do not return an empty fileManifest.`;

    // Only pass minimal context to avoid token bloat
    const result = await this.callAI(userMessage);

    let fileManifest = result.fileManifest || [];

    // If the AI returned an empty fileManifest but we have systems, generate a fallback manifest
    if (fileManifest.length === 0 && systems.length > 0) {
      this.narrate("Architect returned empty file list. Generating structure from plan...");
      fileManifest = this._generateFallbackManifest(systems, remoteEvents);
      result.fileManifest = fileManifest;
      result.structure = result.structure || this._generateFallbackStructure(fileManifest);
    }

    if (result.narration) {
      this.narrate(result.narration);
    } else {
      this.narrate(`Architecture done! ${fileManifest.length} files organized into a clean Roblox structure.`);
    }

    return { ...input, architecture: result };
  }

  /**
   * Generate a basic file manifest from the plan's systems when the AI fails.
   */
  _generateFallbackManifest(systems, remoteEvents) {
    const manifest = [];

    // Always include a shared config module
    manifest.push({
      path: 'ReplicatedStorage/Shared/Config.lua',
      scriptType: 'ModuleScript',
      system: 'Config',
      description: 'Shared game configuration and constants',
      dependencies: [],
    });

    for (const sys of systems) {
      const safeName = sys.name.replace(/[^a-zA-Z0-9]/g, '');

      if (sys.type === 'server' || sys.type === 'core') {
        manifest.push({
          path: `ServerScriptService/Server/${safeName}Service.server.lua`,
          scriptType: 'Script',
          system: sys.name,
          description: sys.description,
          dependencies: (sys.dependencies || []).map(d => `ReplicatedStorage/Shared/${d.replace(/[^a-zA-Z0-9]/g, '')}.lua`),
        });
      } else if (sys.type === 'client') {
        manifest.push({
          path: `StarterPlayer/StarterPlayerScripts/Client/${safeName}Controller.client.lua`,
          scriptType: 'LocalScript',
          system: sys.name,
          description: sys.description,
          dependencies: [],
        });
      } else {
        // shared or unknown -> ModuleScript
        manifest.push({
          path: `ReplicatedStorage/Shared/${safeName}.lua`,
          scriptType: 'ModuleScript',
          system: sys.name,
          description: sys.description,
          dependencies: [],
        });
      }
    }

    return manifest;
  }

  _generateFallbackStructure(manifest) {
    const structure = {};
    for (const file of manifest) {
      const parts = file.path.split('/');
      let current = structure;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]]) {
          current[parts[i]] = { type: 'folder', children: {} };
        }
        current = current[parts[i]].children;
      }
      const fileName = parts[parts.length - 1];
      current[fileName] = { type: file.scriptType, description: file.description };
    }
    return structure;
  }
}
