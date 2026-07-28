"use client";

import {
  Building2,
  Check,
  ChevronRight,
  ClipboardPaste,
  Download,
  Folder,
  FolderOpen,
  ImagePlus,
  ListOrdered,
  LoaderCircle,
  MapPin,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
  X,
  Zap,
} from "lucide-react";
import JSZip from "jszip";
import Link from "next/link";
import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Quality = "low" | "medium" | "high" | "auto";
type JobStatus =
  | "draft"
  | "uploading"
  | "queued"
  | "processing"
  | "succeeded"
  | "failed";
type ExecutionMode = "parallel" | "loop";

type PromptPreset = {
  key: string;
  label: string;
  prompt: string;
  updatedAt: string;
};

type PropertySummary = {
  id: string;
  name: string;
  address: string | null;
  imageCount: number;
  completedCount: number;
  generationCount: number;
  spentMicros: number;
  createdAt: string;
  updatedAt: string;
};

type ApiJob = {
  id: string;
  propertyId: string | null;
  batchId: string;
  filename: string;
  mimeType: string;
  prompt: string;
  quality: Quality;
  aspectRatio: string;
  status: Exclude<JobStatus, "draft" | "uploading">;
  error: string | null;
  createdAt: string;
  updatedAt: string;
  sourceUrl: string;
  resultUrl: string | null;
};

type StudioJob = {
  localId: string;
  serverId?: string;
  propertyId: string;
  batchId: string;
  filename: string;
  file?: File;
  sourceUrl: string;
  resultUrl?: string;
  prompt: string;
  quality: Quality;
  status: JobStatus;
  error?: string;
};

const QUALITY_PRICES: Record<Quality, number> = {
  low: 0.012,
  medium: 0.047,
  high: 0.128,
  auto: 0.047,
};

const DEFAULT_PROMPT = `Utiliza exactamente la fotografía enviada como imagen base.

Extiende el encuadre verticalmente al formato 9:16 mediante outpainting, generando únicamente las áreas necesarias en los bordes superiores e inferiores.

Conserva sin cambios la arquitectura, proporciones, perspectiva, punto de vista, materiales, carpinterías, vegetación, mobiliario y todos los elementos originales. No agregues, elimines ni rediseñes objetos.

Continúa de forma natural el cielo, paredes, techo, suelo, césped o piso según corresponda a la escena. Ajusta sutilmente la iluminación, el balance de blancos, las sombras y el contraste para obtener una fotografía inmobiliaria premium, atractiva, natural y absolutamente realista. Evita colores saturados, apariencia de render o retoques artificiales.`;

const STATUS_LABELS: Record<JobStatus, string> = {
  draft: "Lista",
  uploading: "Subiendo",
  queued: "En cola",
  processing: "Generando",
  succeeded: "Terminada",
  failed: "Revisar",
};

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createId() {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  if (typeof cryptoApi?.getRandomValues === "function") {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    );
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
      .slice(6, 8)
      .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatUsd(micros: number) {
  return (micros / 1_000_000).toLocaleString("es-AR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 3,
  });
}

function apiJobToStudio(job: ApiJob): StudioJob {
  return {
    localId: job.id,
    serverId: job.id,
    propertyId: job.propertyId || "",
    batchId: job.batchId,
    filename: job.filename,
    sourceUrl: job.sourceUrl,
    resultUrl: job.resultUrl || undefined,
    prompt: job.prompt,
    quality: job.quality,
    status: job.status,
    error: job.error || undefined,
  };
}

function cleanBaseName(filename: string) {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "imagen"
  );
}

async function readError(response: Response, fallback: string) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || fallback;
  } catch {
    return fallback;
  }
}

async function optimizeImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, 2000 / longestSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar la imagen.");
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let blob: Blob | null = null;
    for (const quality of [0.86, 0.76, 0.66, 0.56]) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );
      if (blob && blob.size <= 750 * 1024) break;
    }
    if (!blob) throw new Error("No se pudo preparar la imagen.");
    const optimized = new File([blob], `${cleanBaseName(file.name)}.jpg`, {
      type: "image/jpeg",
    });
    return optimized.size < file.size ? optimized : file;
  } catch {
    return file;
  }
}

export function ImageStudio() {
  const [properties, setProperties] = useState<PropertySummary[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [propertiesLoading, setPropertiesLoading] = useState(true);
  const [showPropertyForm, setShowPropertyForm] = useState(false);
  const [propertyName, setPropertyName] = useState("");
  const [propertyAddress, setPropertyAddress] = useState("");
  const [propertySaving, setPropertySaving] = useState(false);
  const [propertyError, setPropertyError] = useState("");
  const [jobs, setJobsState] = useState<StudioJob[]>([]);
  const jobsRef = useRef<StudioJob[]>([]);
  const [promptPresets, setPromptPresets] = useState<PromptPreset[]>([]);
  const [activePresetKey, setActivePresetKey] = useState("fachada");
  const [presetSaving, setPresetSaving] = useState(false);
  const [presetFeedback, setPresetFeedback] = useState("");
  const [showPresetForm, setShowPresetForm] = useState(false);
  const [newPresetLabel, setNewPresetLabel] = useState("");
  const [newPresetPrompt, setNewPresetPrompt] = useState("");
  const [presetCreating, setPresetCreating] = useState(false);
  const [basePrompt, setBasePrompt] = useState(DEFAULT_PROMPT);
  const [defaultQuality, setDefaultQuality] = useState<Quality>("low");
  const [mode, setMode] = useState<ExecutionMode>("parallel");
  const [isDragging, setIsDragging] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const [isPackaging, setIsPackaging] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [replicateConfigured, setReplicateConfigured] = useState<boolean | null>(
    null,
  );
  const [batchId, setBatchId] = useState(createId);
  const inputRef = useRef<HTMLInputElement>(null);
  const stopQueueRef = useRef(false);
  const pollingIdsRef = useRef(new Set<string>());

  const selectedProperty = useMemo(
    () =>
      properties.find((property) => property.id === selectedPropertyId) || null,
    [properties, selectedPropertyId],
  );
  const activePreset = useMemo(
    () =>
      promptPresets.find((preset) => preset.key === activePresetKey) || null,
    [activePresetKey, promptPresets],
  );

  const setJobs = useCallback(
    (
      updater:
        | StudioJob[]
        | ((currentJobs: StudioJob[]) => StudioJob[]),
    ) => {
      setJobsState((currentJobs) => {
        const nextJobs =
          typeof updater === "function" ? updater(currentJobs) : updater;
        jobsRef.current = nextJobs;
        return nextJobs;
      });
    },
    [],
  );

  const patchJob = useCallback(
    (localId: string, patch: Partial<StudioJob>) => {
      setJobs((current) =>
        current.map((job) =>
          job.localId === localId ? { ...job, ...patch } : job,
        ),
      );
    },
    [setJobs],
  );

  const loadProperties = useCallback(async () => {
    const response = await fetch("/api/properties", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(
        await readError(response, "No se pudieron cargar las propiedades."),
      );
    }
    const payload = (await response.json()) as {
      properties: PropertySummary[];
    };
    setProperties(payload.properties);
    setSelectedPropertyId((current) =>
      current && payload.properties.some((property) => property.id === current)
        ? current
        : payload.properties[0]?.id || "",
    );
    return payload.properties;
  }, []);

  useEffect(() => {
    let active = true;
    const initializeProperties = async () => {
      try {
        await loadProperties();
      } catch {
        if (active) {
          setPropertyError("No se pudieron cargar las propiedades.");
        }
      } finally {
        if (active) setPropertiesLoading(false);
      }
    };
    void initializeProperties();
    return () => {
      active = false;
    };
  }, [loadProperties]);

  useEffect(() => {
    let active = true;
    const loadPromptPresets = async () => {
      try {
        const response = await fetch("/api/prompts", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          presets: PromptPreset[];
        };
        if (!active) return;
        setPromptPresets(payload.presets);
        const initial =
          payload.presets.find((preset) => preset.key === "fachada") ||
          payload.presets[0];
        if (initial) {
          setActivePresetKey(initial.key);
          setBasePrompt(initial.prompt);
        }
      } catch {
        // The generic fallback remains available if presets cannot load.
      }
    };
    void loadPromptPresets();
    return () => {
      active = false;
    };
  }, []);

  const pollJob = useCallback(
    async (localId: string, serverId: string) => {
      if (pollingIdsRef.current.has(serverId)) return;
      pollingIdsRef.current.add(serverId);

      try {
        for (let attempt = 0; attempt < 180; attempt += 1) {
          const response = await fetch(`/api/jobs/${serverId}`, {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error(
              await readError(response, "No se pudo consultar el resultado."),
            );
          }
          const payload = (await response.json()) as { job: ApiJob };
          const next = apiJobToStudio(payload.job);
          patchJob(localId, {
            serverId,
            status: next.status,
            resultUrl: next.resultUrl,
            error: next.error,
          });

          if (next.status === "succeeded" || next.status === "failed") {
            await loadProperties().catch(() => undefined);
            return;
          }
          await wait(2500);
        }
        throw new Error("La generación está tardando más de lo esperado.");
      } catch (error) {
        patchJob(localId, {
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "No se pudo completar la generación.",
        });
      } finally {
        pollingIdsRef.current.delete(serverId);
      }
    },
    [loadProperties, patchJob],
  );

  useEffect(() => {
    if (!selectedPropertyId) {
      return;
    }

    let active = true;
    fetch(
      `/api/jobs?propertyId=${encodeURIComponent(selectedPropertyId)}`,
      { cache: "no-store" },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudo cargar la carpeta.");
        return (await response.json()) as {
          jobs: ApiJob[];
          replicateConfigured: boolean;
        };
      })
      .then((payload) => {
        if (!active) return;
        const restored = payload.jobs.map(apiJobToStudio);
        setReplicateConfigured(payload.replicateConfigured);
        setJobs(restored);
        setBatchId(createId());
        restored
          .filter((job) => job.status === "processing" && job.serverId)
          .forEach((job) => void pollJob(job.localId, job.serverId!));
      })
      .catch(() => {
        if (active) setReplicateConfigured(null);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [pollJob, selectedPropertyId, setJobs]);

  const createProperty = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!propertyName.trim()) return;
    setPropertySaving(true);
    setPropertyError("");
    try {
      const response = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: propertyName,
          address: propertyAddress,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readError(response, "No se pudo crear la propiedad."),
        );
      }
      const payload = (await response.json()) as {
        property: PropertySummary;
      };
      setProperties((current) => [payload.property, ...current]);
      setHistoryLoading(true);
      setSelectedPropertyId(payload.property.id);
      setPropertyName("");
      setPropertyAddress("");
      setShowPropertyForm(false);
    } catch (error) {
      setPropertyError(
        error instanceof Error
          ? error.message
          : "No se pudo crear la propiedad.",
      );
    } finally {
      setPropertySaving(false);
    }
  };

  const selectProperty = (propertyId: string) => {
    if (propertyId === selectedPropertyId) return;
    const localDrafts = jobsRef.current.filter((job) => !job.serverId);
    if (
      localDrafts.length &&
      !window.confirm(
        "Hay imágenes todavía sin subir. Si cambiás de propiedad se descartarán de esta tanda.",
      )
    ) {
      return;
    }
    localDrafts.forEach((job) => {
      if (job.sourceUrl.startsWith("blob:")) URL.revokeObjectURL(job.sourceUrl);
    });
    setHistoryLoading(true);
    setSelectedPropertyId(propertyId);
  };

  const addFiles = useCallback(
    async (incomingFiles: File[]) => {
      if (!selectedPropertyId) return;
      const imageFiles = incomingFiles.filter((file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type),
      );
      if (!imageFiles.length) return;

      const prepared = await Promise.all(
        imageFiles.map(async (file, index) => {
          const optimized = await optimizeImage(file);
          const name =
            optimized.name ||
            `imagen-${new Date().toISOString().slice(0, 10)}-${index + 1}.jpg`;
          return {
            localId: createId(),
            propertyId: selectedPropertyId,
            batchId,
            filename: name,
            file: optimized,
            sourceUrl: URL.createObjectURL(optimized),
            prompt: basePrompt,
            quality: defaultQuality,
            status: "draft" as const,
          };
        }),
      );
      setJobs((current) => [...prepared, ...current]);
    },
    [
      basePrompt,
      batchId,
      defaultQuality,
      selectedPropertyId,
      setJobs,
    ],
  );

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!selectedPropertyId) return;
      const files = Array.from(event.clipboardData?.files || []).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (files.length) {
        event.preventDefault();
        void addFiles(files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [addFiles, selectedPropertyId]);

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    void addFiles(Array.from(event.target.files || []));
    event.target.value = "";
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void addFiles(Array.from(event.dataTransfer.files));
  };

  const uploadJob = useCallback(
    async (job: StudioJob): Promise<string> => {
      if (job.serverId) {
        const response = await fetch(`/api/jobs/${job.serverId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: job.prompt, quality: job.quality }),
        });
        if (!response.ok) {
          throw new Error(
            await readError(response, "No se pudo guardar el prompt."),
          );
        }
        return job.serverId;
      }
      if (!job.file) throw new Error("La imagen original ya no está disponible.");

      patchJob(job.localId, { status: "uploading", error: undefined });
      const formData = new FormData();
      formData.append("image", job.file);
      formData.append("prompt", job.prompt);
      formData.append("quality", job.quality);
      formData.append("batchId", job.batchId);
      formData.append("propertyId", job.propertyId);

      const response = await fetch("/api/jobs", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await readError(response, "No se pudo subir la imagen."));
      }
      const payload = (await response.json()) as { job: ApiJob };
      patchJob(job.localId, {
        serverId: payload.job.id,
        status: "queued",
        sourceUrl: payload.job.sourceUrl,
      });
      void loadProperties().catch(() => undefined);
      return payload.job.id;
    },
    [loadProperties, patchJob],
  );

  const generateOne = useCallback(
    async (localId: string) => {
      let job = jobsRef.current.find((item) => item.localId === localId);
      if (!job) return;
      if (!job.prompt.trim()) {
        patchJob(localId, {
          status: "failed",
          error: "Escribí un prompt para esta imagen.",
        });
        return;
      }
      if (job.status === "processing" || job.status === "uploading") return;

      try {
        const serverId = await uploadJob(job);
        job = jobsRef.current.find((item) => item.localId === localId) || job;
        patchJob(localId, {
          serverId,
          status: "processing",
          resultUrl: undefined,
          error: undefined,
        });

        const response = await fetch(`/api/jobs/${serverId}/start`, {
          method: "POST",
        });
        if (!response.ok) {
          const message = await readError(
            response,
            "No se pudo iniciar la generación.",
          );
          if (response.status === 503) setReplicateConfigured(false);
          throw new Error(message);
        }
        await pollJob(localId, serverId);
      } catch (error) {
        patchJob(localId, {
          status: "failed",
          error:
            error instanceof Error
              ? error.message
              : "No se pudo procesar la imagen.",
        });
      }
    },
    [patchJob, pollJob, uploadJob],
  );

  const runBatch = async () => {
    const ids = jobsRef.current
      .filter(
        (job) =>
          job.status !== "processing" &&
          job.status !== "uploading" &&
          job.status !== "succeeded",
      )
      .map((job) => job.localId);
    if (!ids.length) return;

    stopQueueRef.current = false;
    setIsBatchRunning(true);
    let cursor = 0;
    const concurrency = mode === "parallel" ? Math.min(8, ids.length) : 1;

    const worker = async () => {
      while (cursor < ids.length && !stopQueueRef.current) {
        const nextId = ids[cursor];
        cursor += 1;
        await generateOne(nextId);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    setIsBatchRunning(false);
  };

  const pauseBatch = () => {
    stopQueueRef.current = true;
    setIsBatchRunning(false);
  };

  const removeJob = async (localId: string) => {
    const job = jobsRef.current.find((item) => item.localId === localId);
    setJobs((current) => current.filter((item) => item.localId !== localId));
    if (job?.sourceUrl.startsWith("blob:")) URL.revokeObjectURL(job.sourceUrl);
    if (job?.serverId) {
      await fetch(`/api/jobs/${job.serverId}`, { method: "DELETE" }).catch(
        () => undefined,
      );
      void loadProperties().catch(() => undefined);
    }
  };

  const applyPromptToAll = () => {
    setJobs((current) =>
      current.map((job) =>
        job.status === "processing" || job.status === "uploading"
          ? job
          : { ...job, prompt: basePrompt },
      ),
    );
  };

  const selectGlobalPreset = (preset: PromptPreset) => {
    setActivePresetKey(preset.key);
    setBasePrompt(preset.prompt);
    setPresetFeedback("");
  };

  const saveActivePreset = async () => {
    if (!activePreset || !basePrompt.trim()) return;
    setPresetSaving(true);
    setPresetFeedback("");
    try {
      const response = await fetch("/api/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activePreset.key,
          prompt: basePrompt,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readError(response, "No se pudo guardar el prompt."),
        );
      }
      setPromptPresets((current) =>
        current.map((preset) =>
          preset.key === activePreset.key
            ? {
                ...preset,
                prompt: basePrompt,
                updatedAt: new Date().toISOString(),
              }
            : preset,
        ),
      );
      setPresetFeedback("Guardado");
    } catch {
      setPresetFeedback("No se pudo guardar");
    } finally {
      setPresetSaving(false);
    }
  };

  const createPromptPreset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newPresetLabel.trim() || !newPresetPrompt.trim()) return;
    setPresetCreating(true);
    setPresetFeedback("");
    try {
      const response = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: newPresetLabel,
          prompt: newPresetPrompt,
        }),
      });
      if (!response.ok) {
        throw new Error(
          await readError(response, "No se pudo crear el preset."),
        );
      }
      const payload = (await response.json()) as { preset: PromptPreset };
      setPromptPresets((current) => [...current, payload.preset]);
      setActivePresetKey(payload.preset.key);
      setBasePrompt(payload.preset.prompt);
      setNewPresetLabel("");
      setNewPresetPrompt("");
      setShowPresetForm(false);
      setPresetFeedback("Preset creado");
    } catch (error) {
      setPresetFeedback(
        error instanceof Error ? error.message : "No se pudo crear el preset.",
      );
    } finally {
      setPresetCreating(false);
    }
  };

  const applyPresetToJob = (localId: string, preset: PromptPreset) => {
    patchJob(localId, { prompt: preset.prompt, error: undefined });
  };

  const downloadAll = async () => {
    const completed = jobsRef.current.filter(
      (job) => job.status === "succeeded" && job.resultUrl,
    );
    if (!completed.length) return;

    setIsPackaging(true);
    try {
      const zip = new JSZip();
      await Promise.all(
        completed.map(async (job, index) => {
          const response = await fetch(job.resultUrl!);
          if (!response.ok) throw new Error("No se pudo preparar el ZIP.");
          const blob = await response.blob();
          zip.file(
            `${String(index + 1).padStart(2, "0")}-${cleanBaseName(job.filename)}-9x16.jpg`,
            blob,
          );
        }),
      );
      const archive = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 5 },
      });
      const url = URL.createObjectURL(archive);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${cleanBaseName(selectedProperty?.name || "propiedad")}-stories-9x16.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsPackaging(false);
    }
  };

  const completedCount = jobs.filter((job) => job.status === "succeeded").length;
  const activeCount = jobs.filter(
    (job) => job.status === "processing" || job.status === "uploading",
  ).length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;
  const progress = jobs.length
    ? Math.round((completedCount / jobs.length) * 100)
    : 0;
  const pendingEstimate = useMemo(
    () =>
      jobs
        .filter((job) => !job.serverId || job.status === "queued")
        .reduce((total, job) => total + QUALITY_PRICES[job.quality], 0),
    [jobs],
  );
  const totalSpent = properties.reduce(
    (total, property) => total + property.spentMicros,
    0,
  );

  return (
    <main className="studio-shell">
      <header className="topbar">
        <Link href="/" className="brand brand-link" title="Volver a aplicaciones">
          <span className="brand-mark">
            <Sparkles size={18} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Estudio de Imágenes</strong>
            <small>Biblioteca de propiedades · Stories 9:16</small>
          </span>
        </Link>
        <div className="connection-area">
          <span
            className={`connection-pill ${
              replicateConfigured === false ? "connection-warning" : ""
            }`}
          >
            <i />
            {replicateConfigured === true
              ? "Replicate conectado"
              : replicateConfigured === false
                ? "Falta conectar Replicate"
                : "Conexión pendiente"}
          </span>
          <span className="model-pill">GPT Image 2 · hasta 8 simultáneas</span>
        </div>
      </header>

      <div className="studio-container library-layout">
        <aside className="property-sidebar">
          <div className="sidebar-heading">
            <div>
              <span>Biblioteca</span>
              <strong>Propiedades</strong>
            </div>
            <button
              type="button"
              className="new-property-button"
              onClick={() => setShowPropertyForm(true)}
              title="Nueva propiedad"
            >
              <Plus size={17} />
            </button>
          </div>

          {showPropertyForm && (
            <form className="property-form" onSubmit={createProperty}>
              <div className="property-form-title">
                <strong>Nueva propiedad</strong>
                <button
                  type="button"
                  onClick={() => {
                    setShowPropertyForm(false);
                    setPropertyError("");
                  }}
                  aria-label="Cerrar formulario"
                >
                  <X size={15} />
                </button>
              </div>
              <label>
                Nombre de carpeta
                <input
                  value={propertyName}
                  onChange={(event) => setPropertyName(event.target.value)}
                  placeholder="Ej. Casa Funes · San Sebastián"
                  autoFocus
                />
              </label>
              <label>
                Dirección o referencia
                <input
                  value={propertyAddress}
                  onChange={(event) => setPropertyAddress(event.target.value)}
                  placeholder="Opcional"
                />
              </label>
              {propertyError && <span className="form-error">{propertyError}</span>}
              <button
                type="submit"
                className="primary-action"
                disabled={!propertyName.trim() || propertySaving}
              >
                {propertySaving ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Folder size={15} />
                )}
                Crear carpeta
              </button>
            </form>
          )}

          <div className="property-list">
            {propertiesLoading ? (
              <div className="sidebar-loading">
                <LoaderCircle className="spin" size={19} />
                Cargando carpetas…
              </div>
            ) : properties.length ? (
              properties.map((property) => (
                <button
                  type="button"
                  key={property.id}
                  className={`property-row ${
                    property.id === selectedPropertyId ? "selected" : ""
                  }`}
                  onClick={() => selectProperty(property.id)}
                >
                  <span className="property-folder">
                    {property.id === selectedPropertyId ? (
                      <FolderOpen size={18} />
                    ) : (
                      <Folder size={18} />
                    )}
                  </span>
                  <span className="property-row-copy">
                    <strong>{property.name}</strong>
                    <small>
                      {property.imageCount} imágenes ·{" "}
                      {formatUsd(property.spentMicros)}
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              ))
            ) : (
              <div className="sidebar-empty">
                <Folder size={24} />
                <strong>Sin propiedades</strong>
                <span>Creá tu primera carpeta para comenzar.</span>
              </div>
            )}
          </div>

          <div className="library-total">
            <span>Gasto total registrado</span>
            <strong>{formatUsd(totalSpent)}</strong>
            <small>
              {properties.reduce(
                (total, property) => total + property.generationCount,
                0,
              )}{" "}
              generaciones terminadas
            </small>
          </div>
        </aside>

        <div className="studio-main">
          {!selectedProperty ? (
            <section className="property-onboarding">
              <span className="onboarding-icon">
                <Building2 size={31} />
              </span>
              <span className="eyebrow">Biblioteca inmobiliaria</span>
              <h1>Una carpeta para cada propiedad.</h1>
              <p>
                Guardá originales y resultados juntos, descargá cada tanda y
                controlá cuánto invertiste en generaciones.
              </p>
              <button
                type="button"
                className="primary-action"
                onClick={() => setShowPropertyForm(true)}
              >
                <Plus size={17} />
                Crear primera propiedad
              </button>
            </section>
          ) : (
            <>
              {replicateConfigured === false && (
                <section className="configuration-alert">
                  <div>
                    <strong>La interfaz está lista.</strong>
                    <span>
                      Falta cargar la clave segura de Replicate para activar las
                      generaciones.
                    </span>
                  </div>
                  <span className="configuration-code">
                    REPLICATE_API_TOKEN
                  </span>
                </section>
              )}

              <section className="property-hero">
                <div>
                  <span className="eyebrow">Carpeta activa</span>
                  <div className="property-title-line">
                    <span className="property-title-icon">
                      <FolderOpen size={24} />
                    </span>
                    <h1>{selectedProperty.name}</h1>
                  </div>
                  {selectedProperty.address && (
                    <p>
                      <MapPin size={14} />
                      {selectedProperty.address}
                    </p>
                  )}
                </div>
                <div className="property-summary">
                  <div>
                    <span>Imágenes</span>
                    <strong>{selectedProperty.imageCount}</strong>
                  </div>
                  <div>
                    <span>Terminadas</span>
                    <strong>{selectedProperty.completedCount}</strong>
                  </div>
                  <div>
                    <span>Generaciones</span>
                    <strong>{selectedProperty.generationCount}</strong>
                  </div>
                  <div>
                    <span>Gasto estimado</span>
                    <strong>{formatUsd(selectedProperty.spentMicros)}</strong>
                  </div>
                </div>
              </section>

              <section className="setup-grid">
                <div
                  className={`dropzone ${isDragging ? "dropzone-active" : ""}`}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      inputRef.current?.click();
                    }
                  }}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={onFileInput}
                    hidden
                  />
                  <span className="drop-icon">
                    <ImagePlus size={25} />
                  </span>
                  <div>
                    <strong>Agregar imágenes a esta propiedad</strong>
                    <span>soltá, pegá o elegí varias fotografías</span>
                  </div>
                  <div className="paste-hint">
                    <ClipboardPaste size={15} />
                    También podés pegar con Ctrl + V
                  </div>
                </div>

                <div className="prompt-setup">
                  <div className="section-label-row">
                    <label htmlFor="base-prompt">
                      Prompt global
                      {activePreset ? ` · ${activePreset.label}` : ""}
                    </label>
                    <div className="prompt-global-actions">
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => void saveActivePreset()}
                        disabled={!activePreset || presetSaving}
                      >
                        {presetSaving ? (
                          <LoaderCircle className="spin" size={12} />
                        ) : (
                          <Save size={12} />
                        )}
                        Guardar preset
                      </button>
                      <button
                        type="button"
                        className="text-button"
                        onClick={applyPromptToAll}
                        disabled={!jobs.length}
                      >
                        Aplicar a todas
                      </button>
                    </div>
                  </div>
                  <div className="preset-tabs" aria-label="Tipos de ambiente">
                    {promptPresets.map((preset) => (
                      <button
                        type="button"
                        key={preset.key}
                        className={
                          preset.key === activePresetKey ? "selected" : ""
                        }
                        onClick={() => selectGlobalPreset(preset)}
                      >
                        {preset.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="add-preset"
                      onClick={() => {
                        setNewPresetPrompt(basePrompt);
                        setShowPresetForm((current) => !current);
                      }}
                    >
                      <Plus size={11} />
                      Nuevo preset
                    </button>
                  </div>
                  {showPresetForm && (
                    <form
                      className="new-preset-form"
                      onSubmit={createPromptPreset}
                    >
                      <input
                        value={newPresetLabel}
                        onChange={(event) =>
                          setNewPresetLabel(event.target.value)
                        }
                        placeholder="Nombre, por ejemplo: Terraza"
                        maxLength={40}
                        autoFocus
                      />
                      <textarea
                        value={newPresetPrompt}
                        onChange={(event) =>
                          setNewPresetPrompt(event.target.value)
                        }
                        placeholder="Prompt para este tipo de ambiente"
                        rows={5}
                      />
                      <div>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setShowPresetForm(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          type="submit"
                          className="text-button"
                          disabled={
                            presetCreating ||
                            !newPresetLabel.trim() ||
                            !newPresetPrompt.trim()
                          }
                        >
                          {presetCreating ? (
                            <LoaderCircle className="spin" size={12} />
                          ) : (
                            <Plus size={12} />
                          )}
                          Crear preset
                        </button>
                      </div>
                    </form>
                  )}
                  <textarea
                    id="base-prompt"
                    value={basePrompt}
                    onChange={(event) => setBasePrompt(event.target.value)}
                    rows={7}
                  />
                  <div className="prompt-meta">
                    <span>
                      {presetFeedback ||
                        "Se copia automáticamente en cada imagen nueva."}
                    </span>
                    <span>{basePrompt.length} caracteres</span>
                  </div>
                </div>
              </section>

              <section className="batch-toolbar">
                <div className="mode-group">
                  <span>Modo de procesamiento</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={mode === "parallel" ? "selected" : ""}
                      onClick={() => setMode("parallel")}
                    >
                      <Zap size={15} />
                      Simultáneo
                      <small>hasta 8</small>
                    </button>
                    <button
                      type="button"
                      className={mode === "loop" ? "selected" : ""}
                      onClick={() => setMode("loop")}
                    >
                      <ListOrdered size={15} />
                      En loop
                      <small>1 por vez</small>
                    </button>
                  </div>
                </div>

                <div className="toolbar-options">
                  {pendingEstimate > 0 && (
                    <span className="pending-estimate">
                      Próxima tanda ≈ US$ {pendingEstimate.toFixed(3)}
                    </span>
                  )}
                  <label>
                    Calidad inicial
                    <select
                      value={defaultQuality}
                      onChange={(event) =>
                        setDefaultQuality(event.target.value as Quality)
                      }
                    >
                      <option value="low">Low · US$ 0,012</option>
                      <option value="medium">Medium · US$ 0,047</option>
                      <option value="high">High · US$ 0,128</option>
                      <option value="auto">Auto · estimado variable</option>
                    </select>
                  </label>
                  {isBatchRunning ? (
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={pauseBatch}
                    >
                      <Pause size={17} />
                      Pausar cola
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-action"
                      onClick={() => void runBatch()}
                      disabled={!jobs.length || activeCount > 0}
                    >
                      <WandSparkles size={18} />
                      Generar tanda
                    </button>
                  )}
                </div>
              </section>

              {jobs.length > 0 && (
                <section className="progress-strip">
                  <div className="progress-copy">
                    <span>
                      {activeCount > 0
                        ? `${activeCount} procesando ahora`
                        : `${completedCount} de ${jobs.length} terminadas`}
                    </span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-track">
                    <i style={{ width: `${progress}%` }} />
                  </div>
                </section>
              )}

              <section className="workspace-section">
                <div className="workspace-heading">
                  <div>
                    <h2>Imágenes guardadas</h2>
                    <span>
                      Originales y resultados permanecen dentro de esta
                      propiedad.
                    </span>
                  </div>
                  <div className="workspace-actions">
                    {failedCount > 0 && (
                      <span className="failed-summary">
                        {failedCount} para revisar
                      </span>
                    )}
                    <button
                      type="button"
                      className="ghost-action"
                      onClick={() => void downloadAll()}
                      disabled={!completedCount || isPackaging}
                    >
                      {isPackaging ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Download size={16} />
                      )}
                      Descargar carpeta
                    </button>
                  </div>
                </div>

                {historyLoading ? (
                  <div className="empty-workspace">
                    <LoaderCircle className="spin" size={28} />
                    <strong>Cargando la propiedad…</strong>
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="empty-workspace">
                    <span className="empty-icon">
                      <FolderOpen size={29} />
                    </span>
                    <strong>Esta carpeta todavía está vacía</strong>
                    <p>
                      Pegá fotografías con Ctrl + V o usá el área de carga
                      superior.
                    </p>
                    <button
                      type="button"
                      className="secondary-action"
                      onClick={() => inputRef.current?.click()}
                    >
                      <Upload size={16} />
                      Elegir imágenes
                    </button>
                  </div>
                ) : (
                  <div className="jobs-grid">
                    {jobs.map((job, index) => {
                      const isBusy =
                        job.status === "processing" ||
                        job.status === "uploading";
                      return (
                        <article className="job-card" key={job.localId}>
                          <div className="job-header">
                            <div className="file-title">
                              <span>{String(index + 1).padStart(2, "0")}</span>
                              <div>
                                <strong title={job.filename}>
                                  {job.filename}
                                </strong>
                                <small>Salida vertical 9:16</small>
                              </div>
                            </div>
                            <span
                              className={`status-chip status-${job.status}`}
                            >
                              {job.status === "processing" ||
                              job.status === "uploading" ? (
                                <LoaderCircle className="spin" size={13} />
                              ) : job.status === "succeeded" ? (
                                <Check size={13} />
                              ) : null}
                              {STATUS_LABELS[job.status]}
                            </span>
                          </div>

                          <div className="visual-comparison">
                            <figure className="source-frame">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={job.sourceUrl}
                                alt={`Original ${job.filename}`}
                              />
                              <figcaption>Original</figcaption>
                            </figure>
                            <figure className="result-frame">
                              {job.resultUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={job.resultUrl}
                                  alt={`Resultado 9:16 de ${job.filename}`}
                                />
                              ) : (
                                <div className="result-placeholder">
                                  {isBusy ? (
                                    <>
                                      <span className="generation-orbit">
                                        <Sparkles size={21} />
                                      </span>
                                      <strong>
                                        {job.status === "uploading"
                                          ? "Preparando"
                                          : "Generando"}
                                      </strong>
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles size={21} />
                                      <span>Resultado</span>
                                    </>
                                  )}
                                </div>
                              )}
                              <figcaption>Story 9:16</figcaption>
                            </figure>
                          </div>

                          <div className="job-prompt">
                            <div className="section-label-row">
                              <label htmlFor={`prompt-${job.localId}`}>
                                Prompt de esta imagen
                              </label>
                              <span>{job.prompt.length}</span>
                            </div>
                            <div
                              className="job-preset-row"
                              aria-label={`Elegir prompt para ${job.filename}`}
                            >
                              {promptPresets.map((preset) => (
                                <button
                                  type="button"
                                  key={preset.key}
                                  className={
                                    job.prompt === preset.prompt
                                      ? "selected"
                                      : ""
                                  }
                                  onClick={() =>
                                    applyPresetToJob(job.localId, preset)
                                  }
                                  disabled={isBusy}
                                >
                                  {preset.label}
                                </button>
                              ))}
                            </div>
                            <textarea
                              id={`prompt-${job.localId}`}
                              value={job.prompt}
                              onChange={(event) =>
                                patchJob(job.localId, {
                                  prompt: event.target.value,
                                })
                              }
                              disabled={isBusy}
                              rows={6}
                            />
                            {job.error && (
                              <div className="job-error">
                                <span>!</span>
                                {job.error}
                              </div>
                            )}
                          </div>

                          <div className="job-footer">
                            <div className="quality-cost">
                              <select
                                aria-label={`Calidad para ${job.filename}`}
                                value={job.quality}
                                onChange={(event) =>
                                  patchJob(job.localId, {
                                    quality: event.target.value as Quality,
                                  })
                                }
                                disabled={isBusy}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="auto">Auto</option>
                              </select>
                              <small>
                                ≈ US$ {QUALITY_PRICES[job.quality].toFixed(3)}
                              </small>
                            </div>

                            <div className="job-buttons">
                              {job.status === "succeeded" && job.serverId && (
                                <a
                                  className="icon-action download-action"
                                  href={`/api/files/${job.serverId}?download=1`}
                                  title="Descargar imagen"
                                >
                                  <Download size={17} />
                                </a>
                              )}
                              <button
                                type="button"
                                className="icon-action"
                                title="Eliminar"
                                onClick={() => void removeJob(job.localId)}
                                disabled={isBusy}
                              >
                                <Trash2 size={17} />
                              </button>
                              <button
                                type="button"
                                className="card-generate"
                                onClick={() => void generateOne(job.localId)}
                                disabled={isBusy}
                              >
                                {isBusy ? (
                                  <LoaderCircle className="spin" size={16} />
                                ) : job.status === "succeeded" ||
                                  job.status === "failed" ? (
                                  <RotateCcw size={16} />
                                ) : (
                                  <Play size={16} fill="currentColor" />
                                )}
                                {isBusy
                                  ? "Procesando"
                                  : job.status === "succeeded" ||
                                      job.status === "failed"
                                    ? "Regenerar"
                                    : "Generar"}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
