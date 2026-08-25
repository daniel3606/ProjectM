import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import styles from "../privacy/legal.module.css";

export const metadata: Metadata = {
  title: "Terms — Marshmallow",
  description: "Terms of use for the Marshmallow website and waitlist.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <>
      <header className={styles.top}>
        <div className={`container ${styles.topInner}`}>
          <Link href="/" className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon.png" alt="" width={32} height={32} />
            Marshmallow
          </Link>
        </div>
      </header>
      <main className={`container ${styles.main}`}>
        <h1>Terms</h1>
        <p className={styles.updated}>Last updated: August 25, 2026</p>
        <p>
          By using the Marshmallow website and joining the waitlist, you agree to these terms.
        </p>
        <h2>Waitlist</h2>
        <p>
          Joining the waitlist does not guarantee access, pricing, or launch timing.
          We may invite waitlist members in phases as the product becomes available.
        </p>
        <h2>Acceptable use</h2>
        <p>
          Do not abuse the waitlist form, attempt to scrape or extract user data, or interfere
          with the site&apos;s operation.
        </p>
        <h2>Changes</h2>
        <p>
          We may update these terms as Marshmallow evolves. Continued use of the site after
          changes means you accept the updated terms.
        </p>
        <h2>Contact</h2>
        <p>
          Questions can be sent to{" "}
          <a href="mailto:hello@themarshmallow.app">hello@themarshmallow.app</a>.
        </p>
        <p>
          <Link href="/">← Back to Marshmallow</Link>
        </p>
      </main>
      <Footer />
    </>
  );
}
