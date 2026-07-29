# Au Pluriel — Trading Engine

## Architecture

```
engine/
├── __init__.py          # Package root
├── config.py            # Configuration globale (instrument, risque, indicateurs)
├── logger.py            # Journalisation structurée (fichier + callbacks temps réel)
├── analysis.py          # Moteur d'analyse technique multi-timeframe
│                        #   RSI, EMA, MACD, ATR, supports/résistances
│                        #   Timeframes: 5min, 15min, 1h
├── decision.py          # Moteur de décision (score de confiance, seuil 75%)
├── risk.py              # Moteur de risque indépendant
│                        #   0.25% max/trade, stop-loss obligatoire
│                        #   Limite perte quotidienne 2%, max 3 positions
│                        #   Arrêt après 3 pertes consécutives
│                        #   Anti-Martingale, kill-switch
├── mt5_connector.py     # Connecteur MetaTrader 5 + mode simulation
│                        #   Données OHLC, vérification ordres, exécution
├── bot.py               # Orchestrateur (analyse → décision → risque → exécution)
├── server.py            # API FastAPI (REST + WebSocket temps réel)
├── backtest.py          # Moteur de backtest (Phase 2)
└── logs/                # Journaux d'exécution
```

## Configuration actuelle

- **Instrument** : Volatility 100 Index
- **Plateforme** : Deriv MT5 (compte démo)
- **Capital** : $1 000
- **Risque max/trade** : 0.25% ($2.50)
- **Stop-loss** : 1.5 × ATR
- **Limite perte quotidienne** : 2% ($20)
- **Max positions simultanées** : 3
- **Arrêt après** : 3 pertes consécutives
- **Score de confiance minimum** : 75%
- **Martingale** : Interdite

## Installation

```bash
pip install fastapi uvicorn pandas numpy pydantic
# Optionnel (pour MT5 réel, Windows uniquement) :
pip install MetaTrader5
```

## Démarrage

```bash
# Lancer le serveur API
python -m engine.server

# Le serveur démarre sur http://localhost:8000
# WebSocket : ws://localhost:8000/ws
# Documentation API : http://localhost:8000/docs
```

## Phases de développement

1. **Phase 1** (actuelle) : Bot de simulation sans argent réel
2. **Phase 2** : Backtest sur 6-12 mois de données
3. **Phase 3** : Compte démo Deriv MT5 pendant plusieurs semaines
4. **Phase 4** : Petit capital réel avec risque très limité
5. **Phase 5** : Augmentation progressive si résultats stables

## API Endpoints

- `GET  /api/status` — État complet du bot
- `GET  /api/logs` — Journal récent
- `POST /api/start` — Démarrer le bot
- `POST /api/stop` — Arrêter le bot
- `POST /api/kill-switch` — Arrêt d'urgence
- `POST /api/resume` — Reprise après kill-switch
- `POST /api/close-all` — Fermer toutes les positions
- `POST /api/config` — Mettre à jour la configuration
- `POST /api/mt5/connect` — Connecter à MT5 avec identifiants
- `GET  /api/positions` — Positions ouvertes
- `POST /api/positions/{ticket}/close` — Fermer une position
- `WS   /ws` — Mises à jour temps réel
