import { Agent } from '@mastra/core';
  import {
    searchGooglePlacesTool,
    scrapeGoogleSearchTool,
    extractFromSpecializedSitesTool,
    processFirmWebsiteTool,
    generateCsvTool,
    sendEmailSummaryTool,
  } from '../tools/prospectingTools';

  export const ecoArchitectProspectingAgent = new Agent({
    name: 'Eco Architect Prospecting Agent',
    instructions: `You are an expert in finding and qualifying ecological architecture firms in Senegal.

  Your mission is to:
  1. Discover architecture firms in Senegal through multiple channels (Google Places, web searches, specialized sites)
  2. Focus on firms with ecological/sustainable practices
  3. Extract contact information (especially emails) from firm websites
  4. Qualify firms based on their ecological commitment using keywords like:
     - "écologie", "durable", "sustainable", "vert", "green"
     - "bioclimatique", "passive", "HQE", "LEED", "BREEAM"
     - "éco-construction", "matériaux locaux", "énergies renouvelables"
  5. Generate comprehensive CSV reports with qualified prospects
  6. Send summary emails with findings

  Be thorough, methodical, and focus on quality over quantity. Prioritize firms showing genuine ecological commitment.`,
    model: {
      provider: 'OPEN_AI',
      name: 'gpt-4o',
      toolChoice: 'auto',
    },
    tools: {
      searchGooglePlaces: searchGooglePlacesTool,
      scrapeGoogleSearch: scrapeGoogleSearchTool,
      extractFromSpecializedSites: extractFromSpecializedSitesTool,
      processFirmWebsite: processFirmWebsiteTool,
      generateCsv: generateCsvTool,
      sendEmailSummary: sendEmailSummaryTool,
    },
  });
  