import { Suspense } from "react";
import WaitlistForm from "@/components/WaitlistForm";
import styles from "./FinalCTA.module.css";

export default function FinalCTA() {
  return (
    <section id="waitlist-bottom" className={styles.section} aria-labelledby="final-cta-heading">
      <div className={`container ${styles.panel}`}>
        <h2 id="final-cta-heading">Take back your screen time</h2>
        <p className={styles.support}>Be one of the first to try Marshmallow.</p>
        <div className={styles.form}>
          <Suspense fallback={<div className={styles.skeleton} aria-hidden="true" />}>
            <WaitlistForm id="waitlist-final" />
          </Suspense>
        </div>
      </div>
    </section>
  );
}
