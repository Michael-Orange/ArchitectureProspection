import { createTool } from '@mastra/core';
  import { z } from 'zod';

  /**
   * Tool to qualify a firm using Dust AI
   * This tool sends website content to Dust AI for ecological architecture qualification
   */
  export const qualifyFirmWithDustAiTool = createTool({
    id: 'qualify-firm-with-dust-ai',
    description: 'Analyze firm website content using Dust AI to determine ecological commitment score',
    inputSchema: z.object({
      firmName: z.string().describe('Name of the architecture firm'),
      websiteUrl: z.string().describe('URL of the firm website'),
      websiteContent: z.string().describe('Extracted text content from the website'),
      emails: z.array(z.string()).describe('Contact emails found on the website'),
    }),
    outputSchema: z.object({
      firmName: z.string(),
      isQualified: z.boolean(),
      qualificationScore: z.number().min(0).max(10),
      ecoKeywords: z.array(z.string()),
      reasoning: z.string().optional(),
    }),
    execute: async ({ context }) => {
      const { firmName, websiteUrl, websiteContent, emails } = context;
      
      const DUST_API_KEY = process.env.DUST_API_KEY;
      const DUST_WORKSPACE_ID = process.env.DUST_WORKSPACE_ID;
      const DUST_AGENT_ID = process.env.DUST_AGENT_ID || 'dust'; // Default agent
      
      if (!DUST_API_KEY || !DUST_WORKSPACE_ID) {
        console.error('❌ DUST_API_KEY and DUST_WORKSPACE_ID must be set in environment variables');
        return {
          firmName,
          isQualified: false,
          qualificationScore: 0,
          ecoKeywords: [],
          reasoning: 'Missing Dust AI credentials',
        };
      }
      
      try {
        const truncatedContent = websiteContent.length > 3000 
          ? websiteContent.substring(0, 3000) + '...' 
          : websiteContent;
        
        // Create a conversation with Dust AI to analyze the firm
        const conversationResponse = await fetch(
          `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}/assistant/conversations`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${DUST_API_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: `Qualification: ${firmName}`,
              visibility: 'unlisted',
              message: {
                content: `Analyse cette entreprise d'architecture sénégalaise et évalue son engagement écologique sur une échelle de 0 à 10.

  **Entreprise:** ${firmName}
  **Site web:** ${websiteUrl}
  **Emails de contact:** ${emails.join(', ')}

  **Contenu du site web:**
  ${truncatedContent}

  **Critères de notation (0-10):**
  - Mention explicite de pratiques écologiques/durables: +3 points
  - Portfolio montrant des projets éco-responsables: +2 points
  - Certifications (HQE, LEED, BREEAM, etc.): +2 points
  - Utilisation de matériaux locaux/durables mentionnée: +1 point
  - Approche bioclimatique/passive: +1 point
  - Intégration d'énergies renouvelables: +1 point

  **Score minimum de qualification:** 5/10

  Réponds au format JSON suivant:
  {
    "score": <nombre entre 0 et 10>,
    "isQualified": <true si score >= 5, false sinon>,
    "ecoKeywords": [<liste des mots-clés écologiques trouvés>],
    "reasoning": "<explication courte du score>"
  }`,
                mentions: [],
                context: {
                  timezone: 'UTC',
                  username: 'automation',
                  email: 'automation@filtreplante.com',
                  fullName: 'Prospecting Automation',
                  profilePictureUrl: null,
                },
              },
            }),
          }
        );
        
        if (!conversationResponse.ok) {
          throw new Error(`Dust API error: ${conversationResponse.status} ${conversationResponse.statusText}`);
        }
        
        const conversationData = await conversationResponse.json();
        const conversationId = conversationData.conversation.sId;
        
        // Wait for the agent response by polling events
        let attempts = 0;
        const maxAttempts = 30;
        let agentResponse = '';
        
        while (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
          
          const eventsResponse = await fetch(
            `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}/assistant/conversations/${conversationId}/events`,
            {
              headers: {
                'Authorization': `Bearer ${DUST_API_KEY}`,
                'Accept': 'application/json',
              },
            }
          );
          
          if (eventsResponse.ok) {
            const events = await eventsResponse.json();
            
            // Look for agent message content
            const agentMessages = events.events?.filter((e: any) => 
              e.type === 'agent_message' && e.content
            );
            
            if (agentMessages && agentMessages.length > 0) {
              const lastMessage = agentMessages[agentMessages.length - 1];
              agentResponse = lastMessage.content || '';
              break;
            }
          }
          
          attempts++;
        }
        
        if (!agentResponse) {
          console.warn(`⚠️  No response from Dust AI for ${firmName}`);
          return {
            firmName,
            isQualified: false,
            qualificationScore: 0,
            ecoKeywords: [],
            reasoning: 'No response from Dust AI',
          };
        }
        
        // Parse JSON response from agent
        const jsonMatch = agentResponse.match(/\{[^}]*"score"[^}]*\}/);
        if (jsonMatch) {
          const result = JSON.parse(jsonMatch[0]);
          return {
            firmName,
            isQualified: result.isQualified || result.score >= 5,
            qualificationScore: result.score || 0,
            ecoKeywords: result.ecoKeywords || [],
            reasoning: result.reasoning,
          };
        }
        
        // Fallback: basic keyword analysis if JSON parsing fails
        const ecoKeywords: string[] = [];
        const keywords = [
          'écologie', 'durable', 'sustainable', 'vert', 'green',
          'bioclimatique', 'passive', 'HQE', 'LEED', 'BREEAM',
          'éco-construction', 'matériaux locaux', 'énergies renouvelables'
        ];
        
        keywords.forEach(keyword => {
          if (websiteContent.toLowerCase().includes(keyword.toLowerCase())) {
            ecoKeywords.push(keyword);
          }
        });
        
        const score = Math.min(10, ecoKeywords.length);
        
        return {
          firmName,
          isQualified: score >= 5,
          qualificationScore: score,
          ecoKeywords,
          reasoning: agentResponse,
        };
        
      } catch (error) {
        console.error(`Error qualifying ${firmName} with Dust AI:`, error);
        return {
          firmName,
          isQualified: false,
          qualificationScore: 0,
          ecoKeywords: [],
          reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  });
  