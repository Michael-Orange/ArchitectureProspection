import { Workflow, Step } from '@mastra/core';
  import { z } from 'zod';

  export const ecoArchitectProspectingWorkflow = new Workflow({
    name: 'eco-architect-prospecting-workflow',
    triggerSchema: z.object({
      runDate: z.string().optional().describe('Date of the automation run'),
    }),
  });

  /**
   * Step 1: Search Google Places for architecture firms
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'search-google-places',
    description: 'Search Google Places API for architecture firms in major Senegalese cities',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      return `Search Google Places for architecture firms in these Senegalese cities:
      - Dakar
      - Thiès
      - Saint-Louis
      - Kaolack
      
      Use queries like:
      - "cabinet d'architecture"
      - "architecte"
      - "bureau d'études architecture"
      
      Return the list of firms found with their basic information.`;
    },
  }));

  /**
   * Step 2: Scrape Google Search with eco-focused queries
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'scrape-eco-searches',
    description: 'Scrape Google Search using ecological architecture keywords for Senegal',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      return `Perform Google searches with these eco-focused queries for Senegal:
      - "architecture écologique Sénégal"
      - "architecture durable Dakar"
      - "éco-construction Sénégal"
      - "architecte bioclimatique Sénégal"
      - "cabinet architecture HQE Sénégal"
      - "sustainable architecture Senegal"
      - "green building Dakar"
      
      Extract firm names, websites, and descriptions from the search results.`;
    },
  }));

  /**
   * Step 3: Extract from specialized architectural websites
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'extract-specialized-sites',
    description: 'Extract firm data from specialized architectural directories and associations',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      return `Visit and extract architecture firm data from these types of specialized sites in Senegal:
      - Ordre des Architectes du Sénégal directory
      - African architecture directories
      - Ecological construction forums and platforms
      - Sustainable development organizations in Senegal
      
      Focus on extracting firm names, websites, and any ecological certifications or specializations.`;
    },
  }));

  /**
   * Step 4: Deduplicate and consolidate all discovered firms
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'deduplicate-firms',
    description: 'Consolidate and deduplicate all discovered firms from all sources',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      const { outputs } = context.machineContext || {};
      return `You have discovered firms from three sources:
      1. Google Places: ${JSON.stringify(outputs?.['search-google-places'] || [])}
      2. Google Searches: ${JSON.stringify(outputs?.['scrape-eco-searches'] || [])}
      3. Specialized Sites: ${JSON.stringify(outputs?.['extract-specialized-sites'] || [])}
      
      Deduplicate these lists (same firm appearing multiple times) and create a consolidated master list.
      Match firms by name similarity and website URLs.
      Return the deduplicated list with all available information merged.`;
    },
  }));

  /**
   * Step 5: Visit each firm's website and extract emails
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'extract-firm-emails',
    description: 'Visit each firm website to extract contact emails',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      const { outputs } = context.machineContext || {};
      const firms = outputs?.['deduplicate-firms'] || [];
      return `For each of these ${firms.length} firms, visit their website and extract contact emails:
      
      ${JSON.stringify(firms)}
      
      Look for emails on:
      - Contact pages
      - About pages
      - Footer sections
      - Team/Staff pages
      
      Extract all professional emails found (avoid generic info@, contact@, unless that's the only option).
      Return the firm list enriched with discovered emails.`;
    },
  }));

  /**
   * Step 6: Qualify firms based on ecological criteria
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'qualify-firms',
    description: 'Qualify each firm based on ecological architecture commitment',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      const { outputs } = context.machineContext || {};
      const firmsWithEmails = outputs?.['extract-firm-emails'] || [];
      return `Qualify each firm based on their ecological commitment by analyzing their website content:
      
      ${JSON.stringify(firmsWithEmails)}
      
      Scoring criteria (0-10 scale):
      - Explicit mention of ecological/sustainable practices: +3 points
      - Portfolio showcasing eco-projects: +2 points
      - Certifications (HQE, LEED, BREEAM, etc.): +2 points
      - Use of local/sustainable materials mentioned: +1 point
      - Passive/bioclimatic design approach: +1 point
      - Renewable energy integration: +1 point
      
      Minimum qualification score: 5/10
      
      Return only firms scoring 5 or above, with their qualification details.`;
    },
  }));

  /**
   * Step 7: Generate CSV summary
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'generate-csv',
    description: 'Generate CSV file with all qualified prospects',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      const { outputs } = context.machineContext || {};
      const qualifiedFirms = outputs?.['qualify-firms'] || [];
      return `Generate a CSV file with these ${qualifiedFirms.length} qualified firms:
      
      ${JSON.stringify(qualifiedFirms)}
      
      CSV should include columns:
      - Firm Name
      - Website
      - Contact Emails
      - Qualification Score
      - Ecological Keywords Found
      - City/Location
      
      Use the generateCsv tool to create the file.`;
    },
  }));

  /**
   * Step 8: Send summary email
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.ai({
    stepId: 'send-email',
    description: 'Send summary email with CSV attachment to michael@filtreplante.com',
    agentId: 'ecoArchitectProspectingAgent',
    agent: async ({ getAgent }) => {
      const agent = await getAgent('ecoArchitectProspectingAgent');
      return agent;
    },
    prompt: async ({ context }) => {
      const { outputs } = context.machineContext || {};
      const csvInfo = outputs?.['generate-csv'] || {};
      const qualifiedFirms = outputs?.['qualify-firms'] || [];
      
      return `Send a summary email to michael@filtreplante.com with these details:
      
      Subject: Prospection Architectes Écologiques Sénégal - ${new Date().toLocaleDateString('fr-FR')}
      
      Body:
      Bonjour,
      
      Voici le récapitulatif de la prospection bi-hebdomadaire :
      
      - Nombre total de cabinets découverts : [total from all sources]
      - Nombre de cabinets qualifiés : ${qualifiedFirms.length}
      - Fichier CSV en pièce jointe : ${csvInfo.csvPath}
      
      Top 3 des cabinets les mieux qualifiés :
      [List top 3 with scores]
      
      Cordialement,
      Votre Assistant de Prospection
      
      Attach the CSV file: ${csvInfo.csvPath}
      
      Use the sendEmailSummary tool to send this email.`;
    },
  }));

  /**
   * Commit workflow steps
   */
  ecoArchitectProspectingWorkflow.commit();
  