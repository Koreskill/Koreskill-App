"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Clipboard,
  FilePenLine,
  FileText,
  Instagram,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  WandSparkles,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  draftFromResponse,
  emptyPropertyDraft,
  extractPropertyDraft,
  PropertyDraft,
  PropertyRecordResponse,
  renderInstagram,
  renderPortal,
  renderWhatsApp,
} from "@/lib/property-record";
import styles from "./writer.module.css";

type OutputTab = "whatsapp" | "portal" | "instagram";

type ApiResponse = {
  properties?: PropertyRecordResponse[];
  property?: PropertyRecordResponse;
  error?: string;
};

const OUTPUT_TABS: Array<{
  key: OutputTab;
  label: string;
  icon: typeof MessageCircle;
}> = [
  { key: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { key: "portal", label: "Portal", icon: FileText },
  { key: "instagram", label: "Instagram", icon: Instagram },
];

async function readApi(response: Response): Promise<ApiResponse> {
  try {
    return (await response.json()) as ApiResponse;
  } catch {
    return {};
  }
}

export function PropertyWriter() {
  const [draft, setDraft] = useState<PropertyDraft>(emptyPropertyDraft);
  const [sourceText, setSourceText] = useState("");
  const [records, setRecords] = useState<PropertyDraft[]>([]);
  const [search, setSearch] = useState("");
  const [outputTab, setOutputTab] = useState<OutputTab>("whatsapp");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadRecords() {
      try {
        const response = await fetch("/api/property-records", {
          cache: "no-store",
        });
        const payload = await readApi(response);
        if (!response.ok) {
          throw new Error(payload.error || "No se pudieron cargar las fichas.");
        }
        if (active) {
          setRecords((payload.properties || []).map(draftFromResponse));
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudieron cargar las fichas.",
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadRecords();
    return () => {
      active = false;
    };
  }, []);

  const visibleRecords = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return records;
    return records.filter((record) =>
      [record.titulo, record.direccion, record.zona, record.cliente]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [records, search]);

  const outputs = useMemo(
    () => ({
      whatsapp: renderWhatsApp(draft),
      portal: renderPortal(draft),
      instagram: renderInstagram(draft),
    }),
    [draft],
  );

  const update = <Key extends keyof PropertyDraft>(
    key: Key,
    value: PropertyDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setNotice("");
    setError("");
  };

  const newRecord = () => {
    setDraft(emptyPropertyDraft());
    setSourceText("");
    setNotice("");
    setError("");
    setCopied(false);
  };

  const openRecord = (record: PropertyDraft) => {
    setDraft({ ...record, destacados: [...record.destacados] });
    setSourceText(record.textoOriginal);
    setNotice("");
    setError("");
    setCopied(false);
  };

  const interpretSource = () => {
    if (!sourceText.trim()) {
      setError("Pegá primero el texto recibido de la propiedad.");
      return;
    }
    const interpreted = extractPropertyDraft(sourceText, draft);
    setDraft(interpreted);
    setNotice("Datos detectados. Revisalos antes de guardar.");
    setError("");
  };

  const saveRecord = async () => {
    if (!draft.titulo.trim() && !draft.direccion.trim()) {
      setError("Completá al menos el título o la dirección.");
      return;
    }

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/property-records", {
        method: draft.id ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          textoOriginal: sourceText || draft.textoOriginal,
        }),
      });
      const payload = await readApi(response);
      if (!response.ok || !payload.property) {
        throw new Error(payload.error || "No se pudo guardar la ficha.");
      }

      const saved = draftFromResponse(payload.property);
      setDraft(saved);
      setSourceText(saved.textoOriginal);
      setRecords((current) => [
        saved,
        ...current.filter((record) => record.id !== saved.id),
      ]);
      setNotice(draft.id ? "Ficha actualizada." : "Ficha guardada en la biblioteca.");
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo guardar la ficha.",
      );
    } finally {
      setSaving(false);
    }
  };

  const copyOutput = async () => {
    try {
      await navigator.clipboard.writeText(outputs[outputTab]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("No se pudo copiar automáticamente. Seleccioná el texto manualmente.");
    }
  };

  const setHighlight = (index: number, value: string) => {
    update(
      "destacados",
      draft.destacados.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    );
  };

  const removeHighlight = (index: number) => {
    const next = draft.destacados.filter((_, itemIndex) => itemIndex !== index);
    update("destacados", next.length ? next : [""]);
  };

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>
            <FilePenLine size={18} />
          </span>
          <span>
            <strong>Redactor de fichas</strong>
            <small>Propiedades · WhatsApp · Portales</small>
          </span>
        </div>

        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} />
          Aplicaciones
        </Link>
      </header>

      <div className={styles.layout}>
        <aside className={styles.library}>
          <div className={styles.libraryHeading}>
            <div>
              <span>Biblioteca</span>
              <h2>Propiedades</h2>
            </div>
            <button type="button" onClick={newRecord} aria-label="Nueva ficha">
              <Plus size={18} />
            </button>
          </div>

          <label className={styles.search}>
            <Search size={14} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar propiedad..."
            />
          </label>

          <div className={styles.recordList}>
            {loading ? (
              <div className={styles.libraryEmpty}>
                <LoaderCircle className="spin" size={18} />
                Cargando fichas…
              </div>
            ) : visibleRecords.length ? (
              visibleRecords.map((record) => (
                <button
                  type="button"
                  key={record.id}
                  className={draft.id === record.id ? styles.recordActive : ""}
                  onClick={() => openRecord(record)}
                >
                  <span className={styles.recordIcon}>
                    <Building2 size={15} />
                  </span>
                  <span>
                    <strong>{record.titulo || "Ficha sin título"}</strong>
                    <small>
                      {[record.zona, record.direccion].filter(Boolean).join(" · ") ||
                        "Pendiente de completar"}
                    </small>
                  </span>
                  <ChevronRight size={14} />
                </button>
              ))
            ) : (
              <div className={styles.libraryEmpty}>
                <FileText size={20} />
                Todavía no hay fichas guardadas.
              </div>
            )}
          </div>

          <div className={styles.libraryFooter}>
            <strong>{records.length}</strong>
            <span>{records.length === 1 ? "propiedad" : "propiedades"}</span>
          </div>
        </aside>

        <section className={styles.workspace}>
          <div className={styles.intro}>
            <div>
              <span className={styles.eyebrow}>Aplicación 04</span>
              <h1>{draft.id ? "Editá la ficha" : "Convertí datos sueltos en una ficha lista."}</h1>
              <p>
                Pegá el mensaje recibido, revisá los datos y obtené siempre la
                misma estructura para WhatsApp, portales e Instagram.
              </p>
            </div>
            <button
              type="button"
              className={styles.saveButton}
              onClick={() => void saveRecord()}
              disabled={saving}
            >
              {saving ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
              {draft.id ? "Guardar cambios" : "Guardar ficha"}
            </button>
          </div>

          {(notice || error) && (
            <div className={error ? styles.errorNotice : styles.successNotice}>
              {error ? <Sparkles size={15} /> : <Check size={15} />}
              {error || notice}
            </div>
          )}

          <div className={styles.sourcePanel}>
            <div className={styles.panelHeading}>
              <div>
                <span>01 · Entrada rápida</span>
                <h2>Pegá el texto recibido</h2>
              </div>
              <button type="button" onClick={interpretSource}>
                <WandSparkles size={14} />
                Completar formulario
              </button>
            </div>
            <textarea
              value={sourceText}
              onChange={(event) => setSourceText(event.target.value)}
              placeholder="Pegá acá el mensaje de WhatsApp, las notas del relevamiento o los datos desordenados de la propiedad…"
            />
            <small>
              La herramienta detecta precio, superficies, ambientes, dirección y
              destacados. Siempre podés corregirlos debajo antes de guardar.
            </small>
          </div>

          <div className={styles.editorGrid}>
            <section className={styles.formPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>02 · Fuente de verdad</span>
                  <h2>Datos de la propiedad</h2>
                </div>
              </div>

              <div className={styles.fields}>
                <Field label="Título de la ficha" wide>
                  <input
                    value={draft.titulo}
                    onChange={(event) => update("titulo", event.target.value)}
                    placeholder="Monoambiente divisible a estrenar con balcón"
                  />
                </Field>

                <Field label="Tipo">
                  <select
                    value={draft.tipo}
                    onChange={(event) => update("tipo", event.target.value)}
                  >
                    <option value="">Seleccionar</option>
                    <option value="monoambiente">Monoambiente</option>
                    <option value="departamento">Departamento</option>
                    <option value="casa">Casa</option>
                    <option value="dúplex">Dúplex</option>
                    <option value="local">Local</option>
                    <option value="oficina">Oficina</option>
                    <option value="terreno">Terreno</option>
                    <option value="galpón">Galpón</option>
                  </select>
                </Field>

                <Field label="Operación">
                  <select
                    value={draft.operacion}
                    onChange={(event) => update("operacion", event.target.value)}
                  >
                    <option value="venta">Venta</option>
                    <option value="alquiler">Alquiler</option>
                    <option value="alquiler temporal">Alquiler temporal</option>
                  </select>
                </Field>

                <Field label="Dirección" wide>
                  <span className={styles.inputIcon}>
                    <MapPin size={14} />
                    <input
                      value={draft.direccion}
                      onChange={(event) => update("direccion", event.target.value)}
                      placeholder="9 de Julio al 300 – Rosario"
                    />
                  </span>
                </Field>

                <Field label="Zona / barrio">
                  <input
                    value={draft.zona}
                    onChange={(event) => update("zona", event.target.value)}
                    placeholder="Centro"
                  />
                </Field>

                <Field label="Cliente / inmobiliaria">
                  <input
                    value={draft.cliente}
                    onChange={(event) => update("cliente", event.target.value)}
                    placeholder="Risiglione"
                  />
                </Field>

                <Field label="Moneda">
                  <select
                    value={draft.moneda}
                    onChange={(event) => update("moneda", event.target.value)}
                  >
                    <option value="USD">USD</option>
                    <option value="ARS">ARS</option>
                  </select>
                </Field>

                <Field label="Precio">
                  <input
                    inputMode="numeric"
                    value={draft.precio}
                    onChange={(event) => update("precio", event.target.value)}
                    placeholder="67000"
                  />
                </Field>

                <Field label="Superficie total">
                  <input
                    inputMode="decimal"
                    value={draft.totalM2}
                    onChange={(event) => update("totalM2", event.target.value)}
                    placeholder="35.19"
                  />
                </Field>

                <Field label="Superficie cubierta">
                  <input
                    inputMode="decimal"
                    value={draft.cubiertaM2}
                    onChange={(event) => update("cubiertaM2", event.target.value)}
                    placeholder="30"
                  />
                </Field>

                <Field label="Dormitorios">
                  <input
                    inputMode="numeric"
                    value={draft.dormitorios}
                    onChange={(event) => update("dormitorios", event.target.value)}
                    placeholder="0"
                  />
                </Field>

                <Field label="Baños">
                  <input
                    inputMode="numeric"
                    value={draft.banos}
                    onChange={(event) => update("banos", event.target.value)}
                    placeholder="1"
                  />
                </Field>

                <Field label="Cocheras">
                  <input
                    inputMode="numeric"
                    value={draft.cocheras}
                    onChange={(event) => update("cocheras", event.target.value)}
                    placeholder="0"
                  />
                </Field>

                <Field label="Estado">
                  <input
                    value={draft.estado}
                    onChange={(event) => update("estado", event.target.value)}
                    placeholder="A estrenar"
                  />
                </Field>

                <Field label="Situación">
                  <input
                    value={draft.situacion}
                    onChange={(event) => update("situacion", event.target.value)}
                    placeholder="Vacía"
                  />
                </Field>

                <Field label="Contacto" wide>
                  <input
                    value={draft.contacto}
                    onChange={(event) => update("contacto", event.target.value)}
                    placeholder="+54 9 3414 02-8714"
                  />
                </Field>
              </div>

              <div className={styles.highlights}>
                <div className={styles.highlightsHeading}>
                  <div>
                    <strong>Características destacadas</strong>
                    <small>Una característica por línea</small>
                  </div>
                  <button
                    type="button"
                    onClick={() => update("destacados", [...draft.destacados, ""])}
                  >
                    <Plus size={13} />
                    Agregar
                  </button>
                </div>
                {draft.destacados.map((highlight, index) => (
                  <div className={styles.highlightRow} key={`highlight-${index}`}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <input
                      value={highlight}
                      onChange={(event) => setHighlight(index, event.target.value)}
                      placeholder="Ej. Balcón al contrafrente con vista despejada"
                    />
                    <button
                      type="button"
                      onClick={() => removeHighlight(index)}
                      aria-label="Eliminar característica"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <aside className={styles.outputPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>03 · Salida</span>
                  <h2>Ficha terminada</h2>
                </div>
                <span className={styles.liveBadge}>En vivo</span>
              </div>

              <div className={styles.outputTabs}>
                {OUTPUT_TABS.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      type="button"
                      key={tab.key}
                      className={outputTab === tab.key ? styles.outputTabActive : ""}
                      onClick={() => setOutputTab(tab.key)}
                    >
                      <Icon size={13} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <pre className={styles.output}>{outputs[outputTab]}</pre>

              <button type="button" className={styles.copyButton} onClick={() => void copyOutput()}>
                {copied ? <Check size={15} /> : <Clipboard size={15} />}
                {copied ? "Copiado" : `Copiar para ${OUTPUT_TABS.find((tab) => tab.key === outputTab)?.label}`}
              </button>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}

function Field({
  label,
  wide = false,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`${styles.field} ${wide ? styles.fieldWide : ""}`}>
      <span>{label}</span>
      {children}
    </label>
  );
}
