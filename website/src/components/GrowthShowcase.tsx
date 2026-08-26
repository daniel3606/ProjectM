"use client";

import { useEffect, useState } from "react";
import { SHOWCASE_STAGES } from "@/constants/growthStages";
import MarshmallowMark from "@/components/MarshmallowMark";
import styles from "./GrowthShowcase.module.css";

export default function GrowthShowcase() {
  const [active, setActive] = useState(0);
  const stage = SHOWCASE_STAGES[active];

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const timer = window.setInterval(() => {
      setActive((i) => (i + 1) % SHOWCASE_STAGES.length);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  const marshmallowSize = 72 + active * 18;

  return (
    <section id="growth" className={styles.section} aria-labelledby="growth-heading">
      <div className={`container ${styles.layout}`}>
        <div className={styles.copy}>
          <h2 id="growth-heading">Watch your Marshmallow grow</h2>
          <p>
            Focus sessions add centimeters. Compare your marshmallow to real-world objects
            and see how far you&apos;ve come.
          </p>

          <div className={styles.stageList} role="group" aria-label="Growth stages">
            {SHOWCASE_STAGES.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className={[styles.stageButton, index === active ? styles.active : ""].join(
                  " ",
                )}
                onClick={() => setActive(index)}
                aria-pressed={index === active}
              >
                <span className={styles.stageSize}>{item.sizeCm}cm</span>
                <span className={styles.stageName}>{item.objectName}</span>
              </button>
            ))}
          </div>
        </div>

        <div className={styles.canvas} aria-live="polite">
          <div className={styles.ground} />
          <div className={styles.compareRow}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={stage.id}
              src={`/objects/${stage.id}.png`}
              alt=""
              width={96}
              height={96}
              className={styles.object}
            />
            <div
              className={styles.marshmallow}
              style={{ ["--m-size" as string]: `${marshmallowSize}px` }}
            >
              <MarshmallowMark size={marshmallowSize} />
            </div>
          </div>
          <p className={styles.caption}>
            <strong>{stage.objectName}</strong>
            <span>{stage.message}</span>
          </p>
        </div>
      </div>
    </section>
  );
}
