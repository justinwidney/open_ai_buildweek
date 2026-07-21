import { useEffect, type CSSProperties } from "react";
import type { DecisionChoiceDetails } from "./decisionCatalog";
import { fmtMoney } from "./format";
import "./CardInventory.css";

export interface InventoryCardItem {
  id: string;
  title: string;
  acquiredAge: number;
  details: DecisionChoiceDetails;
}

interface CardInventoryProps {
  cards: readonly InventoryCardItem[];
  onClose: () => void;
}

export function CardInventory({ cards, onClose }: CardInventoryProps) {
  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  return (
    <main className="card-inventory-layer" role="dialog" aria-modal="true" aria-labelledby="card-inventory-title">
      <section className="card-inventory">
        <header className="card-inventory__header">
          <button className="card-inventory__back" type="button" onClick={onClose}>
            <span aria-hidden="true">←</span> Back to journey
          </button>
          <div>
            <span className="eyebrow">Your collected choices</span>
            <h1 id="card-inventory-title">Inventory</h1>
            <p>{cards.length} card{cards.length === 1 ? "" : "s"} carried on this path</p>
          </div>
        </header>

        {cards.length === 0 ? (
          <div className="card-inventory__empty">
            <span aria-hidden="true">◇</span>
            <h2>Your deck is waiting</h2>
            <p>Choose a career, college major, or another card-style decision and it will be kept here.</p>
            <button className="ornate-btn is-primary" type="button" onClick={onClose}>Return to the crossroads</button>
          </div>
        ) : (
          <div className="card-inventory__grid" aria-label="Collected decision cards">
            {cards.map((card, index) => (
              <article className="inventory-card" key={card.id} style={{ "--inventory-order": index } as CSSProperties}>
                <div className="inventory-card__art">
                  <img src={card.details.artwork?.src} alt="" />
                  <span>{card.details.kind === "major" ? "College path" : card.details.kind === "pet" ? "Companion" : "Career path"}</span>
                </div>
                <div className="inventory-card__copy">
                  <small>Chosen at age {card.acquiredAge}</small>
                  <h2>{card.title}</h2>
                  <p>{card.details.note}</p>
                  <dl>
                    <div><dt>{card.details.kind === "major" ? "Program estimate" : card.details.kind === "pet" ? "Homecoming setup" : "Starting cost"}</dt><dd>{fmtMoney(card.details.cost * 100)}</dd></div>
                    {card.details.kind === "pet"
                      ? <div><dt>Ongoing care</dt><dd>{fmtMoney((card.details.monthlyCost ?? 0) * 100)}/mo</dd></div>
                      : <div><dt>Expected starting pay</dt><dd>{fmtMoney(card.details.startingSalary * 100)}</dd></div>}
                  </dl>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
