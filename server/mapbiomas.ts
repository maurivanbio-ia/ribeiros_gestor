import type { Request, Response, Express } from "express";

const ENDPOINT = "https://plataforma.alerta.mapbiomas.org/api/v2/graphql";

let cachedToken: string | null = process.env.MAPBIOMAS_API_TOKEN || process.env.MAPBIOMAS_TOKEN || null;

async function gql(
  query: string,
  variables: Record<string, any>,
  token?: string
): Promise<any> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message || "GraphQL error");
  if (!res.ok) throw new Error(`MapBiomas HTTP ${res.status}`);
  return json.data;
}

// ── Queries ───────────────────────────────────────────────────────────────────

const SIGN_IN_MUTATION = `
  mutation signIn($email: String!, $password: String!) {
    signIn(email: $email, password: $password) { token }
  }
`;

const ALERTS_QUERY = `
  query GetAlerts(
    $sources: [SourceTypes!]
    $startDate: BaseDate
    $endDate: BaseDate
    $boundingBox: [Float!]
    $limit: Int
    $page: Int
  ) {
    alerts(
      sources: $sources
      startDate: $startDate
      endDate: $endDate
      boundingBox: $boundingBox
      limit: $limit
      page: $page
      sortField: DETECTED_AT
      sortDirection: DESC
    ) {
      collection {
        alertCode
        areaHa
        detectedAt
        publishedAt
        sources
        categories
        deforestationClasses
        crossedBiomes
        crossedCities
        crossedStates
        crossedIndigenousLands
        crossedConservationUnits
        boundingBox { minX minY maxX maxY }
      }
      metadata { total }
      summary { total area }
    }
  }
`;

const ALERT_GEOMETRY_QUERY = `
  query GetAlertGeometry($alertCode: Int!) {
    alert(alertCode: $alertCode) {
      alertCode
      areaHa
      detectedAt
      publishedAt
      sources
      categories
      deforestationClasses
      crossedBiomes
      crossedCities
      crossedStates
      crossedIndigenousLands
      crossedConservationUnits
      crossedPermanentProtectedArea
      deforestationSpeed
      geometryWkt
    }
  }
`;

// ── WKT → GeoJSON converter (sem dependências externas) ─────────────────────

function wktToGeoJson(wkt: string): any | null {
  if (!wkt) return null;
  try {
    const s = wkt.trim();

    const parseCoordPair = (pair: string): [number, number] => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lng, lat];
    };

    const parseRing = (ring: string): [number, number][] =>
      ring.trim().split(",").map(parseCoordPair);

    if (s.startsWith("POINT")) {
      const m = s.match(/POINT\s*\(([^)]+)\)/i);
      if (!m) return null;
      return { type: "Point", coordinates: parseCoordPair(m[1]) };
    }

    if (s.startsWith("MULTIPOLYGON")) {
      const inner = s.replace(/^MULTIPOLYGON\s*\(\(\(/i, "").replace(/\)\)\)$/, "");
      const polygons = inner.split(/\)\s*,\s*\(\s*\(/).map(poly => {
        const rings = poly.split(/\)\s*,\s*\(/).map(parseRing);
        return rings;
      });
      return { type: "MultiPolygon", coordinates: polygons };
    }

    if (s.startsWith("POLYGON")) {
      const inner = s.replace(/^POLYGON\s*\(\(/i, "").replace(/\)\)$/, "");
      const rings = inner.split(/\)\s*,\s*\(/).map(parseRing);
      return { type: "Polygon", coordinates: rings };
    }

    return null;
  } catch {
    return null;
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireToken(res: Response): string | null {
  if (!cachedToken) {
    res.status(401).json({ error: "Não autenticado. Faça login no MapBiomas Alerta primeiro." });
    return null;
  }
  return cachedToken;
}

function handleAuthError(err: any, res: Response) {
  const msg = (err.message || "").toLowerCase();
  if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("unauthenticated")) {
    if (!process.env.MAPBIOMAS_API_TOKEN && !process.env.MAPBIOMAS_TOKEN) cachedToken = null;
    return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
  }
  res.status(500).json({ error: err.message || "Erro desconhecido" });
}

// ── Routes ────────────────────────────────────────────────────────────────────

export function registerMapbiomasRoutes(app: Express) {

  // Status
  app.get("/api/mapbiomas/status", (_req: Request, res: Response) => {
    res.json({ authenticated: !!cachedToken, hasEnvToken: !!(process.env.MAPBIOMAS_API_TOKEN || process.env.MAPBIOMAS_TOKEN) });
  });

  // Login
  app.post("/api/mapbiomas/signin", async (req: Request, res: Response) => {
    const { email, password } = req.body || {};
    if (!email || !password)
      return res.status(400).json({ error: "Email e senha são obrigatórios" });
    try {
      const data = await gql(SIGN_IN_MUTATION, { email, password });
      const token = data?.signIn?.token;
      if (!token) return res.status(401).json({ error: "Credenciais inválidas" });
      cachedToken = token;
      res.json({ success: true });
    } catch (err: any) {
      res.status(401).json({ error: err.message });
    }
  });

  // Logout
  app.post("/api/mapbiomas/signout", (_req: Request, res: Response) => {
    if (!process.env.MAPBIOMAS_API_TOKEN && !process.env.MAPBIOMAS_TOKEN) cachedToken = null;
    res.json({ success: true });
  });

  // Lista de alertas (marcadores pontuais)
  app.get("/api/mapbiomas/alerts", async (req: Request, res: Response) => {
    const token = requireToken(res); if (!token) return;

    const { sources = "All", startDate, endDate, bbox, limit = "200", page = "1" } =
      req.query as Record<string, string>;

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const sourcesArr = sources === "All" || sources === "all" || !sources
        ? []
        : sources.split(",").map(s => s.trim()).filter(Boolean);

      const variables: Record<string, any> = {
        startDate: startDate || oneYearAgo.toISOString().slice(0, 10),
        endDate:   endDate   || new Date().toISOString().slice(0, 10),
        limit: Math.min(parseInt(limit) || 200, 500),
        page:  parseInt(page) || 1,
      };
      if (sourcesArr.length) variables.sources = sourcesArr;

      // Brasil inteiro como fallback quando nenhum bbox for fornecido
      const BRAZIL_BBOX = [-74.0, -34.0, -32.0, 6.0];
      if (bbox) {
        const parts = bbox.split(",").map(Number).filter(n => !isNaN(n));
        if (parts.length === 4) variables.boundingBox = parts;
        else variables.boundingBox = BRAZIL_BBOX;
      } else {
        variables.boundingBox = BRAZIL_BBOX;
      }

      console.log("[MapBiomas alerts] variables:", JSON.stringify(variables));
      const data = await gql(ALERTS_QUERY, variables, token);
      console.log("[MapBiomas alerts] total:", data?.alerts?.metadata?.total, "| summary:", JSON.stringify(data?.alerts?.summary));
      res.json(data.alerts);
    } catch (err: any) {
      console.error("[MapBiomas alerts] ERROR:", err.message);
      handleAuthError(err, res);
    }
  });

  // Geometria de um alerta específico (WKT → GeoJSON)
  app.get("/api/mapbiomas/alert/:code", async (req: Request, res: Response) => {
    const token = requireToken(res); if (!token) return;
    const alertCode = parseInt(req.params.code);
    if (isNaN(alertCode)) return res.status(400).json({ error: "Código inválido" });

    try {
      const data = await gql(ALERT_GEOMETRY_QUERY, { alertCode }, token);
      const alert = data?.alert;
      if (!alert) return res.status(404).json({ error: "Alerta não encontrado" });

      const geometry = alert.geometryWkt ? wktToGeoJson(alert.geometryWkt) : null;

      res.json({
        alertCode: alert.alertCode,
        areaHa: alert.areaHa,
        detectedAt: alert.detectedAt,
        publishedAt: alert.publishedAt,
        sources: alert.sources,
        categories: alert.categories,
        deforestationClasses: alert.deforestationClasses,
        crossedBiomes: alert.crossedBiomes,
        crossedCities: alert.crossedCities,
        crossedStates: alert.crossedStates,
        crossedIndigenousLands: alert.crossedIndigenousLands,
        crossedConservationUnits: alert.crossedConservationUnits,
        crossedPermanentProtectedArea: alert.crossedPermanentProtectedArea,
        deforestationSpeed: alert.deforestationSpeed,
        geometry,
        geometryWkt: alert.geometryWkt,
      });
    } catch (err: any) {
      handleAuthError(err, res);
    }
  });

  // FeatureCollection com polígonos dos top N alertas (busca em lote)
  // Limita a 30 alertas para não sobrecarregar a API com N chamadas individuais
  app.get("/api/mapbiomas/alerts-geojson", async (req: Request, res: Response) => {
    const token = requireToken(res); if (!token) return;

    const { sources = "All", startDate, endDate, bbox, limit = "30" } =
      req.query as Record<string, string>;

    try {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

      const sourcesArr2 = sources === "All" || sources === "all" || !sources
        ? []
        : sources.split(",").map(s => s.trim()).filter(Boolean);

      const variables: Record<string, any> = {
        startDate: startDate || oneYearAgo.toISOString().slice(0, 10),
        endDate:   endDate   || new Date().toISOString().slice(0, 10),
        limit: Math.min(parseInt(limit) || 30, 50),
        page: 1,
      };
      if (sourcesArr2.length) variables.sources = sourcesArr2;

      // Brasil inteiro como fallback quando nenhum bbox for fornecido
      const BRAZIL_BBOX2 = [-74.0, -34.0, -32.0, 6.0];
      if (bbox) {
        const parts = bbox.split(",").map(Number).filter(n => !isNaN(n));
        if (parts.length === 4) variables.boundingBox = parts;
        else variables.boundingBox = BRAZIL_BBOX2;
      } else {
        variables.boundingBox = BRAZIL_BBOX2;
      }

      console.log("[MapBiomas geojson] variables:", JSON.stringify(variables));
      // Primeiro busca a lista
      const listData = await gql(ALERTS_QUERY, variables, token);
      const collection: any[] = listData?.alerts?.collection || [];

      if (!collection.length) {
        return res.json({ type: "FeatureCollection", features: [], summary: listData?.alerts?.summary });
      }

      // Busca geometrias em paralelo (máx 50 requests simultâneos com throttle)
      const BATCH = 10;
      const features: any[] = [];

      for (let i = 0; i < collection.length; i += BATCH) {
        const batch = collection.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(a => gql(ALERT_GEOMETRY_QUERY, { alertCode: a.alertCode }, token))
        );
        for (const r of results) {
          if (r.status !== "fulfilled") continue;
          const alert = r.value?.alert;
          if (!alert) continue;
          const geometry = alert.geometryWkt
            ? wktToGeoJson(alert.geometryWkt)
            : null;
          if (!geometry) continue;
          features.push({
            type: "Feature",
            geometry,
            properties: {
              alertCode: alert.alertCode,
              areaHa: alert.areaHa,
              detectedAt: alert.detectedAt,
              publishedAt: alert.publishedAt,
              sources: (alert.sources || []).join(", "),
              categories: (alert.categories || []).join(", "),
              deforestationClasses: (alert.deforestationClasses || []).join(", "),
              crossedBiomes: (alert.crossedBiomes || []).join(", "),
              crossedCities: (alert.crossedCities || []).slice(0, 3).join(", "),
              crossedStates: (alert.crossedStates || []).join(", "),
              crossedIndigenousLands: (alert.crossedIndigenousLands || []).join(", ") || null,
              crossedConservationUnits: (alert.crossedConservationUnits || []).join(", ") || null,
              crossedPpa: alert.crossedPermanentProtectedArea || null,
              deforestationSpeed: alert.deforestationSpeed || null,
            },
          });
        }
      }

      res.json({
        type: "FeatureCollection",
        features,
        summary: listData?.alerts?.summary,
        metadata: listData?.alerts?.metadata,
      });
    } catch (err: any) {
      handleAuthError(err, res);
    }
  });
}
