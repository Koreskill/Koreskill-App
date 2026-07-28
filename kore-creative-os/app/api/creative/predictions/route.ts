import Replicate from "replicate";
import { extractOutputUrl } from "@/lib/jobs";
import { getReplicateToken } from "@/lib/runtime";

const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const QUALITIES = new Set(["low", "medium", "high", "auto"]);
const ASPECT_RATIOS = new Set(["1:1", "4:5", "9:16", "3:2", "2:3"]);
const MAX_FILE_SIZE = 2 * 1024 * 1024;

type PredictionResponse = {
  id?: string;
  status?: string;
  output?: unknown;
  error?: string | null;
};

function configuredToken() {
  const token = getReplicateToken();
  if (!token) {
    return Response.json(
      {
        error:
          "Replicate todavía no está conectado. Configurá REPLICATE_API_TOKEN.",
        code: "REPLICATE_NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }
  return token;
}

export async function POST(request: Request) {
  try {
    const token = configuredToken();
    if (token instanceof Response) return token;

    const contentType = request.headers.get("content-type") || "";
    let prompt = "";
    let quality = "low";
    let aspectRatio = "4:5";
    let inputImage: Blob | string | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("image");
      prompt = String(formData.get("prompt") || "").trim();
      quality = String(formData.get("quality") || "low");
      aspectRatio = String(formData.get("aspectRatio") || "4:5");
      if (file instanceof File) {
        if (!ACCEPTED_TYPES.has(file.type)) {
          return Response.json(
            { error: "Usá una imagen JPG, PNG o WEBP." },
            { status: 400 },
          );
        }
        if (file.size > MAX_FILE_SIZE) {
          return Response.json(
            {
              error:
                "La imagen supera el límite. Volvé a seleccionarla para que la web la optimice.",
            },
            { status: 400 },
          );
        }
        inputImage = new Blob([await file.arrayBuffer()], { type: file.type });
      }
    } else {
      const payload = (await request.json()) as {
        imageUrl?: string;
        prompt?: string;
        quality?: string;
        aspectRatio?: string;
      };
      prompt = payload.prompt?.trim() || "";
      quality = payload.quality || "low";
      aspectRatio = payload.aspectRatio || "4:5";
      if (payload.imageUrl?.startsWith("https://")) {
        inputImage = payload.imageUrl;
      }
    }

    if (!inputImage) {
      return Response.json({ error: "Falta la imagen de entrada." }, { status: 400 });
    }
    if (!prompt) {
      return Response.json({ error: "Escribí un prompt." }, { status: 400 });
    }
    if (!QUALITIES.has(quality)) {
      return Response.json({ error: "Calidad inválida." }, { status: 400 });
    }
    if (!ASPECT_RATIOS.has(aspectRatio)) {
      return Response.json({ error: "Formato inválido." }, { status: 400 });
    }

    const replicate = new Replicate({
      auth: token,
      fileEncodingStrategy: "upload",
      useFileOutput: false,
    });
    const prediction = await replicate.predictions.create({
      model: "openai/gpt-image-2",
      input: {
        prompt,
        input_images: [inputImage],
        aspect_ratio: aspectRatio,
        quality,
        number_of_images: 1,
        output_format: "jpeg",
        background: "opaque",
      },
    });

    if (!prediction.id) {
      return Response.json(
        {
          error:
            typeof prediction.error === "string"
              ? prediction.error
              : "Replicate no pudo iniciar la generación.",
        },
        { status: 502 },
      );
    }

    return Response.json(
      { id: prediction.id, status: prediction.status },
      { status: 202 },
    );
  } catch (error) {
    console.error("Creative prediction start failed", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo iniciar la generación.",
      },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  try {
    const token = configuredToken();
    if (token instanceof Response) return token;
    const id = new URL(request.url).searchParams.get("id");
    if (!id) {
      return Response.json({ error: "Falta el identificador." }, { status: 400 });
    }

    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${encodeURIComponent(id)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const prediction = (await response.json()) as PredictionResponse;
    if (!response.ok) {
      return Response.json(
        {
          error:
            prediction.error ||
            `No se pudo consultar Replicate (${response.status}).`,
        },
        { status: response.status },
      );
    }

    return Response.json({
      id,
      status: prediction.status,
      outputUrl:
        prediction.status === "succeeded"
          ? extractOutputUrl(prediction.output)
          : null,
      error: prediction.error || null,
    });
  } catch (error) {
    console.error("Creative prediction refresh failed", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar la generación.",
      },
      { status: 500 },
    );
  }
}
