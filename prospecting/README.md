# Prospecting - SocialCreator

Package Python de prospection B2B (cold email / outbound / gÃ©nÃ©ration de leads), pour **SocialCreator**.

Pipeline : **discovery â†’ qualification â†’ enrichissement â†’ personnalisation â†’ envoi** (respect du DRY_RUN, quota, unsubscribe RFC 8058).

---

## Installation

```bash
pip install -r requirements.txt
cp .env.example .env   # puis Ã©ditez vos secrets
```

## Architecture

```
prospecting/
â”œâ”€â”€ run.py                      # CLI entry point
â”œâ”€â”€ config/icp.json             # Ideal Customer Profile (seuils, marchÃ©s, requÃªtes)
â”œâ”€â”€ requirements.txt
â”œâ”€â”€ tests/                      # 21 tests unitaires
â”‚   â”œâ”€â”€ test_prospecting.py
â”‚   â””â”€â”€ validate.py
â””â”€â”€ src/
    â”œâ”€â”€ __init__.py
    â”œâ”€â”€ config.py               # load_icp, load_config_from_env, is_dry_run, is_heuristic_mode, is_configured
    â”œâ”€â”€ utils.py                # normalize_domain, is_valid_domain, ensure_dir, Logger, smart_delay
    â”œâ”€â”€ prospecting_types.py    # Company, Contact, ProspectStatus, SearchResult, QualificationResult, PipelineResult, Draft
    â”œâ”€â”€ crm.py                  # CRM SQLite (companies, contacts, events, drafts)
    â”œâ”€â”€ lock.py                 # RunnerLock (Ã©vite l'exÃ©cution concurrente)
    â”œâ”€â”€ llm/                    # LLMManager + HeuristicEngine (fallback sans clÃ© API)
    â”œâ”€â”€ email/                  # sender.py (Resend + unsubscribe HMAC-SHA256 RFC 8058)
    â”œâ”€â”€ qualifier.py            # qualification heuristique (signaux mÃ©tier forts/nÃ©gatifs)
    â”œâ”€â”€ enricher.py             # site harvest + vÃ©rification email MX/SMTP + decision makers
    â”œâ”€â”€ personalizer.py         # templates d'emails + personnalisation LLM
    â”œâ”€â”€ outbound_email/         # compatibilitÃ© legacy
    â”œâ”€â”€ notifications/          # webhook Discord rÃ©sumÃ© de run
    â”œâ”€â”€ pipeline/               # Ã©tapes du pipeline (discover, qualify, enrich, personalize, send, replies, stats)
    â””â”€â”€ adapters/discovery/     # adaptateurs de dÃ©couverte (Google SERP, rÃ©pertoires annuaires)
```

## DÃ©marrage rapide

```bash
# 1. Configuration
cp .env.example .env
# Ã‰diter : LLM_API_KEY, RESEND_API_KEY, DRY_RUN=true, USE_HEURISTIC=true

# 2. Run complet en mode sÃ©curisÃ©
python run.py --stage all --dry-run --limit 20

# 3. Ã‰tape par Ã©tape
python run.py --stage discovery --limit 15
python run.py --stage qualify --limit 15
python run.py --stage enrich --limit 5
python run.py --stage personalize --limit 5
python run.py --stage send --dry-run

# 4. Statistiques
python run.py --stage stats

# 5. Marquer une rÃ©ponse
python run.py --stage replies --domain exemple.com
```

## Ã‰tats des prospects

| Ã‰tat | Signification |
|------|---------------|
| `discovered` | TrouvÃ© par discovery |
| `qualified` | Score â‰¥ seuil ICp |
| `rejected` | Hors cible (spam, concurrent, B2C) |
| `enriched` | Site crawlÃ©, email(s) trouvÃ©(s) |
| `drafted` | Brouillon d'email crÃ©Ã© |
| `approved` | ApprouvÃ© pour envoi (avec revue humaine) |
| `declined` | RejetÃ© aprÃ¨s revue |
| `sent` | Email envoyÃ© (DRY_RUN ou rÃ©el) |
| `replied` | Prospect a rÃ©pondu |
| `unsubscribed` | S'est dÃ©sabonnÃ© |

## Qualification heuristique (Sans LLM)

Quand aucun LLM n'est configurÃ© (`USE_HEURISTIC=true`), le scoring utilise des signaux battle-tested portÃ©s de MailGuardPro :

- **Signaux forts** (+10 Ã  +35) : cold email, outreach, lead generation, prospection, email marketing, Klaviyo, HubSpot, RevOps...
- **Signaux du domaine** : si le domaine contient `coldemail`, `leadgen`, `outbound`, etc.
- **Agences connues** : Belkins, Martal, Callbox... (+30)
- **Signaux nÃ©gatifs** (-20 Ã  -50) : immobilier, restaurant, mairie, association, graphiste, tÃ©lÃ©marketing, annuaire, news, blog...
- **Concurrents** (-60) : ZeroBounce, NeverBounce, Hunter.io, Dropcontact, Apollo, etc.

## Enrichissement

1. **Site harvesting** : crawl jusqu'Ã  5 pages (contact, about, team, leadership, impression), extraction des emails (`mailto:` + texte visible).
2. **VÃ©rification email** : rÃ©solution MX + test SMTP RCPT TO (dÃ©livrable / invalide / inconnu / catch-all).
3. **Decision makers** : extraction nom + titre depuis le HTML, priorisation CEO/Founder/Directeur...

## Envoi d'emails (Resend)

- **DRY_RUN** (par dÃ©faut) : aucun email ne part, le statut passe Ã  `sent` pour simulation.
- **Unsubscribe (RFC 8058)** : headers `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click`, token HMAC-SHA256.
- **Variables d'environnement** : `RESEND_API_KEY`, `RESEND_FROM`, `UNSUBSCRIBE_URL`, `UNSUBSCRIBE_SECRET`.

## Nettoyage des sessions CLI

Quand la dÃ©couverte utilise le fallback LLM `opencode --auto` ou `kilo --auto`,
chaque appel crÃ©e une session cÃ´tÃ© CLI. Le package lance dÃ©sormais les CLI en
mode JSON (`--format json`), rÃ©cupÃ¨re l'`sessionID` et **supprime la session Ã 
la fin de chaque recherche**, y compris en cas d'erreur ou de timeout. Aucune
session interactive n'est touchÃ©e : seule la session crÃ©Ã©e par l'appel est
ciblÃ©e via `session delete <id>`.

## Verrouillage du runner

Un seul runner Ã  la fois (`RunnerLock` sur `data/runner.lock`), Ã©vite les exÃ©cutions concurrentes en production.

## Variables d'environnement

| Variable | DÃ©faut | Description |
|----------|--------|-------------|
| `DRY_RUN` | `true` | Mode sec (aucun envoi rÃ©el) |
| `USE_HEURISTIC` | `true` | Qualification heuristique si pas de LLM |
| `LLM_API_KEY` | - | ClÃ© API LLM (Groq/OpenAI/Anthropic) |
| `GROQ_API_KEY` | - | ClÃ© API Groq |
| `RESEND_API_KEY` | - | ClÃ© API Resend (envoi rÃ©el) |
| `RESEND_FROM` | `outreach@votre-domaine.com` | Adresse expÃ©diteur |
| `UNSUBSCRIBE_URL` | `https://votre-domaine.com/unsubscribe` | URL de dÃ©sabonnement |
| `UNSUBSCRIBE_SECRET` | `change-me-in-production` | Secret HMAC pour les tokens unsubscribe |
| `DATABASE_URL` | - | PostgreSQL (Neon) pour CRM cloud |
| `SQLITE_PATH` | `data/crm.db` | Chemin SQLite local |

## Tests

```bash
# Tous les tests
python -m pytest tests/ -v

# Validation rapide des imports
python tests/validate.py

# Run end-to-end sÃ©curisÃ©
python run.py --stage all --dry-run --limit 10
```

## RÃ©fÃ©rences

- MailGuardPro (source des signaux de qualification, enrichissement, templates)
- PromptBearer (architecture de rÃ©fÃ©rence, Prisma/PostgreSQL, admin API)
- COMMUNEScraper, EntreprisesScraper, YtEmail (autres projets de prospection)

---

**Pipeline complet validÃ©** : 21 tests unitaires passent, run en DRY_RUN vÃ©rifiÃ© de bout en bout.