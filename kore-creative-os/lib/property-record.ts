export type PropertyDraft = {
  id: string;
  slug: string;
  tipo: string;
  operacion: string;
  titulo: string;
  zona: string;
  direccion: string;
  cliente: string;
  moneda: string;
  precio: string;
  totalM2: string;
  cubiertaM2: string;
  dormitorios: string;
  banos: string;
  cocheras: string;
  estado: string;
  situacion: string;
  destacados: string[];
  contacto: string;
  textoOriginal: string;
  creada: string;
  actualizada: string;
  fichaCompleta: boolean;
};

export type PropertyRecordResponse = Omit<
  PropertyDraft,
  | "precio"
  | "totalM2"
  | "cubiertaM2"
  | "dormitorios"
  | "banos"
  | "cocheras"
> & {
  precio: number | null;
  totalM2: number | null;
  cubiertaM2: number | null;
  dormitorios: number | null;
  banos: number | null;
  cocheras: number | null;
};

export function emptyPropertyDraft(): PropertyDraft {
  return {
    id: "",
    slug: "",
    tipo: "",
    operacion: "venta",
    titulo: "",
    zona: "",
    direccion: "",
    cliente: "",
    moneda: "USD",
    precio: "",
    totalM2: "",
    cubiertaM2: "",
    dormitorios: "",
    banos: "",
    cocheras: "",
    estado: "",
    situacion: "",
    destacados: [""],
    contacto: "",
    textoOriginal: "",
    creada: "",
    actualizada: "",
    fichaCompleta: false,
  };
}

export function draftFromResponse(
  record: PropertyRecordResponse,
): PropertyDraft {
  return {
    ...record,
    precio: record.precio?.toString() || "",
    totalM2: record.totalM2?.toString() || "",
    cubiertaM2: record.cubiertaM2?.toString() || "",
    dormitorios: record.dormitorios?.toString() || "",
    banos: record.banos?.toString() || "",
    cocheras: record.cocheras?.toString() || "",
    destacados: record.destacados.length ? record.destacados : [""],
  };
}

function labelValue(text: string, labels: string[]) {
  const escaped = labels.map((label) => label.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&"));
  const match = text.match(
    new RegExp(`(?:^|\\n)\\s*(?:${escaped.join("|")})\\s*[:：-]\\s*(.+)`, "i"),
  );
  return match?.[1]?.trim() || "";
}

function normalizedNumber(value: string) {
  const compact = value.replace(/\s/g, "");
  if (compact.includes(".") && compact.includes(",")) {
    return compact.replace(/\./g, "").replace(",", ".");
  }
  if (/^\d{1,3}(?:\.\d{3})+$/.test(compact)) {
    return compact.replace(/\./g, "");
  }
  return compact.replace(",", ".");
}

function firstNumeric(text: string, expressions: RegExp[]) {
  for (const expression of expressions) {
    const match = text.match(expression);
    if (match?.[1]) return normalizedNumber(match[1]);
  }
  return "";
}

function detectType(text: string) {
  const types = [
    "monoambiente",
    "departamento",
    "casa",
    "duplex",
    "dúplex",
    "local",
    "oficina",
    "terreno",
    "cochera",
    "galpón",
    "galpon",
  ];
  return types.find((type) => new RegExp(`\\b${type}\\b`, "i").test(text)) || "";
}

function firstTitleLine(text: string) {
  return (
    text
      .split(/\r?\n/)
      .map((line) => line.replace(/^[\s🏢🏠📍*-]+/u, "").trim())
      .find(
        (line) =>
          line.length >= 8 &&
          line.length <= 150 &&
          !line.includes(":") &&
          !/^(venta|alquiler|usd|u\$s|precio|valor)$/i.test(line),
      ) || ""
  );
}

export function extractPropertyDraft(
  text: string,
  current: PropertyDraft,
): PropertyDraft {
  const operationMatch = text.match(/\b(venta|alquiler temporal|alquiler)\b/i);
  const currencyMatch = text.match(/\b(USD|U\$S|US\$|ARS)\b/i);
  const price = firstNumeric(text, [
    /(?:USD|U\$S|US\$|ARS)\s*\$?\s*([\d.,]+)/i,
    /(?:precio|valor)(?:\s+de\s+(?:venta|alquiler))?\s*[:：-]?\s*\$?\s*([\d.,]+)/i,
  ]);
  const totalM2 = firstNumeric(text, [
    /([\d.,]+)\s*m(?:²|2)\s*(?:totales?|total)/i,
    /(?:superficie\s+)?total\s*[:：-]?\s*([\d.,]+)/i,
  ]);
  const coveredM2 = firstNumeric(text, [
    /([\d.,]+)\s*m(?:²|2)\s*(?:cubiertos?|cubierta)/i,
    /(?:superficie\s+)?cubierta\s*[:：-]?\s*([\d.,]+)/i,
  ]);
  const tipo = labelValue(text, ["tipo", "tipo de propiedad"]) || detectType(text);
  const dormitorios = firstNumeric(text, [
    /(\d+)\s*(?:dormitorios?|habitaciones?)/i,
    /(?:dormitorios?|habitaciones?)\s*[:：-]?\s*(\d+)/i,
  ]);
  const banos = firstNumeric(text, [
    /(\d+)\s*bañ(?:o|os)/i,
    /bañ(?:o|os)\s*[:：-]?\s*(\d+)/i,
  ]);
  const cocheras = firstNumeric(text, [
    /(\d+)\s*cocheras?/i,
    /cocheras?\s*[:：-]?\s*(\d+)/i,
  ]);
  const bulletHighlights = text
    .split(/\r?\n/)
    .filter((line) => /^\s*(?:[-*•✓]|├\s*✨|└\s*✨)/u.test(line))
    .map((line) =>
      line.replace(/^\s*(?:[-*•✓]|[├└]\s*✨)\s*/u, "").trim(),
    )
    .filter((line) => line.length > 6 && line.length < 280)
    .slice(0, 12);
  const phone =
    labelValue(text, ["contacto", "teléfono", "telefono", "whatsapp"]) ||
    text.match(/(?:\+?54\s*9?\s*)?(?:\(?\d{2,4}\)?[\s-]*)?\d{3,4}[\s-]*\d{4}/)?.[0]?.trim() ||
    "";

  return {
    ...current,
    tipo: tipo || current.tipo,
    operacion: operationMatch?.[1]?.toLowerCase() || current.operacion,
    titulo:
      labelValue(text, ["título", "titulo"]) ||
      firstTitleLine(text) ||
      current.titulo,
    zona: labelValue(text, ["zona", "barrio"]) || current.zona,
    direccion:
      labelValue(text, ["dirección", "direccion", "ubicación", "ubicacion"]) ||
      current.direccion,
    cliente:
      labelValue(text, ["cliente", "inmobiliaria"]) || current.cliente,
    moneda:
      currencyMatch?.[1]?.toUpperCase().replace("U$S", "USD").replace("US$", "USD") ||
      current.moneda,
    precio: price || current.precio,
    totalM2: totalM2 || current.totalM2,
    cubiertaM2: coveredM2 || current.cubiertaM2,
    dormitorios:
      dormitorios || (/monoambiente/i.test(tipo) ? "0" : current.dormitorios),
    banos: banos || current.banos,
    cocheras: cocheras || current.cocheras,
    estado:
      labelValue(text, ["estado", "antigüedad", "antiguedad"]) || current.estado,
    situacion:
      labelValue(text, ["situación", "situacion", "ocupación", "ocupacion"]) ||
      current.situacion,
    destacados: bulletHighlights.length
      ? bulletHighlights
      : current.destacados,
    contacto: phone || current.contacto,
    textoOriginal: text,
  };
}

function countLabel(value: string, singular: string, plural: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return `${number} ${number === 1 ? singular : plural}`;
}

function formatPrice(draft: PropertyDraft) {
  const value = Number(draft.precio);
  if (!Number.isFinite(value) || value <= 0) return "A consultar";
  const formatted = new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 0,
  }).format(value);
  return `${draft.moneda || "USD"} ${formatted}`;
}

function cleanHighlights(draft: PropertyDraft) {
  return draft.destacados.map((item) => item.trim()).filter(Boolean);
}

function titleCase(value: string) {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : "";
}

export function renderWhatsApp(draft: PropertyDraft) {
  const shortAddress = draft.direccion.split(/\s+[–—]\s+/)[0] || draft.direccion;
  const headerDetails = [draft.zona, shortAddress].filter(Boolean).join(" – ");
  const lines: string[] = [];

  if (draft.direccion) lines.push(`📍 ${draft.direccion}`);
  const typeOperation = [titleCase(draft.tipo), titleCase(draft.operacion)]
    .filter(Boolean)
    .join(" · ");
  if (typeOperation) lines.push(`🏠 ${typeOperation}`);
  const rooms = [
    countLabel(draft.dormitorios, "dormitorio", "dormitorios"),
    countLabel(draft.banos, "baño", "baños"),
    countLabel(draft.cocheras, "cochera", "cocheras"),
  ].filter(Boolean);
  if (rooms.length) lines.push(`🛏 ${rooms.join(" · ")}`);
  const surfaces = [
    draft.totalM2 ? `${draft.totalM2} m² totales` : "",
    draft.cubiertaM2 ? `${draft.cubiertaM2} m² cubiertos` : "",
  ].filter(Boolean);
  if (surfaces.length) lines.push(`📐 ${surfaces.join(" · ")}`);
  if (draft.estado) lines.push(`🏷 ${titleCase(draft.estado)}`);
  if (draft.situacion) lines.push(`🔑 ${titleCase(draft.situacion)}`);
  cleanHighlights(draft).forEach((highlight) => lines.push(`✨ ${highlight}`));

  const tree = lines
    .map((line, index) => `${index === lines.length - 1 ? "└" : "├"} ${line}`)
    .join("\n");
  const operation = draft.operacion === "alquiler" ? "alquiler" : "venta";

  return [
    `🏢 ${draft.titulo || "Propiedad"}${headerDetails ? ` | ${headerDetails}` : ""}`,
    tree,
    "",
    `Valor de ${operation}: ${formatPrice(draft)}`,
    draft.contacto ? `Para más información: ${draft.contacto}` : "",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();
}

export function renderPortal(draft: PropertyDraft) {
  const opening = [
    draft.titulo || titleCase(draft.tipo) || "Propiedad",
    draft.zona ? `en ${draft.zona}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const rooms = [
    countLabel(draft.dormitorios, "dormitorio", "dormitorios"),
    countLabel(draft.banos, "baño", "baños"),
    countLabel(draft.cocheras, "cochera", "cocheras"),
  ].filter(Boolean);
  const surface = [
    draft.totalM2 ? `${draft.totalM2} m² totales` : "",
    draft.cubiertaM2 ? `${draft.cubiertaM2} m² cubiertos` : "",
  ].filter(Boolean);
  const paragraphs = [
    `${opening}.${draft.direccion ? ` Ubicada en ${draft.direccion}.` : ""}`,
    rooms.length || surface.length
      ? `La unidad cuenta con ${[...rooms, ...surface].join(", ")}.`
      : "",
    cleanHighlights(draft).length
      ? `Entre sus principales características se destacan: ${cleanHighlights(draft).join("; ")}.`
      : "",
    draft.estado || draft.situacion
      ? `Estado: ${[draft.estado, draft.situacion].filter(Boolean).join(" · ")}.`
      : "",
    `Valor: ${formatPrice(draft)}.`,
    draft.contacto ? `Consultas y visitas: ${draft.contacto}.` : "",
  ];

  return paragraphs.filter(Boolean).join("\n\n");
}

export function renderInstagram(draft: PropertyDraft) {
  const highlights = cleanHighlights(draft).slice(0, 4);
  return [
    `🏢 ${draft.titulo || "Nueva propiedad"}`,
    draft.zona || draft.direccion
      ? `📍 ${[draft.zona, draft.direccion].filter(Boolean).join(" · ")}`
      : "",
    "",
    ...highlights.map((item) => `✓ ${item}`),
    highlights.length ? "" : "",
    `💰 ${formatPrice(draft)}`,
    draft.contacto ? `📲 Consultas: ${draft.contacto}` : "",
    "",
    "#Rosario #Inmuebles #Propiedades",
  ]
    .filter((line, index, all) => line !== "" || all[index - 1] !== "")
    .join("\n")
    .trim();
}
