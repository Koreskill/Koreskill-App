import Link from "next/link";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  FilePenLine,
  LibraryBig,
  Megaphone,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

export default function Home() {
  return (
    <main className="apps-home">
      <header className="apps-topbar">
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={18} strokeWidth={2.2} />
          </span>
          <span>
            <strong>Kore Creative OS</strong>
            <small>Aplicaciones internas de producción</small>
          </span>
        </div>
        <span className="internal-pill">Workspace interno</span>
      </header>

      <section className="apps-hero">
        <span className="eyebrow">Centro de aplicaciones</span>
        <h1>Un sistema para cada parte del proceso creativo.</h1>
        <p>
          Elegí una herramienta, cargá el material y seguí un flujo de trabajo
          repetible. Todas comparten el mismo acceso seguro, clientes y
          biblioteca de trabajo.
        </p>
      </section>

      <section className="apps-grid" aria-label="Aplicaciones disponibles">
        <Link href="/propiedades" className="app-card app-card-blue">
          <span className="app-card-icon">
            <Building2 size={25} />
          </span>
          <span className="app-status">Operativa</span>
          <div>
            <span className="app-number">01</span>
            <h2>Expansión inmobiliaria</h2>
            <p>
              Convierte fotografías de propiedades a Stories 9:16, las ordena
              por carpeta y registra el gasto de cada inmueble.
            </p>
          </div>
          <footer>
            <span>Ingresar a la aplicación</span>
            <ArrowRight size={17} />
          </footer>
        </Link>

        <Link href="/creativos" className="app-card app-card-violet">
          <span className="app-card-icon">
            <Megaphone size={25} />
          </span>
          <span className="app-status">Nueva</span>
          <div>
            <span className="app-number">02</span>
            <h2>Creativos para anuncios</h2>
            <p>
              Generá una pieza final con un prompt directo o construí el
              anuncio por etapas, conservando el producto entre procesos.
            </p>
          </div>
          <footer>
            <span>Crear un anuncio</span>
            <ArrowRight size={17} />
          </footer>
        </Link>

        <Link
          href="/recreador"
          className="app-card app-card-cyan"
        >
          <span className="app-card-icon">
            <RefreshCcw size={25} />
          </span>

          <span className="app-status">
            Nueva
          </span>

          <div>
            <span className="app-number">
              03
            </span>

            <h2>
              Recreador de imágenes
            </h2>

            <p>
              Aplicá un prompt y una referencia visual a varios
              productos, agregando características particulares
              para cada resultado.
            </p>
          </div>

          <footer>
            <span>
              Recrear una tanda
            </span>

            <ArrowRight size={17} />
          </footer>
        </Link>

        <Link href="/fichas" className="app-card app-card-amber">
          <span className="app-card-icon">
            <FilePenLine size={25} />
          </span>
          <span className="app-status">Nueva</span>
          <div>
            <span className="app-number">04</span>
            <h2>Redactor de fichas</h2>
            <p>
              Convertí datos sueltos de una propiedad en fichas consistentes
              para WhatsApp, portales e Instagram, listas para copiar.
            </p>
          </div>
          <footer>
            <span>Redactar una propiedad</span>
            <ArrowRight size={17} />
          </footer>
        </Link>
                <Link
          href="/biblioteca"
          className="app-card app-card-green"
        >
          <span className="app-card-icon">
            <LibraryBig size={25} />
          </span>

          <span className="app-status">
            Operativa
          </span>

          <div>
            <span className="app-number">
              05
            </span>

            <h2>Biblioteca de proyectos</h2>

            <p>
              Consultá las imágenes, textos, costos e
              información de cada propiedad desde una
              carpeta unificada.
            </p>
          </div>

          <footer>
            <span>Abrir la biblioteca</span>
            <ArrowRight size={17} />
          </footer>
        </Link>

        <Link href="/camara" className="app-card app-card-indigo">
          <span className="app-card-icon">
            <Camera size={25} />
          </span>
          <span className="app-status">Nueva</span>
          <div>
            <span className="app-number">06</span>
            <h2>Cámara inmobiliaria</h2>
            <p>
              Convertí una foto en un clip 9:16 con presets de movimiento,
              controles avanzados y movimientos propios reutilizables.
            </p>
          </div>
          <footer>
            <span>Animar una propiedad</span>
            <ArrowRight size={17} />
          </footer>
        </Link>

        <Link href="/calendario" className="app-card app-card-coral">
          <span className="app-card-icon">
            <CalendarDays size={25} />
          </span>
          <span className="app-status">Nueva</span>
          <div>
            <span className="app-number">07</span>
            <h2>Calendario de contenidos</h2>
            <p>
              Organizá qué publicar, cuándo hacerlo y para qué cliente,
              vinculando cada entrega con su propiedad.
            </p>
          </div>
          <footer>
            <span>Planificar publicaciones</span>
            <ArrowRight size={17} />
          </footer>
        </Link>
      </section>
    </main>
  );
}
