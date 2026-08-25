import Icon, { type IconName } from "@/components/Icon";
import styles from "./FeatureSection.module.css";

/** Each icon is the one the app itself draws for that feature. */
const FEATURES: { title: string; body: string; icon: IconName }[] = [
  {
    title: "App blocking",
    body: "Silence the apps that pull you back in while you focus.",
    icon: "apps-outline",
  },
  {
    title: "Quick Block",
    body: "Start a focus session in seconds when you need it now.",
    icon: "timer-outline",
  },
  {
    title: "Timed Block",
    body: "Schedule recurring blocks ahead and keep your day protected.",
    icon: "hourglass-outline",
  },
  {
    title: "Deep Focus",
    body: "Choose a stricter mode that grows your marshmallow faster.",
    icon: "lock-closed",
  },
  {
    title: "Marshmallow growth",
    body: "Completed sessions turn into centimeters you can see.",
    icon: "sparkles",
  },
  {
    title: "Long-term progress",
    body: "Compare your size to everyday objects as habits stack up.",
    icon: "stats-chart",
  },
];

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
              <span className={styles.icon}>
                <Icon name={feature.icon} size={22} />
              </span>
              <h3>{feature.title}</h3>
              <p>{feature.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
