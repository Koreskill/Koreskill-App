"use client";

import {
  ArrowLeft,
  ChevronRight,
  DollarSign,
  FileText,
  FolderOpen,
  Images,
  LibraryBig,
  LoaderCircle,
  Search,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import styles from "./library.module.css";

type LibraryProject = {
  id: string;
  slug: string;
  name: string;
  title: string;
  address: string;
  zone: string;
  client: string;
  type: string;
  operation: string;
  imageCount: number;
  generatedImageCount: number;
  imageGenerationCount: number;
  textCount: number;
  textGenerationCount: number;
  inputTokens: number;
  outputTokens: number;
  imageSpentMicros: number;
  textSpentMicros: number;
  totalSpentMicros: number;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

type LibraryTotals = {
  projects: number;
  images: number;
  texts: number;
  imageGenerations: number;
  textGenerations: number;
  inputTokens: number;
  outputTokens: number;
  spentMicros: number;
};

type LibraryResponse = {
  projects?: LibraryProject[];
  totals?: LibraryTotals;
  error?: string;
};

const EMPTY_TOTALS: LibraryTotals = {
  projects: 0,
  images: 0,
  texts: 0,
  imageGenerations: 0,
  textGenerations: 0,
  inputTokens: 0,
  outputTokens: 0,
  spentMicros: 0,
};

function formatCost(micros: number) {
  const dollars = Number(micros || 0) / 1_000_000;

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(dollars);
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
  }).format(date);
}

export function LibraryScreen() {
  const [projects, setProjects] = useState<
    LibraryProject[]
  >([]);

  const [totals, setTotals] =
    useState<LibraryTotals>(EMPTY_TOTALS);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      try {
        const response = await fetch("/api/library", {
          cache: "no-store",
        });

        const payload =
          (await response.json()) as LibraryResponse;

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "No se pudo cargar la biblioteca.",
          );
        }

        if (active) {
          setProjects(payload.projects || []);
          setTotals(payload.totals || EMPTY_TOTALS);
        }
      } catch (loadError) {
        if (active) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "No se pudo cargar la biblioteca.",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadLibrary();

    return () => {
      active = false;
    };
  }, []);

  const visibleProjects = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return projects;
    }

    return projects.filter((project) =>
      [
        project.name,
        project.title,
        project.address,
        project.zone,
        project.client,
        project.type,
        project.operation,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [projects, search]);

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}>
            <LibraryBig size={19} />
          </span>

          <span>
            <strong>Biblioteca de proyectos</strong>
            <small>
              Imágenes, textos y costos por propiedad
            </small>
          </span>
        </div>

        <Link href="/" className={styles.backButton}>
          <ArrowLeft size={15} />
          Aplicaciones
        </Link>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>
            Aplicación 05
          </span>

          <h1>
            Todo el contenido de cada propiedad, en un
            solo lugar.
          </h1>

          <p>
            Abrí un proyecto para consultar sus imágenes,
            textos comerciales y gastos de generación.
          </p>
        </div>

        <div className={styles.totalCost}>
          <span>Gasto total registrado</span>
          <strong>{formatCost(totals.spentMicros)}</strong>
          <small>
            {totals.imageGenerations} generaciones de
            imágenes · {totals.textGenerations} de textos
          </small>
        </div>
      </section>

      <section className={styles.stats}>
        <article>
          <span className={styles.statIcon}>
            <FolderOpen size={18} />
          </span>
          <div>
            <strong>{totals.projects}</strong>
            <small>Proyectos</small>
          </div>
        </article>

        <article>
          <span className={styles.statIcon}>
            <Images size={18} />
          </span>
          <div>
            <strong>{totals.images}</strong>
            <small>Imágenes terminadas</small>
          </div>
        </article>

        <article>
          <span className={styles.statIcon}>
            <FileText size={18} />
          </span>
          <div>
            <strong>{totals.texts}</strong>
            <small>Textos guardados</small>
          </div>
        </article>

        <article>
          <span className={styles.statIcon}>
            <DollarSign size={18} />
          </span>
          <div>
            <strong>
              {formatCost(totals.spentMicros)}
            </strong>
            <small>Consumo estimado</small>
          </div>
        </article>
      </section>

      <section className={styles.library}>
        <div className={styles.libraryHeader}>
          <div>
            <span>Biblioteca</span>
            <h2>Propiedades</h2>
          </div>

          <label className={styles.search}>
            <Search size={15} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Buscar por dirección, cliente o zona..."
            />
          </label>
        </div>

        {error && (
          <div className={styles.error}>{error}</div>
        )}

        {loading ? (
          <div className={styles.loading}>
            <LoaderCircle
              className="spin"
              size={22}
            />
            Cargando biblioteca…
          </div>
        ) : visibleProjects.length ? (
          <div className={styles.grid}>
            {visibleProjects.map((project) => (
              <Link
                href={`/biblioteca/${project.id}`}
                className={styles.card}
                key={project.id}
              >
                <div className={styles.preview}>
                  {project.thumbnailUrl ? (
                    <Image
                      src={project.thumbnailUrl}
                      alt={
                        project.title ||
                        project.name
                      }
                      width={720}
                      height={460}
                      unoptimized
                    />
                  ) : (
                    <span>
                      <FolderOpen size={32} />
                      Sin imágenes generadas
                    </span>
                  )}

                  <span className={styles.folderBadge}>
                    <FolderOpen size={13} />
                    Proyecto
                  </span>
                </div>

                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>
                    <div>
                      <h3>
                        {project.title ||
                          project.name}
                      </h3>

                      <p>
                        {[
                          project.zone,
                          project.address,
                        ]
                          .filter(Boolean)
                          .join(" · ") ||
                          "Sin ubicación registrada"}
                      </p>
                    </div>

                    <ChevronRight size={18} />
                  </div>

                  <div className={styles.cardMetrics}>
                    <span>
                      <Images size={14} />
                      {project.generatedImageCount} imágenes
                    </span>

                    <span>
                      <FileText size={14} />
                      {project.textCount} textos
                    </span>

                    <span>
                      <DollarSign size={14} />
                      {formatCost(
                        project.totalSpentMicros,
                      )}
                    </span>
                  </div>

                  <footer>
                    <span>
                      Actualizado{" "}
                      {formatDate(project.updatedAt)}
                    </span>

                    {project.client && (
                      <strong>{project.client}</strong>
                    )}
                  </footer>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className={styles.empty}>
            <FolderOpen size={30} />

            <h3>
              {search
                ? "No encontramos proyectos"
                : "Todavía no hay proyectos"}
            </h3>

            <p>
              {search
                ? "Probá con otra dirección, zona o cliente."
                : "Creá una propiedad o una ficha para verla en esta biblioteca."}
            </p>

            {!search && (
              <Link href="/propiedades">
                Crear una propiedad
              </Link>
            )}
          </div>
        )}
      </section>
    </main>
  );
}