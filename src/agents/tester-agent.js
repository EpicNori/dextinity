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

    // For small projects, test all at once. For larger ones, batch and merge results.
    const maxFilesPerBatch = 8;
    let mergedResult;

    if (files.length <= maxFilesPerBatch) {
      mergedResult = await this._testBatch(files, input);
    } else {
      mergedResult = {
        testResults: [],
        securityAudit: [],
        performanceNotes: [],
        overallScore: { functionality: 0, security: 0, performance: 0, codeQuality: 0 },
      };
      let batchCount = 0;

      for (let i = 0; i < files.length; i += maxFilesPerBatch) {
        const batch = files.slice(i, i + maxFilesPerBatch);
        batchCount++;
        this.narrate(`Testing batch ${batchCount}: ${batch.map(f => f.path.split('/').pop()).join(', ')}`);

        const batchResult = await this._testBatch(batch, input);

        mergedResult.testResults.push(...(batchResult.testResults || []));
        mergedResult.securityAudit.push(...(batchResult.securityAudit || []));
        mergedResult.performanceNotes.push(...(batchResult.performanceNotes || []));

        // Accumulate scores for averaging
        if (batchResult.overallScore) {
          mergedResult.overallScore.functionality += Number(batchResult.overallScore.functionality) || 0;
          mergedResult.overallScore.security += Number(batchResult.overallScore.security) || 0;
          mergedResult.overallScore.performance += Number(batchResult.overallScore.performance) || 0;
          mergedResult.overallScore.codeQuality += Number(batchResult.overallScore.codeQuality) || 0;
        }
      }

      // Average out scores across batches
      if (batchCount > 1) {
        mergedResult.overallScore.functionality = Math.round(mergedResult.overallScore.functionality / batchCount);
        mergedResult.overallScore.security = Math.round(mergedResult.overallScore.security / batchCount);
        mergedResult.overallScore.performance = Math.round(mergedResult.overallScore.performance / batchCount);
        mergedResult.overallScore.codeQuality = Math.round(mergedResult.overallScore.codeQuality / batchCount);
      }
    }

    const fails = (mergedResult.testResults || []).filter(t => t.status === 'fail').length;
    const warns = (mergedResult.testResults || []).filter(t => t.status === 'warn').length;
    const vulns = (mergedResult.securityAudit || []).length;
    this.narrate(
      `Testing done! ${fails} failures, ${warns} warnings, ${vulns} security findings. ` +
      `Scores: func=${mergedResult.overallScore?.functionality}/10, ` +
      `security=${mergedResult.overallScore?.security}/10, ` +
      `perf=${mergedResult.overallScore?.performance}/10`
    );

    return { ...input, testResults: mergedResult };
  }

  async _testBatch(files, input) {
    const fileList = files.map(f => `=== ${f.path} (${f.scriptType}) ===\n${f.luau}\n`).join('\n');

    const userMessage = `Test this Roblox game by simulating player scenarios:

Game: ${input.gameTitle} (${input.gameType})
Core Loop: ${input.coreLoop}

Files in the project:
${fileList}

Run through all test scenarios. Be thorough - check for bugs, exploits, and performance issues.
Score the game honestly. Identify real problems that would affect players.`;

    const result = await this.callAI(userMessage);

    // Validate we got proper test results structure
    if (!result.testResults && !result.securityAudit) {
      return {
        testResults: [{ scenario: 'Parse error', status: 'warn', details: 'Tester returned unexpected format', affectedFiles: [], fix: 'Re-run generation' }],
        securityAudit: [],
        performanceNotes: [],
        overallScore: result.overallScore || { functionality: 5, security: 5, performance: 5, codeQuality: 5 },
      };
    }

    return result;
  }
}
