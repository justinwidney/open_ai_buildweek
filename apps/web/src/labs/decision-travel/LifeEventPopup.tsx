import { branchEligibility, type DecisionBranch, type DecisionNode, type LifeContext } from "@control-ai/engine";
import { directionsForOptions, ROUTE_DIRECTION_LABELS, selectRouteMap } from "./decisionMaps";
import { isInertBranch, nodeEmoji, routeKindForNode } from "./journeyGraph";

interface LifeEventPopupProps {
  node: DecisionNode;
  ctx: LifeContext;
  age: number;
  onChoose: (branch: DecisionBranch) => void;
  /** Dismiss without choosing — only offered for optional opportunities. */
  onDismiss?: () => void;
  showMap?: boolean;
}

export function LifeEventPopup({ node, ctx, age, onChoose, onDismiss, showMap = true }: LifeEventPopupProps) {
  const routeKind = routeKindForNode(node);
  const decisionMap = selectRouteMap(routeKind, `${node.id}:${age}`);
  const directions = directionsForOptions(node.branches.length, routeKind);
  const isOpportunity = node.trigger === "opportunity";

  return (
    <div className="event-overlay" role="presentation">
      <div className={`scroll event-card ${showMap ? "event-card--with-map" : "event-card--choices-only"}`} role="dialog" aria-modal="true" aria-labelledby="decision-event-title">
        <div className="event-card__head">
          <div className="crest">♛</div>
          <div>
            <span className="eyebrow">{isOpportunity ? `An opportunity · age ${age}` : `A crossroads · age ${age}`}</span>
            <h2 className="dt-title" id="decision-event-title">{nodeEmoji(node)} {node.title}</h2>
          </div>
        </div>

        <div className={`event-card__layout${showMap ? "" : " is-choices-only"}`}>
          {showMap && <figure className="decision-map">
            <div className="decision-map__viewport">
              <img src={decisionMap.src} alt={`${decisionMap.label} watercolor route map`} />
              <span className={`decision-map__kind is-${routeKind}`}>{decisionMap.label}</span>
            </div>
            <figcaption>
              <span><b>Route preview</b> {routeKind.replaceAll("-", " ")}</span>
              <small>{decisionMap.id.replaceAll("_", " ")}</small>
            </figcaption>
          </figure>}

          <div className="event-card__choice">
            <p className="event-card__prompt">{node.prompt}</p>
            <div className="event-options">
              {node.branches.map((branch, index) => {
                const direction = directions[index] ?? "winding";
                const elig = branchEligibility(branch, ctx);
                const inert = isInertBranch(branch);
                return (
                  <button
                    key={branch.id}
                    className={`event-option is-${direction} ${inert ? "is-decline" : ""}`}
                    disabled={!elig.eligible}
                    title={elig.eligible ? undefined : elig.reasons.join(" ")}
                    onClick={() => onChoose(branch)}
                  >
                    <span className="event-option__route">{ROUTE_DIRECTION_LABELS[direction]}</span>
                    <strong>{branch.label}</strong>
                    <small>{elig.eligible ? branch.description : elig.reasons.join(" ")}</small>
                  </button>
                );
              })}
            </div>
            {isOpportunity && onDismiss && (
              <button className="ornate-btn event-card__dismiss" onClick={onDismiss}>Maybe later</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
