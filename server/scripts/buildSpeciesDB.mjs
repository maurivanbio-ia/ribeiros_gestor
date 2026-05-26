/**
 * One-time script: builds compact JSON lookup tables from the reference files.
 * Run: node server/scripts/buildSpeciesDB.mjs
 * Output: server/data/speciesDB.json
 */
import { readFileSync, writeFileSync, createReadStream } from "fs";
import { createInterface } from "readline";
import { fileURLToPath } from "url";
import path from "path";
import XLSX from "xlsx";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const OUT  = path.resolve(__dirname, "../data/speciesDB.json");

// ─── helpers ─────────────────────────────────────────────────────────────────

function extractBinomial(raw) {
  const words = String(raw).replace(/\(.*?\)/g, "").trim().split(/\s+/);
  if (words.length < 2) return null;
  const genus = words[0].replace(/[^A-Za-zÀ-ú]/g, "");
  const sp    = words[1].replace(/[^A-Za-zÀ-ú-]/g, "");
  if (!genus || !sp || genus.length < 2 || sp.length < 2) return null;
  return `${genus} ${sp}`;
}

// ─── 1. CITES CSV ─────────────────────────────────────────────────────────────

function parseCites() {
  const csv = readFileSync(
    path.join(ROOT, "attached_assets/cites_species_table_(1)_1777181328560.csv"),
    "utf-8"
  );
  const lines = csv.split("\n").slice(1);
  const lookup = {};
  for (const line of lines) {
    const cols = line.split(",");
    if (cols.length < 5) continue;
    const rawSp  = cols.slice(3, cols.length - 1).join(",").trim();
    const status = cols[cols.length - 1].trim().replace(/\r/, "");
    if (!["I","II","III"].includes(status)) continue;
    const key = extractBinomial(rawSp);
    if (key) lookup[key] = status;
  }
  return lookup;
}

// ─── 2. IUCN Global xlsx ─────────────────────────────────────────────────────

function parseIUCN() {
  const wb   = XLSX.readFile(path.join(ROOT, "attached_assets/Especies_IUCN_Global_1777181328561.xlsx"));
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
  const lookup = {};
  for (const [especie, categoria] of rows) {
    if (!especie || !categoria) continue;
    const key = extractBinomial(String(especie));
    if (key) lookup[key] = String(categoria).trim();
  }
  return lookup;
}

// ─── 3. MMA xlsx ─────────────────────────────────────────────────────────────

function parseMMA() {
  const wb   = XLSX.readFile(path.join(ROOT, "attached_assets/Especies_Ameacadas_Extincao_1777181328561.xlsx"));
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
  // cols: Seção, Família, Espécie, Categoria
  const lookup = {};
  for (const [secao, familia, especie, categoria] of rows) {
    if (!especie || !categoria) continue;
    const key = extractBinomial(String(especie));
    if (key) lookup[key] = { categoria: String(categoria).trim(), secao: String(secao||"").trim(), familia: String(familia||"").trim() };
  }
  return lookup;
}

// ─── 4. PAN xlsx — inclui nomes vernaculares de fauna ─────────────────────────

function parsePAN() {
  const wb   = XLSX.readFile(path.join(ROOT, "attached_assets/ESPECIES_PAN_1777181328559.xlsx"));
  const ws   = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }).slice(1);
  // cols: N, Espécie, Classe, Nome Popular, PAN, SITUAÇÃO, OBSERVAÇÃO
  const lookup = {};
  for (const [, especie, classe, nomePopular, pan, situacao] of rows) {
    if (!especie) continue;
    const key = extractBinomial(String(especie));
    if (key) lookup[key] = {
      classe:      String(classe      || "").trim(),
      nomePopular: String(nomePopular || "").trim(),
      pan:         String(pan         || "").trim(),
      situacao:    String(situacao    || "").trim(),
    };
  }
  return lookup;
}

// ─── 5. Vernacular names — Flora do Brasil (taxon.txt + vernacularname.txt) ───
// The taxon file contains plants/fungi only (Flora do Brasil).
// We build a lookup: scientificName → primary Portuguese vernacular name.

async function parseFlora() {
  const TAXON_FILE = path.join(ROOT, "attached_assets/taxon_1777181328561.txt");
  const VERN_FILE  = path.join(ROOT, "attached_assets/vernacularname_1777181328561.txt");

  // Step 1: id → binomial (only ESPECIE rank, only those that have genus+epithet)
  console.log("    Parsing taxon file...");
  const idToName = new Map();
  let n = 0;

  await new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(TAXON_FILE), crlfDelay: Infinity });
    rl.on("line", (line) => {
      n++;
      if (n === 1) return;
      const cols    = line.split("\t");
      const id      = cols[0]?.trim();
      const genus   = cols[16]?.trim();
      const epithet = cols[17]?.trim();
      const rank    = cols[19]?.trim();
      if (!id || rank !== "ESPECIE" || !genus || !epithet) return;
      if (genus.length < 2 || epithet.length < 2) return;
      idToName.set(id, `${genus} ${epithet}`);
    });
    rl.on("close", resolve);
  });
  console.log(`    → ${idToName.size} species IDs`);

  // Step 2: parse vernacular names (Portuguese only), pick one per ID
  console.log("    Parsing vernacular names...");
  const vernMap = new Map(); // id → [names]
  let v = 0;

  await new Promise((resolve) => {
    const rl = createInterface({ input: createReadStream(VERN_FILE), crlfDelay: Infinity });
    rl.on("line", (line) => {
      v++;
      if (v === 1) return;
      const cols = line.split("\t");
      const id   = cols[0]?.trim();
      const name = cols[1]?.trim();
      const lang = cols[2]?.trim().toUpperCase();
      if (!id || !name || lang !== "PORTUGUES") return;
      if (!idToName.has(id)) return;
      if (!vernMap.has(id)) vernMap.set(id, []);
      vernMap.get(id).push(name);
    });
    rl.on("close", resolve);
  });

  // Step 3: merge — prefer hyphenated names (more specific), then shortest
  const lookup = {};
  for (const [id, binomial] of idToName) {
    const names = vernMap.get(id);
    if (!names || names.length === 0) continue;
    const sorted = [...names].sort((a, b) => {
      const aH = a.includes("-") ? -1 : 1;
      const bH = b.includes("-") ? -1 : 1;
      if (aH !== bH) return aH - bH;
      return a.length - b.length;
    });
    lookup[binomial] = sorted[0];
  }
  console.log(`    → ${Object.keys(lookup).length} flora vernacular entries`);
  return lookup;
}

// ─── 6. Bird vernacular from PAN (Aves only) ─────────────────────────────────

function buildBirdVernacular(pan) {
  const lookup = {};
  for (const [sp, info] of Object.entries(pan)) {
    if (info.classe === "Aves" && info.nomePopular) {
      lookup[sp] = info.nomePopular;
    }
  }
  return lookup;
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Building species reference DB...");

  console.log("  [1/5] Parsing CITES...");
  const cites = parseCites();
  console.log(`    → ${Object.keys(cites).length} CITES entries`);

  console.log("  [2/5] Parsing IUCN Global...");
  const iucnGlobal = parseIUCN();
  console.log(`    → ${Object.keys(iucnGlobal).length} IUCN entries`);

  console.log("  [3/5] Parsing MMA (Brasil)...");
  const mma = parseMMA();
  console.log(`    → ${Object.keys(mma).length} MMA entries`);

  console.log("  [4/5] Parsing PAN...");
  const pan = parsePAN();
  console.log(`    → ${Object.keys(pan).length} PAN entries`);

  console.log("  [5/5] Parsing Flora do Brasil taxon + vernacular names...");
  const floraVernacular = await parseFlora();

  // Build bird vernacular from PAN
  const birdVernacular = buildBirdVernacular(pan);
  console.log(`  Birds with vernacular names from PAN: ${Object.keys(birdVernacular).length}`);

  // Merge all vernacular: flora + birds from PAN
  const vernacular = { ...floraVernacular, ...birdVernacular };

  const db = { cites, iucnGlobal, mma, pan, vernacular };
  writeFileSync(OUT, JSON.stringify(db, null, 0), "utf-8");

  const size = (Buffer.byteLength(JSON.stringify(db)) / 1024).toFixed(1);
  console.log(`\n✓ speciesDB.json written — ${size} KB`);
  console.log(`  CITES:      ${Object.keys(cites).length}`);
  console.log(`  IUCN:       ${Object.keys(iucnGlobal).length}`);
  console.log(`  MMA:        ${Object.keys(mma).length}`);
  console.log(`  PAN:        ${Object.keys(pan).length}`);
  console.log(`  Vernacular: ${Object.keys(vernacular).length} (flora + ${Object.keys(birdVernacular).length} birds)`);
}

main().catch(err => { console.error(err); process.exit(1); });
