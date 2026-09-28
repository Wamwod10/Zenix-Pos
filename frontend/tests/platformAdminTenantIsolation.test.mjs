import test from "node:test";
import assert from "node:assert/strict";

test("platform admins never qualify for organization-scoped API work", async () => {
  const roles = await import("../src/config/roles.js");

  assert.equal(typeof roles.isOrganizationUser, "function");
  assert.equal(typeof roles.runForOrganizationUser, "function");
  assert.equal(roles.isOrganizationUser(null), false);
  assert.equal(roles.isOrganizationUser({ appRole: "PLATFORM_ADMIN", organizationId: null }), false);
  assert.equal(roles.isOrganizationUser({ appRole: "PLATFORM_ADMIN", organizationId: "unexpected-org" }), false);
  assert.equal(roles.isOrganizationUser({ appRole: "OWNER", organizationId: "org-1" }), true);

  const calls = [];
  const platformAdmin = { appRole: "PLATFORM_ADMIN", organizationId: "unexpected-org" };
  for (const path of ["/api/users", "/api/users/me/sessions", "/api/settings/preferences"]) {
    assert.equal(roles.runForOrganizationUser(platformAdmin, () => calls.push(path)), false);
  }
  assert.deepEqual(calls, []);

  const owner = { appRole: "OWNER", organizationId: "org-1" };
  assert.equal(roles.runForOrganizationUser(owner, () => calls.push("/api/users")), true);
  assert.deepEqual(calls, ["/api/users"]);
});
