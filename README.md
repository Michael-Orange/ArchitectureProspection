# Prospection Automatisée - Cabinets d'Architecture Écologique au Sénégal

  ## 📋 Description

  Cette automation découvre et qualifie automatiquement les cabinets d'architecture écologique au Sénégal.
  Elle s'exécute de manière bi-hebdomadaire et envoie un rapport CSV par email.

  ## 🤖 Utilisation de Dust AI

  Ce projet utilise **Dust AI** pour la qualification intelligente des cabinets d'architecture basée sur leur engagement écologique.

  ### Pourquoi Dust AI ?

  Dust AI analyse le contenu des sites web des cabinets et évalue leur engagement écologique selon des critères précis :
  - Mention explicite de pratiques écologiques/durables
  - Portfolio montrant des projets éco-responsables
  - Certifications (HQE, LEED, BREEAM, etc.)
  - Utilisation de matériaux locaux/durables
  - Approche bioclimatique/passive
  - Intégration d'énergies renouvelables

  ### Configuration requise

  1. **Créer un compte Dust AI** : https://dust.tt/
  2. **Obtenir vos credentials** :
     - `DUST_API_KEY` : Clé API de votre workspace Dust
     - `DUST_WORKSPACE_ID` : ID de votre workspace Dust
     - `DUST_AGENT_ID` (optionnel) : ID d'un agent spécifique à utiliser

  3. **Ajouter les secrets dans Replit** :
     - Ouvrez l'onglet "Secrets" (icône cadenas)
     - Ajoutez ces variables d'environnement :
       - `DUST_API_KEY` = votre_clé_api
       - `DUST_WORKSPACE_ID` = votre_workspace_id
       - `DUST_AGENT_ID` = votre_agent_id (optionnel)

  ## ⚙️ Configuration

  ### Variables d'environnement requises

  ```bash
  # Dust AI (REQUIS)
  DUST_API_KEY=sk-dust-xxxxx
  DUST_WORKSPACE_ID=w-xxxxx
  DUST_AGENT_ID=agent-xxxxx  # Optionnel, par défaut utilise "dust"

  # Cron Schedule (OPTIONNEL)
  SCHEDULE_CRON_EXPRESSION="0 9 * * 1"  # Défaut: Chaque lundi à 9h00 UTC

  # Google Places API (OPTIONNEL pour améliorer les résultats)
  GOOGLE_PLACES_API_KEY=votre_clé_api
  ```

  ### Fréquence d'exécution

  Par défaut, l'automation s'exécute **chaque lundi à 9h00 UTC**.

  Pour changer la fréquence, modifiez `SCHEDULE_CRON_EXPRESSION` :
  - `"0 9 * * 1"` : Chaque lundi à 9h00
  - `"0 9 1,15 * *"` : Le 1er et 15 de chaque mois à 9h00
  - `"0 9 * * 0"` : Chaque dimanche à 9h00
  - `"0 14 * * 3"` : Chaque mercredi à 14h00

  ## 🔄 Workflow

  L'automation suit ces étapes :

  1. **Query Google Places** : Recherche de cabinets d'architecture via l'API Google Places
  2. **Scrape Google Search** : Recherche web avec des requêtes ciblées sur l'écologie
  3. **Extract Specialized Sites** : Extraction depuis les annuaires spécialisés
  4. **Consolidate Firms** : Déduplication et consolidation des résultats
  5. **Extract Emails** (foreach) : Visite de chaque site web pour extraire les emails
  6. **Qualify with Dust AI** (foreach) : Qualification intelligente avec Dust AI
  7. **Store Results** : Sauvegarde des résultats dans la base de données
  8. **Generate CSV** : Génération d'un rapport CSV
  9. **Send Email** : Envoi du rapport à michael@filtreplante.com

  ## 🧪 Test de l'automation

  Pour tester l'automation manuellement sans attendre le cron :

  ```bash
  npx tsx tests/testCronAutomation.ts
  ```

  Cela déclenchera immédiatement le workflow et vous pourrez voir les résultats.

  ## 📊 Résultats

  Chaque exécution génère :
  - **Un fichier CSV** : `qualified_prospects_YYYY-MM-DD.csv`
  - **Un email récapitulatif** envoyé à michael@filtreplante.com

  Le CSV contient :
  - Nom du cabinet
  - Site web
  - Emails de contact
  - Score de qualification (0-10)
  - Mots-clés écologiques trouvés
  - Localisation

  ## 🚀 Déploiement

  Une fois testé, publiez l'automation :

  1. Vérifiez que tous les secrets sont configurés
  2. Testez avec `npx tsx tests/testCronAutomation.ts`
  3. Cliquez sur "Deploy" dans Replit
  4. L'automation s'exécutera automatiquement selon le cron défini

  ## 📚 Documentation Dust AI

  - Documentation officielle : https://docs.dust.tt/
  - API Reference : https://docs.dust.tt/reference/developer-platform-overview
  - Quickstart : https://docs.dust.tt/reference/quickstart

  ## 🛠️ Développement

  Structure du projet :

  ```
  src/
  ├── mastra/
  │   ├── agents/
  │   │   └── ecoArchitectProspectingAgent.ts  # Agent principal
  │   ├── tools/
  │   │   ├── dustAiTool.ts                    # Outil Dust AI
  │   │   └── prospectingTools.ts              # Autres outils
  │   ├── workflows/
  │   │   └── ecoArchitectProspectingWorkflow.ts
  │   └── index.ts                              # Configuration Mastra
  └── triggers/
      └── cronTriggers.ts                       # Configuration cron
  ```

  ## ❓ Support

  Pour toute question ou problème :
  1. Vérifiez que vos credentials Dust AI sont corrects
  2. Consultez les logs dans la console Replit
  3. Testez manuellement avec le script de test

  ## 📝 Notes

  - Les résultats sont stockés dans PostgreSQL pour un historique complet
  - La qualification par Dust AI peut prendre quelques secondes par cabinet
  - Le score minimum de qualification est 5/10
  - Seuls les cabinets qualifiés apparaissent dans le rapport final
  