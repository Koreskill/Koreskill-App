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
  Plus,
  Search,
  Tag,
  Trash2,
  Users,
  X,
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
  clientColor: string;
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

type Client = {
  id: string;
  name: string;
  color: string;
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
  const [clientFilter, setClientFilter] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] =
    useState<LibraryProject | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [taggingId, setTaggingId] = useState("");
  const [clientModal, setClientModal] = useState(false);
  const [savingClient, setSavingClient] = useState(false);
  const [newClient, setNewClient] = useState({
    name: "",
    color: "#2563eb",
  });

  useEffect(() => {
    let active = true;

    async function loadLibrary() {
      try {
        const [response, clientsResponse] = await Promise.all([
          fetch("/api/library", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
        ]);

        const [payload, clientsPayload] = await Promise.all([
          response.json() as Promise<LibraryResponse>,
          clientsResponse.json() as Promise<{
            clients?: Client[];
            error?: string;
          }>,
        ]);

        if (!response.ok || !clientsResponse.ok) {
          throw new Error(
            payload.error || clientsPayload.error ||
              "No se pudo cargar la biblioteca.",
          );
        }

        if (active) {
          setProjects(payload.projects || []);
          setTotals(payload.totals || EMPTY_TOTALS);
          setClients(clientsPayload.clients || []);
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

    return projects.filter((project) => {
      const matchesClient =
        !clientFilter || project.client === clientFilter;
      const matchesSearch =
        !query ||
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
          .includes(query);

      return matchesClient && matchesSearch;
    });
  }, [clientFilter, projects, search]);

  async function assignClient(
    projectId: string,
    clientId: string,
  ) {
    setTaggingId(projectId);
    setError("");

    try {
      const response = await fetch(
        `/api/library/${encodeURIComponent(projectId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ clientId: clientId || null }),
        },
      );
      const payload = (await response.json()) as {
        property?: {
          client: string;
          clientColor: string;
          updatedAt: string;
        };
        error?: string;
      };

      if (!response.ok || !payload.property) {
        throw new Error(
          payload.error || "No se pudo aplicar la etiqueta.",
        );
      }

      setProjects((current) =>
        current.map((project) =>
          project.id === projectId
            ? { ...project, ...payload.property }
            : project,
        ),
      );
    } catch (assignError) {
      setError(
        assignError instanceof Error
          ? assignError.message
          : "No se pudo aplicar la etiqueta.",
      );
    } finally {
      setTaggingId("");
    }
  }

  async function deleteProject() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/library/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json()) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.error || "No se pudo eliminar la carpeta.",
        );
      }

      setProjects((current) =>
        current.filter((project) => project.id !== deleteTarget.id),
      );
      setTotals((current) => ({
        projects: Math.max(0, current.projects - 1),
        images: Math.max(
          0,
          current.images - deleteTarget.generatedImageCount,
        ),
        texts: Math.max(0, current.texts - deleteTarget.textCount),
        imageGenerations: Math.max(
          0,
          current.imageGenerations - deleteTarget.imageGenerationCount,
        ),
        textGenerations: Math.max(
          0,
          current.textGenerations - deleteTarget.textGenerationCount,
        ),
        inputTokens: Math.max(
          0,
          current.inputTokens - deleteTarget.inputTokens,
        ),
        outputTokens: Math.max(
          0,
          current.outputTokens - deleteTarget.outputTokens,
        ),
        spentMicros: Math.max(
          0,
          current.spentMicros - deleteTarget.totalSpentMicros,
        ),
      }));
      setDeleteTarget(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar la carpeta.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function createClient() {
    if (!newClient.name.trim()) return;
    setSavingClient(true);
    setError("");

    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newClient),
      });
      const payload = (await response.json()) as {
        client?: Client;
        error?: string;
      };

      if (!response.ok || !payload.client) {
        throw new Error(
          payload.error || "No se pudo crear el cliente.",
        );
      }

      setClients((current) =>
        [...current, payload.client as Client].sort((first, second) =>
          first.name.localeCompare(second.name),
        ),
      );
      setNewClient({ name: "", color: "#2563eb" });
      setClientModal(false);
    } catch (clientError) {
      setError(
        clientError instanceof Error
          ? clientError.message
          : "No se pudo crear el cliente.",
      );
    } finally {
      setSavingClient(false);
    }
  }

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

          <div className={styles.libraryTools}>
            <label className={styles.clientFilter}>
              <Users size={14} />
              <select
                value={clientFilter}
                onChange={(event) =>
                  setClientFilter(event.target.value)
                }
              >
                <option value="">Todos los clientes</option>
                {clients.map((client) => (
                  <option value={client.name} key={client.id}>
                    {client.name}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              className={styles.newClientButton}
              onClick={() => setClientModal(true)}
            >
              <Plus size={14} />
              Cliente
            </button>

            <label className={styles.search}>
              <Search size={15} />

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Buscar propiedad..."
              />
            </label>
          </div>
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
              <article className={styles.card} key={project.id}>
                <Link
                  href={`/biblioteca/${project.id}`}
                  className={styles.cardLink}
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
                      <strong
                        style={{
                          color:
                            project.clientColor || "#2563eb",
                        }}
                      >
                        {project.client}
                      </strong>
                    )}
                    </footer>
                  </div>
                </Link>

                <div className={styles.cardActions}>
                  <label>
                    <Tag size={13} />
                    <select
                      value={
                        clients.find(
                          (client) =>
                            client.name === project.client,
                        )?.id || ""
                      }
                      disabled={taggingId === project.id}
                      onChange={(event) =>
                        void assignClient(
                          project.id,
                          event.target.value,
                        )
                      }
                      aria-label={`Cliente de ${
                        project.title || project.name
                      }`}
                    >
                      <option value="">Sin cliente</option>
                      {project.client &&
                        !clients.some(
                          (client) =>
                            client.name === project.client,
                        ) && (
                          <option value="" disabled>
                            {project.client}
                          </option>
                        )}
                      {clients.map((client) => (
                        <option value={client.id} key={client.id}>
                          {client.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    type="button"
                    className={styles.trashButton}
                    onClick={() => setDeleteTarget(project)}
                    aria-label={`Eliminar ${
                      project.title || project.name
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </article>
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

      {deleteTarget && (
        <div className={styles.modalBackdrop}>
          <div className={styles.confirmModal}>
            <span className={styles.dangerIcon}>
              <Trash2 size={20} />
            </span>

            <h2>¿Eliminar esta carpeta?</h2>
            <p>
              Se borrará <strong>{deleteTarget.title || deleteTarget.name}</strong>,
              junto con sus imágenes, textos y registros de gasto. Esta acción
              no se puede deshacer.
            </p>

            <div>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={styles.confirmDelete}
                onClick={() => void deleteProject()}
                disabled={deleting}
              >
                {deleting ? (
                  <LoaderCircle className="spin" size={14} />
                ) : (
                  <Trash2 size={14} />
                )}
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}

      {clientModal && (
        <div className={styles.modalBackdrop}>
          <div className={styles.clientModal}>
            <header>
              <div>
                <span>Etiqueta de cliente</span>
                <h2>Crear cliente</h2>
              </div>

              <button
                type="button"
                onClick={() => setClientModal(false)}
                aria-label="Cerrar"
              >
                <X size={17} />
              </button>
            </header>

            <label>
              <span>Nombre</span>
              <input
                value={newClient.name}
                onChange={(event) =>
                  setNewClient((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                placeholder="Ej.: Juri Brokers"
                autoFocus
              />
            </label>

            <div className={styles.colorPicker}>
              <span>Color</span>
              <div>
                {[
                  "#2563eb",
                  "#7c3aed",
                  "#0891b2",
                  "#16a34a",
                  "#ea580c",
                  "#db2777",
                ].map((color) => (
                  <button
                    type="button"
                    key={color}
                    aria-label={`Elegir ${color}`}
                    style={{ background: color }}
                    className={
                      newClient.color === color
                        ? styles.selectedColor
                        : ""
                    }
                    onClick={() =>
                      setNewClient((current) => ({
                        ...current,
                        color,
                      }))
                    }
                  />
                ))}
              </div>
            </div>

            <button
              type="button"
              className={styles.createClientButton}
              onClick={() => void createClient()}
              disabled={savingClient || !newClient.name.trim()}
            >
              {savingClient ? (
                <LoaderCircle className="spin" size={14} />
              ) : (
                <Plus size={14} />
              )}
              Crear cliente
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
