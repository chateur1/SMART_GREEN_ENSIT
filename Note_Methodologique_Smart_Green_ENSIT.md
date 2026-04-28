# Note Méthodologique — Bilan Carbone Smart Green ENSIT
## ENSIT GreenTech Challenge 2026

---

## 1. Démarche de Calcul du Bilan Carbone

### 1.1 Référentiel appliqué

Le bilan carbone de la plateforme Smart Green ENSIT est réalisé selon le **GHG Protocol Corporate Accounting and Reporting Standard** (version révisée), reconnu internationalement comme la norme de référence pour le calcul des émissions de gaz à effet de serre (GES).

Les facteurs d'émission utilisés sont issus de la **Base Carbone ADEME** (Agence de la transition écologique), mise à jour 2023.

### 1.2 Unité de mesure

Toutes les émissions sont exprimées en **tCO₂e (tonnes équivalent CO₂)**, qui agrège l'ensemble des gaz à effet de serre (CO₂, CH₄, N₂O, HFC...) en une unité commune via leur Pouvoir de Réchauffement Global (PRG) sur 100 ans.

### 1.3 Périmètre organisationnel

L'approche retenue est le **contrôle opérationnel** : le bilan couvre toutes les activités sur lesquelles l'ENSIT exerce un contrôle de gestion direct, soit :
- Les bâtiments pédagogiques (salles, amphithéâtres)
- Les laboratoires d'enseignement et de recherche
- Les bâtiments administratifs
- Les équipements techniques associés

---

## 2. Définition des Scopes

### Scope 1 — Émissions directes

Sources couvertes et formules de calcul :

| Source | Formule | Facteur (ADEME 2023) |
|--------|---------|----------------------|
| Gaz naturel (chauffage) | Volume (m³) × FE | 2,012 kgCO₂e/m³ |
| Diesel (véhicules établissement) | Volume (L) × FE | 2,512 kgCO₂e/L |
| Essence (véhicules établissement) | Volume (L) × FE | 2,281 kgCO₂e/L |
| Fuites frigorigènes R-410A | Masse (kg) × PRG | PRG = 2 088 |
| Fuites frigorigènes R-32 | Masse (kg) × PRG | PRG = 675 |

### Scope 2 — Émissions indirectes liées à l'énergie

| Source | Formule | Facteur retenu |
|--------|---------|----------------|
| Électricité réseau STEG | kWh consommés × FE | 0,559 kgCO₂e/kWh |

> **Note :** Le facteur 0,559 kgCO₂e/kWh est une estimation du mix électrique tunisien 2023 basée sur les données STEG et les méthodologies ADEME adaptées aux réseaux non-européens. Ce facteur sera mis à jour annuellement.

### Scope 3 — Périmètre restreint (mobilité domicile-campus)

Conformément au cahier des charges, le Scope 3 est volontairement limité à la catégorie **Transport domicile-campus** pour garantir la faisabilité du modèle.

**Formule de calcul par répondant :**

```
CO₂e (kg) = distance_aller (km) × 2 × jours_par_semaine × semaines_par_an × facteur_mode
```

| Mode de transport | Facteur (kgCO₂e/km) | Source |
|-------------------|----------------------|--------|
| Voiture individuelle | 0,218 | ADEME Base Carbone |
| Covoiturage (2 personnes) | 0,109 | ADEME Base Carbone |
| Bus / Transport en commun | 0,029 | ADEME Base Carbone |
| Métro / Train | 0,011 | ADEME Base Carbone |
| Moto / Scooter | 0,103 | ADEME Base Carbone |
| Vélo / Marche à pied | 0,000 | ADEME Base Carbone |

**Extrapolation à la population totale :**

Lorsque l'enquête ne couvre qu'un échantillon de la population campus, les émissions sont extrapolées selon :

```
CO₂e_total = CO₂e_échantillon × (population_totale / nb_répondants)
```

---

## 3. Collecte des Données

### 3.1 Sources primaires

| Donnée | Source | Fréquence |
|--------|--------|-----------|
| Consommation électrique | Factures STEG | Mensuelle |
| Consommation gaz | Factures fournisseur | Mensuelle |
| Carburants véhicules | Bons de carburant | À chaque plein |
| Rechargements frigorigènes | Registre maintenance | Après intervention |
| Mobilité personnel/étudiants | Enquête numérique | Annuelle |

### 3.2 Hypothèses retenues pour les données manquantes

Quand des données réelles sont indisponibles, les estimations suivantes sont appliquées :
- **Frigorigènes :** si aucun registre disponible, estimation à 10% du volume total chargé à l'installation
- **Mobilité :** si enquête incomplète (taux < 10%), extrapolation avec distance moyenne par catégorie d'usager estimée à 8 km (personnel), 12 km (étudiants)
- **Carburants véhicules :** si bons non disponibles, estimation sur km parcourus × consommation moyenne du parc

---

## 4. Indicateurs Clés de Performance (ICP) Obligatoires

Les 4 ICP normalisés calculés automatiquement par la plateforme :

| ICP | Formule | Objectif de benchmarking |
|-----|---------|--------------------------|
| Émissions totales campus | Σ (Scope 1 + 2 + 3) | Réduction annuelle cible : -5% |
| Émissions / étudiant | Total ÷ nb_étudiants | < 0,5 tCO₂e/étudiant (objectif 2030) |
| Émissions / m² | Total ÷ surface_m² | < 0,09 tCO₂e/m² (objectif 2030) |
| Émissions / entité | Total ÷ nb_entités | Comparaison inter-laboratoires |

---

## 5. Modèle IA — Détail Méthodologique

### 5.1 Analyse de tendances — Régression linéaire

La tendance est calculée par la méthode des **moindres carrés ordinaires** :

```
y = a × x + b
où : x = année, y = tCO₂e, a = pente, b = intercept

Pente (a) = Σ[(xᵢ - x̄)(yᵢ - ȳ)] / Σ[(xᵢ - x̄)²]
Score R² = 1 - (SS_résidus / SS_total)   [R² proche de 1 = tendance fiable]
```

### 5.2 Prévisions — Intervalle de confiance

Les prévisions utilisent la droite de régression avec un **intervalle de confiance à 90%** (facteur Z = 1,645), élargi proportionnellement à l'horizon temporel :

```
Borne haute = prévision + 1,645 × σ × (1 + 0,1 × années_futur)
Borne basse = prévision - 1,645 × σ × (1 + 0,1 × années_futur)
```

### 5.3 Détection d'anomalies

Une valeur est signalée comme anomalie si son écart par rapport à la tendance linéaire dépasse un seuil configurable (défaut : 15%) :

| Écart à la tendance | Niveau de risque |
|--------------------|------------------|
| 15% – 25% | Modéré |
| 25% – 40% | Élevé |
| > 40% | Critique |

---

## 6. Hypothèses et Simplifications

1. **Facteur électrique tunisien :** La valeur 0,559 kgCO₂e/kWh est une estimation. En l'absence de données officielles STEG publiées, ce facteur est basé sur une estimation du mix énergétique tunisien (gaz naturel ~50%, pétrole ~35%, renouvelables ~15%).

2. **Scope 3 restreint :** Seule la mobilité domicile-campus est incluse. Les achats, les déchets, les voyages professionnels et les missions académiques ne sont pas couverts dans cette version.

3. **Extrapolation linéaire :** L'hypothèse que la mobilité de l'échantillon est représentative de la population totale peut introduire un biais si l'enquête n'est pas aléatoire.

4. **PRG sur 100 ans :** Conformément au GHG Protocol, les PRG utilisés sont ceux du 4ème rapport d'évaluation du GIEC (AR4).

---

## 7. Limites de la Solution

| Limite | Impact | Mitigation |
|--------|--------|------------|
| Facteur électricité estimé | Incertitude ±15% sur Scope 2 | Mise à jour dès publication officielle STEG |
| Enquête mobilité par échantillonnage | Extrapolation imprécise si taux < 10% | Viser 30% de taux de réponse minimum |
| Absence de mesures IoT | Saisie manuelle sujette à erreurs | Prévu dans la roadmap (phase 2) |
| Scope 3 restreint | Bilan partiel | Extension prévue (achats, déchets, voyages) |
| Historique limité (5 ans) | Prévisions moins fiables | S'améliore avec le temps |

---

## 8. Sources et Références

- **GHG Protocol Corporate Standard** — World Resources Institute & WBCSD (2015)
- **ADEME Base Carbone** — Agence de la transition écologique (version 2023)
- **Facteurs d'émission STEG** — Estimation basée sur le bilan énergétique tunisien 2022
- **PRG GIEC AR4** — Intergovernmental Panel on Climate Change, 4ème rapport d'évaluation
- **ISO 14064-1 :2018** — Spécification pour la quantification et la déclaration des GES

---

*Document généré par la plateforme Smart Green ENSIT — ENSIT GreenTech Challenge 2026*
*Contact : Challenge.greentech.ensit@gmail.com*
