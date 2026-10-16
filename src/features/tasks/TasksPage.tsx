import React, { useState, useEffect } from "react";
import {
  Kanban,
  ListFilter,
  Plus,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Ticket,
  Calendar,
  X,
  Play,
  RotateCcw,
  Check,
  Search,
  Filter,
} from "lucide-react";
import { tr } from "../../i18n/index.js";

interface Task {
  id: number;
  tenant_id: number;
  ticket_id: number | null;
  task_number: string;
  title: string;
  description: string;
  status: "backlog" | "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  assignee_id: number | null;
  reporter_id: number;
  estimated_minutes: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  assignee_name?: string;
  assignee_email?: string;
  reporter_name?: string;
  ticket_title?: string;
  total_logged_minutes: number;
  worklogs?: Worklog[];
}

interface Worklog {
  id: number;
  task_id: number;
  user_id: number;
  minutes_spent: number;
  description: string;
  user_name?: string;
  created_at: string;
}

const COLUMNS: { key: Task["status"]; label: string; color: string }[] = [
  { key: "backlog", label: "Backlog", color: "#64748b" },
  { key: "todo", label: "Yapılacak", color: "#3b82f6" },
  { key: "in_progress", label: "İşlemde", color: "#f59e0b" },
  { key: "review", label: "İnceleme / Test", color: "#8b5cf6" },
  { key: "done", label: "Tamamlandı", color: "#10b981" },
];

const PRIORITY_BADGES: Record<string, { label: string; bg: string; color: string }> = {
  urgent: { label: "Acil", bg: "rgba(239, 68, 68, 0.15)", color: "#ef4444" },
  high: { label: "Yüksek", bg: "rgba(249, 115, 22, 0.15)", color: "#f97316" },
  medium: { label: "Orta", bg: "rgba(234, 179, 8, 0.15)", color: "#eab308" },
  low: { label: "Düşük", bg: "rgba(59, 130, 246, 0.15)", color: "#3b82f6" },
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);

  // Create form state
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formPriority, setFormPriority] = useState<Task["priority"]>("medium");
  const [formStatus, setFormStatus] = useState<Task["status"]>("todo");
  const [formAssignee, setFormAssignee] = useState("");
  const [formTicketId, setFormTicketId] = useState("");
  const [formEst, setFormEst] = useState("60");
  const [formDue, setFormDue] = useState("");

  // Worklog form state
  const [logMinutes, setLogMinutes] = useState("30");
  const [logDesc, setLogDesc] = useState("");

  const fetchTasks = async () => {
    try {
      const res = await fetch("/api/tasks");
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMetadata = async () => {
    try {
      const [uRes, tRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/tickets"),
      ]);
      if (uRes.ok) setUsers(await uRes.json());
      if (tRes.ok) setTickets(await tRes.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchTasks();
    fetchMetadata();
  }, []);

  const handleStatusChange = async (taskId: number, newStatus: Task["status"]) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
        if (activeTask && activeTask.id === taskId) {
          setActiveTask(updated);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          priority: formPriority,
          status: formStatus,
          assignee_id: formAssignee ? Number(formAssignee) : undefined,
          ticket_id: formTicketId ? Number(formTicketId) : undefined,
          estimated_minutes: Number(formEst) || 0,
          due_date: formDue || undefined,
        }),
      });

      if (res.ok) {
        setCreateModalOpen(false);
        setFormTitle("");
        setFormDesc("");
        setFormEst("60");
        setFormDue("");
        fetchTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddWorklog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask) return;
    const minutes = Number(logMinutes);
    if (!minutes || minutes <= 0) return;

    try {
      const res = await fetch(`/api/tasks/${activeTask.id}/worklogs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minutes_spent: minutes,
          description: logDesc.trim(),
        }),
      });
      if (res.ok) {
        setLogDesc("");
        // Reload task detail
        const updatedRes = await fetch(`/api/tasks/${activeTask.id}`);
        if (updatedRes.ok) {
          const updated = await updatedRes.json();
          setActiveTask(updated);
          setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const openTaskDetail = async (task: Task) => {
    try {
      const res = await fetch(`/api/tasks/${task.id}`);
      if (res.ok) {
        setActiveTask(await res.json());
      } else {
        setActiveTask(task);
      }
    } catch {
      setActiveTask(task);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (search.trim()) {
      const s = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(s) ||
        t.task_number.toLowerCase().includes(s) ||
        (t.description && t.description.toLowerCase().includes(s))
      );
    }
    return true;
  });

  const todoCount = tasks.filter((t) => ["backlog", "todo"].includes(t.status)).length;
  const inProgressCount = tasks.filter((t) => ["in_progress", "review"].includes(t.status)).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="eyebrow">İŞ AKIŞI & TAKIM YÖNETİMİ</div>
          <h1 style={{ margin: "4px 0" }}>Şirket İçi Görevler & Kanban</h1>
          <p className="muted" style={{ margin: 0 }}>
            Destek istemlerine bağlı alt teknik görevleri ve şirket içi operasyonel süreçleri yönetin.
          </p>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          {/* View Toggle */}
          <div style={{ display: "flex", background: "var(--card-bg)", border: "1px solid var(--card-border)", borderRadius: 10, padding: 3 }}>
            <button
              type="button"
              onClick={() => setViewMode("kanban")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                border: "none",
                borderRadius: 8,
                background: viewMode === "kanban" ? "var(--brand-sky, #3b4cb8)" : "transparent",
                color: viewMode === "kanban" ? "#fff" : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <Kanban size={16} /> Kanban
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 14px",
                border: "none",
                borderRadius: 8,
                background: viewMode === "list" ? "var(--brand-sky, #3b4cb8)" : "transparent",
                color: viewMode === "list" ? "#fff" : "var(--text-secondary)",
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              <ListFilter size={16} /> Liste
            </button>
          </div>

          <button
            type="button"
            className="primary"
            onClick={() => setCreateModalOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 18px" }}
          >
            <Plus size={18} /> Yeni Görev
          </button>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="stats">
        <div className="stat stat-primary">
          <div className="stat-header">
            <span className="stat-label">Toplam Görev</span>
            <div className="stat-icon stat-icon-primary"><Kanban size={22} /></div>
          </div>
          <div className="stat-number">{tasks.length}</div>
          <small className="stat-caption">Kayıtlı şirket içi task</small>
        </div>

        <div className="stat stat-info">
          <div className="stat-header">
            <span className="stat-label">Bekleyen / Yapılacak</span>
            <div className="stat-icon stat-icon-info"><Clock size={22} /></div>
          </div>
          <div className="stat-number">{todoCount}</div>
          <small className="stat-caption">Backlog ve to-do havuzu</small>
        </div>

        <div className="stat stat-warning">
          <div className="stat-header">
            <span className="stat-label">Aktif İşlemde</span>
            <div className="stat-icon stat-icon-warning"><Play size={22} /></div>
          </div>
          <div className="stat-number">{inProgressCount}</div>
          <small className="stat-caption">Geliştirme ve incelemede</small>
        </div>

        <div className="stat stat-success">
          <div className="stat-header">
            <span className="stat-label">Tamamlanan</span>
            <div className="stat-icon stat-icon-success"><CheckCircle2 size={22} /></div>
          </div>
          <div className="stat-number">{doneCount}</div>
          <small className="stat-caption">Başarıyla kapatılan görevler</small>
        </div>
      </div>

      {/* Filters Bar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", background: "var(--card-bg)", padding: 14, borderRadius: 14, border: "1px solid var(--card-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 220, position: "relative" }}>
          <Search size={18} style={{ position: "absolute", left: 12, color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="Görev ara (başlık, TSK numarası veya detay)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", paddingLeft: 38 }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Filter size={16} color="var(--text-muted)" />
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ minWidth: 140 }}
          >
            <option value="all">Tüm Öncelikler</option>
            <option value="urgent">Acil</option>
            <option value="high">Yüksek</option>
            <option value="medium">Orta</option>
            <option value="low">Düşük</option>
          </select>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === "kanban" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(260px, 1fr))", gap: 16, overflowX: "auto", paddingBottom: 16 }}>
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.status === col.key);
            return (
              <div
                key={col.key}
                style={{
                  background: "var(--card-bg)",
                  border: "1px solid var(--card-border)",
                  borderRadius: 16,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  minHeight: 500,
                  boxShadow: "var(--card-shadow)",
                }}
              >
                {/* Column Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 10, borderBottom: `2px solid ${col.color}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: col.color }} />
                    <strong style={{ fontSize: 14, color: "var(--text-primary)" }}>{col.label}</strong>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "2px 8px", background: "rgba(100, 116, 139, 0.12)", borderRadius: 12 }}>
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards Container */}
                <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                  {colTasks.map((t) => {
                    const pBadge = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium;
                    return (
                      <div
                        key={t.id}
                        onClick={() => openTaskDetail(t)}
                        style={{
                          background: "var(--workspace-bg, #f8fafc)",
                          border: "1px solid var(--card-border)",
                          borderRadius: 12,
                          padding: 14,
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          display: "flex",
                          flexDirection: "column",
                          gap: 10,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--brand-sky, #3b4cb8)" }}>
                            {t.task_number}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: pBadge.bg, color: pBadge.color }}>
                            {pBadge.label}
                          </span>
                        </div>

                        <div style={{ fontWeight: 600, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.4 }}>
                          {t.title}
                        </div>

                        {t.ticket_title && (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                            <Ticket size={13} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {t.ticket_title}
                            </span>
                          </div>
                        )}

                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 8, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-secondary)" }}>
                            <User size={14} />
                            <span>{t.assignee_name || "Atanmadı"}</span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600, color: "var(--brand-coral, #eb5545)" }}>
                            <Clock size={13} />
                            <span>{t.total_logged_minutes} dk</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {colTasks.length === 0 && (
                    <div style={{ textAlign: "center", padding: "30px 10px", color: "var(--text-muted)", fontSize: 13, border: "1px dashed var(--card-border)", borderRadius: 10 }}>
                      Görev yok
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List / Table View */
        <div className="table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>No</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Başlık</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Öncelik</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Durum</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Sorumlu</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>Harcanan Süre</th>
                <th style={{ textAlign: "left", padding: "12px 16px" }}>İlişkili Bilet</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.map((t) => {
                const pBadge = PRIORITY_BADGES[t.priority] || PRIORITY_BADGES.medium;
                const col = COLUMNS.find((c) => c.key === t.status);
                return (
                  <tr key={t.id} onClick={() => openTaskDetail(t)} style={{ cursor: "pointer" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--brand-sky)" }}>{t.task_number}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{t.title}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: pBadge.bg, color: pBadge.color }}>
                        {pBadge.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: col?.color }}>{col?.label}</span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>{t.assignee_name || "—"}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>{t.total_logged_minutes} dk</td>
                    <td style={{ padding: "12px 16px", color: "var(--text-muted)" }}>{t.ticket_title || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Task Modal */}
      {createModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <h2 style={{ margin: 0, fontSize: 20 }}>Yeni Şirket İçi Görev Oluştur</h2>
              <button type="button" onClick={() => setCreateModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <label>
                Görev Başlığı *
                <input
                  type="text"
                  required
                  placeholder="Örn: POS Entegrasyon loglarını incele"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </label>

              <label>
                Açıklama / Notlar
                <textarea
                  rows={3}
                  placeholder="Görevin detayları, adımları ve beklenen çıktılar..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  Öncelik
                  <select value={formPriority} onChange={(e: any) => setFormPriority(e.target.value)}>
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </label>

                <label>
                  Başlangıç Durumu
                  <select value={formStatus} onChange={(e: any) => setFormStatus(e.target.value)}>
                    <option value="backlog">Backlog</option>
                    <option value="todo">Yapılacak (To Do)</option>
                    <option value="in_progress">İşlemde</option>
                    <option value="review">İnceleme/Test</option>
                    <option value="done">Tamamlandı</option>
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  Sorumlu Personel
                  <select value={formAssignee} onChange={(e) => setFormAssignee(e.target.value)}>
                    <option value="">Atanmamış</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} ({u.org_name || u.role})</option>
                    ))}
                  </select>
                </label>

                <label>
                  İlişkili Destek Bileti
                  <select value={formTicketId} onChange={(e) => setFormTicketId(e.target.value)}>
                    <option value="">Bağımsız Görev (Biletsiz)</option>
                    {tickets.map((t) => (
                      <option key={t.id} value={t.id}>#{t.id} - {t.title}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label>
                  Tahmini Efor (Dakika)
                  <input
                    type="number"
                    min="0"
                    step="15"
                    value={formEst}
                    onChange={(e) => setFormEst(e.target.value)}
                  />
                </label>

                <label>
                  Hedef Bitiş Tarihi
                  <input
                    type="date"
                    value={formDue}
                    onChange={(e) => setFormDue(e.target.value)}
                  />
                </label>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
                <button type="button" className="secondary" onClick={() => setCreateModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className="primary">
                  Görevi Başlat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Detail & Worklogs Modal */}
      {activeTask && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 640 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--brand-sky)" }}>{activeTask.task_number}</span>
                <h2 style={{ margin: "4px 0 0", fontSize: 20 }}>{activeTask.title}</h2>
              </div>
              <button type="button" onClick={() => setActiveTask(null)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={20} />
              </button>
            </div>

            {/* Quick Status Bar */}
            <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 12, marginBottom: 16, borderBottom: "1px solid var(--card-border)" }}>
              {COLUMNS.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => handleStatusChange(activeTask.id, c.key)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: activeTask.status === c.key ? `2px solid ${c.color}` : "1px solid var(--card-border)",
                    background: activeTask.status === c.key ? c.color : "transparent",
                    color: activeTask.status === c.key ? "#fff" : "var(--text-secondary)",
                    fontWeight: 600,
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Task Info Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, background: "var(--workspace-bg)", padding: 14, borderRadius: 10, marginBottom: 18 }}>
              <div>
                <small className="muted">Sorumlu:</small>
                <div style={{ fontWeight: 600 }}>{activeTask.assignee_name || "Atanmadı"}</div>
              </div>
              <div>
                <small className="muted">Oluşturan:</small>
                <div style={{ fontWeight: 600 }}>{activeTask.reporter_name || "—"}</div>
              </div>
              <div>
                <small className="muted">Toplam Harcanan Süre:</small>
                <div style={{ fontWeight: 700, color: "var(--brand-coral)" }}>{activeTask.total_logged_minutes} Dakika</div>
              </div>
              <div>
                <small className="muted">Tahmini Süre:</small>
                <div>{activeTask.estimated_minutes} Dakika</div>
              </div>
            </div>

            {activeTask.description && (
              <div style={{ marginBottom: 18 }}>
                <strong style={{ fontSize: 13 }}>Açıklama:</strong>
                <p style={{ margin: "6px 0", fontSize: 14, lineHeight: 1.5, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>
                  {activeTask.description}
                </p>
              </div>
            )}

            {/* Worklogs Section */}
            <div style={{ borderTop: "1px solid var(--card-border)", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <strong style={{ fontSize: 14 }}>⏱ Çalışma Günlüğü (Worklogs)</strong>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{activeTask.worklogs?.length || 0} kayıt</span>
              </div>

              {/* Add Worklog Form */}
              <form onSubmit={handleAddWorklog} style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "flex-end" }}>
                <label style={{ width: 110 }}>
                  <small>Dakika</small>
                  <input
                    type="number"
                    min="5"
                    step="5"
                    value={logMinutes}
                    onChange={(e) => setLogMinutes(e.target.value)}
                    required
                  />
                </label>
                <label style={{ flex: 1 }}>
                  <small>Açıklama / Yapılan İşlem</small>
                  <input
                    type="text"
                    placeholder="Örn: Loglar incelendi, hata bulundu..."
                    value={logDesc}
                    onChange={(e) => setLogDesc(e.target.value)}
                  />
                </label>
                <button type="submit" className="primary" style={{ padding: "10px 14px", height: 42 }}>
                  Süre Ekle
                </button>
              </form>

              {/* Worklog History List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 180, overflowY: "auto" }}>
                {activeTask.worklogs && activeTask.worklogs.length > 0 ? (
                  activeTask.worklogs.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "8px 12px",
                        background: "var(--workspace-bg)",
                        borderRadius: 8,
                        fontSize: 13,
                      }}
                    >
                      <div>
                        <strong>{w.user_name || "Personel"}</strong>: {w.description || "Zaman kaydı"}
                      </div>
                      <div style={{ fontWeight: 700, color: "var(--brand-coral)" }}>
                        +{w.minutes_spent} dk
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", padding: "12px 0" }}>
                    Henüz zaman kaydı eklenmedi.
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
              <button type="button" className="secondary" onClick={() => setActiveTask(null)}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
