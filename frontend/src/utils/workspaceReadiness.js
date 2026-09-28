export const workspaceIdentity = (user) => {
  if (!user) return "anonymous";
  return `${user.id || "unknown"}:${user.organizationId || "platform"}:${user.appRole || "unknown"}`;
};

export const isWorkspaceReadyFor = (currentIdentity, loadedIdentity) => (
  Boolean(currentIdentity) && currentIdentity === loadedIdentity
);

export const shouldHydrateWorkspace = (currentIdentity, lastIdentity) => (
  currentIdentity !== lastIdentity
);
