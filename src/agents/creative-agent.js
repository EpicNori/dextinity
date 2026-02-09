/**
 * Dextinity - Creative Agent
 *
 * Sits between Intent and Planner. Takes the structured intent and
 * generatively expands it with unique mechanics, thematic twists,
 * unexpected feature combinations, and creative game concepts.
 *
 * This is what makes Dextinity truly generative - instead of just
 * mechanically translating user input, it adds creative spark.
 *
 * Ralph Wiggum Method: "I'm making your idea way cooler with surprises!"
 */

import { BaseAgent } from './base-agent.js';
import { apiClient } from '../core/api.js';

const SYSTEM_PROMPT = `You are the Creative Agent for Dextinity, a generative AI Roblox game development system.
Your job is to take a basic game intent and CREATIVELY EXPAND it with unique, surprising, and fun ideas.

You are the generative heart of Dextinity. Don't just repeat what the user said - AMPLIFY it.
Add unexpected twists, unique mechanics, thematic depth, and creative combinations that
make the game feel fresh and original.

You must respond with ONLY valid JSON (no markdown, no backticks, just raw JSON) in this exact format:
{
  "concepts": [
    {
      "gameTitle": "string - a creative, catchy game title",
      "tagline": "string - one-line pitch that sells the concept",
      "twist": "string - what makes this version unique and surprising",
      "uniqueMechanics": [
        {
          "name": "string - mechanic name",
          "description": "string - how it works and why it's fun"
        }
      ],
      "atmosphere": {
        "visualStyle": "string - art direction description",
        "mood": "string - emotional tone",
        "soundtrack": "string - what the music would feel like"
      },
      "secretSauce": "string - the one unexpected element that ties it all together"
    }
  ],
  "selectedConcept": 0,
  "expandedSystems": ["string array - additional systems inspired by the creative direction"],
  "thematicElements": {
    "colorPalette": "string - primary colors/aesthetic",
    "worldBuilding": "string - brief lore or world context",
    "playerFantasy": "string - what the player gets to feel like"
  },
  "generativeIdeas": [
    "string - wild or experimental idea that could make the game special"
  ],
  "narration": "string - explain your creative choices in an excited, plain-language way"
}

CREATIVE RULES:
1. Generate exactly 3 concept variations - from conservative to wild
2. Each concept should have a unique TWIST that differentiates it
3. Add at least 2 unique mechanics per concept that aren't in the original intent
4. Think about what would make a player say "whoa, that's cool"
5. Consider cross-genre inspiration (a horror game with rhythm elements, a tycoon with time travel)
6. Add thematic depth - games with personality are more memorable
7. The "secretSauce" should be genuinely surprising and delightful
8. Don't just add more of the same - add something DIFFERENT
9. Think about viral/shareable moments - what would make someone screenshot this?
10. Balance creativity with feasibility - these need to work in Roblox`;

export class CreativeAgent extends BaseAgent {
  constructor(onNarrate) {
    super({
      name: 'Creative Agent',
      id: 'creative',
      description: 'Generatively expands concepts with unique twists and mechanics',
      systemPrompt: SYSTEM_PROMPT,
      onNarrate,
    });
  }

  async run(input) {
    this.narrate("Time to get creative! Let me dream up something special...");

    const creativity = apiClient.getSettings().creativity || 0.5;

    const userMessage = `Take this game concept and CREATIVELY EXPAND it. Generate 3 unique variations.

Original Concept:
- Title: ${input.gameTitle}
- Type: ${input.gameType}
- Core Loop: ${input.coreLoop}
- Vibes: ${(input.vibes || []).join(', ')}
- Target Systems: ${(input.targetSystems || []).join(', ')}
- Complexity: ${input.complexity}
- User's Original Prompt: "${input.prompt}"

Creativity Level: ${this._creativityLabel(creativity)} (${Math.round(creativity * 100)}%)
${creativity < 0.3
    ? 'Stay close to the original concept. Enhance but don\'t reinvent.'
    : creativity < 0.7
    ? 'Add creative twists while keeping the core intact. Surprise the player.'
    : 'Go wild! Push boundaries, mix genres, add unexpected mechanics. Make it unforgettable.'}

Generate 3 concept variations:
1. FAITHFUL - Enhanced version of the original idea with polish and one neat twist
2. CREATIVE - The original idea remixed with surprising mechanics and thematic depth
3. WILD - A bold reimagining that keeps the spirit but takes it somewhere unexpected

Select the concept that best matches the creativity level.
Remember: You are the GENERATIVE engine. Your job is to add creative value that the user didn't think of.`;

    // Use higher temperature for creative generation - scales with creativity setting
    const creativeTemp = 0.7 + (creativity * 0.5); // Range: 0.7 to 1.2
    const result = await this.callAI(userMessage, {}, { temperature: creativeTemp });

    // Handle malformed response
    if (!result.concepts || !Array.isArray(result.concepts) || result.concepts.length === 0) {
      this.narrate("Creative expansion returned unexpected format. Passing through original concept...");
      return { ...input, creativeExpansion: null };
    }

    // Select the best concept based on creativity level
    const selectedIdx = this._selectConcept(result, creativity);
    const selected = result.concepts[selectedIdx] || result.concepts[0];

    this.narrate(`Generated 3 concepts! Going with: "${selected.gameTitle}" - ${selected.tagline || selected.twist}`);

    if (selected.secretSauce) {
      this.narrate(`Secret sauce: ${selected.secretSauce}`);
    }

    // Merge creative expansion into the context
    const expanded = {
      ...input,
      // Override with creative version
      gameTitle: selected.gameTitle || input.gameTitle,
      coreLoop: selected.twist
        ? `${input.coreLoop} — with a twist: ${selected.twist}`
        : input.coreLoop,
      // Add new vibes from atmosphere
      vibes: this._mergeVibes(input.vibes, selected.atmosphere),
      // Expand target systems with creative additions
      targetSystems: this._expandSystems(input.targetSystems, result.expandedSystems),
      // Attach full creative context for downstream agents
      creativeExpansion: {
        concepts: result.concepts,
        selectedConcept: selectedIdx,
        selected,
        uniqueMechanics: selected.uniqueMechanics || [],
        thematicElements: result.thematicElements || {},
        generativeIdeas: result.generativeIdeas || [],
        atmosphere: selected.atmosphere || {},
        playerFantasy: result.thematicElements?.playerFantasy || '',
      },
    };

    if (result.narration) {
      this.narrate(result.narration);
    }

    return expanded;
  }

  _creativityLabel(level) {
    if (level < 0.2) return 'Minimal';
    if (level < 0.4) return 'Conservative';
    if (level < 0.6) return 'Balanced';
    if (level < 0.8) return 'Adventurous';
    return 'Unhinged';
  }

  _selectConcept(result, creativity) {
    // If the AI already selected one, respect that for mid-range creativity
    if (typeof result.selectedConcept === 'number' && creativity >= 0.3 && creativity <= 0.7) {
      return Math.min(result.selectedConcept, (result.concepts?.length || 1) - 1);
    }

    // Otherwise pick based on creativity level
    const count = result.concepts?.length || 1;
    if (creativity < 0.35) return 0;                             // Faithful
    if (creativity < 0.65) return Math.min(1, count - 1);       // Creative
    return Math.min(2, count - 1);                               // Wild
  }

  _mergeVibes(originalVibes = [], atmosphere = {}) {
    const vibes = [...originalVibes];
    if (atmosphere.mood && !vibes.includes(atmosphere.mood)) {
      vibes.push(atmosphere.mood);
    }
    if (atmosphere.visualStyle) {
      // Extract key adjectives from visual style
      const keywords = atmosphere.visualStyle
        .toLowerCase()
        .split(/[\s,]+/)
        .filter(w => w.length > 3 && !vibes.map(v => v.toLowerCase()).includes(w))
        .slice(0, 2);
      vibes.push(...keywords);
    }
    return vibes;
  }

  _expandSystems(originalSystems = [], expandedSystems = []) {
    const systems = [...originalSystems];
    for (const sys of expandedSystems) {
      const normalized = sys.toLowerCase();
      if (!systems.some(s => s.toLowerCase() === normalized)) {
        systems.push(sys);
      }
    }
    return systems;
  }
}
