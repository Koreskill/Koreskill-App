"use client";

import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Download,
  ImagePlus,
  Images,
  LoaderCircle,
  Maximize2,
  Plus,
  RefreshCcw,
  Sparkles,
  Trash2,
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
import styles from "./recreator.module.css";

type Quality = "low" | "medium" | "high";
type ItemStatus = "idle" | "running" | "succeeded" | "failed";

type ProductItem = {
  id: string;
  name: string;
  characteristics: string;
  file: File | null;
  previewUrl: string;
  selected: boolean;
  status: ItemStatus;
  resultUrl: string;
  error: string;
};

const MAX_PRODUCTS = 8;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const QUALITY_PRICES: Record<Quality, number> = {
  low: 0.012,
  medium: 0.047,
  high: 0.128,
};

const PROMPT_PRESETS = [
  {
    label: "Editorial premium",
    value: `Crea una fotografía publicitaria editorial premium lista para redes sociales. Construye una escena realista, sofisticada y limpia, con iluminación comercial suave, materiales creíbles, sombras de contacto y profundidad fotográfica. El producto debe ser el protagonista absoluto. Mantén una composición equilibrada, aire visual y acabado de campaña oficial.`,
  },
  {
    label: "Minimalista",
    value: `Crea un anuncio minimalista de alta gama. Usa un fondo limpio, pocos elementos, paleta controlada, iluminación de estudio y una composición precisa. El producto debe conservar toda su identidad y ocupar el punto principal de atención. Evita decoración innecesaria y apariencia de plantilla.`,
  },
  {
    label: "Lifestyle",
    value: `Integra el producto en una escena lifestyle realista relacionada con su uso. La situación debe sentirse natural pero producida profesionalmente, con iluminación atractiva, profundidad, contexto de uso y una composición apta para una campaña de redes sociales.`,
  },
  {
    label: "Impacto comercial",
    value: `Crea una pieza publicitaria de alto impacto visual, moderna y comercial. Usa contraste controlado, iluminación dramática y recursos gráficos sutiles que dirijan la mirada al producto. Conserva espacio limpio para agregar textos posteriormente y evita saturar la composición.`,
  },
];

const INITIAL_PROMPT = PROMPT_PRESETS[0].value;

function createProduct(
  position: number,
  id = `product-${position}`,
): ProductItem {
  return {
    id,
    name: `Producto ${position}`,
    characteristics: "",
    file: null,
    previewUrl: "",
    selected: true,
    status: "idle",
    resultUrl: "",
    error: "",
  };
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

const CREATE_REQUEST_INTERVAL_MS = 11_000;
const MAX_RATE_LIMIT_RETRIES = 5;

let predictionCreateQueue: Promise<void> = Promise.resolve();
let nextPredictionRequestAt = 0;

type ReplicateResponse = {
  id?: string;
  error?: string;
  detail?: string;
  retry_after?: number;
  [key: string]: unknown;
};

async function readResponse(response: Response): Promise<ReplicateResponse> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ReplicateResponse;
  } catch {
    return {
      error: text,
    };
  }
}

function getRetryDelay(
  response: Response,
  payload: ReplicateResponse,
): number {
  const retryHeader = Number(response.headers.get("retry-after"));

  if (Number.isFinite(retryHeader) && retryHeader > 0) {
    return retryHeader * 1000 + 1_500;
  }

  if (
    typeof payload.retry_after === "number" &&
    payload.retry_after > 0
  ) {
    return payload.retry_after * 1000 + 1_500;
  }

  const errorText = JSON.stringify(payload);

  const retryAfterMatch = errorText.match(
    /["']?retry_after["']?\s*[:=]\s*(\d+(?:\.\d+)?)/i,
  );

  if (retryAfterMatch) {
    return Number(retryAfterMatch[1]) * 1000 + 1_500;
  }

  const resetMatch = errorText.match(
    /resets?\s+in\s+~?(\d+(?:\.\d+)?)s/i,
  );

  if (resetMatch) {
    return Number(resetMatch[1]) * 1000 + 1_500;
  }

  return CREATE_REQUEST_INTERVAL_MS;
}

async function createPredictionWithRetry(
  formData: FormData,
): Promise<ReplicateResponse> {
  for (
    let attempt = 0;
    attempt <= MAX_RATE_LIMIT_RETRIES;
    attempt += 1
  ) {
    const remainingDelay = Math.max(
      0,
      nextPredictionRequestAt - Date.now(),
    );

    if (remainingDelay > 0) {
      await wait(remainingDelay);
    }

    // Replicate permite aproximadamente una creación cada 10 segundos.
    // Dejamos 11 segundos para evitar alcanzar el límite.
    nextPredictionRequestAt =
      Date.now() + CREATE_REQUEST_INTERVAL_MS;

    const response = await fetch(
      "/api/creative/predictions",
      {
        method: "POST",
        body: formData,
      },
    );

    const payload = await readResponse(response);

    // La solicitud fue aceptada correctamente.
    if (response.ok) {
      return payload;
    }

    const errorMessage = [payload.error, payload.detail]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const isRateLimited =
      response.status === 429 ||
      errorMessage.includes("429") ||
      errorMessage.includes("too many requests") ||
      errorMessage.includes("throttled") ||
      errorMessage.includes("rate limit");

    // Si Replicate limita la solicitud, espera y vuelve a intentar.
    if (
      isRateLimited &&
      attempt < MAX_RATE_LIMIT_RETRIES
    ) {
      const retryDelay = Math.max(
        CREATE_REQUEST_INTERVAL_MS,
        getRetryDelay(response, payload),
      );

      nextPredictionRequestAt =
        Date.now() + retryDelay;

      await wait(retryDelay);
      continue;
    }

    throw new Error(
      payload.error ||
        payload.detail ||
        `La solicitud falló con estado ${response.status}.`,
    );
  }

  throw new Error(
    "Replicate continúa limitando las solicitudes. Intentá nuevamente en un minuto.",
  );
}

function enqueuePredictionCreation(
  formData: FormData,
): Promise<ReplicateResponse> {
  const queuedRequest = predictionCreateQueue.then(() =>
    createPredictionWithRetry(formData),
  );

  // Permite que la cola continúe aunque una generación falle.
  predictionCreateQueue = queuedRequest.then(
    () => undefined,
    () => undefined,
  );

  return queuedRequest;
}

function cleanName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-|-$/g, "") || "producto"
  );
}

async function readError(response: Response, fallback: string) {
  try {
    const data = (await response.json()) as { error?: string };
    return data.error || fallback;
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

    if (!context) {
      throw new Error("No se pudo preparar la imagen.");
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    let blob: Blob | null = null;

    for (const quality of [0.88, 0.78, 0.68, 0.58]) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", quality),
      );

      if (blob && blob.size <= 900 * 1024) {
        break;
      }
    }

    if (!blob) {
      return file;
    }

    return new File(
      [blob],
      `${cleanName(file.name.replace(/\.[^.]+$/, ""))}.jpg`,
      {
        type: "image/jpeg",
      },
    );
  } catch {
    return file;
  }
}

async function pollPrediction(id: string): Promise<string> {
  for (let attempt = 0; attempt < 180; attempt += 1) {
    const response = await fetch(
      `/api/creative/predictions?id=${encodeURIComponent(id)}`,
      {
        cache: "no-store",
      },
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
      throw new Error(
        payload.error || "La generación no pudo completarse.",
      );
    }

    await wait(2500);
  }

  throw new Error("La generación está tardando más de lo esperado.");
}

async function waitForResultImage(url: string) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const loaded = await new Promise<boolean>((resolve) => {
      const image = new Image();

      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);

      image.src = url;
    });

    if (loaded) {
      return;
    }

    await wait(900);
  }
}

function composePrompt(
  generalPrompt: string,
  item: ProductItem,
  hasReference: boolean,
) {
  return `IMAGEN 1 — PRODUCTO PRINCIPAL

Usa exactamente el producto de la primera imagen.

Conserva con precisión:

- Geometría.
- Envase.
- Tapa.
- Etiqueta.
- Logotipo.
- Textos visibles.
- Colores.
- Materiales.
- Proporciones.

No lo rediseñes, no inventes variantes y no cambies la identidad de marca.

${
  hasReference
    ? `IMAGEN 2 — REFERENCIA DEL ANUNCIO

Usa la segunda imagen solamente como referencia de dirección artística:

- Composición.
- Encuadre.
- Iluminación.
- Fondo.
- Paleta.
- Profundidad.
- Distribución visual.

Reemplaza el producto de la referencia por el producto de la primera imagen.

No copies marcas, logotipos ni textos pertenecientes a la referencia.`
    : `No se proporcionó una referencia visual adicional.

Construye la pieza siguiendo el brief general.`
}

BRIEF GENERAL

${generalPrompt.trim()}

PRODUCTO

${item.name.trim() || "Producto sin nombre"}

CARACTERÍSTICAS A REPRESENTAR

${item.characteristics.trim() || "No se indicaron características adicionales."}

REGLAS FINALES

Genera una sola imagen terminada.

Mantén realismo fotográfico, jerarquía clara y calidad publicitaria profesional.

No agregues afirmaciones, beneficios, sellos, precios ni textos que no hayan sido solicitados.

En formato Story 1080 × 1920, mantén titulares, textos, logos, badges, llamados a la acción y elementos críticos dentro de la zona central segura.

Deja aproximadamente 430 px libres arriba y 430 px libres abajo.`;
}

export function RecreatorStudio() {
  const [generalPrompt, setGeneralPrompt] = useState(INITIAL_PROMPT);
  const [activePreset, setActivePreset] = useState(
    PROMPT_PRESETS[0].label,
  );

  const [products, setProducts] = useState<ProductItem[]>(() => [
    createProduct(1),
    createProduct(2),
  ]);

  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState("");
  const [referenceError, setReferenceError] = useState("");

  const [aspectRatio, setAspectRatio] = useState("9:16");
  const [quality, setQuality] = useState<Quality>("low");

  const [activePasteTarget, setActivePasteTarget] =
    useState<string>("product-1");

  const [batchRunning, setBatchRunning] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState("");

  const referenceInputRef = useRef<HTMLInputElement>(null);
  const nextProductId = useRef(3);

  const selectedReady = useMemo(
    () => products.filter((item) => item.selected && item.file),
    [products],
  );

  const estimatedCost =
    selectedReady.length * QUALITY_PRICES[quality];

  const updateProduct = useCallback(
    (id: string, patch: Partial<ProductItem>) => {
      setProducts((current) =>
        current.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      );
    },
    [],
  );

  const setProductFile = useCallback(
    async (id: string, selected: File) => {
      if (!ACCEPTED_TYPES.includes(selected.type)) {
        updateProduct(id, {
          error: "La imagen debe ser JPG, PNG o WEBP.",
        });
        return;
      }

      const optimized = await optimizeImage(selected);

      setProducts((current) =>
        current.map((item) => {
          if (item.id !== id) {
            return item;
          }

          if (item.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(item.previewUrl);
          }

          return {
            ...item,
            file: optimized,
            previewUrl: URL.createObjectURL(optimized),
            selected: true,
            status: "idle",
            resultUrl: "",
            error: "",
          };
        }),
      );

      setActivePasteTarget(id);
    },
    [updateProduct],
  );

  const setReference = useCallback(async (selected: File) => {
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setReferenceError(
        "La referencia debe ser JPG, PNG o WEBP.",
      );
      return;
    }

    const optimized = await optimizeImage(selected);

    setReferenceUrl((current) => {
      if (current.startsWith("blob:")) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(optimized);
    });

    setReferenceFile(optimized);
    setReferenceError("");
    setActivePasteTarget("reference");
  }, []);

  const imageFromClipboard = useCallback(async () => {
    if (!window.isSecureContext) {
      throw new Error(
        "El botón Pegar necesita HTTPS. También podés usar Ctrl+V.",
      );
    }

    if (!navigator.clipboard?.read) {
      throw new Error(
        "Usá Ctrl+V para pegar la imagen en este navegador.",
      );
    }

    const clipboardItems = await navigator.clipboard.read();

    for (const clipboardItem of clipboardItems) {
      const type = clipboardItem.types.find((value) =>
        ACCEPTED_TYPES.includes(value),
      );

      if (!type) {
        continue;
      }

      const blob = await clipboardItem.getType(type);

      return new File(
        [blob],
        `imagen-pegada-${Date.now()}`,
        {
          type,
        },
      );
    }

    throw new Error("No encontramos una imagen copiada.");
  }, []);

  const pasteInto = useCallback(
    async (target: string) => {
      try {
        setActivePasteTarget(target);

        const pasted = await imageFromClipboard();

        if (target === "reference") {
          await setReference(pasted);
        } else {
          await setProductFile(target, pasted);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "No se pudo pegar la imagen.";

        if (target === "reference") {
          setReferenceError(message);
        } else {
          updateProduct(target, {
            error: message,
          });
        }
      }
    },
    [
      imageFromClipboard,
      setProductFile,
      setReference,
      updateProduct,
    ],
  );

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      const image = Array.from(
        event.clipboardData?.items || [],
      )
        .find((item) => ACCEPTED_TYPES.includes(item.type))
        ?.getAsFile();

      if (!image) {
        return;
      }

      event.preventDefault();

      if (activePasteTarget === "reference") {
        void setReference(image);
      } else {
        void setProductFile(activePasteTarget, image);
      }
    };

    window.addEventListener("paste", handlePaste);

    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [
    activePasteTarget,
    setProductFile,
    setReference,
  ]);

  useEffect(() => {
    if (!lightboxUrl) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightboxUrl("");
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener("keydown", close);
    };
  }, [lightboxUrl]);

  const generateProduct = async (
    item: ProductItem,
  ) => {
    if (!item.file) {
      return;
    }

    updateProduct(item.id, {
      status: "running",
      error: "",
      resultUrl: "",
    });

    try {
      const body = new FormData();

      body.append("image", item.file);

      if (referenceFile) {
        body.append(
          "referenceImage",
          referenceFile,
        );
      }

      body.append(
        "prompt",
        composePrompt(
          generalPrompt,
          item,
          Boolean(referenceFile),
        ),
      );

      body.append("quality", quality);
      body.append("aspectRatio", aspectRatio);

      const payload =
        await enqueuePredictionCreation(body);

      if (!payload.id) {
        throw new Error(
          payload.error ||
            payload.detail ||
            "Replicate no devolvió el identificador de la generación.",
        );
      }

      const resultUrl = await pollPrediction(payload.id);

      /*
       * Replicate puede devolver la URL antes de que el archivo
       * esté completamente disponible en su CDN.
       */
      await waitForResultImage(resultUrl);

      updateProduct(item.id, {
        status: "succeeded",
        resultUrl,
      });
    } catch (error) {
      updateProduct(item.id, {
        status: "failed",
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar la imagen.",
      });
    }
  };

  const generateSelected = async () => {
    if (
      !selectedReady.length ||
      batchRunning ||
      !generalPrompt.trim()
    ) {
      return;
    }

    setBatchRunning(true);

    try {
      const queue = [...selectedReady];

      const worker = async () => {
        while (queue.length) {
          const item = queue.shift();

          if (item) {
            await generateProduct(item);
          }
        }
      };

      await Promise.all(
        Array.from(
          {
            length: Math.min(
              3,
              queue.length,
            ),
          },
          () => worker(),
        ),
      );
    } finally {
      setBatchRunning(false);
    }
  };

  const download = async (
    url: string,
    name: string,
  ) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();

      const blobUrl =
        URL.createObjectURL(blob);

      const anchor =
        document.createElement("a");

      anchor.href = blobUrl;
      anchor.download = `${cleanName(name)}-anuncio.jpg`;
      anchor.click();

      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(
        url,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  const removeProduct = (id: string) => {
    setProducts((current) => {
      const item = current.find(
        (product) => product.id === id,
      );

      if (
        item?.previewUrl.startsWith("blob:")
      ) {
        URL.revokeObjectURL(
          item.previewUrl,
        );
      }

      return current.filter(
        (product) => product.id !== id,
      );
    });
  };

  return (
    <main className={styles.shell}>
      <header className="topbar">
        <Link
          href="/"
          className="brand brand-link"
        >
          <span
            className={`brand-mark ${styles.brandMark}`}
          >
            <RefreshCcw size={18} />
          </span>

          <span>
            <strong>
              Recreador de imágenes
            </strong>

            <small>
              Kore Creative OS · GPT Image 2
            </small>
          </span>
        </Link>

        <Link
          href="/"
          className="back-apps-link"
        >
          <ArrowLeft size={14} />
          Aplicaciones
        </Link>
      </header>

      <div className={styles.container}>
        <section className={styles.hero}>
          <div>
            <span className="eyebrow">
              Aplicación 03
            </span>

            <h1>
              Un estilo. Varios productos. Una
              tanda completa.
            </h1>

            <p>
              Definí el concepto general, sumá una
              referencia visual si la tenés y
              aplicalo a todos los productos
              seleccionados.
            </p>
          </div>

          <div className={styles.costCard}>
            <span>
              Costo estimado de la selección
            </span>

            <strong>
              ≈ US$ {estimatedCost.toFixed(3)}
            </strong>

            <small>
              {selectedReady.length} productos listos
              {" · "}
              calidad {quality}
            </small>
          </div>
        </section>

        <section className={styles.briefGrid}>
          <article className={styles.promptPanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.step}>
                  01 · Dirección general
                </span>

                <h2>Prompt general</h2>
              </div>

              <span>
                {generalPrompt.length} caracteres
              </span>
            </div>

            <div className={styles.presets}>
              {PROMPT_PRESETS.map((preset) => (
                <button
                  type="button"
                  className={
                    activePreset === preset.label
                      ? styles.presetActive
                      : ""
                  }
                  onClick={() => {
                    setGeneralPrompt(preset.value);
                    setActivePreset(preset.label);
                  }}
                  key={preset.label}
                >
                  {activePreset ===
                    preset.label && (
                    <Check size={12} />
                  )}

                  {preset.label}
                </button>
              ))}
            </div>

            <textarea
              value={generalPrompt}
              onChange={(event) => {
                setGeneralPrompt(
                  event.target.value,
                );

                setActivePreset("");
              }}
              rows={8}
              placeholder="Describí el estilo que debe compartir toda la tanda…"
            />
          </article>

          <article className={styles.referencePanel}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.step}>
                  02 · Opcional
                </span>

                <h2>
                  Referencia del anuncio
                </h2>
              </div>

              {referenceFile && (
                <CheckCircle2 size={17} />
              )}
            </div>

            <p>
              El modelo tomará la composición y el
              estilo, pero conservará el producto
              real de cada ficha.
            </p>

            <div
              className={`${styles.referenceDrop} ${
                activePasteTarget === "reference"
                  ? styles.pasteActive
                  : ""
              }`}
              onClick={() => {
                setActivePasteTarget("reference");
                referenceInputRef.current?.click();
              }}
              onDragOver={(event) =>
                event.preventDefault()
              }
              onDrop={(event) => {
                event.preventDefault();

                const file =
                  event.dataTransfer.files[0];

                if (file) {
                  void setReference(file);
                }
              }}
            >
              <input
                ref={referenceInputRef}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
                hidden
                onChange={(event) => {
                  const file =
                    event.target.files?.[0];

                  if (file) {
                    void setReference(file);
                  }

                  event.target.value = "";
                }}
              />

              {referenceUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={referenceUrl}
                    alt="Referencia del anuncio"
                  />

                  <button
                    type="button"
                    className={
                      styles.removeReference
                    }
                    onClick={(event) => {
                      event.stopPropagation();

                      if (
                        referenceUrl.startsWith(
                          "blob:",
                        )
                      ) {
                        URL.revokeObjectURL(
                          referenceUrl,
                        );
                      }

                      setReferenceFile(null);
                      setReferenceUrl("");
                    }}
                    aria-label="Quitar referencia"
                  >
                    <X size={14} />
                  </button>
                </>
              ) : (
                <>
                  <Images size={25} />

                  <strong>
                    Arrastrá o elegí una referencia
                  </strong>

                  <small>
                    Puede ser un anuncio o una imagen
                    a recrear
                  </small>
                </>
              )}
            </div>

            <button
              type="button"
              className={styles.pasteButton}
              onClick={() =>
                void pasteInto("reference")
              }
            >
              <ClipboardPaste size={14} />
              Pegar referencia
            </button>

            {referenceError && (
              <p className={styles.error}>
                {referenceError}
              </p>
            )}
          </article>
        </section>

        <section className={styles.productsSection}>
          <div className={styles.productsHeading}>
            <div>
              <span className={styles.step}>
                03 · Productos
              </span>

              <h2>
                Productos de la tanda
              </h2>

              <p>
                Seleccioná una ficha para pegarle una
                imagen con Ctrl+V.
              </p>
            </div>

            <button
              type="button"
              className={styles.addButton}
              disabled={
                products.length >= MAX_PRODUCTS
              }
              onClick={() =>
                setProducts((current) => {
                  const id = `product-${nextProductId.current}`;

                  nextProductId.current += 1;

                  return [
                    ...current,
                    createProduct(
                      current.length + 1,
                      id,
                    ),
                  ];
                })
              }
            >
              <Plus size={15} />
              Agregar producto

              <span>
                {products.length}/{MAX_PRODUCTS}
              </span>
            </button>
          </div>

          <div className={styles.productGrid}>
            {products.map((item, index) => (
              <article
                className={`${styles.productCard} ${
                  activePasteTarget === item.id
                    ? styles.cardActive
                    : ""
                }`}
                key={item.id}
                onClick={() =>
                  setActivePasteTarget(item.id)
                }
              >
                <div className={styles.cardTopbar}>
                  <button
                    type="button"
                    className={`${styles.selector} ${
                      item.selected
                        ? styles.selected
                        : ""
                    }`}
                    onClick={(event) => {
                      event.stopPropagation();

                      updateProduct(item.id, {
                        selected: !item.selected,
                      });
                    }}
                    aria-label={
                      item.selected
                        ? "Quitar de la tanda"
                        : "Sumar a la tanda"
                    }
                  >
                    {item.selected && (
                      <Check size={12} />
                    )}
                  </button>

                  <span>
                    Producto{" "}
                    {String(index + 1).padStart(
                      2,
                      "0",
                    )}
                  </span>

                  {products.length > 1 && (
                    <button
                      type="button"
                      className={
                        styles.deleteButton
                      }
                      onClick={(event) => {
                        event.stopPropagation();

                        removeProduct(item.id);
                      }}
                      aria-label="Eliminar producto"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <ProductUploader
                  item={item}
                  active={
                    activePasteTarget === item.id
                  }
                  onActivate={() =>
                    setActivePasteTarget(item.id)
                  }
                  onFile={(file) =>
                    void setProductFile(
                      item.id,
                      file,
                    )
                  }
                  onPaste={() =>
                    void pasteInto(item.id)
                  }
                />

                <label className={styles.field}>
                  Nombre del producto

                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateProduct(item.id, {
                        name: event.target.value,
                      })
                    }
                    placeholder="Ej. Magnesio"
                  />
                </label>

                <label className={styles.field}>
                  Características del producto

                    <textarea
                    className={styles.characteristicsTextarea}
                    value={item.characteristics}
                    placeholder="Características, beneficios, materiales, colores, textos que deben conservarse..."
                    title="Hacé clic para expandir"
                    onFocus={(event) => {
                        const textarea = event.currentTarget;

                        textarea.style.height = "auto";
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    onClick={(event) => {
                        const textarea = event.currentTarget;

                        textarea.style.height = "auto";
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    onBlur={(event) => {
                        event.currentTarget.style.height = "";
                    }}
                    onChange={(event) => {
                        updateProduct(item.id, {
                        characteristics: event.target.value,
                        });

                        const textarea = event.currentTarget;

                        textarea.style.height = "auto";
                        textarea.style.height = `${textarea.scrollHeight}px`;
                    }}
                    />
                </label>

                {item.error && (
                  <p className={styles.error}>
                    {item.error}
                  </p>
                )}

                <div
                  className={styles.resultFrame}
                >
                    {item.resultUrl ? (
                    <div
                        className={styles.resultPreview}
                        role="button"
                        tabIndex={0}
                        onClick={() => setLightboxUrl(item.resultUrl)}
                        onKeyDown={(event) => {
                        if (
                            event.key === "Enter" ||
                            event.key === " "
                        ) {
                            event.preventDefault();
                            setLightboxUrl(item.resultUrl);
                        }
                        }}
                        aria-label={`Ampliar resultado de ${item.name}`}
                    >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                        key={item.resultUrl}
                        src={item.resultUrl}
                        alt={`Resultado de ${item.name}`}
                        loading="eager"
                        decoding="async"
                        />

                        <span>
                        <Maximize2 size={13} />
                        Ampliar
                        </span>
                    </div>
                    ) : (
                    <div>
                      {item.status ===
                      "running" ? (
                        <LoaderCircle
                          className="spin"
                          size={25}
                        />
                      ) : (
                        <Sparkles size={25} />
                      )}

                      <strong>
                        {item.status === "running"
                          ? "Generando…"
                          : "Resultado"}
                      </strong>
                    </div>
                  )}
                </div>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    disabled={
                      !item.file ||
                      item.status === "running" ||
                      !generalPrompt.trim()
                    }
                    onClick={() =>
                      void generateProduct(item)
                    }
                  >
                    {item.status === "running" ? (
                      <LoaderCircle
                        className="spin"
                        size={14}
                      />
                    ) : (
                      <WandSparkles size={14} />
                    )}

                    {item.status === "succeeded"
                      ? "Regenerar"
                      : "Generar"}
                  </button>

                  {item.resultUrl && (
                    <button
                      type="button"
                      className={
                        styles.iconAction
                      }
                      onClick={() =>
                        void download(
                          item.resultUrl,
                          item.name,
                        )
                      }
                      aria-label={`Descargar ${item.name}`}
                    >
                      <Download size={14} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.batchBar}>
          <div>
            <label>
              Formato

              <select
                value={aspectRatio}
                onChange={(event) =>
                  setAspectRatio(
                    event.target.value,
                  )
                }
              >
                <option value="9:16">
                  Story 9:16
                </option>

                <option value="3:4">
                  Feed vertical 3:4
                </option>

                <option value="1:1">
                  Cuadrado 1:1
                </option>

                <option value="3:2">
                  Horizontal 3:2
                </option>

                <option value="16:9">
                  Horizontal 16:9
                </option>
              </select>
            </label>

            <label>
              Calidad

              <select
                value={quality}
                onChange={(event) =>
                  setQuality(
                    event.target.value as Quality,
                  )
                }
              >
                <option value="low">
                  Low · US$ 0.012
                </option>

                <option value="medium">
                  Medium · US$ 0.047
                </option>

                <option value="high">
                  High · US$ 0.128
                </option>
              </select>
            </label>
          </div>

          <button
            type="button"
            disabled={
              !selectedReady.length ||
              batchRunning ||
              !generalPrompt.trim()
            }
            onClick={() =>
              void generateSelected()
            }
          >
            {batchRunning ? (
              <LoaderCircle
                className="spin"
                size={16}
              />
            ) : (
              <WandSparkles size={16} />
            )}

            {batchRunning
              ? "Procesando tanda…"
              : `Generar seleccionados (${selectedReady.length})`}
          </button>
        </section>
      </div>

      {lightboxUrl && (
        <div
          className="creative-lightbox"
          role="dialog"
          aria-modal="true"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget
            ) {
              setLightboxUrl("");
            }
          }}
        >
          <button
            type="button"
            className="creative-lightbox-close"
            onClick={() =>
              setLightboxUrl("")
            }
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Resultado ampliado"
          />

          <small>
            Presioná Esc o hacé clic afuera para
            cerrar
          </small>
        </div>
      )}
    </main>
  );
}

function ProductUploader({
  item,
  active,
  onActivate,
  onFile,
  onPaste,
}: {
  item: ProductItem;
  active: boolean;
  onActivate: () => void;
  onFile: (file: File) => void;
  onPaste: () => void;
}) {
  const inputRef =
    useRef<HTMLInputElement>(null);

  const onInput = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (file) {
      onFile(file);
    }

    event.target.value = "";
  };

  return (
    <div
      className={`${styles.productDrop} ${
        active ? styles.pasteActive : ""
      }`}
      onClick={(event) => {
        event.stopPropagation();
        onActivate();
        inputRef.current?.click();
      }}
      onDragOver={(event) =>
        event.preventDefault()
      }
      onDrop={(event) => {
        event.preventDefault();
        event.stopPropagation();

        const file =
          event.dataTransfer.files[0];

        if (file) {
          onFile(file);
        }
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        onChange={onInput}
        hidden
      />

      {item.previewUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.previewUrl}
            alt={item.name}
          />

          <span className={styles.replaceHint}>
            Cambiar imagen
          </span>
        </>
      ) : (
        <>
          <ImagePlus size={23} />

          <strong>
            Pegá o cargá el producto
          </strong>

          <small>
            {active
              ? "Esta ficha recibirá el próximo Ctrl+V"
              : "Hacé clic para seleccionar"}
          </small>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPaste();
            }}
          >
            <ClipboardPaste size={13} />
            Pegar imagen
          </button>
        </>
      )}
    </div>
  );
}
