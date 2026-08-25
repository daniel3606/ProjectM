import { Suspense } from "react";
import MarshmallowMark from "@/components/MarshmallowMark";
import WaitlistForm from "@/components/WaitlistForm";
import styles from "./Hero.module.css";

function WaitlistFallback() {
  return <div className={styles.formSkeleton} aria-hidden="true" />;
}

export default function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-heading">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.brand}>Marshmallow</p>
          <h1 id="hero-heading" className={styles.title}>
            Spend less time on your phone. Grow something instead.
          </h1>
          <p className={styles.subtitle}>
            Marshmallow turns reducing screen time into a visual growth journey —
            block distractions, finish focus sessions, and watch your marshmallow grow.
          </p>
          <div id="waitlist-hero" className={styles.formWrap}>
            <Suspense fallback={<WaitlistFallback />}>
              <WaitlistForm id="waitlist" />
            </Suspense>
          </div>
        </div>

        <div className={styles.visual} aria-hidden="true">
          <div className={styles.phone}>
            <div className={styles.phoneChrome}>
              <div className={styles.notch} />
              <div className={styles.phoneScreen}>
                <div className={styles.appHeader}>
                  <span>Marshmallow</span>
                  <span className={styles.avatar} />
                </div>
                <div className={styles.scene}>
                  <div className={styles.ruler}>
                    <span>12cm</span>
                    <span>8cm</span>
                    <span>4cm</span>
                  </div>
                  <div className={styles.stage}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/objects/donut.png"
                      alt=""
                      width={56}
                      height={56}
                      className={styles.compare}
                    />
                    <MarshmallowMark size={118} />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/objects/cupcake.png"
                      alt=""
                      width={48}
                      height={48}
                      className={styles.compare}
                    />
                  </div>
                  <p className={styles.sizeLabel}>A growing marshmallow · 10.5 cm</p>
                </div>
                <div className={styles.appCta}>Start Focus Session</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
