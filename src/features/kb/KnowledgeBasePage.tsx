import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { tr, useLanguage, date } from "../../i18n/index.js";
import { useAuth } from "../auth/AuthProvider";
import Modal from "../../components/Modal";
import QueryState from "../../components/QueryState";
import { BookOpen, Search, Plus, Eye, Pencil, Trash2 } from "lucide-react";

interface Article {
  id: number;
  title: string;
  slug: string;
  content?: string;
  category: string;
  is_public: boolean;
  view_count: number;
  created_at: string;
}

export default function KnowledgeBasePage() {
  useLanguage();
  const { user } = useAuth();
  const client = useQueryClient();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [readingArticle, setReadingArticle] = useState<Article | null>(null);
  const [editingArticle, setEditingArticle] = useState<Partial<Article> | null>(null);

  const query = useQuery({
    queryKey: ["kb", search, selectedCategory, user?.tenant_id],
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (search.trim()) params.append("q", search.trim());
      if (selectedCategory) params.append("category", selectedCategory);
      const qs = params.toString() ? `?${params.toString()}` : "";
      return api<Article[]>(`/kb${qs}`, undefined, signal);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["kb", "detail", readingArticle?.id],
    queryFn: ({ signal }) =>
      api<Article>(`/kb/${readingArticle!.id}`, undefined, signal),
    enabled: !!readingArticle?.id,
  });

  const saveMutation = useMutation({
    mutationFn: (body: Partial<Article>) =>
      api(
        body.id ? `/admin/kb/${body.id}` : "/admin/kb",
        body,
      ),
    onSuccess: async () => {
      setEditingArticle(null);
      await client.invalidateQueries({ queryKey: ["kb"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/admin/kb/${id}/delete`, {}),
    onSuccess: async () => {
      setReadingArticle(null);
      await client.invalidateQueries({ queryKey: ["kb"] });
    },
  });

  const isSuperAdmin = user?.role === "super_admin";

  const categories = ["general", "installation", "integration", "billing"];

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">{tr("knowledge_base")}</div>
          <h1>{tr("knowledge_base")}</h1>
          <p>{tr("knowledge_base_intro")}</p>
        </div>
        {isSuperAdmin && (
          <button
            type="button"
            className="primary"
            onClick={() =>
              setEditingArticle({
                title: "",
                content: "",
                category: "general",
                is_public: true,
              })
            }
          >
            <Plus size={16} />
            {tr("add_article")}
          </button>
        )}
      </div>

      <div
        className="panel"
        style={{
          padding: "16px 20px",
          marginBottom: 20,
          borderRadius: 12,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        <div style={{ flex: "1 1 260px", position: "relative" }}>
          <Search
            size={16}
            style={{
              position: "absolute",
              left: 10,
              top: 10,
              color: "#94a3b8",
            }}
          />
          <input
            type="search"
            placeholder={tr("search_articles")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, width: "100%" }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button
            type="button"
            className={selectedCategory === "" ? "primary" : "secondary"}
            style={{ fontSize: 12, padding: "5px 12px" }}
            onClick={() => setSelectedCategory("")}
          >
            Tümü
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              className={selectedCategory === cat ? "primary" : "secondary"}
              style={{ fontSize: 12, padding: "5px 12px" }}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {query.isPending || query.isError ? (
        <QueryState result={query} />
      ) : query.data.length === 0 ? (
        <div className="panel" style={{ textAlign: "center", padding: 32 }}>
          <BookOpen size={36} color="#64748b" style={{ margin: "0 auto 12px" }} />
          <p className="muted">{tr("no_articles_found")}</p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 14,
          }}
        >
          {query.data.map((art) => (
            <div
              key={art.id}
              className="panel"
              style={{
                cursor: "pointer",
                margin: 0,
                padding: "20px 22px",
                borderRadius: 12,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 16,
                transition: "all 0.2s ease",
              }}
              onClick={() => setReadingArticle(art)}
            >

              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                  }}
                >
                  <span className="badge open" style={{ fontSize: 11 }}>
                    {art.category}
                  </span>
                  {!art.is_public && (
                    <span className="badge closed" style={{ fontSize: 11 }}>
                      Özel (Taslak)
                    </span>
                  )}
                </div>
                <h3 style={{ fontSize: 16, margin: "6px 0 10px" }}>
                  {art.title}
                </h3>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  color: "#94a3b8",
                  borderTop: "1px solid #334155",
                  paddingTop: 8,
                  marginTop: 10,
                }}
              >
                <span>{date(art.created_at)}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Eye size={13} /> {art.view_count}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {readingArticle && (
        <Modal
          title={readingArticle.title}
          onClose={() => setReadingArticle(null)}
        >
          {detailQuery.isPending ? (
            <div role="status" className="loading">
              {tr("loading")}
            </div>
          ) : (
            <div className="detail-section">
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <span className="badge open">{detailQuery.data?.category}</span>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>
                  <Eye size={13} /> {detailQuery.data?.view_count} {tr("views")}
                </span>
              </div>

              <div
                style={{
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  fontSize: 14,
                  backgroundColor: "rgba(0,0,0,0.15)",
                  padding: 14,
                  borderRadius: 8,
                }}
              >
                {detailQuery.data?.content}
              </div>

              <div
                className="form-bottom"
                style={{ marginTop: 18, justifyContent: "space-between" }}
              >
                <div>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className="danger-button"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(readingArticle.id)}
                    >
                      <Trash2 size={14} />
                      {tr("delete_article")}
                    </button>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {isSuperAdmin && (
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => {
                        setEditingArticle(detailQuery.data || readingArticle);
                        setReadingArticle(null);
                      }}
                    >
                      <Pencil size={14} />
                      {tr("edit_article")}
                    </button>
                  )}
                  <button
                    type="button"
                    className="primary"
                    onClick={() => setReadingArticle(null)}
                  >
                    Kapat
                  </button>
                </div>
              </div>
            </div>
          )}
        </Modal>
      )}

      {editingArticle && (
        <Modal
          title={tr(editingArticle.id ? "edit_article" : "add_article")}
          busy={saveMutation.isPending}
          onClose={() => setEditingArticle(null)}
        >
          <form
            className="admin-form"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate(editingArticle);
            }}
          >
            <div className="form-row">
              <label>
                {tr("article_title")}
                <input
                  required
                  maxLength={255}
                  value={editingArticle.title || ""}
                  disabled={saveMutation.isPending}
                  onChange={(e) =>
                    setEditingArticle((prev) => ({
                      ...prev,
                      title: e.target.value,
                    }))
                  }
                />
              </label>
              <label>
                {tr("article_category")}
                <select
                  value={editingArticle.category || "general"}
                  disabled={saveMutation.isPending}
                  onChange={(e) =>
                    setEditingArticle((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label>
              {tr("article_content")}
              <textarea
                required
                rows={8}
                value={editingArticle.content || ""}
                disabled={saveMutation.isPending}
                onChange={(e) =>
                  setEditingArticle((prev) => ({
                    ...prev,
                    content: e.target.value,
                  }))
                }
              />
            </label>

            <label className="checkbox">
              <input
                type="checkbox"
                checked={editingArticle.is_public !== false}
                disabled={saveMutation.isPending}
                onChange={(e) =>
                  setEditingArticle((prev) => ({
                    ...prev,
                    is_public: e.target.checked,
                  }))
                }
              />
              {tr("article_is_public")}
            </label>

            <div className="form-bottom">
              <button
                type="button"
                className="secondary"
                disabled={saveMutation.isPending}
                onClick={() => setEditingArticle(null)}
              >
                {tr("cancel")}
              </button>
              <button className="primary" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? tr("saving") : tr("save")}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
