# Kore Creative OS

Sistema interno con aplicaciones para producir imágenes mediante
`openai/gpt-image-2` a través de Replicate.

## Empezar

- Para trabajar desde Visual Studio Code o Codex y publicar en una VPS de
  Hostinger con Dokploy, abrir [README-DOKPLOY.md](README-DOKPLOY.md).
- Para una instalación Docker convencional, continuar con esta guía.

## Aplicaciones incluidas

### 1. Expansión inmobiliaria

- Carga de imágenes por propiedad.
- Expansión vertical a formato Story 9:16.
- Hasta ocho generaciones simultáneas o procesamiento en loop.
- Presets de Fachada, Baño, Living, Cocina, Dormitorio y Balcón.
- Creación de nuevos presets desde la interfaz.
- Historial, descarga y gasto estimado por propiedad.

### 2. Creativos para anuncios

- **Ruta A:** imagen original + prompt final → anuncio terminado.
- **Ruta B:** producto original → captura del producto → entorno publicitario →
  composición final.
- Edición del prompt de cada etapa.
- Ejecución individual o automática de toda la cadena.
- Formatos 4:5, 9:16, 1:1 y 3:2.
- Descarga del resultado de cada etapa.

## Inicio rápido en un servidor propio

La forma recomendada es Docker. El servidor debe tener Docker y Docker Compose.

1. Descomprimir el proyecto.
2. Entrar a la carpeta:

   ```bash
   cd kore-creative-os
   ```

3. Crear el archivo de variables:

   ```bash
   cp .env.example .env
   ```

4. Abrir `.env` y colocar el token real:

   ```env
   REPLICATE_API_TOKEN=r8_tu_token_real
   ```

5. Construir y levantar:

   ```bash
   docker compose up -d --build
   ```

6. Abrir:

   ```text
   http://IP-DE-TU-SERVIDOR:3000
   ```

Los registros, las carpetas y las imágenes de propiedades quedan dentro del
volumen persistente `creative_data`. No desaparecen al reiniciar el contenedor.

Para actualizar una versión:

```bash
docker compose down
docker compose up -d --build
```

Para ver errores:

```bash
docker compose logs -f kore-creative-os
```

## Instalación sin Docker

Requiere Node.js 22.13 o superior.

```bash
npm ci
cp .env.example .env
npm run start:selfhost
```

La aplicación se abre en `http://localhost:3000`.

## Configuración principal

### API Key de Replicate

En servidor propio, modificar:

```text
.env
```

Variable:

```env
REPLICATE_API_TOKEN=r8_tu_token
```

Después reiniciar:

```bash
docker compose up -d --build
```

Nunca escribir la clave dentro de un componente, subirla a Git ni incluirla en
capturas. Si una clave fue compartida públicamente, revocarla en Replicate y
crear una nueva.

En el sitio alojado, la misma clave debe configurarse como secreto con el
nombre `REPLICATE_API_TOKEN`.

### Modelo de imágenes

El modelo usado por las dos aplicaciones se configura en:

```text
app/api/jobs/[id]/start/route.ts
app/api/creative/predictions/route.ts
```

Buscar:

```ts
model: "openai/gpt-image-2"
```

Si se cambia de modelo, revisar también los nombres de sus parámetros de
entrada en Replicate.

### Costos estimados

Aplicación inmobiliaria:

```text
lib/pricing.ts
```

Aplicación de anuncios:

```text
app/creativos/studio.tsx
```

Buscar `QUALITY_PRICES`. Los valores son estimaciones visuales; el cobro real lo
determina Replicate.

### Agregar botones de ambientes

No hace falta modificar código:

1. Abrir **Expansión inmobiliaria**.
2. Entrar en **Prompt global**.
3. Presionar **Nuevo preset**.
4. Escribir el nombre, por ejemplo `Patio`, `Terraza` o `Pileta`.
5. Completar el prompt.
6. Presionar **Crear preset**.

El nuevo botón se guarda y aparece también debajo de cada imagen.

Los presets que deben existir automáticamente en una instalación nueva están
en:

```text
app/api/prompts/route.ts
```

Buscar `DEFAULT_PRESETS`.

### Modificar los prompts del proceso publicitario

Los prompts iniciales de la Ruta A y de las tres etapas de la Ruta B están en:

```text
app/creativos/studio.tsx
```

Buscar:

```text
DIRECT_PROMPT
INITIAL_STAGES
```

También pueden editarse directamente en la pantalla antes de ejecutar una
generación.

### Agregar una nueva etapa a la Ruta B

En `app/creativos/studio.tsx`, agregar un elemento dentro de `INITIAL_STAGES`
con esta estructura:

```ts
{
  id: "nombre-unico",
  number: "04",
  title: "Nombre visible",
  description: "Qué hace esta etapa.",
  prompt: `Prompt completo de la etapa.`,
  status: "idle",
}
```

Si se agregan identificadores nuevos, ampliar también el tipo `Stage["id"]`.
El proceso automático recorre las etapas en orden y utiliza el resultado de la
anterior como entrada de la siguiente.

### Agregar otra aplicación al inicio

1. Crear una ruta dentro de `app/`, por ejemplo:

   ```text
   app/videos/page.tsx
   ```

2. Agregar su tarjeta en:

   ```text
   app/page.tsx
   ```

3. Mantener sus endpoints dentro de un namespace propio:

   ```text
   app/api/videos/
   ```

Esto evita mezclar datos y procesos entre aplicaciones.

## Estructura importante

```text
app/
├── page.tsx                         # Inicio y selector de aplicaciones
├── propiedades/page.tsx             # Aplicación inmobiliaria
├── studio.tsx                       # Interfaz inmobiliaria
├── creativos/
│   ├── page.tsx
│   └── studio.tsx                   # Rutas A y B de anuncios
└── api/
    ├── jobs/                        # Generaciones inmobiliarias
    ├── prompts/                     # Presets de ambientes
    ├── properties/                  # Carpetas de propiedades
    └── creative/predictions/        # Generaciones publicitarias

db/
├── index.ts                         # Inicialización de base de datos
└── schema.ts                        # Tablas

lib/
├── pricing.ts                       # Precios inmobiliarios estimados
└── runtime.ts                       # Acceso seguro a Replicate y almacenamiento
```

## Comandos

```bash
npm run lint       # Revisar el código
npm test           # Compilar y ejecutar las validaciones
npm run dev        # Desarrollo local
npm run start:selfhost
```

## Seguridad recomendada

- Proteger el dominio con contraseña, VPN o autenticación del proxy.
- No publicar `.env`.
- Rotar el token de Replicate periódicamente.
- Hacer copias de seguridad del volumen `creative_data`.
- Mantener Docker, Node y las dependencias actualizadas.
