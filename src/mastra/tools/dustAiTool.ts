import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const qualifyFirmWithDustAiTool = createTool({
  id: "qualify-firm-with-dust-ai",
  description: "Qualify a firm using Dust AI agent. Returns score 1-5 with qualification details.",
  inputSchema: z.object({
    firmName: z.string().describe("Name of the architecture firm"),
    websiteUrl: z.string().describe("URL of the firm website"),
    websiteContent: z.string().describe("Extracted text content from the website"),
    emails: z.string().describe("JSON array of contact emails"),
    source: z.string().optional().describe("Source where the firm was discovered"),
  }),
  outputSchema: z.object({
    firmName: z.string(),
    websiteUrl: z.string(),
    emails: z.array(z.string()),
    source: z.string(),
    score: z.number(),
    pertinent: z.boolean(),
    raison: z.string(),
    projet_recent: z.string().nullable(),
    typologies: z.array(z.string()),
    langue: z.string(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    const { firmName, websiteUrl, websiteContent, source } = inputData;

    let emailsList: string[] = [];
    try { emailsList = JSON.parse(inputData.emails); } catch { emailsList = []; }

    const DUST_API_KEY = process.env.DUST_API_KEY;
    const DUST_WORKSPACE_ID = process.env.DUST_WORKSPACE_ID || "3QJdFW4JIF";
    const DUST_AGENT_ID = process.env.DUST_AGENT_ID || "3hKwn579Sc";

    logger?.info(`🤖 [dustAi] Qualifying: ${firmName}`);

    if (!DUST_API_KEY) {
      logger?.error("❌ [dustAi] DUST_API_KEY not set");
      return {
        firmName, websiteUrl, emails: emailsList, source: source || "",
        score: 1, pertinent: false, raison: "DUST_API_KEY not configured",
        projet_recent: null, typologies: [], langue: "fr",
      };
    }

    try {
      const truncatedContent = websiteContent.length > 4000
        ? websiteContent.substring(0, 4000) + "..."
        : websiteContent;

      const promptContent = `Analyse cette entreprise d'architecture sénégalaise et évalue son engagement écologique.

**Entreprise:** ${firmName}
**Site web:** ${websiteUrl}
**Emails:** ${emailsList.join(", ") || "Non trouvé"}
**Source:** ${source || "Inconnu"}

**Contenu du site web:**
${truncatedContent}

**Échelle de notation (1-5):**
- Score 1: Aucune mention d'écologie/durabilité
- Score 2: Mentions vagues, pas de projets concrets
- Score 3: Quelques références écologiques, 1-2 projets identifiables (QUALIFIÉ)
- Score 4: Engagement écologique clair, plusieurs projets durables (QUALIFIÉ)
- Score 5: Spécialiste reconnu en architecture écologique (QUALIFIÉ)

**Critères:** BTC, pisé, terre crue, bioclimatique, HQE, LEED, BREEAM, matériaux locaux, énergies renouvelables

Réponds UNIQUEMENT avec un objet JSON valide (sans markdown):
{"score": <1-5>, "pertinent": <true/false>, "raison": "<texte>", "projet_recent": "<texte ou null>", "typologies": ["<type>"], "langue": "<fr ou en>"}`;

      const conversationResponse = await fetch(
        `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}/assistant/conversations`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${DUST_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `Qualification: ${firmName}`,
            visibility: "unlisted",
            message: {
              content: promptContent,
              mentions: [{ configurationId: DUST_AGENT_ID }],
              context: {
                timezone: "UTC",
                username: "automation",
                email: "automation@filtreplante.com",
                fullName: "Prospecting Automation",
                profilePictureUrl: null,
              },
            },
          }),
        }
      );

      if (!conversationResponse.ok) {
        const errorText = await conversationResponse.text();
        throw new Error(`Dust API ${conversationResponse.status}: ${errorText.substring(0, 200)}`);
      }

      const conversationData = await conversationResponse.json();
      const conversationId = conversationData.conversation?.sId;

      if (!conversationId) {
        throw new Error("No conversation ID returned from Dust API");
      }

      logger?.info(`🤖 [dustAi] Conversation created: ${conversationId}, waiting for response...`);

      let agentResponse = "";
      for (let attempt = 0; attempt < 45; attempt++) {
        await new Promise(r => setTimeout(r, 2000));

        try {
          const messagesResponse = await fetch(
            `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}/assistant/conversations/${conversationId}`,
            {
              headers: { "Authorization": `Bearer ${DUST_API_KEY}` },
            }
          );

          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json();
            const conversation = messagesData.conversation;

            if (conversation?.content) {
              for (const messageGroup of conversation.content) {
                for (const msg of messageGroup) {
                  if (msg.type === "agent_message" && msg.status === "succeeded" && msg.content) {
                    agentResponse = msg.content;
                    break;
                  }
                }
                if (agentResponse) break;
              }
            }
          }
        } catch (err) {
          logger?.warn(`⚠️ [dustAi] Polling error: ${err}`);
        }

        if (agentResponse) break;
      }

      if (!agentResponse) {
        logger?.warn(`⚠️ [dustAi] No response from Dust AI for ${firmName}`);
        return {
          firmName, websiteUrl, emails: emailsList, source: source || "",
          score: 1, pertinent: false, raison: "Timeout: no Dust AI response",
          projet_recent: null, typologies: [], langue: "fr",
        };
      }

      logger?.info(`🤖 [dustAi] Response received for ${firmName}`);

      let jsonText = agentResponse.trim();
      jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        try {
          const result = JSON.parse(jsonMatch[0]);
          const score = Math.max(1, Math.min(5, result.score || 1));
          const pertinent = result.pertinent !== undefined ? result.pertinent : score >= 3;

          logger?.info(`✅ [dustAi] ${firmName}: Score ${score}/5, Qualified: ${pertinent}`);

          return {
            firmName, websiteUrl, emails: emailsList, source: source || "",
            score, pertinent,
            raison: result.raison || "Qualification automatique",
            projet_recent: result.projet_recent || null,
            typologies: Array.isArray(result.typologies) ? result.typologies : [],
            langue: (result.langue === "en" ? "en" : "fr"),
          };
        } catch (parseErr) {
          logger?.error(`❌ [dustAi] JSON parse error for ${firmName}: ${parseErr}`);
        }
      }

      logger?.warn(`⚠️ [dustAi] Fallback keyword analysis for ${firmName}`);
      const keywords = ["écologie", "durable", "sustainable", "bioclimatique", "HQE", "LEED", "BTC", "pisé", "terre"];
      let found = 0;
      const foundKeywords: string[] = [];
      keywords.forEach(kw => {
        if (websiteContent.toLowerCase().includes(kw.toLowerCase())) { found++; foundKeywords.push(kw); }
      });
      const fallbackScore = Math.min(5, Math.max(1, Math.ceil(found / 2)));

      return {
        firmName, websiteUrl, emails: emailsList, source: source || "",
        score: fallbackScore, pertinent: fallbackScore >= 3,
        raison: `Fallback analysis. Keywords: ${foundKeywords.join(", ")}`,
        projet_recent: null, typologies: [], langue: "fr",
      };
    } catch (err) {
      logger?.error(`❌ [dustAi] Error qualifying ${firmName}: ${err}`);
      return {
        firmName, websiteUrl, emails: emailsList, source: source || "",
        score: 1, pertinent: false,
        raison: `Error: ${err instanceof Error ? err.message : String(err)}`,
        projet_recent: null, typologies: [], langue: "fr",
      };
    }
  },
});
