import test from "node:test";
import assert from "node:assert/strict";

test("Sales renders before effects run", async (t) => {
  let React, renderToStaticMarkup, MemoryRouter, createServer;
  try {
    React=(await import("react")).default;
    ({renderToStaticMarkup}=await import("react-dom/server"));
    ({MemoryRouter}=await import("react-router-dom"));
    ({createServer}=await import("vite"));
  } catch {
    t.skip("React/Vite dependencies are not installed in this audit sandbox");
    return;
  }

  const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  try {
    const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
    const { StoreProvider } = await server.ssrLoadModule("/src/context/StoreContext.jsx");
    const { FeedbackProvider } = await server.ssrLoadModule("/src/context/FeedbackContext.jsx");
    const { default: Sales } = await server.ssrLoadModule("/src/pages/sales/Sales.jsx");
    const html = renderToStaticMarkup(
      React.createElement(AuthProvider, null,
        React.createElement(StoreProvider, null,
          React.createElement(FeedbackProvider, null,
            React.createElement(MemoryRouter, null, React.createElement(Sales))))),
    );
    assert.match(html, /Savdo/);
  } finally {
    await server.close();
  }
});
