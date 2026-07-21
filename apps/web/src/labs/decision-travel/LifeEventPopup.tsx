import type { EventOption, LifeEvent } from "./lifeEvents";
import {
  directionsForOptions,
  ROUTE_DIRECTION_LABELS,
  selectDecisionMap,
} from "./decisionMaps";

interface LifeEventPopupProps {
  event: LifeEvent;
  age: number;
  onChoose: (option: EventOption) => void;
  showMap?: boolean;
}

export function LifeEventPopup({ event, age, onChoose, showMap = true }: LifeEventPopupProps) {
  const decisionMap = selectDecisionMap(event, age);
  const directions = directionsForOptions(event.options, event.routeKind);

  return (
    <div className="event-overlay" role="presentation">
      <div className={`scroll event-card ${showMap ? "event-card--with-map" : "event-card--choices-only"}`} role="dialog" aria-modal="true" aria-labelledby="decision-event-title">
        <div className="event-card__head">
          <div className="crest">♛</div>
          <div>
            <span className="eyebrow">{event.kind === "scheduled" ? `A crossroads · age ${age}` : `An unexpected turn · age ${age}`}</span>
            <h2 className="dt-title" id="decision-event-title">{event.emoji} {event.title}</h2>
          </div>
        </div>

        <div className={`event-card__layout${showMap ? "" : " is-choices-only"}`}>
          {showMap && <figure className="decision-map">
            <div className="decision-map__viewport">
              <img src={decisionMap.src} alt={`${decisionMap.label} watercolor route map`} />
              <span className={`decision-map__kind is-${event.routeKind}`}>{decisionMap.label}</span>
            </div>
            <figcaption>
              <span><b>Route preview</b> {event.routeKind.replaceAll("-", " ")}</span>
              <small>{decisionMap.id.replaceAll("_", " ")}</small>
            </figcaption>
          </figure>}

          <div className="event-card__choice">
            <p className="event-card__prompt">{event.prompt}</p>
            <div className="event-options">
              {event.options.map((opt, index) => {
                const direction = directions[index] ?? "winding";
                return (
                  <button key={opt.id} className={`event-option is-${direction} ${opt.build === null ? "is-decline" : ""}`} onClick={() => onChoose(opt)}>
                    <span className="event-option__route">{ROUTE_DIRECTION_LABELS[direction]}</span>
                    <strong>{opt.label}</strong>
                    <small>{opt.description}</small>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
