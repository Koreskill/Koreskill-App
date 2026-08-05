# Kore Creative OS

Sistema interno para producir imágenes, textos, videos de cámara y calendarios
de contenido. Las generaciones de IA usan `openai/gpt-image-2` mediante
Replicate; el motor de cámara 2D funciona localmente en el navegador.

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

### 3. Recreador de imágenes

- Prompt general y referencia visual opcional.
- Hasta ocho productos con características independientes.
- Generación seleccionada con cola de seguridad para evitar el límite 429.
- Campos compactos que se expanden al editar.
- Vista ampliada y descarga de resultados.

### 4. Redactor de fichas

- Pegado de texto libre y detección inicial de datos.
- Formulario completo de la propiedad.
- Salida determinista para WhatsApp.
- Versiones para portales e Instagram desde los mismos datos.
- Biblioteca de propiedades con guardado y reedición.

### 5. Biblioteca de proyectos

- Reúne imágenes, textos, información y costos de cada propiedad.
- Permite crear clientes y usar sus nombres como etiquetas.
- Filtra carpetas por cliente y cambia la etiqueta desde cada tarjeta.
- Elimina una carpeta completa, sus imágenes, resultados, textos y costos.

### 6. Cámara inmobiliaria

- Pegar, arrastrar o seleccionar una fotografía.
- Cinco presets visuales: Push-In, Pull-Out, Slide Left, Crane Up y Orbit Right.
- Previsualizaciones animadas sobre la foto cargada.
- Controles avanzados ocultos por defecto, con seis valores de `-10.0` a
  `10.0` y duración configurable.
- Guardado de presets propios por usuario.
- Visor de trayectoria con marcos y punto de interés seleccionable.
- Exportación local de clips verticales 9:16 sin costo por generación.

> El motor incluido en esta entrega es 2D con perspectiva. La profundidad
> cacheada y el Orbit 2.5D real quedan preparados como la siguiente evolución;
> requieren conectar un modelo de profundidad antes de prometer paralaje real.

### 7. Calendario de contenido

- Vista mensual, navegación por meses y filtro por cliente.
- Alta y edición de publicaciones con fecha, hora, canal, formato y estado.
- Vinculación opcional entre una publicación, un cliente y una propiedad.
- Lista de próximas publicaciones y colores por cliente.

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

5. Agregar también las variables públicas de Supabase:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_clave_publicable
   ```

6. Para habilitar el generador de textos, agregar:

   ```env
   OPENAI_API_KEY=sk_tu_clave
   OPENAI_TEXT_MODEL=tu_modelo_de_texto
   ```

7. Construir y levantar:

   ```bash
   docker compose up -d --build
   ```

8. Abrir:

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

### Generación de textos con OpenAI

En `.env` y en las variables de Dokploy configurar:

```env
OPENAI_API_KEY=sk_tu_clave
OPENAI_TEXT_MODEL=tu_modelo_de_texto
```

La clave se usa únicamente en el servidor. Nunca debe llevar el prefijo
`NEXT_PUBLIC_` ni escribirse dentro de un componente.

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

### Clientes, etiquetas, eliminación y calendario

Las tablas y sus índices se crean automáticamente al iniciar la aplicación.
También se incluye la migración de Drizzle correspondiente.

Archivos principales:

```text
app/biblioteca/library.tsx              # Etiquetas y eliminación de carpetas
app/calendario/calendar.tsx             # Calendario interno
app/api/clients/route.ts                # Clientes
app/api/calendar/                       # Publicaciones programadas
app/api/library/[propertyId]/route.ts   # Etiquetar y eliminar proyectos
db/schema.ts                            # Definición de tablas
db/index.ts                             # Compatibilidad con bases existentes
```

La eliminación de una carpeta es irreversible. Antes de confirmarla, la
interfaz muestra una advertencia. Los eventos del calendario no se eliminan:
quedan conservados y solamente pierden el vínculo con la propiedad eliminada.

### Presets de cámara

Los cinco presets de fábrica se encuentran en:

```text
app/camara/studio.tsx
```

Buscar `FACTORY_PRESETS`. Los presets personales se guardan mediante:

```text
app/api/camera-presets/route.ts
```

### Modificar el formato de las fichas inmobiliarias

Los tres renderizadores deterministas se encuentran en:

```text
lib/property-record.ts
```

Buscar:

```ts
renderWhatsApp
renderPortal
renderInstagram
```

Los campos guardados y la migración compatible con las propiedades existentes
están en:

```text
db/schema.ts
db/index.ts
app/api/property-records/route.ts
```

## Estructura importante

```text
app/
├── page.tsx                         # Inicio y selector de aplicaciones
├── propiedades/page.tsx             # Aplicación inmobiliaria
├── studio.tsx                       # Interfaz inmobiliaria
├── creativos/
│   ├── page.tsx
│   └── studio.tsx                   # Rutas A y B de anuncios
├── recreador/                        # Tandas de productos y referencias
├── fichas/                           # Redactor y biblioteca de propiedades
├── biblioteca/                       # Proyectos, etiquetas y eliminación
├── camara/                           # App 06: movimientos y exportación 9:16
├── calendario/                       # App 07: planificación de contenido
└── api/
    ├── calendar/                     # Publicaciones programadas
    ├── camera-presets/               # Movimientos propios
    ├── clients/                      # Clientes y colores
    ├── jobs/                        # Generaciones inmobiliarias
    ├── library/                     # Carpeta unificada por propiedad
    ├── prompts/                     # Presets de ambientes
    ├── properties/                  # Carpetas de propiedades
    ├── property-records/            # Fichas completas y reedición
    └── creative/predictions/        # Generaciones publicitarias

db/
├── index.ts                         # Inicialización de base de datos
└── schema.ts                        # Tablas

lib/
├── pricing.ts                       # Precios inmobiliarios estimados
├── property-record.ts               # Extracción y salidas deterministas
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
