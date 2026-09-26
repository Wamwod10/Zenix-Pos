import test from "node:test";
import assert from "node:assert/strict";

test("StoreProvider exposes workspace readiness to route guards", async (t) => {
  let React, renderToStaticMarkup, createServer;
  try {
    React=(await import("react")).default;
    ({renderToStaticMarkup}=await import("react-dom/server"));
    ({createServer}=await import("vite"));
  } catch {
    t.skip("React/Vite dependencies are not installed in this audit sandbox");
    return;
  }

  const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  try {
    const { AuthProvider } = await server.ssrLoadModule("/src/context/AuthContext.jsx");
    const { StoreProvider, useStore } = await server.ssrLoadModule("/src/context/StoreContext.jsx");
    const Probe = () => {
      const store = useStore();
      return React.createElement("span", { "data-workspace-ready": String(store.workspaceReady) });
    };
    const html = renderToStaticMarkup(
      React.createElement(AuthProvider, null,
        React.createElement(StoreProvider, null, React.createElement(Probe))),
    );
    assert.match(html, /data-workspace-ready="false"/);
  } finally {
    await server.close();
  }
});
