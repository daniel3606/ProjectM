import type { Metadata } from "next";
import Link from "next/link";
import Footer from "@/components/Footer";
import styles from "./legal.module.css";

export const metadata: Metadata = {
  title: "Privacy — Marshmallow",
  description: "Privacy policy for Marshmallow.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPage() {
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
        <h1>Privacy</h1>
        <p className={styles.updated}>Last updated: August 25, 2026</p>
        <p>
          Marshmallow helps you reduce screen time and grow healthier focus habits.
          This page explains what information we collect for the waitlist and how we use it.
        </p>
        <h2>Waitlist email</h2>
        <p>
          If you join the waitlist, we store the email address you provide, an optional
          referral source (for example from a <code>?ref=</code> link), and the time you signed up.
          We use this information only to contact you about Marshmallow availability and related product updates.
        </p>
        <h2>Analytics and cookies</h2>
        <p>
          The marketing site is designed to work without requiring account cookies.
          If we add analytics later, we will update this policy before collecting additional data.
        </p>
        <h2>Contact</h2>
        <p>
          Questions about privacy can be sent to{" "}
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
