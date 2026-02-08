/**
 * Dextinity - Roblox Adapter Agent
 *
 * Fifth in chain. Ensures all code is strictly Roblox Studio compatible.
 * Validates APIs, fixes common mistakes, ensures proper script types.
 *
 * Ralph Wiggum Method: "I'm checking if Roblox will actually like this code!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Roblox Adapter Agent for Dextinity.
You review generated Luau code and ensure it is 100% compatible with Roblox Studio.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "files": [
    {
      "path": "string - file path",
      "scriptType": "Script|LocalScript|ModuleScript",
      "luau": "string - the corrected/validated Luau code",
      "antigravity": "string - original antigravity source (pass through)",
      "description": "string - file description",
      "issues": ["string array - issues found and fixed, empty if none"],
      "compatible": true
    }
  ],
  "globalIssues": ["string array - project-wide issues found"],
  "narration": "string - explain what you checked and fixed"
}

CHECK FOR THESE COMMON ISSUES:
1. Using wait() instead of task.wait()
2. Using spawn() instead of task.spawn()
3. Using delay() instead of task.delay()
4. Accessing services incorrectly (must use game:GetService)
5. Client scripts accessing server-only services (ServerStorage, ServerScriptService)
6. Server scripts accessing client-only services (UserInputService on server)
7. Missing pcall around DataStore operations
8. Not checking if player exists before accessing properties
9. Using deprecated API methods
10. Missing return statement in ModuleScripts
11. Incorrect Remote event usage (FireClient needs player arg)
12. Memory leaks (connections not cleaned up)
13. Using string concatenation instead of string.format or interpolation
14. Not handling nil values from FindFirstChild
15. Infinite loops without yields

Fix any issues you find. If code is already correct, pass it through unchanged.
Always ensure ModuleScripts return their module table.`;

export class AdapterAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Roblox Adapter Agent',
      id: 'adapter',
      description: 'Validates and fixes Roblox compatibility',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Let me check all this code works in Roblox Studio...");

    const files = input.files || [];
    const allAdapted = [];

    // Process in batches
    const batchSize = 6;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);

      this.narrate(`Checking files ${i + 1}-${Math.min(i + batchSize, files.length)} of ${files.length}...`);

      const userMessage = `Review and fix these Roblox Luau files for strict Roblox Studio compatibility:

${batch.map(f => `=== ${f.path} (${f.scriptType}) ===
${f.luau}
`).join('\n')}

Check every file for compatibility issues. Fix anything that won't work in Roblox Studio.
If a file is fine, include it unchanged with an empty issues array.`;

      const result = await this.callAI(userMessage);

      if (result.files && Array.isArray(result.files)) {
        // Merge antigravity source from original files
        for (const adapted of result.files) {
          const original = batch.find(f => f.path === adapted.path);
          if (original && !adapted.antigravity) {
            adapted.antigravity = original.antigravity;
          }
          allAdapted.push(adapted);
        }
      } else {
        // AI returned malformed response - keep original files rather than losing them
        this.narrate(`Warning: adapter check returned unexpected format for batch. Keeping original files.`);
        allAdapted.push(...batch);
      }
    }

    // Count issues
    const issueCount = allAdapted.reduce((sum, f) => sum + (f.issues?.length || 0), 0);

    if (issueCount > 0) {
      this.narrate(`Found and fixed ${issueCount} compatibility issues across ${allAdapted.length} files.`);
    } else {
      this.narrate("All files look Roblox-ready! No compatibility issues found.");
    }

    return { ...input, files: allAdapted };
  }
}
