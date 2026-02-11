# How to Use Agent Chains Correctly

This guide explains how to use the `AgentChain` system implemented in `src/agents/chain.js`.

## Overview

The `AgentChain` orchestrates a sequence of specialized AI agents to complete complex tasks. It handles:
- **Sequential Execution**: Running agents in a specific order (Intent -> Creative -> Planner -> ...).
- **State Management**: Passing context and artifacts between agents.
- **Monitoring**: Tracking token usage, timing, and errors.
- **Ralph Wiggum Narration**: Agents "narrate" their actions via callbacks.

## Basic Usage

To use the Agent Chain in your application (e.g., from a frontend component or a script):

1. **Import the Chain**:
   ```javascript
   import { AgentChain } from './src/agents/chain.js';
   ```

2. **Define Callbacks**:
   The chain relies on callbacks to update the UI or log progress.
   ```javascript
   const callbacks = {
     onNarrate: (entry) => {
       console.log(`[${entry.agentName}] ${entry.message}`);
     },
     onProgress: ({ step, total, percent }) => {
       console.log(`Progress: ${percent}% (${step}/${total})`);
     },
     onChainDone: (result) => {
       console.log("Chain complete!", result);
     },
     onChainError: (error) => {
       console.error("Chain failed:", error);
     }
   };
   ```

3. **Initialize and Run**:
   ```javascript
   const chain = new AgentChain(callbacks);

   const userInput = {
     prompt: "Create a snake game in HTML5",
     mode: "vibe", // or 'detailed', 'upload'
   };

   try {
     const result = await chain.run(userInput);
     // Result contains generated plan, files, etc.
   } catch (err) {
     // Handle error
   }
   ```

## Workflow Modes

The `AgentChain` supports two main modes:

1.  **Standard Run (`chain.run(input)`)**:
    -   Used for creating new projects from scratch.
    -   Sequence: `Intent -> Creative -> Planner -> Architect -> Coder -> Adapter -> Tester -> Improver`.
    -   Includes a feedback loop (`Tester -> Improver`) that runs up to `maxIterations` times.

2.  **Upload & Improve (`chain.runUploadImprove(input)`)**:
    -   Used when the user provides existing files.
    -   Sequence: `Intent -> Adapter -> Tester -> Improver`.
    -   Skips creative/architect phases to focus on analysis and fixing.

## Extending the Chain

To add a new agent:
1.  Create a new agent class in `src/agents/` extending `BaseAgent`.
2.  Import it in `src/agents/chain.js`.
3.  Add it to the `this.agents` object in the constructor.
4.  Add its ID to the `this.agentOrder` array in the desired position.

## "Ralph Wiggum" Method

The codebase references the "Ralph Wiggum Method" in `BaseAgent.js`:
> *Narrate what the agent is doing (Ralph Wiggum Method: say what you're doing).*

This ensures the user always knows what the AI is thinking, preventing the "black box" feeling. when implementing new agents, always call `this.narrate("Doing X...")` frequently.
