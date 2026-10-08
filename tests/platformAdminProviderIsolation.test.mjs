import test from "node:test";
import assert from "node:assert/strict";
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { createServer } from "vite";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const STORE_ID = "11111111-1111-4111-8111-111111111111";
const waitFor = async (predicate) => {
  const deadline = Date.now() + 2000;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error("Provider state did not settle");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
};

test("platform providers keep tenant APIs isolated while organization users retain them", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousNavigator = globalThis.navigator;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: dom.window.navigator });
  const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "silent" });
  try {
    const [{ AuthProvider }, { StoreProvider, useStore }, { api }] = await Promise.all([
      vite.ssrLoadModule("/src/context/AuthContext.jsx"),
      vite.ssrLoadModule("/src/context/StoreContext.jsx"),
      vite.ssrLoadModule("/src/services/apiClient.js"),
    ]);

    const renderSession = async (user) => {
      const calls = [];
      let store;
      api.get = async (path) => {
        calls.push(["GET", path]);
        if (path === "/api/auth/me") return { user };
        if (path === "/api/platform/overview") return { overview: { organizations: 0, active: 0, review: 0, stores: 0 } };
        if (path === "/api/users/me/sessions") return { sessions: [] };
        if (path === "/api/users") return { users: [] };
        if (path === "/api/bootstrap") return {
          stores: [{ id: STORE_ID, name: "Asosiy filial", active: true }],
          inventory: [], dailySales: [], salesHistory: [], suppliers: [], expenses: [], returns: [],
          activeShifts: {}, shiftHistory: [], activityLogs: [], inventoryTransfers: [], stockMovements: [], inventoryCounts: [], payments: [],
          organization: { id: user.organizationId, plan: "MONTHLY", storeLimit: 2 }, telegramConnections: [], employees: [],
        };
        if (path === "/api/settings") return { workspaceSettings: {}, businessFeatures: {}, rolePermissions: {}, uiPreferences: {}, selectedStoreId: STORE_ID };
        throw new Error(`Unexpected GET ${path}`);
      };
      api.patch = async (path, body) => { calls.push(["PATCH", path, body]); return { success: true }; };

      const Probe = () => {
        const value = useStore();
        useEffect(() => { if (value.workspaceReady) store = value; }, [value]);
        return null;
      };

      const container = document.createElement("div");
      document.body.append(container);
      const root = createRoot(container);
      await act(async () => {
        root.render(
          React.createElement(AuthProvider, null,
            React.createElement(StoreProvider, null, React.createElement(Probe)),
          ),
        );
      });
      await act(async () => { await waitFor(() => Boolean(store)); });
      await act(async () => {
        store.setSelectedStoreId(STORE_ID);
        store.setUiPreferences({ theme: "dark" });
        store.resetUiPreferences();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      await act(async () => { root.unmount(); });
      container.remove();
      return calls;
    };

    const platformCalls = await renderSession({ id: "platform-1", appRole: "PLATFORM_ADMIN", organizationId: "unexpected-org", name: "Platform Admin" });
    assert.equal(platformCalls.some(([, path]) => path === "/api/platform/overview"), true);
    for (const path of ["/api/users", "/api/users/me/sessions", "/api/settings/preferences"]) {
      assert.equal(platformCalls.some(([, calledPath]) => calledPath === path), false, `${path} must stay tenant-only`);
    }

    const ownerCalls = await renderSession({ id: "owner-1", appRole: "OWNER", organizationId: "org-1", name: "Owner" });
    assert.equal(ownerCalls.some(([, path]) => path === "/api/users"), true);
    assert.equal(ownerCalls.some(([, path]) => path === "/api/users/me/sessions"), true);
    assert.equal(ownerCalls.some(([, path]) => path === "/api/settings/preferences"), true);
  } finally {
    await vite.close();
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: previousNavigator });
  }
});
