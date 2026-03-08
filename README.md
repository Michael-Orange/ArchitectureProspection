# Prospection Automatisée - Cabinets d'Architecture Écologique au Sénégal

  ## 📋 Description

  Cette automation découvre et qualifie automatiquement les cabinets d'architecture écologique au Sénégal.
  Elle s'exécute de manière bi-hebdomadaire (chaque **samedi à 15h00 UTC**) et envoie un rapport CSV par email.

  ## 🤖 Utilisation de Dust AI

  Ce projet utilise **Dust AI** pour la qualification intelligente des cabinets d'architecture basée sur leur engagement écologique.

  ### Score de qualification (1-5)

  Dust AI évalue chaque cabinet sur une échelle de **1 à 5** :

  - **Score 1-2** : Non qualifié (pas d'engagement écologique clair)
  - **Score 3** : Quelques références écologiques, 1-2 projets identifiables ✅ **QUALIFIÉ**
  - **Score 4** : Engagement écologique clair, plusieurs projets durables ✅ **QUALIFIÉ**
  - **Score 5** : Spécialiste reconnu en architecture écologique ✅ **QUALIFIÉ**

  **Seuls les cabinets avec score >= 3 sont exportés dans le CSV final.**

  ### Format de réponse Dust AI

  L'agent Dust retourne un JSON structuré :

  ```json
  {
    "score": 3,                              // 1 à 5
    "pertinent": true,                       // true si score >= 3
    "raison": "Texte explicatif du score",
    "projet_recent": "Nom du projet" ou null,
    "typologies": ["habitat", "équipement public"],
    "langue": "fr" ou "en"
  }
  ```

  ### Critères d'évaluation

  - Projets éco-responsables dans le portfolio
  - Certifications (HQE, LEED, BREEAM)
  - Matériaux locaux/durables (BTC, pisé, terre)
  - Approche bioclimatique/passive
  - Énergies renouvelables
  - Typologies : habitat, équipement public, tertiaire, industriel, infrastructure

  ## ⚙️ Configuration

  ### Variables d'environnement requises

  ```bash
  # Dust AI (REQUIS)
  DUST_API_KEY=sk-dust-xxxxx
  DUST_WORKSPACE_ID=w-xxxxx
  DUST_AGENT_ID=agent-xxxxx  # Optionnel

  # Cron Schedule (OPTIONNEL)
  SCHEDULE_CRON_EXPRESSION="0 15 * * 6"  # Défaut: Samedi 15h00 UTC

  # Google Places API (OPTIONNEL)
  GOOGLE_PLACES_API_KEY=votre_clé_api
  ```

  ### Configuration Dust AI

  1. **Créer un compte** : https://dust.tt/
  2. **Obtenir vos credentials** :
     - Allez dans Settings > Workspace > API Keys
     - Créez une nouvelle clé API
     - Notez votre `WORKSPACE_ID` (visible dans l'URL : `https://dust.tt/w/[workspace_id]/...`)
  3. **Ajouter dans Replit Secrets** :
     - Ouvrez l'onglet "Secrets" (🔒)
     - Ajoutez `DUST_API_KEY` et `DUST_WORKSPACE_ID`

  ### Fréquence d'exécution

  Par défaut : **Chaque samedi à 15h00 UTC**

  Pour changer la fréquence, modifiez `SCHEDULE_CRON_EXPRESSION` :
  - `"0 15 * * 6"` : Samedi 15h00 UTC (défaut)
  - `"0 9 * * 1"` : Lundi 9h00 UTC
  - `"0 15 1,15 * *"` : 1er et 15 du mois à 15h00 UTC

  ## 🔄 Workflow (6 étapes)

  ### 1. Initialize Database
  Préparation de la base de données PostgreSQL pour stocker les résultats.

  ### 2. Parallel Discovery (3 tracks)
  Découverte en parallèle via 3 sources :

  #### Track A: Google Places API
  Recherche de cabinets d'architecture au Sénégal via l'API Google Places.

  #### Track B: Google Search
  Recherche web avec requêtes ciblées :
  - "architecture écologique Sénégal"
  - "architecture durable Dakar"
  - "éco-construction Sénégal"
  - "BTC pisé architecture Sénégal"
  - "architecture terre crue Sénégal"

  #### Track C: Specialized Sites (BeautifulSoup)
  Extraction depuis des sites spécialisés :
  - **Aga Khan Award for Architecture** (akdn.org, archnet.org) - Projets primés en Afrique
  - **CRAterre** (craterre.org) - Réseau mondial architecture en terre
  - **LafargeHolcim Foundation** (lafargeholcim-foundation.org) - Prix construction durable
  - **Architecture sans Frontières** (asf-france.com) - Projets en Afrique
  - **Afrik21** (afrik21.africa) - Articles filtrés avec mots-clés : BTC, pisé, terre, bioclimatique

  ### 3. Consolidate Firms
  Déduplication des cabinets découverts (par URL du site web).

  ### 4. Process Each Firm (Foreach - Concurrency 5)
  Pour chaque cabinet découvert :
  1. **Visite du site web** : extraction du contenu et des emails (contact, about, footer, équipe)
  2. **Qualification Dust AI** : analyse intelligente → score 1-5
  3. **Stockage database** : sauvegarde des résultats

  ### 5. Generate CSV Report
  Génération du CSV avec **uniquement les cabinets score >= 3**.

  Colonnes du CSV :
  - Nom, Site Web, Emails
  - Score (1-5), Pertinent (true/false)
  - Raison de la qualification
  - Projet récent identifié
  - Typologies (habitat, équipement, etc.)
  - Langue (fr/en), Source de découverte

  ### 6. Send Email Summary
  Envoi du rapport à **michael@filtreplante.com** avec :
  - Statistiques de découverte
  - Taux de qualification
  - Fichier CSV en pièce jointe

  ## 🧪 Test de l'automation

  Pour tester manuellement sans attendre le samedi :

  ```bash
  npx tsx tests/testCronAutomation.ts
  ```

  Cela déclenche immédiatement le workflow complet et affiche les logs en temps réel.

  ## 📊 Résultats attendus

  Chaque exécution génère :
  - **CSV** : `qualified_prospects_YYYY-MM-DD.csv` (score >= 3 uniquement)
  - **Email** : Envoyé à michael@filtreplante.com avec statistiques et CSV

  Exemple de statistiques :
  ```
  Cabinets découverts : 45
  Cabinets uniques : 38
  Cabinets qualifiés (score >= 3) : 12
  Taux de qualification : 32%
  ```

  ## 🚀 Déploiement (Publishing)

  Une fois testé :

  1. ✅ Vérifiez que `DUST_API_KEY` et `DUST_WORKSPACE_ID` sont configurés
  2. 🧪 Testez avec `npx tsx tests/testCronAutomation.ts`
  3. 🚀 Cliquez sur "Deploy" dans Replit
  4. ⏰ L'automation s'exécutera automatiquement chaque samedi à 15h00 UTC

  Après publication, testez dans l'onglet **"Playground"** de Replit.

  ## 🛠️ Structure du projet

  ```
  src/
  ├── mastra/
  │   ├── agents/
  │   │   └── ecoArchitectProspectingAgent.ts
  │   ├── tools/
  │   │   ├── dustAiTool.ts              # Qualification Dust AI (1-5)
  │   │   └── prospectingTools.ts        # Discovery, scraping, CSV, email
  │   ├── workflows/
  │   │   └── ecoArchitectProspectingWorkflow.ts  # 6 steps
  │   └── index.ts                        # Mastra config + cron
  └── triggers/
      └── cronTriggers.ts                 # Time-based trigger
  ```

  ## 📚 Documentation

  - **Dust AI** : https://docs.dust.tt/
  - **API Reference** : https://docs.dust.tt/reference/developer-platform-overview
  - **Mastra Framework** : https://mastra.ai/

  ## ❓ FAQ

  **Q: Pourquoi score 1-5 et pas 0-10 ?**
  R: C'est le format standard de Dust AI pour la qualification. Plus simple et plus actionnable.

  **Q: Pourquoi seulement score >= 3 dans le CSV ?**
  R: Pour garantir la qualité des prospects. Scores 1-2 = pas d'engagement écologique clair.

  **Q: Comment Dust AI qualifie-t-il ?**
  R: Analyse du contenu du site web selon critères précis (projets, certifications, matériaux, etc.).

  **Q: Que faire si Dust AI ne répond pas ?**
  R: Le système a un fallback avec analyse par mots-clés écologiques.

  **Q: Combien de temps prend une exécution ?**
  R: 5-15 minutes selon le nombre de cabinets découverts (concurrency 5 pour la qualification).

  ## 📝 Notes techniques

  - **Scraping** : BeautifulSoup pour les sites spécialisés (pas Playwright pour l'instant)
  - **Parallel execution** : Les 3 tracks de découverte s'exécutent en parallèle
  - **Concurrency** : Foreach avec concurrency=5 pour optimiser le traitement
  - **Database** : PostgreSQL via Mastra (LibSQL engine)
  - **Email** : Via Replit Mail ou service configuré

  ## 🆘 Support

  En cas de problème :
  1. Vérifiez les logs dans la console Replit
  2. Confirmez que `DUST_API_KEY` et `DUST_WORKSPACE_ID` sont corrects
  3. Testez Dust AI manuellement : https://dust.tt/
  4. Vérifiez la connexion internet du Repl

  ---

  **Maintainer** : michael@filtreplante.com
  **Last updated** : 2026-03-08
  