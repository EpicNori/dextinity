/**
 * Dextinity - Tester Agent
 *
 * Sixth in chain. Simulates play sessions, checks edge cases,
 * validates exploit prevention, and identifies bugs.
 *
 * Ralph Wiggum Method: "I'm pretending to play the game and see what breaks!"
 */

import { BaseAgent } from './base-agent.js';

const SYSTEM_PROMPT = `You are the Tester Agent for Dextinity.
You review generated Roblox game code by simulating play scenarios and identifying potential issues.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "testResults": [
    {
      "scenario": "string - what play scenario was tested",
      "status": "pass|warn|fail",
      "details": "string - what happened in this scenario",
      "affectedFiles": ["string array - file paths involved"],
      "fix": "string - suggested fix if status is warn or fail, null if pass"
    }
  ],
  "securityAudit": [
    {
      "vulnerability": "string - what the vulnerability is",
      "severity": "low|medium|high|critical",
      "location": "string - file path and area",
      "fix": "string - how to fix it"
    }
  ],
  "performanceNotes": [
    {
      "issue": "string - performance concern",
      "severity": "low|medium|high",
      "location": "string - where",
      "suggestion": "string - how to improve"
    }
  ],
  "overallScore": {
    "functionality": "1-10 score",
    "security": "1-10 score",
    "performance": "1-10 score",
    "codeQuality": "1-10 score"
  },
  "narration": "string - summary of testing in plain language"
}

TEST SCENARIOS TO RUN:
1. New player joins for the first time
2. Returning player with saved data
3. Player leaves mid-action
4. Multiple players interacting
5. Rapid input/spam clicking
6. DataStore failure scenarios
7. Remote event exploitation (firing events with bad data)
8. Memory usage over time (connections, instances)
9. Edge cases: empty inventory, max values, negative values
10. UI responsiveness and feedback

SECURITY CHECKS:
- Can clients fire remote events with spoofed data?
- Are server-side validations in place?
- Can players access other players' data?
- Are there rate limits on remote events?
- Can players get items/currency they shouldn't have?`;

export class TesterAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Tester Agent',
      id: 'tester',
      description: 'Simulates play sessions and identifies issues',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Time to play-test! Let me pretend I'm a player and see what happens...");

    const files = input.files || [];

    const userMessage = `Test this Roblox game by simulating player scenarios:

Game: ${input.gameTitle} (${input.gameType})
Core Loop: ${input.coreLoop}

Files in the project:
${files.map(f => `=== ${f.path} (${f.scriptType}) ===
${f.luau}
`).join('\n')}

Run through all test scenarios. Be thorough - check for bugs, exploits, and performance issues.
Score the game honestly. Identify real problems that would affect players.`;

    const result = await this.callAI(userMessage);

    if (result.narration) {
      this.narrate(result.narration);
    } else {
      const fails = (result.testResults || []).filter(t => t.status === 'fail').length;
      const warns = (result.testResults || []).filter(t => t.status === 'warn').length;
      const vulns = (result.securityAudit || []).length;
      this.narrate(
        `Testing done! ${fails} failures, ${warns} warnings, ${vulns} security findings. ` +
        `Scores: func=${result.overallScore?.functionality}/10, ` +
        `security=${result.overallScore?.security}/10, ` +
        `perf=${result.overallScore?.performance}/10`
      );
    }

    return { ...input, testResults: result };
  }
}
