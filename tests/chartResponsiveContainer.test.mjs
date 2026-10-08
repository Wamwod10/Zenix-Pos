import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LineChart } from "recharts";

test("responsive charts do not warn before their parent is measured", async () => {
  const { createServer } = await import("vite");
  const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const { default: ResponsiveChart } = await server.ssrLoadModule("/src/components/ResponsiveChart.jsx");
    renderToStaticMarkup(React.createElement(ResponsiveChart, null, React.createElement(LineChart, { data: [] })));
  } finally {
    console.warn = originalWarn;
    await server.close();
  }
  assert.deepEqual(warnings, []);
});
