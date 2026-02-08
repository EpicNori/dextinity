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

    // Build the test summary once (shared across batches)
    const testSummary = this._buildTestSummary(testResults, input);

    // Determine which files are affected by test failures/security issues
    const affectedPaths = this._getAffectedPaths(testResults);

    // For large projects, batch files but prioritize affected ones first
    const maxFilesPerBatch = 8;
    let allImprovedFiles = [];
    let allImprovements = [];
    let shouldIterate = false;

    if (files.length <= maxFilesPerBatch) {
      const result = await this._improveBatch(files, testSummary, input);
      allImprovedFiles = result.improvedFiles || [];
      allImprovements = result.improvements || [];
      shouldIterate = result.shouldIterate || false;
    } else {
      // Prioritize: affected files first, then the rest
      const affected = files.filter(f => affectedPaths.has(f.path));
      const unaffected = files.filter(f => !affectedPaths.has(f.path));
      const ordered = [...affected, ...unaffected];

      let batchNum = 0;
      for (let i = 0; i < ordered.length; i += maxFilesPerBatch) {
        const batch = ordered.slice(i, i + maxFilesPerBatch);
        batchNum++;
        this.narrate(`Improving batch ${batchNum}: ${batch.map(f => f.path.split('/').pop()).join(', ')}`);

        const result = await this._improveBatch(batch, testSummary, input);
        allImprovedFiles.push(...(result.improvedFiles || []));
        allImprovements.push(...(result.improvements || []));
        if (result.shouldIterate) shouldIterate = true;
      }
    }

    // Merge improved files with unchanged files
    const improvedPaths = new Set(allImprovedFiles.map(f => f.path));
    const mergedFiles = [
      ...allImprovedFiles,
      ...files.filter(f => !improvedPaths.has(f.path)),
    ];

    const changeCount = allImprovements.length;
    this.narrate(`Made ${changeCount} improvements. ${shouldIterate ? 'More work needed...' : 'Looking good!'}`);

    return {
      ...input,
      files: mergedFiles,
      improvements: allImprovements,
      shouldIterate,
    };
  }

  _buildTestSummary(testResults, input) {
    const failures = (testResults.testResults || [])
      .filter(t => t.status === 'fail')
      .map(t => `${t.scenario}: ${t.details} [FIX: ${t.fix}]`)
      .join('\n  ') || 'None';

    const warnings = (testResults.testResults || [])
      .filter(t => t.status === 'warn')
      .map(t => `${t.scenario}: ${t.details} [FIX: ${t.fix}]`)
      .join('\n  ') || 'None';

    const security = (testResults.securityAudit || [])
      .map(s => `${s.vulnerability} (${s.severity}): ${s.fix}`)
      .join('\n  ') || 'None';

    const perf = (testResults.performanceNotes || [])
      .map(p => `${p.issue}: ${p.suggestion}`)
      .join('\n  ') || 'None';

    return `Game: ${input.gameTitle} (${input.gameType})

Test Results:
- Failures: ${failures}
- Warnings: ${warnings}
- Security Issues: ${security}
- Performance Issues: ${perf}
- Scores: ${JSON.stringify(testResults.overallScore || {})}`;
  }

  _getAffectedPaths(testResults) {
    const paths = new Set();
    for (const t of (testResults.testResults || [])) {
      if (t.status !== 'pass' && t.affectedFiles) {
        for (const p of t.affectedFiles) paths.add(p);
      }
    }
    for (const s of (testResults.securityAudit || [])) {
      if (s.location) paths.add(s.location.split(' ')[0]); // extract file path from "path area"
    }
    return paths;
  }

  async _improveBatch(files, testSummary, input) {
    const fileList = files.map(f => `=== ${f.path} (${f.scriptType}) ===\n${f.luau}\n`).join('\n');

    const userMessage = `Improve this game based on the test results:

${testSummary}

Current Files:
${fileList}

Fix all failures and critical security issues. Address warnings and performance issues if possible.
Only change files that need it. Produce clean, production-quality code.`;

    const result = await this.callAI(userMessage);

    // Handle malformed response: if no improvedFiles, treat as no changes needed
    if (!result.improvedFiles && !result.improvements) {
      return {
        improvedFiles: [],
        improvements: [],
        shouldIterate: false,
      };
    }

    return result;
  }
}
