/* eslint-disable @next/next/no-img-element */
"use client";

import {
  ArrowLeft,
  Camera,
  Check,
  ClipboardPaste,
  Download,
  Film,
  ImagePlus,
  LoaderCircle,
  Play,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import {
  CSSProperties,
  ChangeEvent,
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import styles from "./camera.module.css";

type MotionValues = {
  horizontal: number;
  vertical: number;
  zoom: number;
  pan: number;
  tilt: number;
  rotate: number;
  durationSeconds: number;
};

type MotionPreset = MotionValues & {
  id: string;
  name: string;
  description: string;
  custom?: boolean;
};

type SavedPreset = MotionValues & {
  id: string;
  name: string;
};

const FACTORY_PRESETS: MotionPreset[] = [
  {
    id: "push-in",
    name: "Push-In",
    description: "Avanza hacia la escena",
    horizontal: 0,
    vertical: 0,
    zoom: 6.5,
    pan: 0,
    tilt: 0,
    rotate: 0,
    durationSeconds: 5,
  },
  {
    id: "pull-out",
    name: "Pull-Out",
    description: "Revela el ambiente completo",
    horizontal: 0,
    vertical: 0,
    zoom: -5.5,
    pan: 0,
    tilt: 0,
    rotate: 0,
    durationSeconds: 5,
  },
  {
    id: "slide-left",
    name: "Slide Left",
    description: "Recorre espacios anchos",
    horizontal: -6.5,
    vertical: 0,
    zoom: 1.2,
    pan: 1.8,
    tilt: 0,
    rotate: 0,
    durationSeconds: 5,
  },
  {
    id: "crane-up",
    name: "Crane Up",
    description: "Descubre altura y fachadas",
    horizontal: 0,
    vertical: -6,
    zoom: 1.6,
    pan: 0,
    tilt: 1.4,
    rotate: 0,
    durationSeconds: 5,
  },
  {
    id: "orbit-right",
    name: "Orbit Right",
    description: "Rodea el punto de interés",
    horizontal: 6.2,
    vertical: 0,
    zoom: 2.2,
    pan: -6.2,
    tilt: 0.5,
    rotate: 0,
    durationSeconds: 5,
  },
];

const CONTROL_FIELDS: Array<{
  key: keyof MotionValues;
  label: string;
  minimum: number;
  maximum: number;
  step: number;
}> = [
  { key: "horizontal", label: "Horizontal", minimum: -10, maximum: 10, step: 0.1 },
  { key: "vertical", label: "Vertical", minimum: -10, maximum: 10, step: 0.1 },
  { key: "zoom", label: "Zoom", minimum: -10, maximum: 10, step: 0.1 },
  { key: "pan", label: "Pan", minimum: -10, maximum: 10, step: 0.1 },
  { key: "tilt", label: "Tilt", minimum: -10, maximum: 10, step: 0.1 },
  { key: "rotate", label: "Rotación", minimum: -10, maximum: 10, step: 0.1 },
];

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothStep(value: number) {
  return value * value * (3 - 2 * value);
}

function transforms(values: MotionValues) {
  const baseScale = 1.16;
  const zoomDelta = Math.abs(values.zoom) * 0.026;
  const startScale = values.zoom < 0 ? baseScale + zoomDelta : baseScale;
  const endScale = values.zoom >= 0 ? baseScale + zoomDelta : baseScale;
  const perspective = "perspective(900px)";
  const start = `${perspective} translate3d(0%, 0%, 0) scale(${startScale}) rotateX(0deg) rotateY(0deg) rotate(0deg)`;
  const end = `${perspective} translate3d(${values.horizontal * 1.5}%, ${values.vertical * 1.5}%, 0) scale(${endScale}) rotateX(${-values.tilt * 0.75}deg) rotateY(${values.pan * 0.75}deg) rotate(${values.rotate * 0.55}deg)`;
  return { start, end };
}

function motionStyle(
  values: MotionValues,
  point: { x: number; y: number },
): CSSProperties {
  const motion = transforms(values);
  return {
    "--motion-start": motion.start,
    "--motion-end": motion.end,
    "--motion-duration": `${values.durationSeconds}s`,
    transformOrigin: `${point.x}% ${point.y}%`,
  } as CSSProperties;
}

function formatValue(value: number) {
  return Number(value).toFixed(1);
}

function dateSafeName(value: string) {
  return (
    value
      .replace(/\.[^.]+$/, "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "movimiento"
  );
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen."));
    image.src = url;
  });
}

function preferredRecordingType() {
  const types = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm",
  ];
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

export function CameraStudio() {
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef("");
  const [imageUrl, setImageUrl] = useState("");
  const [fileName, setFileName] = useState("foto-propiedad.jpg");
  const [selectedId, setSelectedId] = useState(FACTORY_PRESETS[0].id);
  const [values, setValues] = useState<MotionValues>(FACTORY_PRESETS[0]);
  const [advanced, setAdvanced] = useState(false);
  const [point, setPoint] = useState({ x: 50, y: 50 });
  const [customPresets, setCustomPresets] = useState<MotionPreset[]>([]);
  const [presetName, setPresetName] = useState("");
  const [savingPreset, setSavingPreset] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [animationKey, setAnimationKey] = useState(0);

  const allPresets = useMemo(
    () => [...FACTORY_PRESETS, ...customPresets],
    [customPresets],
  );

  const setImageFile = useCallback((file: File) => {
    setError("");
    setMessage("");
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Usá una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("La imagen no puede superar los 20 MB.");
      return;
    }
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    setImageUrl(url);
    setFileName(file.name || "foto-propiedad.jpg");
    setPoint({ x: 50, y: 50 });
    setAnimationKey((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    async function loadPresets() {
      try {
        const response = await fetch("/api/camera-presets", { cache: "no-store" });
        const payload = (await response.json()) as {
          presets?: SavedPreset[];
        };
        if (!active || !response.ok) return;
        setCustomPresets(
          (payload.presets || []).map((preset) => ({
            ...preset,
            description: "Preset propio",
            custom: true,
          })),
        );
      } catch {
        // La herramienta sigue funcionando con los presets de fábrica.
      }
    }
    void loadPresets();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const item = Array.from(event.clipboardData?.items || []).find((entry) =>
        entry.type.startsWith("image/"),
      );
      const file = item?.getAsFile();
      if (file) setImageFile(file);
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [setImageFile]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setImageFile(file);
    event.target.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((entry) =>
      entry.type.startsWith("image/"),
    );
    if (file) setImageFile(file);
  }

  function selectPreset(preset: MotionPreset) {
    setSelectedId(preset.id);
    setValues({
      horizontal: preset.horizontal,
      vertical: preset.vertical,
      zoom: preset.zoom,
      pan: preset.pan,
      tilt: preset.tilt,
      rotate: preset.rotate,
      durationSeconds: preset.durationSeconds,
    });
    setAnimationKey((current) => current + 1);
    setMessage("");
  }

  function updateControl(key: keyof MotionValues, value: number) {
    setValues((current) => ({ ...current, [key]: value }));
    setSelectedId("adjusted");
    setAnimationKey((current) => current + 1);
  }

  async function savePreset() {
    const name = presetName.trim();
    if (!name) {
      setError("Escribí un nombre para guardar el movimiento.");
      return;
    }
    setSavingPreset(true);
    setError("");
    try {
      const response = await fetch("/api/camera-presets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, ...values }),
      });
      const payload = (await response.json()) as {
        preset?: SavedPreset;
        error?: string;
      };
      if (!response.ok || !payload.preset) {
        throw new Error(payload.error || "No se pudo guardar el movimiento.");
      }
      const saved: MotionPreset = {
        ...payload.preset,
        description: "Preset propio",
        custom: true,
      };
      setCustomPresets((current) => [saved, ...current]);
      setPresetName("");
      setSelectedId(saved.id);
      setMessage("Movimiento guardado y listo para reutilizar.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSavingPreset(false);
    }
  }

  async function deletePreset(id: string) {
    try {
      const response = await fetch("/api/camera-presets", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error();
      setCustomPresets((current) => current.filter((preset) => preset.id !== id));
      if (selectedId === id) selectPreset(FACTORY_PRESETS[0]);
    } catch {
      setError("No se pudo eliminar el movimiento guardado.");
    }
  }

  function setPointFromClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!imageUrl) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = clamp(((event.clientX - bounds.left) / bounds.width) * 100, 5, 95);
    const y = clamp(((event.clientY - bounds.top) / bounds.height) * 100, 5, 95);
    setPoint({ x, y });
    setAnimationKey((current) => current + 1);
  }

  async function exportVideo() {
    if (!imageUrl || exporting) return;
    if (typeof MediaRecorder === "undefined") {
      setError("Este navegador no permite exportar video. Usá Chrome actualizado.");
      return;
    }

    setExporting(true);
    setProgress(0);
    setError("");
    setMessage("");

    try {
      const source = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 1920;
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) throw new Error("No se pudo preparar el video.");

      const stream = canvas.captureStream(30);
      const mimeType = preferredRecordingType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : undefined,
      );
      const chunks: BlobPart[] = [];
      recorder.addEventListener("dataavailable", (event) => {
        if (event.data.size) chunks.push(event.data);
      });
      const stopped = new Promise<void>((resolve) => {
        recorder.addEventListener("stop", () => resolve(), { once: true });
      });

      recorder.start(250);
      const durationMs = values.durationSeconds * 1000;
      const startAt = performance.now();

      await new Promise<void>((resolve) => {
        function render(now: number) {
          if (!context) return resolve();
          const rawProgress = clamp((now - startAt) / durationMs, 0, 1);
          const eased = smoothStep(rawProgress);
          const cover = Math.max(
            canvas.width / source.naturalWidth,
            canvas.height / source.naturalHeight,
          );
          const baseScale = 1.16;
          const zoomDelta = Math.abs(values.zoom) * 0.026;
          const startScale = values.zoom < 0 ? baseScale + zoomDelta : baseScale;
          const endScale = values.zoom >= 0 ? baseScale + zoomDelta : baseScale;
          const scale = cover * (startScale + (endScale - startScale) * eased);
          const drawWidth = source.naturalWidth * scale;
          const drawHeight = source.naturalHeight * scale;
          const offsetX =
            (values.horizontal * 0.012 + values.pan * 0.004) *
            canvas.width *
            eased;
          const offsetY =
            (values.vertical * 0.012 - values.tilt * 0.004) *
            canvas.height *
            eased;
          const focusX = drawWidth * (point.x / 100);
          const focusY = drawHeight * (point.y / 100);
          const unclampedX = canvas.width / 2 - focusX + offsetX;
          const unclampedY = canvas.height / 2 - focusY + offsetY;
          const drawX = clamp(unclampedX, canvas.width - drawWidth, 0);
          const drawY = clamp(unclampedY, canvas.height - drawHeight, 0);

          context.save();
          context.fillStyle = "#111318";
          context.fillRect(0, 0, canvas.width, canvas.height);
          const rotation = (values.rotate * 0.45 * eased * Math.PI) / 180;
          context.translate(canvas.width / 2, canvas.height / 2);
          context.rotate(rotation);
          context.translate(-canvas.width / 2, -canvas.height / 2);
          context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
          context.restore();

          setProgress(Math.round(rawProgress * 100));
          if (rawProgress < 1) requestAnimationFrame(render);
          else resolve();
        }
        requestAnimationFrame(render);
      });

      recorder.stop();
      await stopped;
      stream.getTracks().forEach((track) => track.stop());

      const outputType = recorder.mimeType || mimeType || "video/webm";
      const extension = outputType.includes("mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: outputType });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = downloadUrl;
      anchor.download = `${dateSafeName(fileName)}-${selectedId}.${extension}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 10_000);
      setMessage(`Clip 9:16 exportado en ${extension.toUpperCase()}.`);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "No se pudo exportar el movimiento.",
      );
    } finally {
      setExporting(false);
      setProgress(0);
    }
  }

  const frames = [0, 0.25, 0.5, 0.75, 1].map((position) => {
    const zoomEffect = values.zoom * position * 0.55;
    const width = clamp(78 - zoomEffect, 54, 88);
    const height = clamp(78 - zoomEffect, 54, 88);
    return {
      x: clamp(11 + values.horizontal * position * 0.6 + (78 - width) / 2, 2, 98 - width),
      y: clamp(11 + values.vertical * position * 0.6 + (78 - height) / 2, 2, 98 - height),
      width,
      height,
      opacity: position === 0 || position === 1 ? 0.92 : 0.28,
    };
  });

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}><Camera size={19} /></span>
          <span>
            <strong>Cámara inmobiliaria</strong>
            <small>Movimiento 9:16 sin costo por generación</small>
          </span>
        </div>
        <Link href="/" className={styles.backButton}>
          <ArrowLeft size={15} /> Aplicaciones
        </Link>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Aplicación 06</span>
          <h1>Convertí una foto en un plano de cámara.</h1>
          <p>
            Pegá una imagen, mirá los movimientos sobre tu propia propiedad y
            exportá un clip vertical listo para editar o publicar.
          </p>
        </div>
        <div className={styles.costBadge}>
          <Sparkles size={17} />
          <span><strong>US$ 0</strong><small>Motor local 2D</small></span>
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.leftColumn}>
          <div
            className={`${styles.upload} ${imageUrl ? styles.uploadCompact : ""}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onFileChange}
              hidden
            />
            {imageUrl ? (
              <>
                <img src={imageUrl} alt="Foto cargada" />
                <span className={styles.changeImage}><ImagePlus size={14} /> Cambiar foto</span>
              </>
            ) : (
              <>
                <span className={styles.uploadIcon}><Upload size={24} /></span>
                <h2>Subí o pegá una foto</h2>
                <p>Arrastrá un archivo o presioná <kbd>Ctrl</kbd> + <kbd>V</kbd></p>
                <span className={styles.pasteHint}><ClipboardPaste size={14} /> JPG, PNG o WebP</span>
              </>
            )}
          </div>

          <div className={styles.stageCard}>
            <div className={styles.sectionTitle}>
              <div>
                <span>Visor 9:16</span>
                <h2>Encuadre final</h2>
              </div>
              <button
                type="button"
                className={styles.replayButton}
                onClick={() => setAnimationKey((current) => current + 1)}
                disabled={!imageUrl}
              >
                <RotateCcw size={14} /> Repetir
              </button>
            </div>

            <div className={styles.stageWrap}>
              <div
                className={styles.stage}
                onClick={setPointFromClick}
                title={imageUrl ? "Hacé clic para fijar el punto de interés" : undefined}
              >
                {imageUrl ? (
                  <img
                    key={`${animationKey}-${selectedId}`}
                    src={imageUrl}
                    alt="Previsualización animada"
                    className={styles.animatedImage}
                    style={motionStyle(values, point)}
                  />
                ) : (
                  <div className={styles.stageEmpty}>
                    <Film size={30} />
                    <span>La previsualización aparece acá</span>
                  </div>
                )}

                {imageUrl && (
                  <>
                    <svg className={styles.frameOverlay} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      {frames.map((frame, index) => (
                        <rect
                          key={index}
                          x={frame.x}
                          y={frame.y}
                          width={frame.width}
                          height={frame.height}
                          rx="1.2"
                          fill="none"
                          stroke="white"
                          strokeWidth={index === 0 || index === frames.length - 1 ? 0.55 : 0.3}
                          opacity={frame.opacity}
                        />
                      ))}
                    </svg>
                    <span
                      className={styles.focusPoint}
                      style={{ left: `${point.x}%`, top: `${point.y}%` }}
                    >
                      <Target size={15} />
                    </span>
                  </>
                )}
              </div>

              <div className={styles.stageInfo}>
                <span><Target size={14} /> Tocá la foto para elegir el foco</span>
                <strong>{allPresets.find((preset) => preset.id === selectedId)?.name || "Ajuste personalizado"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.controlsColumn}>
          <section className={styles.presetsPanel}>
            <div className={styles.sectionTitle}>
              <div>
                <span>Nivel 1</span>
                <h2>Elegí el movimiento</h2>
              </div>
              <span className={styles.instant}><Play size={12} /> Vista instantánea</span>
            </div>

            <div className={styles.presetGrid}>
              {FACTORY_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={`${styles.presetCard} ${selectedId === preset.id ? styles.presetSelected : ""}`}
                  onClick={() => selectPreset(preset)}
                >
                  <span className={styles.presetPreview}>
                    {imageUrl ? (
                      <img
                        src={imageUrl}
                        alt=""
                        style={motionStyle(preset, point)}
                      />
                    ) : (
                      <span className={styles.previewPlaceholder}><Camera size={20} /></span>
                    )}
                    <span className={styles.playDot}><Play size={10} fill="currentColor" /></span>
                  </span>
                  <span className={styles.presetCopy}>
                    <strong>{preset.name}</strong>
                    <small>{preset.description}</small>
                  </span>
                  {selectedId === preset.id && <Check className={styles.selectedCheck} size={14} />}
                </button>
              ))}
            </div>

            {customPresets.length > 0 && (
              <div className={styles.customBlock}>
                <span className={styles.customLabel}>Mis movimientos</span>
                <div className={styles.customList}>
                  {customPresets.map((preset) => (
                    <div key={preset.id} className={styles.customPreset}>
                      <button type="button" onClick={() => selectPreset(preset)}>
                        <Play size={12} />
                        <span><strong>{preset.name}</strong><small>Preset propio</small></span>
                      </button>
                      <button type="button" onClick={() => void deletePreset(preset.id)} aria-label={`Eliminar ${preset.name}`}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className={styles.advancedPanel}>
            <button
              type="button"
              className={styles.advancedToggle}
              onClick={() => setAdvanced((current) => !current)}
              aria-expanded={advanced}
            >
              <span><SlidersHorizontal size={16} /><span><strong>Avanzado</strong><small>Ajustá el preset seleccionado</small></span></span>
              <span className={`${styles.switch} ${advanced ? styles.switchOn : ""}`}><i /></span>
            </button>

            {advanced && (
              <div className={styles.advancedBody}>
                <div className={styles.sliders}>
                  {CONTROL_FIELDS.map((control) => (
                    <label key={control.key}>
                      <span><strong>{control.label}</strong><output>{formatValue(values[control.key])}</output></span>
                      <input
                        type="range"
                        min={control.minimum}
                        max={control.maximum}
                        step={control.step}
                        value={values[control.key]}
                        onChange={(event) => updateControl(control.key, Number(event.target.value))}
                      />
                    </label>
                  ))}
                </div>

                <label className={styles.durationControl}>
                  <span><strong>Duración</strong><output>{values.durationSeconds.toFixed(1)} s</output></span>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.5"
                    value={values.durationSeconds}
                    onChange={(event) => updateControl("durationSeconds", Number(event.target.value))}
                  />
                </label>

                <div className={styles.savePreset}>
                  <input
                    value={presetName}
                    onChange={(event) => setPresetName(event.target.value)}
                    placeholder="Ej.: Living suave"
                    maxLength={60}
                  />
                  <button type="button" onClick={() => void savePreset()} disabled={savingPreset}>
                    {savingPreset ? <LoaderCircle className="spin" size={14} /> : <Save size={14} />}
                    Guardar preset
                  </button>
                </div>
              </div>
            )}
          </section>

          {error && <div className={styles.error}>{error}</div>}
          {message && <div className={styles.success}><Check size={14} /> {message}</div>}

          <button
            type="button"
            className={styles.exportButton}
            onClick={() => void exportVideo()}
            disabled={!imageUrl || exporting}
          >
            {exporting ? <LoaderCircle className="spin" size={18} /> : <Download size={18} />}
            <span>
              <strong>{exporting ? `Exportando ${progress}%` : "Exportar clip 9:16"}</strong>
              <small>{exporting ? "No cierres esta pestaña" : `${values.durationSeconds.toFixed(1)} s · MP4 o WebM según el navegador`}</small>
            </span>
          </button>

          <p className={styles.engineNote}>
            Orbit se previsualiza hoy con perspectiva 2D. La profundidad real
            2.5D queda preparada como siguiente módulo y requiere conectar un
            modelo de mapa de profundidad.
          </p>
        </div>
      </section>
    </main>
  );
}
