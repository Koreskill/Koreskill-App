"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  ClipboardPaste,
  Download,
  ImagePlus,
  Layers3,
  LoaderCircle,
  Maximize2,
  Megaphone,
  Play,
  RotateCcw,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Quality = "low" | "medium" | "high" | "auto";
type Flow = "direct" | "pipeline";
type StageStatus = "idle" | "running" | "succeeded" | "failed";
type PasteFeedback = {
  kind: "success" | "error";
  message: string;
};

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Stage = {
  id: "product" | "environment" | "advertisement";
  number: string;
  title: string;
  description: string;
  prompt: string;
  status: StageStatus;
  outputUrl?: string;
  error?: string;
};

const QUALITY_PRICES: Record<Quality, number> = {
  low: 0.012,
  medium: 0.047,
  high: 0.128,
  auto: 0.047,
};

const DIRECT_PROMPT = `Utiliza exactamente el producto de la imagen proporcionada como elemento principal.

Crea un anuncio publicitario premium listo para publicar en redes sociales. Conserva completamente la geometría, envase, etiqueta, logotipo, colores, materiales y proporciones reales del producto.

Integra el producto en una composición atractiva, profesional y realista, con iluminación comercial, fondo coherente, profundidad y espacio visual suficiente. Agrega solamente los elementos publicitarios indicados y mantén textos, logotipos y llamados a la acción dentro de la zona segura central.

No deformes el producto, no inventes variantes y no cambies la identidad de marca. El resultado debe parecer una campaña oficial fotografiada profesionalmente, no un render artificial.`;

const INITIAL_STAGES: Stage[] = [
  {
    id: "product",
    number: "01",
    title: "Capturar el producto",
    description:
      "Limpia la toma y fija la identidad visual que debe conservarse.",
    prompt: `Utiliza exactamente el producto de la fotografía como referencia principal.

Aísla y reconstruye una toma comercial limpia del producto, conservando con precisión absoluta su geometría, envase, etiqueta, logotipo, colores, textos visibles, materiales, reflejos y proporciones. Mejora definición, iluminación y lectura de detalles sin rediseñarlo.

Ubícalo sobre un fondo de estudio neutro y simple. No agregues elementos publicitarios, titulares, beneficios, escenarios ni accesorios. Esta etapa debe producir una referencia maestra fiel del producto para alimentar las siguientes etapas.`,
    status: "idle",
  },
  {
    id: "environment",
    number: "02",
    title: "Construir el entorno",
    description:
      "Coloca el producto ya depurado dentro de una escena publicitaria.",
    prompt: `Usa exactamente el producto de la imagen proporcionada y conserva intactos su forma, etiqueta, logotipo, colores, textos, materiales y proporciones.

Integra el producto dentro de un entorno publicitario premium, realista y coherente con su categoría. Construye una escena fotográfica con iluminación comercial, profundidad, sombras de contacto y una composición que dirija la mirada hacia el producto.

No agregues todavía titulares, precios, promociones, botones, textos ni placas gráficas. El resultado debe ser una fotografía de campaña limpia que servirá de base para el anuncio final.`,
    status: "idle",
  },
  {
    id: "advertisement",
    number: "03",
    title: "Componer el anuncio",
    description:
      "Añade jerarquía, oferta, elementos gráficos y terminación final.",
    prompt: `Convierte la imagen proporcionada en un anuncio premium listo para publicar.

Mantén intactos el producto, el entorno, la identidad de marca y la composición principal. Agrega una jerarquía publicitaria clara con espacio para titular, beneficio principal, oferta y llamado a la acción. Usa recursos gráficos mínimos, modernos y coherentes con la marca.

Todo el contenido importante debe permanecer dentro de la zona segura central. Deja aire visual en los bordes superiores e inferiores. Mantén legibilidad, contraste, iluminación realista y acabado profesional. Evita sobrecargar la pieza, deformar el producto o generar apariencia de plantilla genérica.`,
    status: "idle",
  },
];

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function cleanBaseName(filename: string) {
  return (
    filename
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "creativo"
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
    return new File([blob], `${cleanBaseName(file.name)}.jpg`, {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

async function pollPrediction(id: string): Promise<string> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(
      `/api/creative/predictions?id=${encodeURIComponent(id)}`,
      { cache: "no-store" },
    );
    if (!response.ok) {
      throw new Error(
        await readError(response, "No se pudo consultar el resultado."),
      );
    }
    const payload = (await response.json()) as {
      status: string;
      outputUrl?: string | null;
      error?: string | null;
    };
    if (payload.status === "succeeded" && payload.outputUrl) {
      return payload.outputUrl;
    }
    if (payload.status === "failed" || payload.status === "canceled") {
      throw new Error(payload.error || "La generación no pudo completarse.");
    }
    await wait(2500);
  }
  throw new Error("La generación está tardando más de lo esperado.");
}

export function CreativeStudio() {
  const [flow, setFlow] = useState<Flow>("direct");
  const [file, setFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [quality, setQuality] = useState<Quality>("low");
  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [directPrompt, setDirectPrompt] = useState(DIRECT_PROMPT);
  const [directStatus, setDirectStatus] = useState<StageStatus>("idle");
  const [directResult, setDirectResult] = useState("");
  const [directError, setDirectError] = useState("");
  const [stages, setStages] = useState<Stage[]>(INITIAL_STAGES);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const [previewUrl, setPreviewUrl] = useState("");
  const [pasteFeedback, setPasteFeedback] = useState<PasteFeedback | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const completedStages = stages.filter(
    (stage) => stage.status === "succeeded",
  ).length;
  const estimate = useMemo(
    () =>
      QUALITY_PRICES[quality] *
      (flow === "direct" ? 1 : Math.max(1, 3 - completedStages)),
    [completedStages, flow, quality],
  );

  const selectFile = useCallback(async (selected: File) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(selected.type)) {
      setPasteFeedback({
        kind: "error",
        message: "La imagen debe ser JPG, PNG o WEBP.",
      });
      return;
    }
    const optimized = await optimizeImage(selected);
    if (sourceUrl.startsWith("blob:")) URL.revokeObjectURL(sourceUrl);
    setFile(optimized);
    setSourceUrl(URL.createObjectURL(optimized));
    setDirectResult("");
    setDirectStatus("idle");
    setDirectError("");
    setStages(INITIAL_STAGES.map((stage) => ({ ...stage })));
    setPasteFeedback({
      kind: "success",
      message: "✔️",
    });
  }, [sourceUrl]);

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const clipboard = event.clipboardData;
      const pastedFile = Array.from(clipboard?.files || []).find((item) =>
        ACCEPTED_IMAGE_TYPES.includes(item.type),
      );
      const imageItem = Array.from(clipboard?.items || []).find((item) =>
        ACCEPTED_IMAGE_TYPES.includes(item.type),
      );
      const pastedImage = pastedFile || imageItem?.getAsFile();
      if (!pastedImage) return;
      event.preventDefault();
      void selectFile(pastedImage);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [selectFile]);

  useEffect(() => {
    if (!previewUrl) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewUrl("");
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [previewUrl]);

  const pasteImageFromClipboard = async () => {
    setPasteFeedback(null);

    try {
      if (!window.isSecureContext) {
        throw new Error(
          "Chrome necesita que la web tenga HTTPS para usar el botón Pegar.",
        );
      }

      if (!navigator.clipboard?.read) {
        throw new Error(
          "Este navegador no permite leer imágenes con el botón. Copiá la imagen y presioná Ctrl+V.",
        );
      }

      const clipboardItems = await navigator.clipboard.read();

      for (const clipboardItem of clipboardItems) {
        const imageType = clipboardItem.types.find((type) =>
          ACCEPTED_IMAGE_TYPES.includes(type),
        );
        if (!imageType) continue;

        const imageBlob = await clipboardItem.getType(imageType);
        const extension =
          imageType === "image/png"
            ? "png"
            : imageType === "image/webp"
              ? "webp"
              : "jpg";
        const pastedImage = new File(
          [imageBlob],
          `producto-pegado-${Date.now()}.${extension}`,
          { type: imageType },
        );

        await selectFile(pastedImage);
        return;
      }

      throw new Error(
        "No encontramos una imagen copiada. Copiá la imagen y volvé a presionar Pegar imagen.",
      );
    } catch (error) {
      setPasteFeedback({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : "No pudimos pegar la imagen. Probá con Ctrl+V.",
      });
    }
  };

  const onFileInput = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    if (selected) void selectFile(selected);
    event.target.value = "";
  };

  const startPrediction = async ({
    prompt,
    imageUrl,
  }: {
    prompt: string;
    imageUrl?: string;
  }) => {
    let response: Response;
    if (imageUrl) {
      response = await fetch("/api/creative/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          prompt,
          quality,
          aspectRatio,
        }),
      });
    } else {
      if (!file) throw new Error("Seleccioná una imagen.");
      const body = new FormData();
      body.append("image", file);
      body.append("prompt", prompt);
      body.append("quality", quality);
      body.append("aspectRatio", aspectRatio);
      response = await fetch("/api/creative/predictions", {
        method: "POST",
        body,
      });
    }
    if (!response.ok) {
      throw new Error(
        await readError(response, "No se pudo iniciar la generación."),
      );
    }
    const payload = (await response.json()) as { id: string };
    return pollPrediction(payload.id);
  };

  const generateDirect = async () => {
    if (!file || !directPrompt.trim() || directStatus === "running") return;
    setDirectStatus("running");
    setDirectError("");
    setDirectResult("");
    try {
      const result = await startPrediction({ prompt: directPrompt });
      setDirectResult(result);
      setDirectStatus("succeeded");
    } catch (error) {
      setDirectStatus("failed");
      setDirectError(
        error instanceof Error ? error.message : "No se pudo crear el anuncio.",
      );
    }
  };

  const updateStage = (id: Stage["id"], patch: Partial<Stage>) => {
    setStages((current) =>
      current.map((stage) => (stage.id === id ? { ...stage, ...patch } : stage)),
    );
  };

  const runStage = async (index: number, previousOutput?: string) => {
    const stage = stages[index];
    if (!stage) throw new Error("Etapa no encontrada.");
    const inputUrl =
      previousOutput || (index > 0 ? stages[index - 1].outputUrl : undefined);
    if (index > 0 && !inputUrl) {
      throw new Error("Primero completá la etapa anterior.");
    }
    updateStage(stage.id, {
      status: "running",
      error: undefined,
      outputUrl: undefined,
    });
    try {
      const outputUrl = await startPrediction({
        prompt: stage.prompt,
        imageUrl: inputUrl,
      });
      updateStage(stage.id, { status: "succeeded", outputUrl });
      return outputUrl;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo completar la etapa.";
      updateStage(stage.id, { status: "failed", error: message });
      throw error;
    }
  };

  const runFullPipeline = async () => {
    if (!file || pipelineRunning) return;
    setPipelineRunning(true);
    setStages((current) =>
      current.map((stage) => ({
        ...stage,
        status: "idle",
        outputUrl: undefined,
        error: undefined,
      })),
    );
    try {
      let previousOutput: string | undefined;
      for (let index = 0; index < INITIAL_STAGES.length; index += 1) {
        previousOutput = await runStage(index, previousOutput);
      }
    } catch {
      // The failed stage already displays the actionable error.
    } finally {
      setPipelineRunning(false);
    }
  };

  const downloadResult = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = filename;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="creative-shell">
      <header className="topbar">
        <Link href="/" className="brand brand-link">
          <span className="brand-mark creative-brand-mark">
            <Megaphone size={18} />
          </span>
          <span>
            <strong>Creativos para anuncios</strong>
            <small>Kore Creative OS · GPT Image 2</small>
          </span>
        </Link>
        <Link href="/" className="back-apps-link">
          <ArrowLeft size={14} />
          Aplicaciones
        </Link>
      </header>

      <div className="creative-container">
        <section className="creative-intro">
          <div>
            <span className="eyebrow">Aplicación 02</span>
            <h1>De una imagen cruda a un anuncio listo.</h1>
            <p>
              Elegí el camino rápido o controlá cada transformación del
              producto antes de construir la pieza final.
            </p>
          </div>
          <div className="cost-card">
            <span>Próximo proceso</span>
            <strong>≈ US$ {estimate.toFixed(3)}</strong>
            <small>
              Calidad {quality} · {flow === "direct" ? "1 generación" : "hasta 3 etapas"}
            </small>
          </div>
        </section>

        <section className="creative-flow-selector">
          <button
            type="button"
            className={flow === "direct" ? "selected" : ""}
            onClick={() => setFlow("direct")}
          >
            <span>A</span>
            <div>
              <strong>Ruta directa</strong>
              <small>Un prompt → anuncio final</small>
            </div>
            <ArrowRight size={16} />
          </button>
          <button
            type="button"
            className={flow === "pipeline" ? "selected" : ""}
            onClick={() => setFlow("pipeline")}
          >
            <span>B</span>
            <div>
              <strong>Proceso por etapas</strong>
              <small>Producto → entorno → anuncio</small>
            </div>
            <Layers3 size={16} />
          </button>
        </section>

        <section className="creative-setup">
          <div
            className="creative-uploader"
            onClick={() => inputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = event.dataTransfer.files[0];
              if (dropped) void selectFile(dropped);
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileInput}
              hidden
            />
            {sourceUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl} alt="Producto original" />
                <div className="source-image-actions">
                  <button
                    type="button"
                    className="replace-image"
                    onClick={(event) => {
                      event.stopPropagation();
                      inputRef.current?.click();
                    }}
                  >
                    <RotateCcw size={13} />
                    Cambiar imagen
                  </button>
                  <button
                    type="button"
                    className="paste-image-secondary"
                    onClick={(event) => {
                      event.stopPropagation();
                      void pasteImageFromClipboard();
                    }}
                  >
                    <ClipboardPaste size={13} />
                    Pegar otra
                  </button>
                </div>
              </>
            ) : (
              <>
                <span>
                  <ImagePlus size={26} />
                </span>
                <strong>Cargá la imagen principal</strong>
                <small>Arrastrá o hacé clic · JPG, PNG o WEBP</small>
                <button
                  type="button"
                  className="creative-paste-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    void pasteImageFromClipboard();
                  }}
                >
                  <ClipboardPaste size={14} />
                  Pegar imagen
                </button>
                <small className="creative-paste-hint">
                  También funciona copiando la imagen y presionando Ctrl+V
                </small>
              </>
            )}
            {pasteFeedback && (
              <span
                className={`creative-paste-feedback paste-${pasteFeedback.kind}`}
                role="status"
                aria-live="polite"
              >
                {pasteFeedback.message}
              </span>
            )}
          </div>

          <div className="creative-options">
            <label>
              Formato final
              <select
                value={aspectRatio}
                onChange={(event) => setAspectRatio(event.target.value)}
              >
                <option value="9:16">Story 9:16</option>
                <option value="3:4">Feed vertical 3:4</option>
                <option value="1:1">Cuadrado 1:1</option>
                <option value="3:2">Horizontal 3:2</option>
                <option value="16:9">Horizontal 16:9</option>
              </select>
            </label>
            <label>
              Calidad
              <select
                value={quality}
                onChange={(event) => setQuality(event.target.value as Quality)}
              >
                <option value="low">Low · US$ 0.012</option>
                <option value="medium">Medium · US$ 0.047</option>
                <option value="high">High · US$ 0.128</option>
              </select>
            </label>
          </div>
        </section>

        {flow === "direct" ? (
          <section className="direct-workspace">
            <div className="creative-panel prompt-panel">
              <div className="panel-heading">
                <div>
                  <span className="route-badge">RUTA A</span>
                  <h2>Prompt final</h2>
                </div>
                <span>{directPrompt.length} caracteres</span>
              </div>
              <textarea
                value={directPrompt}
                onChange={(event) => setDirectPrompt(event.target.value)}
                rows={16}
              />
              <button
                type="button"
                className="primary-action creative-generate"
                disabled={
                  !file || !directPrompt.trim() || directStatus === "running"
                }
                onClick={() => void generateDirect()}
              >
                {directStatus === "running" ? (
                  <LoaderCircle className="spin" size={16} />
                ) : (
                  <WandSparkles size={16} />
                )}
                {directStatus === "running"
                  ? "Generando anuncio…"
                  : "Generar anuncio final"}
              </button>
              {directError && <p className="creative-error">{directError}</p>}
            </div>

            <div className="creative-panel result-panel">
              <div className="panel-heading">
                <div>
                  <span className="route-badge route-badge-result">SALIDA</span>
                  <h2>Anuncio terminado</h2>
                </div>
                {directStatus === "succeeded" && (
                  <Check size={17} className="result-check" />
                )}
              </div>
              <div className={`creative-result-frame ratio-${aspectRatio.replace(":", "-")}`}>
                {directResult ? (
                  <button
                    type="button"
                    className="result-preview-button"
                    onClick={() => setPreviewUrl(directResult)}
                    aria-label="Ampliar anuncio generado"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={directResult} alt="Anuncio generado" />
                    <span>
                      <Maximize2 size={14} />
                      Ampliar
                    </span>
                  </button>
                ) : (
                  <div>
                    {directStatus === "running" ? (
                      <LoaderCircle className="spin" size={30} />
                    ) : (
                      <Sparkles size={30} />
                    )}
                    <strong>
                      {directStatus === "running"
                        ? "Creando la pieza…"
                        : "El resultado aparecerá acá"}
                    </strong>
                  </div>
                )}
              </div>
              {directResult && (
                <div className="creative-result-actions">
                  <button
                    type="button"
                    className="secondary-action preview-creative"
                    onClick={() => setPreviewUrl(directResult)}
                  >
                    <Maximize2 size={15} />
                    Ver en pantalla completa
                  </button>
                  <button
                    type="button"
                    className="secondary-action download-creative"
                    onClick={() =>
                      void downloadResult(directResult, "anuncio-final.jpg")
                    }
                  >
                    <Download size={15} />
                    Descargar anuncio
                  </button>
                </div>
              )}
            </div>
          </section>
        ) : (
          <section className="pipeline-workspace">
            <div className="pipeline-heading">
              <div>
                <span className="route-badge">RUTA B</span>
                <h2>Cadena de creación</h2>
                <p>Cada resultado se convierte en la entrada de la etapa siguiente.</p>
              </div>
              <button
                type="button"
                className="primary-action"
                disabled={!file || pipelineRunning}
                onClick={() => void runFullPipeline()}
              >
                {pipelineRunning ? (
                  <LoaderCircle className="spin" size={15} />
                ) : (
                  <Play size={15} />
                )}
                {pipelineRunning ? "Procesando cadena…" : "Ejecutar ruta completa"}
              </button>
            </div>

            <div className="pipeline-list">
              {stages.map((stage, index) => (
                <article className="pipeline-stage" key={stage.id}>
                  <div className="stage-number">{stage.number}</div>
                  <div className="stage-content">
                    <div className="stage-heading">
                      <div>
                        <h3>{stage.title}</h3>
                        <p>{stage.description}</p>
                      </div>
                      <span className={`stage-status stage-${stage.status}`}>
                        {stage.status === "running" && (
                          <LoaderCircle className="spin" size={11} />
                        )}
                        {stage.status === "succeeded" && <Check size={11} />}
                        {stage.status === "idle"
                          ? "Pendiente"
                          : stage.status === "running"
                            ? "Procesando"
                            : stage.status === "succeeded"
                              ? "Terminada"
                              : "Revisar"}
                      </span>
                    </div>
                    <textarea
                      value={stage.prompt}
                      disabled={stage.status === "running" || pipelineRunning}
                      onChange={(event) =>
                        updateStage(stage.id, { prompt: event.target.value })
                      }
                      rows={8}
                    />
                    {stage.error && (
                      <p className="creative-error">{stage.error}</p>
                    )}
                    <div className="stage-actions">
                      <button
                        type="button"
                        className="secondary-action"
                        disabled={
                          !file ||
                          stage.status === "running" ||
                          pipelineRunning ||
                          (index > 0 &&
                            stages[index - 1].status !== "succeeded")
                        }
                        onClick={() => void runStage(index).catch(() => undefined)}
                      >
                        {stage.status === "running" ? (
                          <LoaderCircle className="spin" size={14} />
                        ) : (
                          <Play size={14} />
                        )}
                        {stage.status === "succeeded"
                          ? "Repetir etapa"
                          : "Ejecutar etapa"}
                      </button>
                      <span>≈ US$ {QUALITY_PRICES[quality].toFixed(3)}</span>
                    </div>
                  </div>
                  <div className="stage-result">
                    {stage.outputUrl ? (
                      <>
                        <button
                          type="button"
                          className="stage-preview-button"
                          onClick={() => setPreviewUrl(stage.outputUrl!)}
                          aria-label={`Ampliar ${stage.title}`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={stage.outputUrl}
                            alt={`Resultado: ${stage.title}`}
                          />
                          <span>
                            <Maximize2 size={13} />
                            Ampliar
                          </span>
                        </button>
                        <button
                          type="button"
                          className="stage-download-button"
                          onClick={() =>
                            void downloadResult(
                              stage.outputUrl!,
                              `${stage.number}-${stage.id}.jpg`,
                            )
                          }
                          aria-label={`Descargar ${stage.title}`}
                        >
                          <Download size={14} />
                        </button>
                      </>
                    ) : (
                      <div>
                        {stage.status === "running" ? (
                          <LoaderCircle className="spin" size={23} />
                        ) : (
                          <span>{stage.number}</span>
                        )}
                        <small>Resultado intermedio</small>
                      </div>
                    )}
                  </div>
                  {index < stages.length - 1 && (
                    <span className="stage-connector">
                      <ArrowRight size={15} />
                    </span>
                  )}
                </article>
              ))}
            </div>

            {stages[2].outputUrl && (
              <div className="pipeline-final">
                <div>
                  <Check size={18} />
                  <span>
                    <strong>Anuncio final completado</strong>
                    <small>Las tres etapas se procesaron correctamente.</small>
                  </span>
                </div>
                <div className="pipeline-final-actions">
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => setPreviewUrl(stages[2].outputUrl!)}
                  >
                    <Maximize2 size={15} />
                    Ver en pantalla completa
                  </button>
                  <button
                    type="button"
                    className="primary-action"
                    onClick={() =>
                      void downloadResult(
                        stages[2].outputUrl!,
                        "anuncio-final-ruta-b.jpg",
                      )
                    }
                  >
                    <Download size={15} />
                    Descargar anuncio
                  </button>
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {previewUrl && (
        <div
          className="creative-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Vista ampliada del resultado"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewUrl("");
          }}
        >
          <button
            type="button"
            className="creative-lightbox-close"
            onClick={() => setPreviewUrl("")}
            aria-label="Cerrar vista ampliada"
          >
            <X size={20} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Resultado generado ampliado" />
          <small>Presioná Esc o hacé clic afuera para cerrar</small>
        </div>
      )}
    </main>
  );
}