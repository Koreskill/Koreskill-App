"use client";

import {
  ArrowLeft,
  Building2,
  Check,
  Copy,
  DollarSign,
  Download,
  ExternalLink,
  FileText,
  Images,
  Instagram,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Sparkles,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "../project.module.css";

type TabKey =
  | "resumen"
  | "imagenes"
  | "textos"
  | "costos";

type ProjectProperty = {
  id: string;
  slug: string;
  name: string;
  type: string;
  operation: string;
  title: string;
  zone: string;
  address: string;
  client: string;
  currency: string;
  price: number | null;
  totalM2: number | null;
  coveredM2: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  garages: number | null;
  status: string;
  situation: string;
  highlights: string[];
  contact: string;
  rawSource: string;
  createdAt: string;
  updatedAt: string;
};

type ProjectImage = {
  id: string;
  propertyId: string | null;
  filename: string;
  mimeType: string;
  prompt: string;
  quality: string;
  aspectRatio: string;
  status: string;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
  resultUrl: string | null;
};

type ProjectText = {
  id: string;
  propertyId: string;
  type: string;
  content: string;
  sourceText: string;
  promptVersion: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCostMicros: number;
  createdAt: string;
  updatedAt: string;
};

type ProjectSummary = {
  imageCount: number;
  generatedImageCount: number;
  imageGenerationCount: number;
  textCount: number;
  textGenerationCount: number;
  textInputTokens: number;
  textOutputTokens: number;
  imageSpentMicros: number;
  textSpentMicros: number;
  totalSpentMicros: number;
};

type ProjectResponse = {
  property?: ProjectProperty;
  images?: ProjectImage[];
  texts?: ProjectText[];
  summary?: ProjectSummary;
  error?: string;
};

const TABS: Array<{
  id: TabKey;
  label: string;
  icon: typeof LayoutDashboard;
}> = [
  {
    id: "resumen",
    label: "Resumen",
    icon: LayoutDashboard,
  },
  {
    id: "imagenes",
    label: "Imágenes",
    icon: Images,
  },
  {
    id: "textos",
    label: "Textos",
    icon: FileText,
  },
  {
    id: "costos",
    label: "Costos",
    icon: DollarSign,
  },
];

function formatCost(micros: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(Number(micros || 0) / 1_000_000);
}

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function textTypeLabel(type: string) {
  if (type === "whatsapp") {
    return "WhatsApp";
  }

  if (type === "instagram") {
    return "Instagram";
  }

  if (type === "portal") {
    return "Portal inmobiliario";
  }

  return type;
}

function TextTypeIcon({
  type,
}: {
  type: string;
}) {
  if (type === "whatsapp") {
    return <MessageCircle size={15} />;
  }

  if (type === "instagram") {
    return <Instagram size={15} />;
  }

  return <FileText size={15} />;
}

export function ProjectScreen({
  propertyId,
}: {
  propertyId: string;
}) {
  const [data, setData] =
    useState<ProjectResponse | null>(null);

  const [activeTab, setActiveTab] =
    useState<TabKey>("resumen");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState("");
  const [previewImage, setPreviewImage] =
    useState<ProjectImage | null>(null);

  useEffect(() => {
    let active = true;

    async function loadProject() {
      try {
        const response = await fetch(
          `/api/library/${encodeURIComponent(propertyId)}`,
          {
            cache: "no-store",
          },
        );

        const payload =
          (await response.json()) as ProjectResponse;

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "No se pudo cargar el proyecto.",
          );
        }

        if (active) {
          setData(payload);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar el proyecto.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProject();

    return () => {
      active = false;
    };
  }, [propertyId]);

  const latestTexts = useMemo(() => {
    const results = new Map<string, ProjectText>();

    for (const text of data?.texts || []) {
      if (!results.has(text.type)) {
        results.set(text.type, text);
      }
    }

    return Array.from(results.values());
  }, [data?.texts]);

  const copyText = async (
    id: string,
    content: string,
  ) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);

      window.setTimeout(() => {
        setCopiedId("");
      }, 1800);
    } catch {
      setError(
        "No se pudo copiar automáticamente.",
      );
    }
  };

  if (loading) {
    return (
      <main className={styles.statePage}>
        <LoaderCircle className="spin" size={28} />
        <p>Cargando proyecto…</p>
      </main>
    );
  }

  if (
    error ||
    !data?.property ||
    !data.summary
  ) {
    return (
      <main className={styles.statePage}>
        <Building2 size={30} />
        <h1>No pudimos abrir este proyecto</h1>
        <p>{error || "La propiedad no existe."}</p>

        <Link href="/biblioteca">
          Volver a la biblioteca
        </Link>
      </main>
    );
  }

  const {
    property,
    images = [],
    texts = [],
    summary,
  } = data;

  const generatedImages = images.filter(
    (image) => Boolean(image.resultUrl),
  );

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <Building2 size={18} />
          </span>

          <span>
            <strong>Biblioteca de proyectos</strong>
            <small>{property.title}</small>
          </span>
        </div>

        <Link
          href="/biblioteca"
          className={styles.backButton}
        >
          <ArrowLeft size={15} />
          Biblioteca
        </Link>
      </header>

      <section className={styles.projectHeader}>
        <div>
          <span className={styles.eyebrow}>
            Proyecto inmobiliario
          </span>

          <h1>
            {property.title || property.name}
          </h1>

          <p>
            <MapPin size={14} />

            {[property.zone, property.address]
              .filter(Boolean)
              .join(" · ") ||
              "Sin ubicación registrada"}
          </p>
        </div>

        <div className={styles.headerActions}>
          <Link href="/propiedades">
            <Images size={15} />
            Generar imágenes
          </Link>

          <Link href="/fichas">
            <FileText size={15} />
            Editar textos
          </Link>
        </div>
      </section>

      <section className={styles.stats}>
        <article>
          <Images size={18} />

          <div>
            <strong>
              {summary.generatedImageCount}
            </strong>
            <span>Imágenes terminadas</span>
          </div>
        </article>

        <article>
          <FileText size={18} />

          <div>
            <strong>{summary.textCount}</strong>
            <span>Textos guardados</span>
          </div>
        </article>

        <article>
          <Sparkles size={18} />

          <div>
            <strong>
              {summary.imageGenerationCount +
                summary.textGenerationCount}
            </strong>
            <span>Generaciones realizadas</span>
          </div>
        </article>

        <article>
          <DollarSign size={18} />

          <div>
            <strong>
              {formatCost(
                summary.totalSpentMicros,
              )}
            </strong>
            <span>Gasto estimado</span>
          </div>
        </article>
      </section>

      <nav
        className={styles.tabs}
        aria-label="Secciones del proyecto"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              type="button"
              className={
                activeTab === tab.id
                  ? styles.tabActive
                  : ""
              }
              onClick={() => setActiveTab(tab.id)}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <section className={styles.content}>
        {activeTab === "resumen" && (
          <div className={styles.overviewGrid}>
            <section className={styles.propertyPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>Información</span>
                  <h2>Datos de la propiedad</h2>
                </div>
              </div>

              <dl className={styles.propertyData}>
                <div>
                  <dt>Tipo</dt>
                  <dd>
                    {property.type || "Sin definir"}
                  </dd>
                </div>

                <div>
                  <dt>Operación</dt>
                  <dd>
                    {property.operation ||
                      "Sin definir"}
                  </dd>
                </div>

                <div>
                  <dt>Precio</dt>
                  <dd>
                    {property.price
                      ? `${property.currency} ${new Intl.NumberFormat(
                          "es-AR",
                        ).format(property.price)}`
                      : "A consultar"}
                  </dd>
                </div>

                <div>
                  <dt>Superficie total</dt>
                  <dd>
                    {property.totalM2
                      ? `${property.totalM2} m²`
                      : "Sin definir"}
                  </dd>
                </div>

                <div>
                  <dt>Dormitorios</dt>
                  <dd>
                    {property.bedrooms ?? "—"}
                  </dd>
                </div>

                <div>
                  <dt>Baños</dt>
                  <dd>
                    {property.bathrooms ?? "—"}
                  </dd>
                </div>

                <div>
                  <dt>Cocheras</dt>
                  <dd>
                    {property.garages ?? "—"}
                  </dd>
                </div>

                <div>
                  <dt>Cliente</dt>
                  <dd>
                    {property.client || "Sin definir"}
                  </dd>
                </div>
              </dl>

              {property.highlights.length > 0 && (
                <div className={styles.highlights}>
                  <strong>Características</strong>

                  <ul>
                    {property.highlights.map(
                      (highlight) => (
                        <li key={highlight}>
                          {highlight}
                        </li>
                      ),
                    )}
                  </ul>
                </div>
              )}
            </section>

            <section className={styles.recentPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <span>Últimos resultados</span>
                  <h2>Contenido reciente</h2>
                </div>
              </div>

              {generatedImages.length ||
              latestTexts.length ? (
                <div className={styles.recentContent}>
                  {generatedImages
                    .slice(0, 2)
                    .map((image) => (
                      <button
                        type="button"
                        className={styles.recentImage}
                        key={image.id}
                        onClick={() =>
                          setPreviewImage(image)
                        }
                      >
                        <Image
                          src={image.resultUrl!}
                          alt={image.filename}
                          width={500}
                          height={700}
                          unoptimized
                        />
                      </button>
                    ))}

                  {latestTexts
                    .slice(0, 3)
                    .map((text) => (
                      <article
                        className={styles.recentText}
                        key={text.id}
                      >
                        <span>
                          <TextTypeIcon
                            type={text.type}
                          />
                          {textTypeLabel(text.type)}
                        </span>

                        <p>{text.content}</p>
                      </article>
                    ))}
                </div>
              ) : (
                <div className={styles.empty}>
                  <Sparkles size={25} />
                  <p>
                    Este proyecto todavía no tiene
                    contenido generado.
                  </p>
                </div>
              )}
            </section>
          </div>
        )}

        {activeTab === "imagenes" && (
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span>Galería</span>
                <h2>Imágenes del proyecto</h2>
              </div>

              <strong>
                {generatedImages.length} terminadas
              </strong>
            </div>

            {images.length ? (
              <div className={styles.imageGrid}>
                {images.map((image) => {
                  const displayUrl =
                    image.resultUrl ||
                    image.sourceUrl;

                  return (
                    <article
                      className={styles.imageCard}
                      key={image.id}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewImage(image)
                        }
                      >
                        <Image
                          src={displayUrl}
                          alt={image.filename}
                          width={600}
                          height={820}
                          unoptimized
                        />

                        <span>
                          {image.resultUrl
                            ? "Resultado"
                            : "Original"}
                        </span>
                      </button>

                      <div>
                        <strong>
                          {image.filename}
                        </strong>

                        <small>
                          {image.aspectRatio} ·{" "}
                          {image.quality}
                        </small>

                        <footer>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImage(image)
                            }
                          >
                            <ExternalLink
                              size={14}
                            />
                            Ver
                          </button>

                          {image.resultUrl && (
                            <a
                              href={`${image.resultUrl}?download=1`}
                            >
                              <Download size={14} />
                              Descargar
                            </a>
                          )}
                        </footer>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className={styles.empty}>
                <Images size={27} />
                <p>
                  Todavía no hay imágenes en esta
                  propiedad.
                </p>

                <Link href="/propiedades">
                  Generar imágenes
                </Link>
              </div>
            )}
          </section>
        )}

        {activeTab === "textos" && (
          <section className={styles.panel}>
            <div className={styles.panelHeading}>
              <div>
                <span>Historial</span>
                <h2>Textos generados</h2>
              </div>

              <strong>{texts.length} textos</strong>
            </div>

            {texts.length ? (
              <div className={styles.textList}>
                {texts.map((text) => (
                  <article
                    className={styles.textCard}
                    key={text.id}
                  >
                    <header>
                      <span>
                        <TextTypeIcon
                          type={text.type}
                        />

                        {textTypeLabel(text.type)}
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            text.id,
                            text.content,
                          )
                        }
                      >
                        {copiedId === text.id ? (
                          <Check size={14} />
                        ) : (
                          <Copy size={14} />
                        )}

                        {copiedId === text.id
                          ? "Copiado"
                          : "Copiar"}
                      </button>
                    </header>

                    <pre>{text.content}</pre>

                    <footer>
                      <span>{text.model}</span>

                      <span>
                        {text.inputTokens} entrada ·{" "}
                        {text.outputTokens} salida
                      </span>

                      <span>
                        {formatDate(text.createdAt)}
                      </span>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.empty}>
                <FileText size={27} />
                <p>
                  Todavía no hay textos generados.
                </p>

                <Link href="/fichas">
                  Generar textos
                </Link>
              </div>
            )}
          </section>
        )}

        {activeTab === "costos" && (
          <div className={styles.costGrid}>
            <article>
              <Images size={20} />
              <span>Generación de imágenes</span>

              <strong>
                {formatCost(
                  summary.imageSpentMicros,
                )}
              </strong>

              <small>
                {summary.imageGenerationCount}{" "}
                generaciones registradas
              </small>
            </article>

            <article>
              <FileText size={20} />
              <span>Generación de textos</span>

              <strong>
                {formatCost(
                  summary.textSpentMicros,
                )}
              </strong>

              <small>
                {summary.textGenerationCount}{" "}
                generaciones ·{" "}
                {summary.textInputTokens +
                  summary.textOutputTokens}{" "}
                tokens
              </small>
            </article>

            <article className={styles.totalCostCard}>
              <DollarSign size={20} />
              <span>Total del proyecto</span>

              <strong>
                {formatCost(
                  summary.totalSpentMicros,
                )}
              </strong>

              <small>
                Imágenes y textos combinados
              </small>
            </article>
          </div>
        )}
      </section>

      {previewImage && (
        <div
          className={styles.modal}
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada de la imagen"
        >
          <button
            type="button"
            className={styles.modalClose}
            onClick={() => setPreviewImage(null)}
            aria-label="Cerrar imagen"
          >
            <X size={20} />
          </button>

          <Image
            src={
              previewImage.resultUrl ||
              previewImage.sourceUrl
            }
            alt={previewImage.filename}
            width={1200}
            height={1800}
            unoptimized
          />

          <footer>
            <strong>{previewImage.filename}</strong>

            {previewImage.resultUrl && (
              <a
                href={`${previewImage.resultUrl}?download=1`}
              >
                <Download size={15} />
                Descargar
              </a>
            )}
          </footer>
        </div>
      )}
    </main>
  );
}