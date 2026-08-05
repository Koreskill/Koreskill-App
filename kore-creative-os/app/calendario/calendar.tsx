"use client";

import {
  ArrowLeft,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Edit3,
  Filter,
  LoaderCircle,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./calendar.module.css";

type Client = {
  id: string;
  name: string;
  color: string;
};

type Project = {
  id: string;
  title: string;
  name: string;
  client: string;
};

type CalendarItem = {
  id: string;
  clientId: string | null;
  propertyId: string | null;
  title: string;
  contentType: string;
  channel: string;
  scheduledFor: string;
  status: "planned" | "ready" | "published";
  notes: string;
  clientName: string;
  clientColor: string;
  propertyTitle: string;
};

type EventForm = {
  clientId: string;
  propertyId: string;
  title: string;
  contentType: string;
  channel: string;
  scheduledFor: string;
  status: CalendarItem["status"];
  notes: string;
};

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CONTENT_TYPES = ["Reel", "Historia", "Post", "Carrusel", "Anuncio"];
const CHANNELS = ["Instagram", "Facebook", "TikTok", "LinkedIn", "WhatsApp"];
const COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#db2777"];

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function localDateTimeValue(date: Date) {
  return `${dateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function monthLabel(date: Date) {
  const value = new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function timeLabel(value: string) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function fullDateLabel(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function newForm(date = new Date(), clientId = ""): EventForm {
  const scheduled = new Date(date);
  scheduled.setHours(10, 0, 0, 0);
  return {
    clientId,
    propertyId: "",
    title: "",
    contentType: "Reel",
    channel: "Instagram",
    scheduledFor: localDateTimeValue(scheduled),
    status: "planned",
    notes: "",
  };
}

export function CalendarScreen() {
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [loadedAt] = useState(() => Date.now());
  const [clientFilter, setClientFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState<EventForm>(() => newForm());
  const [saving, setSaving] = useState(false);
  const [clientModal, setClientModal] = useState(false);
  const [newClient, setNewClient] = useState({ name: "", color: COLORS[0] });

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const [calendarResponse, clientResponse, libraryResponse] = await Promise.all([
          fetch("/api/calendar", { cache: "no-store" }),
          fetch("/api/clients", { cache: "no-store" }),
          fetch("/api/library", { cache: "no-store" }),
        ]);
        const [calendarPayload, clientPayload, libraryPayload] = await Promise.all([
          calendarResponse.json(),
          clientResponse.json(),
          libraryResponse.json(),
        ]) as [
          { items?: CalendarItem[]; error?: string },
          { clients?: Client[]; error?: string },
          { projects?: Project[]; error?: string },
        ];
        if (!calendarResponse.ok) throw new Error(calendarPayload.error || "No se pudo cargar el calendario.");
        if (!clientResponse.ok) throw new Error(clientPayload.error || "No se pudieron cargar los clientes.");
        if (!libraryResponse.ok) throw new Error(libraryPayload.error || "No se pudieron cargar las propiedades.");
        if (active) {
          setItems(calendarPayload.items || []);
          setClients(clientPayload.clients || []);
          setProjects(libraryPayload.projects || []);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el calendario.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => !clientFilter || item.clientId === clientFilter),
    [clientFilter, items],
  );

  const days = useMemo(() => {
    const firstWeekday = (month.getDay() + 6) % 7;
    const first = new Date(month.getFullYear(), month.getMonth(), 1 - firstWeekday);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(first);
      date.setDate(first.getDate() + index);
      return date;
    });
  }, [month]);

  const grouped = useMemo(() => {
    const map = new Map<string, CalendarItem[]>();
    for (const item of visibleItems) {
      const key = dateKey(new Date(item.scheduledFor));
      map.set(key, [...(map.get(key) || []), item]);
    }
    return map;
  }, [visibleItems]);

  const upcoming = useMemo(() => {
    return visibleItems
      .filter((item) => new Date(item.scheduledFor).getTime() >= loadedAt)
      .sort((first, second) => first.scheduledFor.localeCompare(second.scheduledFor))
      .slice(0, 8);
  }, [loadedAt, visibleItems]);

  const selectedClientName = clients.find((client) => client.id === form.clientId)?.name;
  const availableProjects = projects.filter(
    (project) => !selectedClientName || !project.client || project.client === selectedClientName,
  );

  function openNew(date = new Date()) {
    setEditingId("");
    setForm(newForm(date, clientFilter || clients[0]?.id || ""));
    setError("");
    setModalOpen(true);
  }

  function openEdit(item: CalendarItem) {
    setEditingId(item.id);
    setForm({
      clientId: item.clientId || "",
      propertyId: item.propertyId || "",
      title: item.title,
      contentType: item.contentType,
      channel: item.channel,
      scheduledFor: localDateTimeValue(new Date(item.scheduledFor)),
      status: item.status,
      notes: item.notes,
    });
    setError("");
    setModalOpen(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        editingId ? `/api/calendar/${editingId}` : "/api/calendar",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...form,
            scheduledFor: new Date(form.scheduledFor).toISOString(),
          }),
        },
      );
      const payload = (await response.json()) as { item?: CalendarItem; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "No se pudo guardar.");
      setItems((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? payload.item as CalendarItem : item))
          : [...current, payload.item as CalendarItem],
      );
      setModalOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem() {
    if (!editingId || !window.confirm("¿Eliminar este contenido del calendario?")) return;
    setSaving(true);
    try {
      const response = await fetch(`/api/calendar/${editingId}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setItems((current) => current.filter((item) => item.id !== editingId));
      setModalOpen(false);
    } catch {
      setError("No se pudo eliminar el contenido.");
    } finally {
      setSaving(false);
    }
  }

  async function createClient(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/clients", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(newClient),
      });
      const payload = (await response.json()) as { client?: Client; error?: string };
      if (!response.ok || !payload.client) throw new Error(payload.error || "No se pudo crear el cliente.");
      setClients((current) => [...current, payload.client as Client].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((current) => ({ ...current, clientId: payload.client?.id || "" }));
      setNewClient({ name: "", color: COLORS[0] });
      setClientModal(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandIcon}><CalendarDays size={19} /></span>
          <span><strong>Calendario de contenidos</strong><small>Planificación interna por cliente</small></span>
        </div>
        <Link href="/" className={styles.backButton}><ArrowLeft size={15} /> Aplicaciones</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <span className={styles.eyebrow}>Aplicación 07</span>
          <h1>Qué publicar, cuándo y para quién.</h1>
          <p>Organizá reels, historias, anuncios y publicaciones de todos tus clientes en un mismo calendario.</p>
        </div>
        <button type="button" className={styles.primaryButton} onClick={() => openNew()}>
          <Plus size={16} /> Agendar contenido
        </button>
      </section>

      <section className={styles.toolbar}>
        <div className={styles.monthNavigation}>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={17} /></button>
          <strong>{monthLabel(month)}</strong>
          <button type="button" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={17} /></button>
          <button type="button" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Hoy</button>
        </div>

        <div className={styles.filters}>
          <label><Filter size={14} /><select value={clientFilter} onChange={(event) => setClientFilter(event.target.value)}><option value="">Todos los clientes</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
          <button type="button" onClick={() => setClientModal(true)}><Plus size={14} /> Nuevo cliente</button>
        </div>
      </section>

      {error && !modalOpen && !clientModal && <div className={styles.pageError}>{error}</div>}

      {loading ? (
        <div className={styles.loading}><LoaderCircle className="spin" size={25} /> Cargando calendario…</div>
      ) : (
        <section className={styles.layout}>
          <div className={styles.calendarCard}>
            <div className={styles.weekdays}>{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className={styles.monthGrid}>
              {days.map((day) => {
                const key = dateKey(day);
                const dayItems = grouped.get(key) || [];
                const outside = day.getMonth() !== month.getMonth();
                const today = key === dateKey(new Date());
                return (
                  <div key={key} className={`${styles.day} ${outside ? styles.outside : ""} ${today ? styles.today : ""}`} onDoubleClick={() => openNew(day)}>
                    <button type="button" className={styles.dayNumber} onClick={() => openNew(day)}>{day.getDate()}</button>
                    <div className={styles.dayItems}>
                      {dayItems.slice(0, 3).map((item) => (
                        <button type="button" key={item.id} className={styles.calendarEvent} style={{ "--client-color": item.clientColor } as React.CSSProperties} onClick={() => openEdit(item)}>
                          <span>{timeLabel(item.scheduledFor)}</span>
                          <strong>{item.title}</strong>
                        </button>
                      ))}
                      {dayItems.length > 3 && <span className={styles.moreEvents}>+{dayItems.length - 3} más</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <aside className={styles.upcoming}>
            <div><span>Próximos</span><h2>Contenido programado</h2></div>
            {upcoming.length ? upcoming.map((item) => (
              <button type="button" key={item.id} className={styles.upcomingItem} onClick={() => openEdit(item)}>
                <span className={styles.clientDot} style={{ background: item.clientColor }} />
                <span className={styles.upcomingCopy}>
                  <strong>{item.title}</strong>
                  <small>{item.clientName} · {item.contentType}</small>
                  <time><Clock3 size={11} /> {fullDateLabel(item.scheduledFor)}</time>
                </span>
                <Edit3 size={13} />
              </button>
            )) : <div className={styles.emptyUpcoming}><CalendarDays size={25} /><p>No hay publicaciones próximas.</p><button type="button" onClick={() => openNew()}>Agendar la primera</button></div>}
          </aside>
        </section>
      )}

      {modalOpen && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModalOpen(false); }}>
          <form className={styles.modal} onSubmit={saveItem}>
            <header><div><span>{editingId ? "Editar contenido" : "Nuevo contenido"}</span><h2>{editingId ? "Actualizar publicación" : "Agendar publicación"}</h2></div><button type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></header>
            <div className={styles.formGrid}>
              <label><span>Cliente</span><select required value={form.clientId} onChange={(event) => setForm((current) => ({ ...current, clientId: event.target.value, propertyId: "" }))}><option value="">Seleccionar cliente</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label>
              <label><span>Propiedad / proyecto</span><select value={form.propertyId} onChange={(event) => setForm((current) => ({ ...current, propertyId: event.target.value }))}><option value="">Sin propiedad vinculada</option>{availableProjects.map((project) => <option value={project.id} key={project.id}>{project.title || project.name}</option>)}</select></label>
              <label className={styles.fullField}><span>Qué se va a publicar</span><input required value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Ej.: Reel recorrido del living" /></label>
              <label><span>Formato</span><select value={form.contentType} onChange={(event) => setForm((current) => ({ ...current, contentType: event.target.value }))}>{CONTENT_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
              <label><span>Canal</span><select value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}>{CHANNELS.map((channel) => <option key={channel}>{channel}</option>)}</select></label>
              <label><span>Fecha y hora</span><input required type="datetime-local" value={form.scheduledFor} onChange={(event) => setForm((current) => ({ ...current, scheduledFor: event.target.value }))} /></label>
              <label><span>Estado</span><select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CalendarItem["status"] }))}><option value="planned">Planificado</option><option value="ready">Listo para subir</option><option value="published">Publicado</option></select></label>
              <label className={styles.fullField}><span>Notas</span><textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Copy pendiente, material necesario, enlace, observaciones…" /></label>
            </div>
            {error && <div className={styles.formError}>{error}</div>}
            <footer>{editingId ? <button type="button" className={styles.deleteButton} onClick={() => void deleteItem()} disabled={saving}><Trash2 size={14} /> Eliminar</button> : <span />}<button type="submit" className={styles.saveButton} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Check size={15} />}{editingId ? "Guardar cambios" : "Agendar contenido"}</button></footer>
          </form>
        </div>
      )}

      {clientModal && (
        <div className={styles.modalBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClientModal(false); }}>
          <form className={`${styles.modal} ${styles.clientForm}`} onSubmit={createClient}>
            <header><div><span>Etiqueta de cliente</span><h2>Crear cliente</h2></div><button type="button" onClick={() => setClientModal(false)}><X size={18} /></button></header>
            <label className={styles.clientNameField}><span>Nombre</span><input required autoFocus value={newClient.name} onChange={(event) => setNewClient((current) => ({ ...current, name: event.target.value }))} placeholder="Ej.: Juri Brokers" /></label>
            <div className={styles.colorPicker}><span>Color de etiqueta</span><div>{COLORS.map((color) => <button key={color} type="button" aria-label={`Elegir ${color}`} className={newClient.color === color ? styles.colorSelected : ""} style={{ background: color }} onClick={() => setNewClient((current) => ({ ...current, color }))} />)}</div></div>
            {error && <div className={styles.formError}>{error}</div>}
            <footer><span /><button type="submit" className={styles.saveButton} disabled={saving}>{saving ? <LoaderCircle className="spin" size={15} /> : <Plus size={15} />} Crear cliente</button></footer>
          </form>
        </div>
      )}
    </main>
  );
}
