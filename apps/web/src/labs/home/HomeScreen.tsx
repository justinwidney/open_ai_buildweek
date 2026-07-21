import { useEffect, useState } from "react";
import "./HomeScreen.css";

const ROAD_SRC = "/home/road-backdrop.webp";
/** Two exports of one wash: the pigment you see, and a solidified copy that masks. */
const WASH_SRC = "/home/wash-01.webp";
const WASH_MASK_SRC = "/home/wash-mask.webp";
const PLATE_SRC = "/home/panel-start.svg";

/** Stage coordinate system. The scene is sliced to cover whatever the viewport is. */
const STAGE_W = 1600;
const STAGE_H = 900;

/** The exported wash is 668x720, so a drop's box has to keep that ratio to stay unsquashed. */
const WASH_ASPECT = 668 / 720;

interface Drop {
  /** Centre of the drop in stage units. */
  cx: number;
  cy: number;
  /** Height of the drop in stage units; width follows WASH_ASPECT. */
  size: number;
  /** Rotation keeps repeats of the one wash asset from reading as copies. */
  rotate: number;
  /** Milliseconds after the reveal starts that this drop lands. */
  delay: number;
  /** Hue shift, so the splats span peach through rose rather than all matching. */
  hue: number;
}

/** How long one drop takes to bloom to full size. Mirrors --drop-grow in the CSS. */
const DROP_GROW_MS = 1400;

// The first drop blooms alone in the middle of the stage and brings the title
// with it; the rest arrive on uneven beats so the scene fills in like paint
// being worked, not like a list playing out. Spread wide enough that the union
// already reads as the world before the unmasked backdrop closes the gaps.
const DROPS: readonly Drop[] = [
  { cx: 800, cy: 380, size: 720, rotate: -12, delay: 0, hue: 0 },
  { cx: 330, cy: 300, size: 600, rotate: 148, delay: 900, hue: -18 },
  { cx: 1240, cy: 430, size: 660, rotate: 62, delay: 1450, hue: 12 },
  { cx: 620, cy: 760, size: 560, rotate: -104, delay: 1900, hue: 24 },
  { cx: 1480, cy: 760, size: 540, rotate: 24, delay: 2500, hue: -30 },
  { cx: 150, cy: 720, size: 580, rotate: -158, delay: 2900, hue: 8 },
  { cx: 1030, cy: 120, size: 480, rotate: 96, delay: 3450, hue: -12 },
  { cx: 430, cy: 60, size: 460, rotate: -46, delay: 3900, hue: 18 },
];

/** The title rides in on the first drop, part-way through its bloom. */
const TITLE_DELAY_MS = Math.min(...DROPS.map((drop) => drop.delay)) + DROP_GROW_MS * 0.45;
/** The backdrop closes the gaps once the last drop is most of the way open. */
const FILL_DELAY_MS = Math.max(...DROPS.map((drop) => drop.delay)) + DROP_GROW_MS * 0.6;
const PLATE_DELAY_MS = FILL_DELAY_MS + 900;

interface Cloud {
  src: string;
  /** Vertical band in stage units. */
  y: number;
  width: number;
  /** Seconds for one full traverse; slower reads as further away. */
  duration: number;
  /** Negative offset so the sky is already populated on the first frame. */
  offset: number;
  opacity: number;
}

const CLOUDS: readonly Cloud[] = [
  { src: "/lab-assets/clouds/streak-large.png", y: 90, width: 520, duration: 190, offset: -40, opacity: 0.5 },
  { src: "/lab-assets/clouds/tower-glow.png", y: 30, width: 380, duration: 150, offset: -95, opacity: 0.42 },
  { src: "/lab-assets/clouds/wing-sunset.png", y: 210, width: 300, duration: 125, offset: -20, opacity: 0.38 },
  { src: "/lab-assets/clouds/lavender-puff.png", y: 150, width: 240, duration: 105, offset: -70, opacity: 0.34 },
  { src: "/lab-assets/clouds/golden-ribbon.png", y: 280, width: 420, duration: 165, offset: -130, opacity: 0.3 },
];

function dropBox(drop: Drop) {
  const width = drop.size * WASH_ASPECT;
  return { width, height: drop.size, x: drop.cx - width / 2, y: drop.cy - drop.size / 2 };
}

/** Decode the two heavy layers up front so the reveal never plays against a blank stage. */
function usePreloadedArt(sources: readonly string[]) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const load = (src: string) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve(); // a missing asset should not strand the screen
        img.src = src;
      });

    void Promise.all(sources.map(load)).then(() => {
      if (live) setReady(true);
    });

    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ready;
}

interface HomeScreenProps {
  onStart: () => void;
}

export function HomeScreen({ onStart }: HomeScreenProps) {
  const ready = usePreloadedArt([ROAD_SRC, WASH_SRC, WASH_MASK_SRC]);

  return (
    <div
      className={`home${ready ? " is-ready" : ""}`}
      style={
        {
          "--drop-grow": `${DROP_GROW_MS}ms`,
          "--title-delay": `${TITLE_DELAY_MS}ms`,
          "--fill-delay": `${FILL_DELAY_MS}ms`,
          "--plate-delay": `${PLATE_DELAY_MS}ms`,
        } as React.CSSProperties
      }
    >
      <svg
        className="home__stage"
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          {/* mask-type:alpha means the wash's own feathered edge is the reveal
              shape. As each drop animates in, the backdrop appears under it. */}
          <mask id="home-reveal" className="home__reveal-mask">
            {DROPS.map((drop, index) => {
              const box = dropBox(drop);
              return (
                <image
                  key={index}
                  className="home__drop"
                  href={WASH_MASK_SRC}
                  x={box.x}
                  y={box.y}
                  width={box.width}
                  height={box.height}
                  preserveAspectRatio="xMidYMid meet"
                  style={{ "--rotate": `${drop.rotate}deg`, "--delay": `${drop.delay}ms` } as React.CSSProperties}
                />
              );
            })}
          </mask>
        </defs>

        {/* Revealed through the drops as they land... */}
        <image
          className="home__road"
          href={ROAD_SRC}
          width={STAGE_W}
          height={STAGE_H}
          preserveAspectRatio="xMidYMid slice"
          mask="url(#home-reveal)"
        />
        {/* ...then the same art, unmasked, fades in behind to close the gaps. */}
        <image
          className="home__road home__road--fill"
          href={ROAD_SRC}
          width={STAGE_W}
          height={STAGE_H}
          preserveAspectRatio="xMidYMid slice"
        />

        <g className="home__sky">
          {CLOUDS.map((cloud, index) => (
            <image
              key={index}
              className="home__cloud"
              href={cloud.src}
              x={-cloud.width}
              y={cloud.y}
              width={cloud.width}
              preserveAspectRatio="xMidYMid meet"
              style={
                {
                  "--duration": `${cloud.duration}s`,
                  "--offset": `${cloud.offset}s`,
                  "--travel": `${STAGE_W + cloud.width * 2}px`,
                  opacity: cloud.opacity,
                } as React.CSSProperties
              }
            />
          ))}
        </g>

        {/* The pigment itself, over the art it revealed, drying away to nothing. */}
        <g className="home__ink">
          {DROPS.map((drop, index) => {
            const box = dropBox(drop);
            return (
              <image
                key={index}
                className="home__drop home__drop--ink"
                href={WASH_SRC}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                preserveAspectRatio="xMidYMid meet"
                style={
                  {
                    "--rotate": `${drop.rotate}deg`,
                    "--delay": `${drop.delay}ms`,
                    "--hue": `${drop.hue}deg`,
                  } as React.CSSProperties
                }
              />
            );
          })}
        </g>
      </svg>

      <h1 className="home__title">Conquer Your Path</h1>

      <div className="home__plate">
        <button type="button" className="home__start" onClick={onStart}>
          <img className="home__start-plate" src={PLATE_SRC} alt="" aria-hidden="true" />
          <span className="home__start-label">Start Journey</span>
        </button>
      </div>
    </div>
  );
}
