"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./Navbar.module.css";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={[styles.header, scrolled ? styles.scrolled : ""].join(" ")}>
      <div className={`container ${styles.inner}`}>
        <Link href="/" className={styles.brand} onClick={close}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/icon.png" alt="" width={36} height={36} className={styles.logo} />
          <span className={styles.wordmark}>Marshmallow</span>
        </Link>

        <nav className={styles.desktopNav} aria-label="Primary">
          <a href="#how-it-works">How it works</a>
          <a href="#growth">Growth</a>
          <a href="#features">Features</a>
          <a className={styles.cta} href="#waitlist">
            Join Waitlist
          </a>
        </nav>

        <button
          type="button"
          className={[styles.menuButton, open ? styles.menuButtonOpen : ""].join(" ")}
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          <span />
          <span />
        </button>
      </div>

      <div
        id="mobile-nav"
        className={[styles.mobileNav, open ? styles.mobileOpen : ""].join(" ")}
      >
        <nav aria-label="Mobile">
          <a href="#how-it-works" onClick={close}>
            How it works
          </a>
          <a href="#growth" onClick={close}>
            Growth
          </a>
          <a href="#features" onClick={close}>
            Features
          </a>
          <a className={styles.cta} href="#waitlist" onClick={close}>
            Join Waitlist
          </a>
        </nav>
      </div>
    </header>
  );
}
