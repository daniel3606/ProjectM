import styles from "./MarshmallowMark.module.css";

type MarshmallowMarkProps = {
  size?: number;
  color?: string;
  className?: string;
  determined?: boolean;
  "aria-hidden"?: boolean | "true" | "false";
};

/** CSS recreation of the in-app marshmallow character. */
export default function MarshmallowMark({
  size = 160,
  color = "var(--color-marshmallow)",
  className,
  determined = false,
  "aria-hidden": ariaHidden = true,
}: MarshmallowMarkProps) {
  return (
    <div
      className={[styles.wrap, className].filter(Boolean).join(" ")}
      style={{ width: size, height: size * 1.11 }}
      aria-hidden={ariaHidden}
    >
      <div className={styles.shadow} />
      <div className={styles.body} style={{ backgroundColor: color }}>
        <span className={styles.shine} />
        <div className={styles.face}>
          <span className={styles.eye} />
          <span className={styles.eye} />
          {determined ? (
            <span className={styles.mouthFlat} />
          ) : (
            <span className={styles.mouth} />
          )}
        </div>
      </div>
    </div>
  );
}
