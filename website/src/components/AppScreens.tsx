import Image from "next/image";
import styles from "./AppScreens.module.css";

const SCREENS = [
  {
    src: "/screenshots/timed-block-new.png",
    alt: "Creating a timed block in the Marshmallow app: a label, the expected growth for an eight hour block, focus mode, and the apps to block.",
    title: "Plan blocks ahead",
    body: "Name a block, pick the day and the hours, and see the growth it will earn before you commit.",
  },
  {
    src: "/screenshots/customize.png",
    alt: "The Marshmallow app's customize screen, showing the marshmallow character above eight color choices.",
    title: "Make it yours",
    body: "Your marshmallow keeps its own look — pick a color and dress it up as it grows.",
  },
] as const;

/** Real device screenshots, cropped by the frame rather than by the file. */
export default function AppScreens() {
  return (
    <section id="screens" className={styles.section} aria-labelledby="screens-heading">
      <div className="container">
        <div className={styles.intro}>
          <h2 id="screens-heading">Inside the app</h2>
          <p>Actual screens from Marshmallow on iPhone.</p>
        </div>

        <ul className={styles.grid}>
          {SCREENS.map((screen) => (
            <li key={screen.title} className={styles.item}>
              <div className={styles.phone}>
                <div className={styles.chrome}>
                  <div className={styles.frame}>
                    <Image
                      src={screen.src}
                      alt={screen.alt}
                      fill
                      sizes="(max-width: 720px) 78vw, 300px"
                      className={styles.screen}
                    />
                  </div>
                </div>
              </div>
              <h3>{screen.title}</h3>
              <p>{screen.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
