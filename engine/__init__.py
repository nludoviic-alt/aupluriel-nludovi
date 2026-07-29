"""
Au Pluriel — Trading Engine
Phase 1 : Bot de simulation (compte démo Deriv MT5)

Architecture modulaire :
  - mt5_connector : connexion MetaTrader 5
  - analysis      : indicateurs techniques (RSI, MA, MACD, ATR, S/R)
  - decision      : moteur de décision avec score de confiance
  - risk          : gestion du risque indépendante
  - execution     : exécution des ordres et gestion des positions
  - logger        : journalisation complète
  - bot           : orchestrateur principal
"""
