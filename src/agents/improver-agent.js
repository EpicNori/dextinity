/**
 * Dextinity - Improver Agent
 *
 * Last in chain. Takes test results and refactors/fixes/upgrades code.
 * Runs iteratively until quality thresholds are met or max iterations reached.
 *
 * Ralph Wiggum Method: "I'm making it better! Delete what's bad, keep what's good!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Improver Agent for Dextinity.
You receive test results and the current code, then fix issues and improve quality.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "improvedFiles": [
    {
      "path": "string - file path",
      "scriptType": "Script|LocalScript|ModuleScript",
      "luau": "string - improved Luau code",
      "antigravity": "string - updated Antigravity source",
      "description": "string - file description",
      "changes": ["string array - what was changed and why"]
    }
  ],
  "unchangedFiles": ["string array - paths of files that needed no changes"],
  "improvements": [
    {
      "area": "string - what area was improved",
      "before": "string - brief description of the problem",
      "after": "string - what it looks like now"
    }
  ],
  "shouldIterate": false,
  "narration": "string - explain what you improved"
}

IMPROVEMENT PRIORITIES (in order):
1. Fix any test failures (bugs that break gameplay)
2. Fix security vulnerabilities (especially critical/high)
3. Fix performance issues
4. Improve code quality and readability
5. Add missing error handling
6. Improve player experience (feedback, UI responsiveness)

RULES:
- Only modify files that need changes
- Don't introduce new bugs while fixing old ones
- Keep the same file structure and naming
- Set shouldIterate to true only if there are still significant issues
- If code is already good, say so and don't change it for the sake of changing it
- Follow the Ralph Wiggum Method: if complexity grew too fast, simplify before adding more`;

export class ImproverAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Improver Agent',
      id: 'improver',
      description: 'Refactors, fixes, and upgrades based on test results',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Let me look at the test results and make things better...");

    const files = input.files || [];
    const testResults = input.testResults || {};

    const userMessage = `Improve this game based on the test results:

Game: ${input.gameTitle} (${input.gameType})

Test Results:
- Failures: ${(testResults.testResults || []).filter(t => t.status === 'fail').map(t => `${t.scenario}: ${t.details} [FIX: ${t.fix}]`).join('\n  ')}
- Warnings: ${(testResults.testResults || []).filter(t => t.status === 'warn').map(t => `${t.scenario}: ${t.details} [FIX: ${t.fix}]`).join('\n  ')}
- Security Issues: ${(testResults.securityAudit || []).map(s => `${s.vulnerability} (${s.severity}): ${s.fix}`).join('\n  ')}
- Performance Issues: ${(testResults.performanceNotes || []).map(p => `${p.issue}: ${p.suggestion}`).join('\n  ')}
- Scores: ${JSON.stringify(testResults.overallScore || {})}

Current Files:
${files.map(f => `=== ${f.path} (${f.scriptType}) ===
${f.luau}
`).join('\n')}

Fix all failures and critical security issues. Address warnings and performance issues if possible.
Only change files that need it. Produce clean, production-quality code.`;

    const result = await this.callAI(userMessage);

    // Merge improved files with unchanged files
    const improvedPaths = new Set((result.improvedFiles || []).map(f => f.path));
    const mergedFiles = [
      ...(result.improvedFiles || []),
      ...files.filter(f => !improvedPaths.has(f.path)),
    ];

    const changeCount = (result.improvements || []).length;
    if (result.narration) {
      this.narrate(result.narration);
    } else {
      this.narrate(`Made ${changeCount} improvements. ${result.shouldIterate ? 'More work needed...' : 'Looking good!'}`);
    }

    return {
      ...input,
      files: mergedFiles,
      improvements: result.improvements || [],
      shouldIterate: result.shouldIterate || false,
    };
  }
}
