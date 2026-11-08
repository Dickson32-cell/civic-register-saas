// True ONLY on the owner's own deployment (env MASTER_COUNCIL === TENANT_ID).
// Council deployments never set MASTER_COUNCIL, so their UI hides the Master
// button entirely - matching the API's 404 gate.
export function isMasterDeployment(): boolean {
  const m = process.env.MASTER_COUNCIL;
  return !!m && m === process.env.TENANT_ID;
}
