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

export const isCurrentWorkspaceHydration = ({
  currentIdentity,
  hydrationIdentity,
  currentRequestId,
  requestId,
}) => currentIdentity === hydrationIdentity && currentRequestId === requestId;

export const workspaceRouteDecision = ({
  workspaceReady,
  workspaceLoadError = "",
  organization = null,
  licenseAllowed = false,
}) => {
  if (workspaceLoadError) return "error";
  if (!workspaceReady) return "loading";
  if (!organization) return "error";
  return licenseAllowed ? "allowed" : "billing";
};
