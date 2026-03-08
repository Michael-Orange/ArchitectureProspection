import { Agent } from '@mastra/core';
  import {
    searchGooglePlacesTool,
    scrapeGoogleSearchTool,
    extractFromSpecializedSitesTool,
    processFirmWebsiteTool,
    generateCsvTool,
    sendEmailSummaryTool,
  } from '../tools/prospectingTools';
  import { qualifyFirmWithDustAiTool } from '../tools/dustAiTool';

  /**
   * Eco Architect Prospecting Agent
   * 
   * This agent orchestrates the discovery and qualification of ecological architecture firms in Senegal.
   * It uses Dust AI for intelligent qualification of firms based on their ecological commitment.
   * 
   * Required environment variables:
   * - DUST_API_KEY: Your Dust AI API key
   * - DUST_WORKSPACE_ID: Your Dust AI workspace ID
   * - DUST_AGENT_ID (optional): Specific agent to use for qualification
   */
  export const ecoArchitectProspectingAgent = new Agent({
    name: 'Eco Architect Prospecting Agent',
    instructions: `You are an expert automation agent for discovering and qualifying ecological architecture firms in Senegal.

  Your mission:
  1. Discover architecture firms through multiple channels (Google Places, web searches, specialized directories)
  2. Focus on firms with ecological/sustainable architecture practices
  3. Extract contact information (especially emails) from firm websites
  4. Use Dust AI to qualify firms based on their ecological commitment
  5. Generate comprehensive CSV reports with qualified prospects
  6. Send summary emails with findings to michael@filtreplante.com

  Be thorough, methodical, and focus on quality over quantity. Prioritize firms showing genuine ecological commitment.

  Qualification criteria for scoring (0-10 scale):
  - Explicit mention of ecological/sustainable practices: +3 points
  - Portfolio showcasing eco-projects: +2 points
  - Certifications (HQE, LEED, BREEAM, etc.): +2 points
  - Use of local/sustainable materials mentioned: +1 point
  - Passive/bioclimatic design approach: +1 point
  - Renewable energy integration: +1 point

  Minimum qualification score: 5/10`,
    // No model needed - this agent is purely for tool orchestration
    // Dust AI handles the intelligent qualification part
    tools: {
      searchGooglePlaces: searchGooglePlacesTool,
      scrapeGoogleSearch: scrapeGoogleSearchTool,
      extractFromSpecializedSites: extractFromSpecializedSitesTool,
      processFirmWebsite: processFirmWebsiteTool,
      qualifyFirmWithDustAi: qualifyFirmWithDustAiTool,
      generateCsv: generateCsvTool,
      sendEmailSummary: sendEmailSummaryTool,
    },
  });
  