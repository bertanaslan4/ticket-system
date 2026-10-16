import React, { useState, useEffect } from "react";
import { Kanban, Plus, Clock, CheckCircle2, User, X } from "lucide-react";

interface Task {
  id: number;
  task_number: string;
  title: string;
  status: string;
  priority: string;
  assignee_name?: string;
  total_logged_minutes: number;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  backlog: { label: "Backlog", color: "#64748b" },
  todo: { label: "Yapılacak", color: "#3b82f6" },
  in_progress: { label: "İşlemde", color: "#f59e0b" },
  review: { label: "Test/İnceleme", color: "#8b5cf6" },
  done: { label: "Tamamlandı", color: "#10b981" },
};

export default function TicketSubtasks({ ticketId, user }: { ticketId: number; user: any }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [priority, setPriority] = useState("medium");
  const [estMinutes, setEstMinutes] = useState("60");
  const [users, setUsers] = useState<any[]>([]);
  const [assigneeId, setAssigneeId] = useState("");

  const go = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.href = path;
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await fetch(`/api/tasks?ticket_id=${ticketId}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setTasks(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (user.role !== "customer") {
      fetchTasks();
      fetch("/api/users")
        .then((r) => r.ok && r.json())
        .then((data) => data && setUsers(data))
        .catch(() => {});
    }
  }, [ticketId, user.role]);

  if (user.role === "customer") return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket_id: ticketId,
          title: title.trim(),
          description: desc.trim(),
          priority,
          status: "todo",
          assignee_id: assigneeId ? Number(assigneeId) : undefined,
          estimated_minutes: Number(estMinutes) || 0,
        }),
      });

      if (res.ok) {
        setTitle("");
        setDesc("");
        setModalOpen(false);
        fetchTasks();
      }
    } catch {}
  };

  return (
    <section className="panel detail-section" style={{ marginTop: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Kanban size={18} color="var(--brand-sky, #3b4cb8)" />
          <h2 style={{ margin: 0, fontSize: 16 }}>Şirket İçi Görevler (Sub-tasks)</h2>
        </div>
        <button
          type="button"
          className="secondary"
          onClick={() => setModalOpen(true)}
          style={{ padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
        >
          <Plus size={14} /> Görev Bağla
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(Array.isArray(tasks) ? tasks : []).map((task) => {
          const st = STATUS_LABELS[task.status] || STATUS_LABELS.todo;
          return (
            <div
              key={task.id}
              onClick={() => go("/tasks")}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: "var(--workspace-bg, #f8fafc)",
                borderRadius: 8,
                border: "1px solid var(--card-border)",
                cursor: "pointer",
              }}
            >
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-sky)" }}>
                  {task.task_number}
                </span>{" "}
                <strong style={{ fontSize: 13 }}>{task.title}</strong>
                <div style={{ display: "flex", gap: 10, fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                  <span>Sorumlu: {task.assignee_name || "—"}</span>
                  <span>Süre: {task.total_logged_minutes} dk</span>
                </div>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: `${st.color}20`,
                  color: st.color,
                }}
              >
                {st.label}
              </span>
            </div>
          );
        })}
        {tasks.length === 0 && (
          <p className="hint" style={{ margin: "4px 0", fontSize: 13 }}>
            Bu bilet için henüz iç operasyonel görev açılmadı.
          </p>
        )}
      </div>

      {modalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 500 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Bu Bilete Görev Bağla</h3>
              <button type="button" onClick={() => setModalOpen(false)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label>
                Görev Başlığı *
                <input
                  type="text"
                  required
                  placeholder="Örn: Hata kodunu incele ve düzelt"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>

              <label>
                Açıklama
                <textarea
                  rows={2}
                  placeholder="Teknik notlar..."
                  value={desc}
                  onChange={(e) => setDesc(e.target.value)}
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <label>
                  Öncelik
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="urgent">Acil</option>
                  </select>
                </label>

                <label>
                  Sorumlu Personel
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                    <option value="">Seçiniz (Opsiyonel)</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                Tahmini Efor (Dakika)
                <input
                  type="number"
                  min="0"
                  step="15"
                  value={estMinutes}
                  onChange={(e) => setEstMinutes(e.target.value)}
                />
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="secondary" onClick={() => setModalOpen(false)}>
                  İptal
                </button>
                <button type="submit" className="primary">
                  Görevi Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
