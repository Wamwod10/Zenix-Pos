import { cloneElement, isValidElement, useEffect, useRef, useState } from "react";

/**
 * Recharts' ResponsiveContainer may briefly measure a hidden dashboard card at
 * 0×0 (e.g. when the AI workspace opens) and log a width/height warning.
 * Render the chart itself only after its parent has actual positive dimensions.
 * Keep its canvas in the DOM so the observer can recover when shown again.
 */
export default function ResponsiveChart({ children, className, style, ...chartProps }) {
  const host = useRef(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return undefined;
    const measure = () => {
      const rect = node.getBoundingClientRect();
      const width = Math.floor(rect.width);
      const height = Math.floor(rect.height);
      setSize(previous => {
        const next = width > 1 && height > 1 ? { width, height } : null;
        if (previous?.width === next?.width && previous?.height === next?.height) return previous;
        return next;
      });
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    if (!observer) window.addEventListener("resize", measure);
    measure();
    return () => {
      observer?.disconnect();
      if (!observer) window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div ref={host} className={className} style={{ width: "100%", height: "100%", minWidth: 0, minHeight: 0, ...style }}>
      {size && isValidElement(children) ? cloneElement(children, { ...chartProps, width: size.width, height: size.height }) : null}
    </div>
  );
}
