import styles from "./FeatureSection.module.css";

const FEATURES = [
  {
    title: "App blocking",
    body: "Silence the apps that pull you back in while you focus.",
  },
  {
    title: "Quick Block",
    body: "Start a focus session in seconds when you need it now.",
  },
  {
    title: "Timed Block",
    body: "Schedule recurring blocks ahead and keep your day protected.",
  },
  {
    title: "Deep Focus",
    body: "Choose a stricter mode that grows your marshmallow faster.",
  },
  {
    title: "Marshmallow growth",
    body: "Completed sessions turn into centimeters you can see.",
  },
  {
    title: "Long-term progress",
    body: "Compare your size to everyday objects as habits stack up.",
  },
] as const;

export default function FeatureSection() {
  return (
    <section id="features" className={styles.section} aria-labelledby="features-heading">
      <div className="container">
        <div className={styles.intro}>
          <h2 id="features-heading">Built for focus that sticks</h2>
          <p>The essentials from the Marshmallow app — nothing extra.</p>
        </div>

        <ul className={styles.grid}>
          {FEATURES.map((feature) => (
            <li key={feature.title} className={styles.item}>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
