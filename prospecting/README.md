# Prospecting - SocialCreator

Package Python de prospection B2B (cold email / outbound / génération de leads), pour **SocialCreator**.

Pipeline : **discovery → qualification → enrichissement → personnalisation → envoi** (respect du DRY_RUN, quota, unsubscribe RFC 8058).

---

## Installation

```bash
pip install -r requirements.txt
cp .env.example .env   # puis éditez vos secrets
```

## Architecture

```
prospecting/
├── run.py                      # CLI entry point
├── config/icp.json             # Ideal Customer Profile (seuils, marchés, requêtes)
├── requirements.txt
├── tests/                      # 21 tests unitaires
│   ├── test_prospecting.py
│   └── validate.py
└── src/
    ├── __init__.py
    ├── config.py               # load_icp, load_config_from_env, is_dry_run, is_heuristic_mode, is_configured
    ├── utils.py                # normalize_domain, is_valid_domain, ensure_dir, Logger, smart_delay
    ├── prospecting_types.py    # Company, Contact, ProspectStatus, SearchResult, QualificationResult, PipelineResult, Draft
    ├── crm.py                  # CRM SQLite (companies, contacts, events, drafts)
    ├── lock.py                 # RunnerLock (évite l'exécution concurrente)
    ├── llm/                    # LLMManager + HeuristicEngine (fallback sans clé API)
    ├── email/                  # sender.py (Resend + unsubscribe HMAC-SHA256 RFC 8058)
    ├── qualifier.py            # qualification heuristique (signaux métier forts/négatifs)
    ├── enricher.py             # site harvest + vérification email MX/SMTP + decision makers
    ├── personalizer.py         # templates d'emails + personnalisation LLM
    ├── outbound_email/         # compatibilité legacy
    ├── notifications/          # webhook Discord résumé de run
    ├── pipeline/               # étapes du pipeline (discover, qualify, enrich, personalize, send, replies, stats)
    └── adapters/discovery/     # adaptateurs de découverte (Google SERP, répertoires annuaires)
```

## Démarrage rapide

```bash
# 1. Configuration
cp .env.example .env
# Éditer : LLM_API_KEY, RESEND_API_KEY, DRY_RUN=true, USE_HEURISTIC=true

# 2. Run complet en mode sécurisé
python run.py --stage all --dry-run --limit 20

# 3. Étape par étape
python run.py --stage discovery --limit 15
python run.py --stage qualify --limit 15
python run.py --stage enrich --limit 5
python run.py --stage personalize --limit 5
python run.py --stage send --dry-run

# 4. Statistiques
python run.py --stage stats

# 5. Marquer une réponse
python run.py --stage replies --domain exemple.com
```

## États des prospects

| État           | Signification                            |
| -------------- | ---------------------------------------- |
| `discovered`   | Trouvé par discovery                     |
| `qualified`    | Score ≥ seuil ICp                        |
| `rejected`     | Hors cible (spam, concurrent, B2C)       |
| `enriched`     | Site crawlé, email(s) trouvé(s)          |
| `drafted`      | Brouillon d'email créé                   |
| `approved`     | Approuvé pour envoi (avec revue humaine) |
| `declined`     | Rejeté après revue                       |
| `sent`         | Email envoyé (DRY_RUN ou réel)           |
| `replied`      | Prospect a répondu                       |
| `unsubscribed` | S'est désabonné                          |

## Qualification heuristique (Sans LLM)

Quand aucun LLM n'est configuré (`USE_HEURISTIC=true`), le scoring utilise des signaux battle-tested portés de MailGuardPro :

- **Signaux forts** (+10 à +35) : cold email, outreach, lead generation, prospection, email marketing, Klaviyo, HubSpot, RevOps...
- **Signaux du domaine** : si le domaine contient `coldemail`, `leadgen`, `outbound`, etc.
- **Agences connues** : Belkins, Martal, Callbox... (+30)
- **Signaux négatifs** (-20 à -50) : immobilier, restaurant, mairie, association, graphiste, télémarketing, annuaire, news, blog...
- **Concurrents** (-60) : ZeroBounce, NeverBounce, Hunter.io, Dropcontact, Apollo, etc.

## Enrichissement

1. **Site harvesting** : crawl jusqu'à 5 pages (contact, about, team, leadership, impression), extraction des emails (`mailto:` + texte visible).
2. **Vérification email** : résolution MX + test SMTP RCPT TO (délivrable / invalide / inconnu / catch-all).
3. **Decision makers** : extraction nom + titre depuis le HTML, priorisation CEO/Founder/Directeur...

## Envoi d'emails (Resend)

- **DRY_RUN** (par défaut) : aucun email ne part, le statut passe à `sent` pour simulation.
- **Unsubscribe (RFC 8058)** : headers `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`, token HMAC-SHA256.
- **Variables d'environnement** : `RESEND_API_KEY`, `RESEND_FROM`, `UNSUBSCRIBE_URL`, `UNSUBSCRIBE_SECRET`.

## Nettoyage des sessions CLI

Quand la découverte utilise le fallback LLM `opencode --auto` ou `kilo --auto`,
chaque appel crée une session côté CLI. Le package lance désormais les CLI en
mode JSON (`--format json`), récupère l'`sessionID` et **supprime la session à
la fin de chaque recherche**, y compris en cas d'erreur ou de timeout. Aucune
session interactive n'est touchée : seule la session créée par l'appel est
ciblée via `session delete <id>`.

## Verrouillage du runner

Un seul runner à la fois (`RunnerLock` sur `data/runner.lock`), évite les exécutions concurrentes en production.

## Variables d'environnement

| Variable             | Défaut                                  | Description                             |
| -------------------- | --------------------------------------- | --------------------------------------- |
| `DRY_RUN`            | `true`                                  | Mode sec (aucun envoi réel)             |
| `USE_HEURISTIC`      | `true`                                  | Qualification heuristique si pas de LLM |
| `LLM_API_KEY`        | -                                       | Clé API LLM (Groq/OpenAI/Anthropic)     |
| `GROQ_API_KEY`       | -                                       | Clé API Groq                            |
| `RESEND_API_KEY`     | -                                       | Clé API Resend (envoi réel)             |
| `RESEND_FROM`        | `outreach@votre-domaine.com`            | Adresse expéditeur                      |
| `UNSUBSCRIBE_URL`    | `https://votre-domaine.com/unsubscribe` | URL de désabonnement                    |
| `UNSUBSCRIBE_SECRET` | `change-me-in-production`               | Secret HMAC pour les tokens unsubscribe |
| `DATABASE_URL`       | -                                       | PostgreSQL (Neon) pour CRM cloud        |
| `SQLITE_PATH`        | `data/crm.db`                           | Chemin SQLite local                     |

## Tests

```bash
# Tous les tests
python -m pytest tests/ -v

# Validation rapide des imports
python tests/validate.py

# Run end-to-end sécurisé
python run.py --stage all --dry-run --limit 10
```

## Références

- MailGuardPro (source des signaux de qualification, enrichissement, templates)
- PromptBearer (architecture de référence, Prisma/PostgreSQL, admin API)
- COMMUNEScraper, EntreprisesScraper, YtEmail (autres projets de prospection)

---

**Pipeline complet validé** : 21 tests unitaires passent, run en DRY_RUN vérifié de bout en bout.
