import { Workflow, Step } from '@mastra/core';
  import { z } from 'zod';

  /**
   * Eco Architect Prospecting Workflow
   * 
   * This workflow discovers and qualifies ecological architecture firms in Senegal
   * using a multi-step process with Dust AI for intelligent qualification.
   * 
   * Trigger: Time-based (bi-weekly via cron)
   * Output: CSV report emailed to michael@filtreplante.com
   */
  export const ecoArchitectProspectingWorkflow = new Workflow({
    name: 'eco-architect-prospecting-workflow',
    triggerSchema: z.object({
      runDate: z.string().optional().describe('Date of the automation run'),
    }),
  });

  /**
   * Step 1: Query Google Places API for architectural firms in Senegal
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'query-google-places',
    description: 'Queries Google Places API for architectural firms in Senegal',
    transform: async ({ context }) => {
      console.log('🔍 Step 1: Querying Google Places API...');
      
      // This would use the searchGooglePlacesTool
      // For MVP, we'll return mock data structure
      const firms = [
        {
          name: 'Cabinet Architecture Exemple 1',
          address: 'Dakar, Sénégal',
          phone: '+221 33 XXX XXXX',
          website: 'https://example1.com',
        },
        {
          name: 'Cabinet Architecture Exemple 2',
          address: 'Thiès, Sénégal',
          website: 'https://example2.com',
        },
      ];
      
      console.log(`   Found ${firms.length} firms from Google Places`);
      return { googlePlacesFirms: firms };
    },
  }));

  /**
   * Step 2: Scrape Google Search with targeted eco-friendly queries
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'scrape-google-search',
    description: 'Scrapes Google Search with targeted eco-friendly queries',
    transform: async ({ context }) => {
      console.log('🔍 Step 2: Scraping Google Search with eco queries...');
      
      const ecoQueries = [
        'architecture écologique Sénégal',
        'architecture durable Dakar',
        'éco-construction Sénégal',
        'architecte bioclimatique Sénégal',
        'cabinet architecture HQE Sénégal',
      ];
      
      // This would use the scrapeGoogleSearchTool
      const firms = [
        {
          name: 'Éco Architecture Sénégal',
          website: 'https://eco-archi-sn.com',
          snippet: 'Spécialiste en architecture durable et bioclimatique',
        },
      ];
      
      console.log(`   Found ${firms.length} firms from Google Search`);
      return { googleSearchFirms: firms };
    },
  }));

  /**
   * Step 3: Extract data from specialized architecture and ecology websites
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'extract-from-specialized-sites',
    description: 'Extracts data from specialized architecture and ecology websites',
    transform: async ({ context }) => {
      console.log('🔍 Step 3: Extracting from specialized sites...');
      
      const specializedSites = [
        'Ordre des Architectes du Sénégal',
        'African architecture directories',
        'Ecological construction forums',
      ];
      
      // This would use the extractFromSpecializedSitesTool
      const firms = [
        {
          name: 'Atelier Vert Architecture',
          website: 'https://atelier-vert.sn',
          description: 'Architecture écologique et durable',
        },
      ];
      
      console.log(`   Found ${firms.length} firms from specialized sites`);
      return { specializedSiteFirms: firms };
    },
  }));

  /**
   * Step 4: Consolidate and deduplicate all discovered firms
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'consolidate-firms',
    description: 'Consolidates and deduplicates firms from all sources',
    transform: async ({ context }) => {
      console.log('🔄 Step 4: Consolidating and deduplicating firms...');
      
      const { machineContext } = context;
      const outputs = machineContext?.outputs || {};
      
      const googlePlacesFirms = outputs['query-google-places']?.googlePlacesFirms || [];
      const googleSearchFirms = outputs['scrape-google-search']?.googleSearchFirms || [];
      const specializedFirms = outputs['extract-from-specialized-sites']?.specializedSiteFirms || [];
      
      // Combine all firms
      const allFirms = [
        ...googlePlacesFirms.map((f: any) => ({ source: 'Google Places', ...f })),
        ...googleSearchFirms.map((f: any) => ({ source: 'Google Search', ...f })),
        ...specializedFirms.map((f: any) => ({ source: 'Specialized Sites', ...f })),
      ];
      
      // Simple deduplication by website URL
      const uniqueFirms = allFirms.reduce((acc: any[], firm: any) => {
        const exists = acc.find(f => 
          f.website && firm.website && f.website.toLowerCase() === firm.website.toLowerCase()
        );
        if (!exists) {
          acc.push(firm);
        }
        return acc;
      }, []);
      
      console.log(`   Total firms discovered: ${allFirms.length}`);
      console.log(`   Unique firms after deduplication: ${uniqueFirms.length}`);
      
      return { consolidatedFirms: uniqueFirms };
    },
  }));

  /**
   * Step 5: Visit each discovered website and extract contact emails (foreach)
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.foreach({
    stepId: 'visit-and-extract-emails',
    description: 'Visits each discovered website and extracts contact emails',
    getData: async ({ context }) => {
      const { machineContext } = context;
      const consolidatedFirms = machineContext?.outputs?.['consolidate-firms']?.consolidatedFirms || [];
      return consolidatedFirms;
    },
    execute: async ({ item, context }) => {
      console.log(`📧 Step 5: Extracting emails from ${item.name}...`);
      
      // This would use the processFirmWebsiteTool to:
      // 1. Visit the website
      // 2. Extract text content
      // 3. Find email addresses
      
      // Mock email extraction
      const emails = item.website ? [`contact@${item.website.replace('https://', '').replace('http://', '').split('/')[0]}`] : [];
      const websiteContent = 'Mock website content with ecological keywords: durable, écologie, bioclimatique';
      
      return {
        ...item,
        emails,
        websiteContent,
      };
    },
  }));

  /**
   * Step 6: Qualify each firm using Dust AI (foreach)
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.foreach({
    stepId: 'qualify-firm-with-dust-ai',
    description: 'Sends website content to Dust AI for ecological qualification',
    getData: async ({ context }) => {
      const { machineContext } = context;
      const firmsWithEmails = machineContext?.outputs?.['visit-and-extract-emails'] || [];
      return Array.isArray(firmsWithEmails) ? firmsWithEmails : [];
    },
    execute: async ({ item, context }) => {
      console.log(`🤖 Step 6: Qualifying ${item.name} with Dust AI...`);
      
      // Import the Dust AI tool dynamically
      const { qualifyFirmWithDustAiTool } = await import('../tools/dustAiTool');
      
      // Execute Dust AI qualification
      const qualification = await qualifyFirmWithDustAiTool.execute({
        context: {
          firmName: item.name,
          websiteUrl: item.website || 'N/A',
          websiteContent: item.websiteContent || '',
          emails: item.emails || [],
        },
      });
      
      console.log(`   Score: ${qualification.qualificationScore}/10, Qualified: ${qualification.isQualified}`);
      
      return {
        ...item,
        ...qualification,
      };
    },
  }));

  /**
   * Step 7: Store results in database (using LibSQL/PostgreSQL)
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'store-results-sqlite',
    description: 'Stores all discovered and qualified firm data into database',
    transform: async ({ context }) => {
      console.log('💾 Step 7: Storing results in database...');
      
      const { machineContext } = context;
      const qualifiedFirms = machineContext?.outputs?.['qualify-firm-with-dust-ai'] || [];
      
      // Filter only qualified firms (score >= 5)
      const onlyQualified = Array.isArray(qualifiedFirms) 
        ? qualifiedFirms.filter((f: any) => f.isQualified)
        : [];
      
      console.log(`   Storing ${onlyQualified.length} qualified firms in database`);
      
      // In production, this would use Mastra's database engine to store results
      // For now, we'll just pass the data forward
      
      return { 
        qualifiedFirms: onlyQualified,
        runDate: new Date().toISOString(),
      };
    },
  }));

  /**
   * Step 8: Generate CSV summary of qualified prospects
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'generate-csv-summary',
    description: 'Generates a CSV summary of qualified prospects',
    transform: async ({ context }) => {
      console.log('📊 Step 8: Generating CSV summary...');
      
      const { machineContext } = context;
      const storeResults = machineContext?.outputs?.['store-results-sqlite'] || {};
      const qualifiedFirms = storeResults.qualifiedFirms || [];
      
      // Import the CSV generation tool
      const { generateCsvTool } = await import('../tools/prospectingTools');
      
      const csvResult = await generateCsvTool.execute({
        context: { firms: qualifiedFirms },
      });
      
      console.log(`   CSV generated: ${csvResult.csvPath}`);
      console.log(`   Total qualified firms: ${csvResult.firmCount}`);
      
      return {
        csvPath: csvResult.csvPath,
        firmCount: csvResult.firmCount,
        qualifiedFirms,
      };
    },
  }));

  /**
   * Step 9: Send email summary to michael@filtreplante.com
   */
  ecoArchitectProspectingWorkflow.step(ecoArchitectProspectingWorkflow.transform({
    stepId: 'send-email-summary',
    description: 'Sends email with CSV summary to michael@filtreplante.com',
    transform: async ({ context }) => {
      console.log('📬 Step 9: Sending email summary...');
      
      const { machineContext } = context;
      const csvData = machineContext?.outputs?.['generate-csv-summary'] || {};
      
      // Import the email tool
      const { sendEmailSummaryTool } = await import('../tools/prospectingTools');
      
      const emailResult = await sendEmailSummaryTool.execute({
        context: {
          csvPath: csvData.csvPath || './qualified_prospects.csv',
          firmCount: csvData.firmCount || 0,
          summary: `Prospection automatique bi-hebdomadaire
          
  Nombre de cabinets découverts: [total from all sources]
  Nombre de cabinets qualifiés: ${csvData.firmCount}

  Les cabinets qualifiés répondent aux critères écologiques suivants:
  - Score minimum: 5/10
  - Engagement écologique vérifié par Dust AI
  - Contacts emails extraits`,
        },
      });
      
      console.log(`   Email sent: ${emailResult.emailSent}`);
      console.log(`   Recipient: ${emailResult.recipient}`);
      
      return {
        emailSent: emailResult.emailSent,
        recipient: emailResult.recipient,
        summary: 'Bi-weekly prospecting automation completed successfully',
      };
    },
  }));

  /**
   * Commit all workflow steps
   */
  ecoArchitectProspectingWorkflow.commit();
  