import { ResponsiveContainer } from "recharts";

const INITIAL_DIMENSION = { width: 1, height: 1 };

export default function ResponsiveChart({ children, ...props }) {
  return <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL_DIMENSION} {...props}>{children}</ResponsiveContainer>;
}
