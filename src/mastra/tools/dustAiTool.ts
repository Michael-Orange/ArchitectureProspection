import { createTool } from "@mastra/core/tools";
import { z } from "zod";

export const qualifyDustBatchTool = createTool({
  id: "qualify-dust-batch",
  description: "Qualify all firms in a single batch Dust AI API call. Returns scored firms with qualification details.",
  inputSchema: z.object({
    firmsJson: z.string().describe("JSON string of scraped firms array"),
  }),
  outputSchema: z.object({
    firmsJson: z.string(),
    qualifiedCount: z.number(),
    totalCount: z.number(),
  }),
  execute: async (inputData, context) => {
    const logger = context?.mastra?.getLogger();
    logger?.info("🤖 [dustBatch] Starting batch qualification...");

    let firms: any[] = [];
    try { firms = JSON.parse(inputData.firmsJson); } catch { firms = []; }

    if (firms.length === 0) {
      logger?.warn("⚠️ [dustBatch] No firms to qualify");
      return { firmsJson: "[]", qualifiedCount: 0, totalCount: 0 };
    }

    const DUST_API_KEY = process.env.DUST_API_KEY;
    const DUST_WORKSPACE_ID = process.env.DUST_WORKSPACE_ID || "3OUdFWdJIF";
    const DUST_AGENT_ID = process.env.DUST_AGENT_ID || "3hKwn579Sc";

    if (!DUST_API_KEY) {
      logger?.error("❌ [dustBatch] DUST_API_KEY not set, using fallback keyword scoring");
      const fallbackFirms = firms.map(f => applyKeywordFallback(f));
      const qualCount = fallbackFirms.filter(f => f.score >= 3).length;
      return { firmsJson: JSON.stringify(fallbackFirms), qualifiedCount: qualCount, totalCount: firms.length };
    }

    const firmsData = firms.map((firm: any, index: number) => ({
      id: index + 1,
      nom: firm.name || "N/A",
      pays: "Sénégal",
      site_web: firm.website || "N/A",
      contenu: (firm.scrapedContent || firm.snippet || firm.description || "").substring(0, 1500),
      mots_cles_detectes: (firm.keywords || []).join(", ") || "Aucun",
      projets_mentionnes: (firm.projects || []).join(", ") || "Aucun",
      emails: (firm.emails || []).join(", ") || "Non trouvé",
      source: firm.source || "Inconnu",
    }));

    const prompt = `Voici ${firmsData.length} cabinets d'architecture à qualifier pour leur engagement en architecture écologique au Sénégal.

CABINETS :
${JSON.stringify(firmsData, null, 2)}

ÉCHELLE DE NOTATION (1-5) :
- Score 1 : Aucune mention d'écologie/durabilité, ou pas un cabinet d'architecture
- Score 2 : Mentions vagues, pas de projets concrets écologiques
- Score 3 : Quelques références écologiques, 1-2 projets identifiables (QUALIFIÉ)
- Score 4 : Engagement écologique clair, plusieurs projets durables (QUALIFIÉ)
- Score 5 : Spécialiste reconnu en architecture écologique (QUALIFIÉ)

CRITÈRES : BTC, pisé, terre crue, bioclimatique, HQE, LEED, BREEAM, matériaux locaux, bio-sourcés, éco-construction, CRAterre

Réponds UNIQUEMENT avec un JSON array valide (sans markdown, sans commentaires) :
[{"id": 1, "score": <1-5>, "pertinent": <true/false>, "raison": "<texte court>", "projet_recent": "<texte ou null>", "typologies": ["<type>"], "langue": "<fr ou en>"}, ...]`;

    logger?.info(`🤖 [dustBatch] Sending ${firmsData.length} firms to Dust AI (prompt: ~${prompt.length} chars)`);

    try {
      let conversationResponse: Response | null = null;
      for (let retry = 0; retry < 3; retry++) {
        conversationResponse = await fetch(
          `https://dust.tt/api/v1/w/${DUST_WORKSPACE_ID}/assistant/conversations`,
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${DUST_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              title: `Batch Qualification - ${firmsData.length} cabinets`,
              visibility: "unlisted",
              message: {
                content: prompt,
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

        if (conversationResponse.ok) break;

        if (conversationResponse.status === 403 || conversationResponse.status === 429) {
          const waitTime = (retry + 1) * 15;
          logger?.warn(`⚠️ [dustBatch] Rate limited (${conversationResponse.status}), retrying in ${waitTime}s (attempt ${retry + 1}/3)`);
          await new Promise(r => setTimeout(r, waitTime * 1000));
          continue;
        }

        const errorText = await conversationResponse.text();
        throw new Error(`Dust API ${conversationResponse.status}: ${errorText.substring(0, 300)}`);
      }

      if (!conversationResponse || !conversationResponse.ok) {
        throw new Error("Dust API failed after 3 retries");
      }

      const conversationData = await conversationResponse.json();
      const conversationId = conversationData.conversation?.sId;

      if (!conversationId) {
        throw new Error("No conversation ID returned from Dust API");
      }

      logger?.info(`🤖 [dustBatch] Conversation created: ${conversationId}, polling for response...`);

      let agentResponse = "";
      for (let attempt = 0; attempt < 90; attempt++) {
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
          logger?.warn(`⚠️ [dustBatch] Polling error: ${err}`);
        }

        if (agentResponse) break;

        if (attempt % 10 === 0 && attempt > 0) {
          logger?.info(`   ⏳ [dustBatch] Still waiting for response... (${attempt * 2}s)`);
        }
      }

      if (!agentResponse) {
        logger?.warn("⚠️ [dustBatch] Timeout waiting for Dust AI response, using fallback");
        const fallbackFirms = firms.map(f => applyKeywordFallback(f));
        const qualCount = fallbackFirms.filter(f => f.score >= 3).length;
        return { firmsJson: JSON.stringify(fallbackFirms), qualifiedCount: qualCount, totalCount: firms.length };
      }

      logger?.info(`🤖 [dustBatch] Response received (${agentResponse.length} chars)`);

      let jsonText = agentResponse.trim();
      jsonText = jsonText.replace(/```json\s*/g, "").replace(/```\s*/g, "");
      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        logger?.warn("⚠️ [dustBatch] Could not parse JSON array from response, using fallback");
        const fallbackFirms = firms.map(f => applyKeywordFallback(f));
        const qualCount = fallbackFirms.filter(f => f.score >= 3).length;
        return { firmsJson: JSON.stringify(fallbackFirms), qualifiedCount: qualCount, totalCount: firms.length };
      }

      let qualifications: any[] = [];
      try {
        qualifications = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        logger?.error(`❌ [dustBatch] JSON parse error: ${parseErr}`);
        const fallbackFirms = firms.map(f => applyKeywordFallback(f));
        const qualCount = fallbackFirms.filter(f => f.score >= 3).length;
        return { firmsJson: JSON.stringify(fallbackFirms), qualifiedCount: qualCount, totalCount: firms.length };
      }

      logger?.info(`🤖 [dustBatch] Parsed ${qualifications.length} qualifications`);

      const qualifiedFirms = firms.map((firm: any, index: number) => {
        const qual = qualifications.find((q: any) => q.id === index + 1) || null;

        if (!qual) {
          return applyKeywordFallback(firm);
        }

        const score = Math.max(1, Math.min(5, qual.score || 1));
        const pertinent = qual.pertinent !== undefined ? qual.pertinent : score >= 3;

        return {
          ...firm,
          firmName: firm.name || "Unknown",
          websiteUrl: firm.website || "",
          score,
          pertinent,
          raison: qual.raison || "Qualification Dust AI",
          projet_recent: qual.projet_recent || null,
          typologies: Array.isArray(qual.typologies) ? qual.typologies : [],
          langue: qual.langue === "en" ? "en" : "fr",
        };
      });

      const qualifiedCount = qualifiedFirms.filter(f => f.score >= 3).length;
      logger?.info(`✅ [dustBatch] Qualification complete: ${qualifiedCount}/${firms.length} qualified (score >= 3)`);

      for (const f of qualifiedFirms) {
        const icon = f.pertinent ? "✅" : "❌";
        logger?.info(`   ${icon} ${f.firmName || f.name}: ${f.score}/5 — ${f.raison}`);
      }

      return { firmsJson: JSON.stringify(qualifiedFirms), qualifiedCount, totalCount: firms.length };
    } catch (err) {
      logger?.error(`❌ [dustBatch] Error: ${err}`);
      logger?.info("🔄 [dustBatch] Using keyword fallback for all firms");
      const fallbackFirms = firms.map(f => applyKeywordFallback(f));
      const qualCount = fallbackFirms.filter(f => f.score >= 3).length;
      return { firmsJson: JSON.stringify(fallbackFirms), qualifiedCount: qualCount, totalCount: firms.length };
    }
  },
});

function applyKeywordFallback(firm: any): any {
  const keywords = ["écologie", "durable", "sustainable", "bioclimatique", "HQE", "LEED", "BTC", "pisé", "terre", "bio-sourcés", "éco-construction"];
  const content = (firm.scrapedContent || firm.snippet || firm.description || "").toLowerCase();
  let found = 0;
  const foundKeywords: string[] = [];
  keywords.forEach(kw => {
    if (content.includes(kw.toLowerCase())) { found++; foundKeywords.push(kw); }
  });

  if ((firm.keywords || []).length > 0) {
    found += firm.keywords.length;
    foundKeywords.push(...firm.keywords);
  }

  const score = Math.min(5, Math.max(1, Math.ceil(found / 2)));

  return {
    ...firm,
    firmName: firm.name || "Unknown",
    websiteUrl: firm.website || "",
    score,
    pertinent: score >= 3,
    raison: `Fallback keywords: ${[...new Set(foundKeywords)].join(", ") || "aucun"}`,
    projet_recent: null,
    typologies: [],
    langue: "fr",
  };
}
