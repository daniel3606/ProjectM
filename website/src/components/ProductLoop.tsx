import styles from "./ProductLoop.module.css";

const STEPS = [
  {
    title: "Reduce screen time",
    body: "Block distracting apps when you need to focus.",
  },
  {
    title: "Complete focus goals",
    body: "Finish Quick Blocks or scheduled Timed Blocks.",
  },
  {
    title: "Grow your Marshmallow",
    body: "Every completed session adds real growth.",
  },
  {
    title: "See long-term progress",
    body: "Watch focus compound into something you can see.",
  },
] as const;

export default function ProductLoop() {
  return (
    <section id="how-it-works" className={styles.section} aria-labelledby="loop-heading">
      <div className="container">
        <div className={styles.intro}>
          <h2 id="loop-heading">A simple loop that rewards focus</h2>
          <p>Less phone time becomes visible progress — not another streak counter.</p>
        </div>

        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.index} aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {index < STEPS.length - 1 ? (
                <span className={styles.arrow} aria-hidden="true">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
