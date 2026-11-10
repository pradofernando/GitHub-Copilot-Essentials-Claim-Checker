export async function fetchSnapshot(run = false) {
  const response = await fetch(run ? "/api/run" : "/api/claims", {
    method: run ? "POST" : "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const snapshot = await response.json();
  if (snapshot.kind !== "claims-lab-run") {
    throw new Error(snapshot.error || `The server returned HTTP ${response.status}.`);
  }
  if (!response.ok && snapshot.status !== "failed") {
    throw new Error(`The server returned HTTP ${response.status} without an execution error.`);
  }
  return snapshot;
}
