import Image from "next/image";
import { Suspense } from "react";
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
          <div id="waitlist" className={`scroll-anchor ${styles.formWrap}`}>
            <Suspense fallback={<WaitlistFallback />}>
              <WaitlistForm id="waitlist-hero" />
            </Suspense>
          </div>
        </div>

        <div className={styles.visual}>
          <div className={styles.phone}>
            <div className={styles.phoneChrome}>
              <Image
                src="/screenshots/focus-session.png"
                alt="The Marshmallow app starting a focus session: Flexible or Deep Focus mode, the apps being blocked, and a 30 minute block duration."
                width={720}
                height={1565}
                sizes="(max-width: 900px) 74vw, 320px"
                className={styles.screen}
                priority
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
