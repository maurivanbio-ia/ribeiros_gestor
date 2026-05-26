import { readFileSync } from "fs";
import path from "path";

interface PanInfo {
  classe: string;
  nomePopular: string;
  pan: string;
  situacao: string;
}

interface MmaInfo {
  categoria: string;
  secao: string;
  familia: string;
}

interface SpeciesDB {
  cites:      Record<string, string>;       // sp → "I"|"II"|"III"
  iucnGlobal: Record<string, string>;       // sp → "LC"|"NT"|"VU"|"EN"|"CR"|"EX"|"EW"|"DD"
  mma:        Record<string, MmaInfo>;      // sp → { categoria, secao, familia }
  pan:        Record<string, PanInfo>;      // sp → { classe, nomePopular, pan, situacao }
  vernacular: Record<string, string>;       // sp → nome vernacular PT
}

let _db: SpeciesDB | null = null;

function loadDB(): SpeciesDB {
  if (_db) return _db;
  try {
    const raw = readFileSync(path.join(process.cwd(), "server/data/speciesDB.json"), "utf-8");
    _db = JSON.parse(raw) as SpeciesDB;
    console.log("[SpeciesDB] Loaded — CITES:", Object.keys(_db.cites).length,
      "IUCN:", Object.keys(_db.iucnGlobal).length,
      "MMA:", Object.keys(_db.mma).length,
      "PAN:", Object.keys(_db.pan).length,
      "Vernacular:", Object.keys(_db.vernacular).length);
  } catch (e) {
    console.warn("[SpeciesDB] speciesDB.json not found — lookup disabled");
    _db = { cites: {}, iucnGlobal: {}, mma: {}, pan: {}, vernacular: {} };
  }
  return _db;
}

/** Try progressively shorter prefixes to find a match (handles subspecies) */
function findMatch<T>(db: Record<string, T>, rawName: string): [string, T] | null {
  const words = rawName.trim().split(/\s+/);
  for (let len = Math.min(words.length, 3); len >= 2; len--) {
    const key = words.slice(0, len).join(" ");
    if (db[key]) return [key, db[key]];
    // case-insensitive fallback
    const lk = key.toLowerCase();
    for (const k of Object.keys(db)) {
      if (k.toLowerCase() === lk) return [k, db[k]];
    }
  }
  return null;
}

export interface SpeciesLookupResult {
  found:         boolean;
  cites?:        string;
  iucn?:         string;
  mma?:          MmaInfo;
  pan?:          PanInfo;
  nomeVernacular?: string;
}

export function lookupSpecies(scientificName: string): SpeciesLookupResult {
  const db = loadDB();
  const name = scientificName.trim();
  if (!name) return { found: false };

  const citesMatch = findMatch(db.cites, name);
  const iucnMatch  = findMatch(db.iucnGlobal, name);
  const mmaMatch   = findMatch(db.mma, name);
  const panMatch   = findMatch(db.pan, name);
  const vernMatch  = findMatch(db.vernacular, name);

  const found = !!(citesMatch || iucnMatch || mmaMatch || panMatch || vernMatch);
  return {
    found,
    cites:          citesMatch?.[1],
    iucn:           iucnMatch?.[1],
    mma:            mmaMatch?.[1],
    pan:            panMatch?.[1],
    nomeVernacular: vernMatch?.[1] ?? panMatch?.[1]?.nomePopular,
  };
}

// Pre-load on import
loadDB();
