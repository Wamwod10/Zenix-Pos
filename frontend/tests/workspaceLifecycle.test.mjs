import test from "node:test";
import assert from "node:assert/strict";
import { isWorkspaceReadyFor, shouldHydrateWorkspace, workspaceIdentity } from "../src/utils/workspaceReadiness.js";

test("anonymous workspace data is not ready for a restored organization user", () => {
  const anonymousIdentity=workspaceIdentity(null);
  const restoredIdentity=workspaceIdentity({id:"user-1",organizationId:"org-1",appRole:"OWNER"});

  assert.equal(isWorkspaceReadyFor(restoredIdentity,anonymousIdentity),false);
});

test("workspace data loaded for another account is invalidated", () => {
  const firstIdentity=workspaceIdentity({id:"user-1",organizationId:"org-1",appRole:"OWNER"});
  const secondIdentity=workspaceIdentity({id:"user-2",organizationId:"org-2",appRole:"OWNER"});

  assert.equal(isWorkspaceReadyFor(secondIdentity,firstIdentity),false);
  assert.equal(isWorkspaceReadyFor(secondIdentity,secondIdentity),true);
});

test("switching accounts in the same organization starts a new workspace hydration", () => {
  const firstIdentity=workspaceIdentity({id:"user-1",organizationId:"org-1",appRole:"OWNER"});
  const secondIdentity=workspaceIdentity({id:"user-2",organizationId:"org-1",appRole:"MANAGER"});

  assert.equal(shouldHydrateWorkspace(secondIdentity,firstIdentity),true);
  assert.equal(shouldHydrateWorkspace(secondIdentity,secondIdentity),false);
});

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
