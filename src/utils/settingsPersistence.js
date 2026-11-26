// Acknowledged workspace settings, not a UI timer, define persistence status.
export function settingsChanges(current,baseline,owner){
 const keys=['workspaceSettings','businessFeatures',...(owner?['rolePermissions']:[])];
 return keys.filter(key=>current[key]!==baseline[key]);
}
export function canApplySettingsRead({identity,baseline,current,readRevision,revision,owner}){
 if(baseline.identity!==identity)return true;
 return readRevision===revision&&settingsChanges(current,baseline,owner).length===0;
}
