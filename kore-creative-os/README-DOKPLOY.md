# Publicar Kore Creative OS en Hostinger con Dokploy

Esta es la guía recomendada para mantener el código en tu computadora y
publicarlo en la VPS de Hostinger donde ya tenés Dokploy.

## Arquitectura recomendada

```text
Computadora
└── C:\Proyectos\kore-creative-os
    ├── Visual Studio Code o Codex
    └── Git
          ↓ push
Repositorio privado de GitHub
          ↓ deploy
Dokploy en la VPS de Hostinger
          ↓
creative.tudominio.com
```

El repositorio guarda el código. Dokploy construye la aplicación. El volumen
`creative_data` guarda las propiedades, imágenes, resultados y base de datos
locales del servidor.

## 1. Guardar el proyecto en Windows

1. Crear esta carpeta:

   ```text
   C:\Proyectos
   ```

2. Descomprimir el ZIP dentro de esa carpeta.

3. La ruta final debería quedar así:

   ```text
   C:\Proyectos\kore-creative-os
   ```

4. Abrir PowerShell:

   ```powershell
   cd C:\Proyectos\kore-creative-os
   code .
   ```

Si `code .` no funciona, abrir Visual Studio Code y elegir:

```text
Archivo → Abrir carpeta → C:\Proyectos\kore-creative-os
```

Codex también debe abrirse tomando `C:\Proyectos\kore-creative-os` como carpeta
del proyecto.

## 2. Probarlo en tu computadora

Requisitos:

- Node.js 22.13 o superior.
- Git.
- Visual Studio Code o Codex.

Desde la terminal del proyecto:

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Abrir la dirección que muestre la terminal.

En `.env` debe estar:

```env
REPLICATE_API_TOKEN=r8_TU_TOKEN_REAL
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_clave_publicable
```

El archivo `.env` está ignorado por Git y no debe subirse.

## 3. Crear un repositorio privado

La opción más fácil de mantener con Dokploy es un repositorio privado de
GitHub.

Crear un repositorio vacío, por ejemplo:

```text
kore-creative-os
```

Después, desde la carpeta local:

```powershell
git init
git add .
git commit -m "Primera versión de Kore Creative OS"
git branch -M main
git remote add origin URL_DE_TU_REPOSITORIO
git push -u origin main
```

No subir nunca `.env`, claves API, contraseñas ni copias de las imágenes
generadas.

## 4. Crear el proyecto en Dokploy

1. Entrar a tu panel de Dokploy.
2. Presionar **New Project**.
3. Nombre recomendado:

   ```text
   Kore Creative OS
   ```

4. Dentro del proyecto, crear un servicio de tipo **Docker Compose**.
5. Como fuente, seleccionar GitHub.
6. Conectar el repositorio privado.
7. Seleccionar la rama:

   ```text
   main
   ```

8. Indicar este archivo Compose:

   ```text
   ./docker-compose.dokploy.yml
   ```

No utilizar el `docker-compose.yml` general dentro de Dokploy. Ese archivo
publica el puerto 3000 directamente y está pensado para pruebas locales. Dokploy
ya utiliza su propio proxy y debe trabajar con `docker-compose.dokploy.yml`.

## 5. Configurar la API Key

Dentro del servicio Compose:

1. Entrar en **Environment**.
2. Agregar:

   ```env
   REPLICATE_API_TOKEN=r8_TU_TOKEN_REAL
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=tu_clave_publicable
   ```

3. Guardar.

La variable es referenciada por el Compose mediante:

```yaml
REPLICATE_API_TOKEN: ${REPLICATE_API_TOKEN}
```

Nunca escribir la clave directamente en `Dockerfile`,
`docker-compose.dokploy.yml` o GitHub.

Si el token que utilizaste anteriormente quedó expuesto en un chat o captura,
revocarlo desde Replicate y crear uno nuevo antes de publicar.

## 6. Configurar dominio y HTTPS

Usar un subdominio, por ejemplo:

```text
creative.tudominio.com
```

En el DNS administrado desde Hostinger:

1. Crear un registro `A`.
2. Nombre:

   ```text
   creative
   ```

3. Destino: la IP pública de la VPS.
4. Guardar y esperar la propagación.

Después, en Dokploy:

1. Entrar en **Domains**.
2. Agregar `creative.tudominio.com`.
3. Seleccionar el servicio:

   ```text
   kore-creative-os
   ```

4. Configurar el puerto interno:

   ```text
   3000
   ```

5. Activar HTTPS/Certificate.

Dokploy agrega automáticamente la configuración de Traefik. No hace falta
publicar manualmente el puerto 3000 de la VPS ni configurar Nginx.

## 7. Realizar el primer Deploy

1. Revisar que la variable `REPLICATE_API_TOKEN` esté cargada.
2. Presionar **Deploy**.
3. Seguir el proceso en **Deployments**.
4. Si algo falla, entrar en **Logs**.
5. Cuando el servicio esté saludable, abrir el dominio.

La primera construcción puede tardar algunos minutos porque instala todas las
dependencias.

## 8. Persistencia y copias de seguridad

El archivo específico de Dokploy declara:

```yaml
volumes:
  creative_data:
```

Ese volumen se monta en:

```text
/app/.wrangler
```

Ahí se conserva la base de datos y el almacenamiento local de la aplicación.
El contenido sobrevive reinicios y nuevas construcciones.

En Dokploy, configurar **Volume Backups** para `creative_data`. Los backups
automáticos de Dokploy funcionan con volúmenes Docker nombrados.

Antes de eliminar el servicio o el volumen:

1. Crear un backup.
2. Verificar que el backup terminó.
3. Recién después realizar la eliminación.

## 9. Flujo de actualizaciones

Cada cambio debería seguir este orden:

```text
Editar localmente
→ probar
→ guardar en Git
→ enviar a GitHub
→ desplegar en Dokploy
```

Comandos recomendados:

```powershell
npm run lint
npm test
git status
git add .
git commit -m "Descripción del cambio"
git push
```

Después:

- Presionar **Deploy** en Dokploy, o
- Configurar el webhook de despliegue automático.

Para cambios importantes, primero hacer backup de `creative_data`.

## 10. Archivos que vas a modificar con mayor frecuencia

| Necesidad | Archivo |
|---|---|
| Agregar otra aplicación al inicio | `app/page.tsx` |
| Interfaz inmobiliaria | `app/studio.tsx` |
| Presets automáticos | `app/api/prompts/route.ts` |
| Interfaz de anuncios | `app/creativos/studio.tsx` |
| Recreador de productos | `app/recreador/studio.tsx` |
| Redactor de fichas | `app/fichas/studio.tsx` |
| Formato de salida de fichas | `lib/property-record.ts` |
| Modelo de Replicate | `app/api/jobs/[id]/start/route.ts` y `app/api/creative/predictions/route.ts` |
| Precios estimados | `lib/pricing.ts` y `QUALITY_PRICES` |
| Estilos generales | `app/globals.css` |
| Configuración de Dokploy | `docker-compose.dokploy.yml` |

Los nuevos botones inmobiliarios también pueden crearse desde la propia
aplicación con **Nuevo preset**, sin editar código.

## 11. Solución de problemas

### La aplicación no inicia

Revisar **Deployments** y después **Logs**. Confirmar que la construcción del
Dockerfile terminó correctamente.

### Aparece “Falta conectar Replicate”

Confirmar que en **Environment** exista exactamente:

```text
REPLICATE_API_TOKEN
```

Guardar la variable y hacer un nuevo Deploy.

### El dominio devuelve error

Verificar:

- Registro DNS `A` apuntando a la IP de la VPS.
- Servicio seleccionado: `kore-creative-os`.
- Puerto interno: `3000`.
- Contenedor en estado saludable.

### Se pierden archivos al actualizar

Verificar que el volumen `creative_data` continúe montado en:

```text
/app/.wrangler
```

No crear un servicio nuevo sin migrar o reutilizar el volumen.

### Conflicto con el puerto 3000

Confirmar que Dokploy utiliza:

```text
docker-compose.dokploy.yml
```

Ese archivo usa `expose: 3000` y no publica `3000:3000` en el host.
