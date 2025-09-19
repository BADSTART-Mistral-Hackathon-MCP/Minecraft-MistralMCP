# McMap API

Une API REST pour interroger les données de biomes et de structures Minecraft en utilisant la bibliothèque Cubiomes.

## Table des matières

- [Vue d'ensemble](#vue-densemble)
- [Installation](#installation)
- [Démarrage rapide](#démarrage-rapide)
- [Endpoints API](#endpoints-api)
  - [Health Check](#health-check)
  - [Biome Query](#biome-query)
  - [Structure Search](#structure-search)
  - [Structure Search Around Point](#structure-search-around-point)
- [Types de données](#types-de-données)
- [Gestion des erreurs](#gestion-des-erreurs)
- [Exemples d'utilisation](#exemples-dutilisation)

## Vue d'ensemble

Cette API utilise la bibliothèque Cubiomes compilée en WebAssembly pour fournir des informations sur les biomes et structures Minecraft. Elle supporte :

- Détection de biomes à des coordonnées spécifiques
- Recherche de structures dans une zone délimitée
- Recherche de structures autour d'un point central
- Support des différentes dimensions (Overworld, Nether, End)
- Différents niveaux d'échelle pour les biomes

## Installation

```bash
npm install
```

## Démarrage rapide

### Développement
```bash
npm run dev
```

### Production
```bash
npm run build
node dist/server.js
```

L'API sera disponible sur `http://127.0.0.1:8787` par défaut.

## Endpoints API

### Health Check

**GET** `/health`

Vérifie que l'API fonctionne correctement.

**Réponse :**
```
ok
```

### Biome Query

**GET** `/api/biome`

Obtient l'ID du biome à des coordonnées spécifiques.

**Paramètres de requête :**

| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `seed` | string | ✓ | Graine du monde Minecraft |
| `dim` | number | ✓ | Dimension (0=Overworld, 1=Nether, 2=End) |
| `x` | number | ✓ | Coordonnée X |
| `z` | number | ✓ | Coordonnée Z |
| `y` | number | ✗ | Coordonnée Y (défaut: 63) |
| `scale` | number | ✓ | Échelle (1, 4, 16, 64, ou 256) |

**Exemple :**
```
GET /api/biome?seed=12345&dim=0&x=100&z=200&scale=1
```

**Réponse :**
```json
{
  "biomeId": 1
}
```

### Structure Search

**GET** `/api/structures`

Recherche toutes les structures d'un type donné dans une zone rectangulaire.

**Paramètres de requête :**

| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `seed` | string | ✓ | Graine du monde Minecraft |
| `dim` | number | ✓ | Dimension (0=Overworld, 1=Nether, 2=End) |
| `typeId` | number | ✓ | ID du type de structure |
| `x0` | number | ✓ | Coordonnée X minimale |
| `z0` | number | ✓ | Coordonnée Z minimale |
| `x1` | number | ✓ | Coordonnée X maximale |
| `z1` | number | ✓ | Coordonnée Z maximale |
| `max` | number | ✗ | Nombre maximum de résultats (défaut: 500) |

**Exemple :**
```
GET /api/structures?seed=12345&dim=0&typeId=1&x0=-1000&z0=-1000&x1=1000&z1=1000
```

**Réponse :**
```json
{
  "count": 3,
  "items": [
    { "x": 120, "z": 200 },
    { "x": -300, "z": 450 },
    { "x": 800, "z": -150 }
  ]
}
```

### Structure Search Around Point

**GET** `/api/structures/around`

Recherche les structures autour d'un point central dans un rayon spécifié.

**Paramètres de requête :**

| Paramètre | Type | Obligatoire | Description |
|-----------|------|-------------|-------------|
| `seed` | string | ✓ | Graine du monde Minecraft |
| `dim` | number | ✓ | Dimension (0=Overworld, 1=Nether, 2=End) |
| `typeId` | number | ✓ | ID du type de structure |
| `cx` | number | ✓ | Coordonnée X du centre |
| `cz` | number | ✓ | Coordonnée Z du centre |
| `radius` | number | ✗ | Rayon de recherche (défaut: 2048) |
| `max` | number | ✗ | Nombre maximum de résultats (défaut: 500) |

**Exemple :**
```
GET /api/structures/around?seed=12345&dim=0&typeId=1&cx=0&cz=0&radius=1000
```

**Réponse :**
```json
{
  "center": { "x": 0, "z": 0 },
  "radius": 1000,
  "count": 2,
  "items": [
    { "x": 120, "z": 200 },
    { "x": -300, "z": 450 }
  ]
}
```

## Types de données

### Dimensions
- `0` : Overworld (monde principal)
- `1` : Nether
- `2` : End

### Échelles de biomes
- `1` : Résolution complète (1:1)
- `4` : Échelle 1:4
- `16` : Échelle 1:16
- `64` : Échelle 1:64
- `256` : Échelle 1:256

### Types de structures
Les IDs de structures correspondent aux types de structures Minecraft. Consultez la documentation Cubiomes pour une liste complète.

Exemples communs :
- Villages
- Temples
- Forteresses
- Monuments océaniques
- Etc.

## Gestion des erreurs

L'API retourne des codes d'erreur HTTP appropriés :

- `400 Bad Request` : Paramètres invalides
- `500 Internal Server Error` : Erreur du serveur

**Format d'erreur :**
```json
{
  "error": "Description de l'erreur"
}
```

**Exemple d'erreur de validation :**
```json
{
  "error": {
    "fieldErrors": {
      "scale": ["scale invalid"]
    }
  }
}
```

## Exemples d'utilisation

### JavaScript/Node.js

```javascript
const API_BASE = 'http://127.0.0.1:8787';

// Obtenir le biome à une position
async function getBiome(seed, x, z) {
  const response = await fetch(
    `${API_BASE}/api/biome?seed=${seed}&dim=0&x=${x}&z=${z}&scale=1`
  );
  const data = await response.json();
  return data.biomeId;
}

// Trouver des villages autour d'un point
async function findVillagesNearby(seed, centerX, centerZ, radius = 2000) {
  const response = await fetch(
    `${API_BASE}/api/structures/around?seed=${seed}&dim=0&typeId=14&cx=${centerX}&cz=${centerZ}&radius=${radius}`
  );
  const data = await response.json();
  return data.items;
}
```

### Python

```python
import requests

API_BASE = 'http://127.0.0.1:8787'

def get_biome(seed, x, z):
    response = requests.get(f'{API_BASE}/api/biome', params={
        'seed': seed,
        'dim': 0,
        'x': x,
        'z': z,
        'scale': 1
    })
    return response.json()['biomeId']

def find_structures_in_area(seed, type_id, x0, z0, x1, z1):
    response = requests.get(f'{API_BASE}/api/structures', params={
        'seed': seed,
        'dim': 0,
        'typeId': type_id,
        'x0': x0,
        'z0': z0,
        'x1': x1,
        'z1': z1
    })
    return response.json()['items']
```

### cURL

```bash
# Obtenir le biome
curl "http://127.0.0.1:8787/api/biome?seed=12345&dim=0&x=100&z=200&scale=1"

# Rechercher des structures
curl "http://127.0.0.1:8787/api/structures?seed=12345&dim=0&typeId=1&x0=-1000&z0=-1000&x1=1000&z1=1000"

# Rechercher autour d'un point
curl "http://127.0.0.1:8787/api/structures/around?seed=12345&dim=0&typeId=1&cx=0&cz=0&radius=1000"
```

## Configuration

### Variables d'environnement

- `PORT` : Port d'écoute du serveur (défaut: 8787)

### Paramètres Cubiomes

L'API est initialisée avec :
- Version Minecraft : 19 (1.19)
- Large Biomes : false

Ces paramètres peuvent être modifiés dans le code source (`src/server.ts` ligne 8).

## Architecture

### Structure du projet
```
mcmap-api/
├── src/
│   ├── server.ts      # Serveur Express principal
│   └── cubiomes.ts    # Interface avec Cubiomes WASM
├── cubiomes/
│   ├── cubiomes.js    # Module JavaScript généré
│   └── cubiomes.wasm  # Module WebAssembly
├── dist/              # Code compilé
├── package.json
└── tsconfig.json
```

### Flux de données
1. Les requêtes HTTP arrivent sur le serveur Express
2. Les paramètres sont validés avec Zod
3. Les fonctions Cubiomes sont appelées via l'interface WASM
4. Les résultats sont formatés et retournés en JSON

### Technologies utilisées
- **Node.js** : Runtime JavaScript
- **Express** : Framework web
- **TypeScript** : Langage de programmation
- **Zod** : Validation de schémas
- **Cubiomes** : Bibliothèque de génération Minecraft en WebAssembly