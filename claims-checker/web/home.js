import { fetchSnapshot } from "/api.js";

const $ = (selector) => document.querySelector(selector);
const state = { snapshot: null, rows: [], selected: null, source: "validate_claim", busy: false, error: null };
const ruleLabels = {
  is_valid_npi: "Does the provider NPI pass its checksum?",
  is_valid_date_range: "What does the date comparison return?",
  is_valid_state: "Is the state code recognized?",
};

function element(tag, className, text) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function renderSource() {
  const sources = state.snapshot?.sources ?? {};
  const select = $("#exampleSourceSelect");
  select.replaceChildren();
  for (const name of Object.keys(sources)) {
    const option = element("option", "", `${name}()`);
    option.value = name;
    select.append(option);
  }
  if (!sources[state.source]) state.source = Object.keys(sources)[0] ?? "";
  select.value = state.source;
  select.disabled = !state.source;
  const source = sources[state.source];
  $("#exampleSourceLocation").textContent = source ? `${source.file} / line ${source.line}` : "No source snapshot available.";
  $("#exampleSourceCode").textContent = source?.code ?? "Load the local sample to inspect its Python source.";
}

function renderExample() {
  const row = state.rows.find((claim) => claim.claim_id === state.selected);
  const evaluation = state.snapshot?.evaluations.find((claim) => claim.claim_id === state.selected);
  const select = $("#exampleClaimSelect");
  select.replaceChildren();
  if (!state.rows.length) select.append(element("option", "", state.busy ? "Loading the sample..." : "Sample unavailable"));
  for (const claim of state.rows) {
    const option = element("option", "", `${claim.claim_id} / ${claim.state || "no state"} / $${claim.billed_amount}`);
    option.value = claim.claim_id;
    select.append(option);
  }
  select.value = state.selected ?? "";
  select.disabled = state.busy || !row;
  document.querySelectorAll("[data-claim-field]").forEach((field) => {
    const value = row?.[field.dataset.claimField];
    field.textContent = value === undefined ? "--" : value === "" ? '"" (empty)' : field.hasAttribute("data-money") ? `$${value}` : value;
  });
  const loaded = state.snapshot?.stages.find((stage) => stage.id === "load")?.status === "complete";
  $("#homeClaimCount").textContent = loaded ? state.rows.length : "--";
  if (row) document.dispatchEvent(new CustomEvent("claims-lab:selection", { detail: { claim_id: row.claim_id } }));
  $("#exampleRunButton").disabled = state.busy;
  $("#exampleRunButton span").textContent = state.busy ? "Asking Python..." : row ? "Run live example" : "Reload sample";
  $("#homeError").hidden = !state.error;
  $("#homeError").textContent = state.error ?? "";
  $("#homeConnection").textContent = state.error ? "PYTHON UNAVAILABLE" : state.snapshot ? "CONNECTED TO YOUR PYTHON" : "CONNECTING TO PYTHON";

  const status = evaluation ? evaluation.problems.length ? "flagged" : "valid" : "pending";
  $("#exampleVerdict").className = `example-verdict ${status}`;
  $("#exampleVerdict").textContent = status === "flagged" ? "FLAGGED FOR REVIEW" : status === "valid" ? "NO PROBLEMS RETURNED" : "AWAITING A RUN";
  const checks = $("#exampleChecks");
  checks.replaceChildren();
  const rules = evaluation?.checks ?? Object.keys(state.snapshot?.sources ?? {}).filter((name) => name.startsWith("is_valid_")).map((name) => ({ function: name }));
  for (const [index, check] of rules.entries()) {
    const observed = check.returned !== undefined;
    const failed = check.passed === false || check.error;
    const card = element("div", `example-check ${!observed ? "pending" : failed ? "flagged" : "valid"}`);
    card.append(element("span", "example-check-indicator", !observed ? String(index + 1).padStart(2, "0") : failed ? "!" : check.passed === true ? "\u2713" : "?"));
    const copy = element("div", "example-check-copy");
    copy.append(element("span", "example-check-title", ruleLabels[check.function] ?? check.function));
    const inputs = check.inputs ? Object.entries(check.inputs).map(([name, value]) => `${name}=${value}`).join(", ") : `${check.function}() / waiting for a run`;
    copy.append(element("span", "example-check-inputs", inputs));
    const button = element("button", "example-check-source", "See this function");
    button.type = "button";
    button.dataset.function = check.function;
    copy.append(button);
    card.append(copy, element("span", "example-check-return", !observed ? "\u2014" : check.error ? "Error" : check.returned));
    checks.append(card);
  }
  const problems = $("#exampleProblems");
  problems.replaceChildren();
  if (evaluation) {
    problems.append(element("strong", "", `validate_claim returned ${evaluation.problems.length ? `${evaluation.problems.length} problem(s)` : "[]"}`));
    if (evaluation.problems.length) {
      const list = element("ul");
      evaluation.problems.forEach((problem) => list.append(element("li", "", problem)));
      problems.append(list);
    } else {
      problems.append(element("p", "", "The current Python rules found no problems in this claim. That is not the same as checking every possible rule."));
    }
  } else {
    problems.append(element("p", "", state.busy ? "Python is running. The response will appear here." : "These are the available validator functions, not results yet. Run the example to see which calls Python actually makes."));
  }
  const error = state.snapshot?.error;
  const summary = state.snapshot?.summary;
  const report = $("#exampleReport");
  report.hidden = !error && !summary;
  report.classList.toggle("complete", Boolean(summary));
  if (error) {
    report.textContent = `${evaluation ? "This claim's validation completed." : "Execution stopped before this claim was fully validated."} The batch raised ${error.type}${error.claim_id ? ` at ${error.claim_id}` : ""}: ${error.message}. No summary was returned.`;
  } else if (summary) {
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(summary.total_billed);
    report.textContent = `The actual batch summary returned ${summary.valid_claims} valid claims, ${summary.flagged_claims} flagged claims, and ${amount} total billed.`;
  } else {
    report.textContent = "";
  }
  $("#exampleCapture").textContent = evaluation ? "Captured from the latest batch run. Save a Python change, then run again." : error ? "Execution was interrupted. See the Python error above." : loaded ? "Sample loaded locally. No claim has been validated yet." : "Waiting for the local CSV.";
  renderSource();
}

async function loadExample(run) {
  if (state.busy) return;
  state.busy = true;
  state.snapshot = null;
  state.error = null;
  renderExample();
  try {
    const snapshot = await fetchSnapshot(run);
    state.snapshot = snapshot;
    state.rows = snapshot.claims;
    if (!state.rows.some((row) => row.claim_id === state.selected)) state.selected = state.rows[0]?.claim_id ?? null;
    if (snapshot.error && !snapshot.claims.length) state.error = `${snapshot.error.type}: ${snapshot.error.message}. Save your Python code and reload the sample.`;
    const evaluation = snapshot.evaluations.find((claim) => claim.claim_id === state.selected);
    $("#homeAnnouncement").textContent = state.error ?? (evaluation ? `${state.selected}: Python returned ${evaluation.problems.length} problem(s).${snapshot.error ? " The batch summary raised an error." : ""}` : `${snapshot.claims.length} synthetic claims loaded. Run the live example to inspect Python's decisions.`);
  } catch (error) {
    console.error("Claims Lab example request failed:", error);
    state.error = `Could not load the live example: ${error.message}. Make sure python demo.py is running, then retry.`;
    $("#homeAnnouncement").textContent = "The live example could not reach Python. See the connection error.";
  } finally {
    state.busy = false;
    renderExample();
  }
}

$("#exampleRunButton").addEventListener("click", () => loadExample(state.rows.length > 0));
$("#exampleClaimSelect").addEventListener("change", (event) => {
  state.selected = event.target.value;
  renderExample();
});
$("#exampleChecks").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-function]");
  if (!button) return;
  state.source = button.dataset.function;
  renderSource();
  $("#exampleSource").open = true;
  $("#exampleSourceSelect").focus({ preventScroll: true });
});
$("#exampleSourceSelect").addEventListener("change", (event) => {
  state.source = event.target.value;
  renderSource();
});

loadExample(false);
