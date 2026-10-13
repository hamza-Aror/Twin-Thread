/**
 * The CoolRoute brand: the supplied logo (background removed and cropped, see
 * assets/brand/) plus the word mark. The image is never stretched: it is square
 * and always rendered at equal width and height.
 */
export function Brand({ size = 30 }: { size?: number }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src="/coolroute-mark-96.png" alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />
      <span className="font-sans text-[17px] font-semibold tracking-tight text-fg">CoolRoute</span>
    </span>
  );
}
