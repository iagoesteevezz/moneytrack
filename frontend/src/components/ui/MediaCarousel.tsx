import styles from './MediaCarousel.module.css'

// ── Image lists — 4 per column, duplicated for infinite loop ──

const col1Images = [
  '/assets/image1.jpg',
  '/assets/image2.webp',
  '/assets/image5.gif',
  '/assets/image4.gif',
]

const col2Images = [
  '/assets/image3.jpg',
  '/assets/image6.gif',
  '/assets/image7.gif',
  '/assets/image8.gif',
]

// Duplicate each list so the animation can loop seamlessly.
// The keyframe moves by -50%, which lands exactly on the clone.
const col1 = [...col1Images, ...col1Images]
const col2 = [...col2Images, ...col2Images]

// ── Component ─────────────────────────────────────────────────

export function MediaCarousel() {
  return (
    <div className={styles.wrap}>
      {/* Column 1 — scrolls down */}
      <div className={`${styles.col} ${styles.colDown}`}>
        {col1.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={styles.img}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>

      {/* Column 2 — scrolls up */}
      <div className={`${styles.col} ${styles.colUp}`}>
        {col2.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={styles.img}
            loading="lazy"
            draggable={false}
          />
        ))}
      </div>
    </div>
  )
}
