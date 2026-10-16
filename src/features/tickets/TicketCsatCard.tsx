import React, { useState } from "react";
import { Star, Send, CheckCircle2, MessageSquareQuote, Award } from "lucide-react";
import { tr, date, useLanguage } from "../../i18n/index.js";
import { submitTicketCsat } from "./tickets.api";
import type { Ticket, User } from "../../lib/types";

interface TicketCsatCardProps {
  ticket: Ticket;
  user: User;
  onRated?: (csat: any) => void;
}

export default function TicketCsatCard({ ticket, user, onRated }: TicketCsatCardProps) {
  useLanguage();
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localCsat, setLocalCsat] = useState<any>(ticket.csat || null);

  // CSAT is only available once the ticket is closed
  if (ticket.status !== "closed") {
    return null;
  }

  const csat = localCsat || ticket.csat;
  const isCustomer = user.role === "customer";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating || rating < 1 || rating > 5) {
      setError(tr("invalid_rating"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await submitTicketCsat(String(ticket.id), {
        rating,
        comment: comment.trim(),
      });
      const createdCsat = {
        rating,
        comment: comment.trim(),
        created_at: new Date().toISOString(),
        customer_name: user.name,
      };
      setLocalCsat(createdCsat);
      onRated?.(createdCsat);
    } catch (err: any) {
      setError(err?.message || tr("action_failed"));
    } finally {
      setBusy(false);
    }
  };

  const activeStarCount = hoverRating || rating;

  // View 1: Customer has already submitted CSAT or newly submitted
  if (csat) {
    return (
      <section className="panel detail-section csat-card csat-rated" data-testid="csat-rated-card">
        <div className="csat-header">
          <div className="csat-title-wrap">
            <span className="csat-badge">
              <Award size={15} />
              {tr("csat_satisfaction_survey")}
            </span>
            <h3>{tr("csat_card_title")}</h3>
          </div>
          <span className="csat-score-pill">
            ★ {csat.rating} / 5
          </span>
        </div>

        <div className="csat-stars-display" aria-label={`Rating: ${csat.rating} out of 5`}>
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              size={22}
              className={s <= csat.rating ? "star-icon filled" : "star-icon empty"}
              fill={s <= csat.rating ? "#f59e0b" : "none"}
              color={s <= csat.rating ? "#f59e0b" : "#cbd5e1"}
            />
          ))}
          <strong className="csat-rating-text">
            {tr(`csat_rating_${csat.rating}`)}
          </strong>
        </div>

        {csat.comment ? (
          <div className="csat-quote">
            <MessageSquareQuote size={18} className="quote-icon" />
            <p>{csat.comment}</p>
          </div>
        ) : null}

        <div className="csat-meta">
          <span>
            {csat.customer_name ? `${csat.customer_name} · ` : ""}
            {csat.created_at ? date(csat.created_at) : ""}
          </span>
          {isCustomer && (
            <p className="csat-thankyou-sub">
              <CheckCircle2 size={15} />
              {tr("csat_thank_you_sub")}
            </p>
          )}
        </div>
      </section>
    );
  }

  // View 2: Customer can fill out the CSAT survey
  if (isCustomer) {
    return (
      <section className="panel detail-section csat-card csat-form-card" data-testid="csat-form-card">
        <div className="csat-header">
          <div className="csat-title-wrap">
            <span className="csat-badge">
              <Award size={15} />
              {tr("csat_satisfaction_survey")}
            </span>
            <h3>{tr("csat_how_satisfied")}</h3>
          </div>
        </div>

        {error && (
          <div role="alert" className="error" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="csat-interactive-stars" role="radiogroup" aria-label="Rating stars">
            {[1, 2, 3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                className={`csat-star-btn ${s <= activeStarCount ? "active" : ""}`}
                onClick={() => setRating(s)}
                onMouseEnter={() => setHoverRating(s)}
                onMouseLeave={() => setHoverRating(0)}
                aria-label={tr(`csat_rating_${s}`)}
                aria-checked={rating === s}
                role="radio"
              >
                <Star
                  size={28}
                  fill={s <= activeStarCount ? "#f59e0b" : "none"}
                  color={s <= activeStarCount ? "#f59e0b" : "#cbd5e1"}
                />
              </button>
            ))}
            {activeStarCount > 0 && (
              <span className="csat-rating-indicator">
                {tr(`csat_rating_${activeStarCount}`)}
              </span>
            )}
          </div>

          <label className="csat-textarea-label">
            <span>{tr("csat_customer_feedback")}</span>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={tr("csat_feedback_placeholder")}
              rows={3}
              maxLength={1000}
              disabled={busy}
            />
          </label>

          <div className="csat-actions">
            <button
              type="submit"
              className="primary"
              disabled={busy || rating === 0}
            >
              {busy ? (
                tr("csat_submitting")
              ) : (
                <>
                  <Send size={15} />
                  {tr("csat_submit")}
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    );
  }

  // View 3: Support staff / Dealer / Admin viewing ticket when customer has not yet rated
  return (
    <section className="panel detail-section csat-card csat-pending">
      <div className="csat-header">
        <div className="csat-title-wrap">
          <span className="csat-badge">
            <Award size={15} />
            {tr("csat_satisfaction_survey")}
          </span>
          <h3>{tr("csat_card_title")}</h3>
        </div>
      </div>
      <p className="csat-pending-note">
        {tr("csat_not_rated_yet")}
      </p>
    </section>
  );
}
