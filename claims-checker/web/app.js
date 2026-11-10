import { fetchSnapshot } from "/api.js";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const state = {
  snapshot: null,
  rows: [],
  selected: new URLSearchParams(window.location.search).get("claim"),
  filter: "all",
  search: "",
  tab: new URLSearchParams(window.location.search).get("tab") ?? "checks",
  source: "validate_claim",
  running: false,
  replayTimer: null,
  replayIndex: null,
};
const labels = {
  is_valid_npi: "Provider NPI",
  is_valid_date_range: "Service & submission dates",
  is_valid_state: "State code",
};
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

function node(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== "") element.textContent = text;
  return element;
}

function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("icon");
  svg.setAttribute("aria-hidden", "true");
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#i-${name}`);
  svg.append(use);
  return svg;
}

function evaluationFor(id) {
  return state.snapshot?.evaluations.find((evaluation) => evaluation.claim_id === id);
}

function statusFor(id) {
  const evaluation = evaluationFor(id);
  if (!evaluation) return "pending";
  return evaluation.problems.length ? "flagged" : "valid";
}

function badge(id) {
  const status = statusFor(id);
  return node("span", `badge ${status}`, { pending: "Not run", flagged: "Flagged", valid: "Valid" }[status]);
}

function announce(message) {
  $("#announcement").textContent = message;
}

function counts() {
  const evaluations = state.snapshot?.evaluations ?? [];
  const flagged = evaluations.filter((evaluation) => evaluation.problems.length).length;
  return { checked: evaluations.length, flagged, valid: evaluations.length - flagged };
}

function renderMetrics() {
  const { checked, flagged, valid } = counts();
  const loaded = state.rows.length;
  const providers = new Set(state.rows.map((row) => row.provider_name)).size;
  const states = new Set(state.rows.map((row) => row.state).filter(Boolean)).size;
  $("#loadedCount").textContent = state.snapshot ? loaded : "--";
  $("#datasetDetail").textContent = state.snapshot ? `${providers} fictional providers / ${states} states` : "Waiting for the local CSV";
  $("#validCount").textContent = checked ? String(valid).padStart(2, "0") : "--";
  $("#flaggedCount").textContent = checked ? String(flagged).padStart(2, "0") : "--";
  $("#validDetail").textContent = checked ? `${valid} of ${checked} checked claims` : "Waiting for Python";
  $("#flaggedDetail").textContent = checked ? "Select a claim to investigate" : "No checks run yet";
  $("#validMeter").style.width = checked ? `${valid / checked * 100}%` : "0%";
  $("#flaggedMeter").style.width = checked ? `${flagged / checked * 100}%` : "0%";
  const summary = state.snapshot?.summary;
  $("#billedTotal").textContent = summary ? money.format(summary.total_billed) : "\u2014";
  $("#billedDetail").textContent = state.snapshot?.error ? "Unavailable / Python raised an error" : summary ? "All claims, including flagged claims" : "Returned by the Python report";
  $("#allFilterCount").textContent = loaded;
  $("#flaggedFilterCount").textContent = checked ? flagged : "--";
  $("#validFilterCount").textContent = checked ? valid : "--";
}

function renderPipeline() {
  const stages = state.snapshot?.stages ?? [
    { name: "Read CSV", function: "load_claims", status: "waiting" },
    { name: "Validate claims", function: "validate_claim", status: "waiting" },
    { name: "Build summary", function: "summarize", status: "waiting" },
  ];
  const container = $("#pipelineStages");
  container.replaceChildren();
  stages.forEach((stage, index) => {
    if (index) container.append(node("span", "pipeline-connector"));
    const button = node("button", `pipeline-step ${stage.status}`);
    button.type = "button";
    button.dataset.source = stage.function;
    button.setAttribute("aria-label", `Inspect ${stage.function}, ${stage.status}`);
    const number = node("span", "stage-number");
    if (stage.status === "complete") number.append(icon("check"));
    else if (stage.status === "failed") number.append(icon("alert"));
    else number.textContent = String(index + 1).padStart(2, "0");
    const text = node("span");
    text.append(node("strong", "", stage.name), node("small", "", `${stage.function}()`));
    button.append(number, text);
    container.append(button);
  });
  const status = state.snapshot?.status;
  $("#runState").textContent = state.running ? "Running Python..." : status === "failed" ? "Execution interrupted" : status === "complete" ? `${state.snapshot.duration_ms.toFixed(1)} ms / complete` : "Ready to explore";
  $("#runState").classList.toggle("failed", status === "failed");
}

function renderTable() {
  const visible = state.rows.filter((row) => {
    const matchesStatus = state.filter === "all" || statusFor(row.claim_id) === state.filter;
    return matchesStatus && Object.values(row).join(" ").toLowerCase().includes(state.search);
  });
  const body = $("#claimsBody");
  body.replaceChildren();
  for (const row of visible) {
    const tr = node("tr", row.claim_id === state.selected ? "selected" : "");
    tr.dataset.claim = row.claim_id;
    const idCell = node("td");
    const button = node("button", "claim-link", row.claim_id);
    button.type = "button";
    button.setAttribute("aria-label", `Inspect ${row.claim_id}`);
    button.setAttribute("aria-pressed", String(row.claim_id === state.selected));
    idCell.append(button);
    const provider = node("td");
    const name = node("span", "provider-name", row.provider_name);
    name.title = row.provider_name;
    provider.append(name, node("span", "provider-state", row.state || "State not provided"));
    const result = node("td");
    result.append(badge(row.claim_id));
    tr.append(idCell, provider, node("td", "code-cell", row.procedure_code), node("td", "amount-cell", `$${row.billed_amount}`), result);
    body.append(tr);
  }
  $("#tableEmpty").hidden = visible.length > 0;
  $("#tableCount").textContent = state.rows.length;
  $("#tableFooter").textContent = `${visible.length} of ${state.rows.length} claims / select a row to inspect`;
  $$(".filter").forEach((button) => {
    const active = button.dataset.filter === state.filter;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function checksumView(npi) {
  if (!/^[0-9]{10}$/.test(npi)) return null;
  const wrapper = node("div", "checksum");
  wrapper.append(node("strong", "", "NPI LUHN WALKTHROUGH / ILLUSTRATION"));
  const digits = node("div", "checksum-digits");
  let total = 24;
  [...npi].forEach((character, index) => {
    const doubled = (9 - index) % 2 === 1;
    const expanded = Number(character) * (doubled ? 2 : 1);
    const contribution = expanded > 9 ? expanded - 9 : expanded;
    total += contribution;
    const cell = node("span", `checksum-digit${doubled ? " doubled" : ""}`);
    cell.append(node("span", "", character), node("small", "", doubled ? "\u00d72" : "\u00d71"), node("b", "", contribution));
    digits.append(cell);
  });
  wrapper.append(digits, node("p", "", `24 prefix + ${total - 24} digits = ${total} / remainder ${total % 10}`));
  return wrapper;
}

function dateRelationship(row) {
  const service = Date.parse(`${row.date_of_service}T00:00:00Z`);
  const submitted = Date.parse(`${row.date_submitted}T00:00:00Z`);
  if (!Number.isFinite(service) || !Number.isFinite(submitted)) return null;
  const days = Math.round((submitted - service) / 86400000);
  const text = days === 0 ? "Both dates are the same day." : `Service is ${Math.abs(days)} day(s) ${days > 0 ? "before" : "after"} submission.`;
  return node("p", "date-relationship", `${text} The return value above is from Python.`);
}

function renderChecks(row, evaluation) {
  const container = $("#view-checks");
  container.replaceChildren();
  if (!evaluation) {
    container.append(node("div", "empty-inspector", "The data is here. Now follow the logic.\nRun checks to see Python's actual arguments and return values."));
    return;
  }
  for (const check of evaluation.checks) {
    const failed = check.passed === false || check.error;
    const details = node("details", `check-card${failed ? " fail" : ""}`);
    const summary = node("summary");
    const mark = node("span", "check-icon");
    mark.append(icon(failed ? "alert" : "check"));
    const title = node("span", "check-title", labels[check.function] ?? check.function);
    title.append(node("small", "", `${check.function}()`));
    summary.append(mark, title, node("span", "return-value", check.error ? "Raised error" : `\u2192 ${check.returned}`));
    const body = node("div", "check-body");
    for (const [name, value] of Object.entries(check.inputs)) {
      const argument = node("div", "argument-row");
      argument.append(node("span", "", name), node("code", "", value));
      body.append(argument);
    }
    if (check.error) body.append(node("p", "date-relationship", check.error));
    if (check.function === "is_valid_npi") {
      const illustration = checksumView(row.provider_npi);
      if (illustration) body.append(illustration);
    }
    if (check.function === "is_valid_date_range") {
      const relationship = dateRelationship(row);
      if (relationship) body.append(relationship);
    }
    const actions = node("div", "check-actions");
    const source = node("button", "text-button", "View Python source");
    source.type = "button";
    source.dataset.source = check.function;
    actions.append(source, node("span", "duration", `${check.duration_ms?.toFixed(3) ?? "?"} ms`));
    body.append(actions);
    details.append(summary, body);
    container.append(details);
  }
  if (evaluation.problems.length) {
    const problems = node("div", "problem-list");
    const list = node("ul");
    evaluation.problems.forEach((problem) => list.append(node("li", "", problem)));
    problems.append(node("strong", "", `validate_claim returned ${evaluation.problems.length} problem(s)`), list);
    container.append(problems);
  } else {
    container.append(node("p", "no-problems", "validate_claim returned [] \u2014 no problems found by the current Python rules."));
  }
  container.append(node("p", "inspector-note", "These are observed Python calls, not browser-side validation. Inline rules also appear in the returned problem list."));
}

function renderRaw(row) {
  const list = node("dl", "raw-data");
  for (const [name, value] of Object.entries(row)) {
    const entry = node("div");
    entry.append(node("dt", "", name), node("dd", "", value === "" ? '"" (empty)' : value));
    list.append(entry);
  }
  $("#view-raw").replaceChildren(list);
}

function renderSource() {
  const sources = state.snapshot?.sources ?? {};
  const select = $("#sourceSelect");
  select.replaceChildren();
  for (const name of Object.keys(sources)) {
    const option = node("option", "", `${name}()`);
    option.value = name;
    select.append(option);
  }
  if (!sources[state.source]) state.source = Object.keys(sources)[0] ?? "";
  select.value = state.source;
  const source = sources[state.source];
  const code = $("#sourceCode");
  code.replaceChildren();
  $("#sourceLocation").textContent = source ? `${source.file} / line ${source.line}` : "No source snapshot available";
  if (!source) return;
  const errorFrames = state.snapshot?.error?.frames ?? [];
  source.code.split("\n").forEach((text, index) => {
    const lineNumber = source.line + index;
    const failed = errorFrames.some((frame) => frame.file === source.file && frame.line === lineNumber);
    const line = node("span", `source-line${failed ? " error-line" : ""}`);
    line.append(node("span", "line-number", lineNumber), node("span", "", text || " "));
    code.append(line);
  });
}

function renderInspector() {
  const row = state.rows.find((claim) => claim.claim_id === state.selected);
  const selected = $("#selectedClaim");
  selected.replaceChildren();
  if (!row) {
    selected.append(node("span", "selected-provider", "Select a claim in the explorer."));
    $("#view-checks").replaceChildren(node("div", "empty-inspector", "No claim selected."));
    $("#view-raw").replaceChildren();
  } else {
    const top = node("div", "selected-topline");
    top.append(node("strong", "selected-id", row.claim_id), badge(row.claim_id));
    const meta = node("div", "selected-meta");
    meta.append(node("span", "", `BENEFICIARY ${row.beneficiary_id}`), node("strong", "", `$${row.billed_amount}`));
    selected.append(top, node("div", "selected-provider", row.provider_name), meta);
    renderChecks(row, evaluationFor(row.claim_id));
    renderRaw(row);
    document.dispatchEvent(new CustomEvent("claims-lab:selection", { detail: { claim_id: row.claim_id } }));
  }
  renderSource();
}

function setTab(tab, focus = false, syncRoute = true) {
  if (!["checks", "raw", "source"].includes(tab)) {
    console.warn("Claims Lab received an unknown inspector tab:", tab);
    tab = "checks";
  }
  state.tab = tab;
  $$(".tab").forEach((button) => {
    const active = button.dataset.tab === tab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;
    $(`#view-${button.dataset.tab}`).hidden = !active;
    if (active && focus) button.focus();
  });
  if (syncRoute) document.dispatchEvent(new CustomEvent("claims-lab:inspector", { detail: { tab } }));
}

function inspectSource(name, scroll = false) {
  state.source = name;
  renderSource();
  setTab("source");
  if (scroll) $(".inspector").scrollIntoView({ block: "start" });
}

function selectClaim(id) {
  state.selected = id;
  $$("#claimsBody tr").forEach((row) => {
    const selected = row.dataset.claim === id;
    row.classList.toggle("selected", selected);
    row.querySelector(".claim-link").setAttribute("aria-pressed", String(selected));
  });
  renderInspector();
}

function renderTrace() {
  const snapshot = state.snapshot;
  const error = snapshot?.error;
  const events = snapshot?.events ?? [];
  const replaying = state.replayTimer !== null;
  $("#exceptionBanner").hidden = !error;
  $("#tracebackDetails").hidden = !error;
  if (error) {
    const failedStage = snapshot.stages.find((stage) => stage.status === "failed");
    const context = failedStage?.id === "report" ? "Summary" : "Execution";
    $("#exceptionTitle").textContent = `${context} interrupted / ${error.type}${error.claim_id ? ` / ${error.claim_id}` : ""}`;
    $("#exceptionMessage").textContent = error.message;
    $("#tracebackText").textContent = error.traceback;
  } else {
    $("#tracebackText").textContent = "";
    $("#tracebackDetails").open = false;
  }
  $("#traceChip").textContent = replaying ? `RECORDED REPLAY / ${state.replayIndex + 1} OF ${events.length}` : snapshot?.status === "ready" ? "CSV LOADED / READY TO RUN" : snapshot ? `${snapshot.duration_ms.toFixed(2)} MS / ${snapshot.status.toUpperCase()}` : "AWAITING FIRST RUN";
  $("#traceChip").classList.toggle("replaying", replaying);
  const log = $("#traceLog");
  log.replaceChildren();
  const shown = replaying ? events.slice(0, state.replayIndex + 1) : events;
  if (!shown.length) log.append(node("div", "trace-empty", "The pipeline is quiet. Start a run and see what happens behind the screen."));
  shown.forEach((event, index) => {
    const row = node("button", `trace-row ${event.level}${replaying && index === state.replayIndex ? " current" : ""}`);
    row.type = "button";
    row.dataset.event = index;
    row.append(node("span", "trace-time", `+${event.offset_ms.toFixed(2)}ms`), node("span", "trace-level", event.level === "warning" ? "FLAG" : event.level.toUpperCase()), node("span", "trace-message", event.message));
    log.append(row);
  });
  if (replaying) log.scrollTop = log.scrollHeight;
  $("#traceNoteTitle").textContent = error ? "The failure is part of the story." : snapshot?.status === "complete" ? "A complete trip through Python." : "A window into the work.";
  $("#traceNote").textContent = error ? "The validation pass is visible above, but Python did not return a summary. Inspect the actual exception and source, make your change in VS Code, then run again." : snapshot?.status === "complete" ? "The report returned successfully. Every badge comes from validate_claim, and the billing total is the actual report result. Saved code changes appear on the next run." : "Run checks to watch the actual Python pipeline. Select any claim to see arguments, return values, and the code behind each decision.";
  $("#traceFooter").textContent = replaying ? "Playback of a recorded run; Python has already finished executing." : "Real Python results. Replay changes the playback, never the data.";
  $("#replayButton").disabled = state.running || !snapshot || snapshot.status === "ready";
  $("#replayButton span").textContent = replaying ? "Stop replay" : "Replay trace";
}

function stopReplay() {
  if (state.replayTimer !== null) clearInterval(state.replayTimer);
  state.replayTimer = null;
  state.replayIndex = null;
}

function render() {
  document.body.classList.toggle("running", state.running);
  $("#runButton").disabled = state.running;
  $("#runButton span").textContent = state.running ? "Running Python..." : "Run checks";
  renderMetrics();
  renderPipeline();
  renderTable();
  renderInspector();
  renderTrace();
}

async function requestSnapshot(run) {
  if (state.running) return;
  stopReplay();
  state.running = true;
  state.snapshot = null;
  $("#connectionAlert").hidden = true;
  render();
  try {
    const snapshot = await fetchSnapshot(run);
    state.snapshot = snapshot;
    state.rows = snapshot.claims;
    if (!state.rows.some((row) => row.claim_id === state.selected)) {
      state.selected = state.rows[0]?.claim_id ?? null;
    }
    $("#connection").classList.remove("offline");
    $("#connectionLabel").textContent = "Python backend connected";
    const { flagged, valid } = counts();
    announce(snapshot.error ? `Python raised ${snapshot.error.type}. ${flagged} claims flagged, ${valid} valid. Summary unavailable.` : run ? `Run complete. ${flagged} claims flagged, ${valid} valid.` : `${state.rows.length} synthetic claims loaded. Ready to run checks.`);
  } catch (error) {
    console.error("Claims Lab request failed:", error);
    $("#connection").classList.add("offline");
    $("#connectionLabel").textContent = "Backend unavailable";
    $("#connectionAlert").textContent = `Could not reach the Python demo: ${error.message}. Make sure python demo.py is running, then try Run checks again.`;
    $("#connectionAlert").hidden = false;
    announce("The Python request failed. See the connection error.");
  } finally {
    state.running = false;
    render();
  }
}

$("#runButton").addEventListener("click", () => requestSnapshot(true));
$("#searchInput").addEventListener("input", (event) => {
  state.search = event.target.value.trim().toLowerCase();
  renderTable();
});
$$(".filter").forEach((button) => button.addEventListener("click", () => {
  state.filter = button.dataset.filter;
  renderTable();
}));
$("#claimsBody").addEventListener("click", (event) => {
  const row = event.target.closest("tr[data-claim]");
  if (row) selectClaim(row.dataset.claim);
});
$$(".tab").forEach((button) => {
  button.addEventListener("click", () => setTab(button.dataset.tab));
  button.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const tabs = $$(".tab");
    const current = tabs.indexOf(button);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (current + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[next].dataset.tab, true);
  });
});
document.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-source]");
  if (button) inspectSource(button.dataset.source, button.classList.contains("pipeline-step"));
});
$("#sourceSelect").addEventListener("change", (event) => {
  state.source = event.target.value;
  renderSource();
});
$("#inspectErrorButton").addEventListener("click", () => {
  const error = state.snapshot?.error;
  if (!error) return;
  if (error.claim_id) selectClaim(error.claim_id);
  const frame = [...error.frames].reverse().find((item) => state.snapshot.sources[item.function]);
  if (frame) inspectSource(frame.function, true);
  else {
    $("#tracebackDetails").open = true;
    $("#tracebackDetails").scrollIntoView({ block: "center" });
  }
});
$("#traceLog").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-event]");
  if (!button) return;
  const entry = state.snapshot.events[Number(button.dataset.event)];
  if (entry.claim_id) selectClaim(entry.claim_id);
  inspectSource(entry.function, true);
});
$("#replayButton").addEventListener("click", () => {
  if (state.replayTimer !== null) {
    stopReplay();
    renderTrace();
    return;
  }
  const events = state.snapshot?.events ?? [];
  if (!events.length) return;
  state.replayIndex = 0;
  state.replayTimer = setInterval(() => {
    if (state.replayIndex + 1 >= events.length) stopReplay();
    else state.replayIndex += 1;
    renderTrace();
  }, 400);
  renderTrace();
  $("#trace-section").scrollIntoView({ block: "start" });
});
$("#presentButton").addEventListener("click", () => {
  const active = document.body.classList.toggle("presentation");
  $("#presentButton").setAttribute("aria-pressed", String(active));
  $("#presentButton span").textContent = active ? "Exit presentation" : "Present";
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("presentation")) $("#presentButton").click();
});

function followWorkbenchRoute() {
  const params = new URLSearchParams(window.location.search);
  const selected = params.get("claim");
  if (state.rows.some((row) => row.claim_id === selected) && selected !== state.selected) selectClaim(selected);
  setTab(params.get("tab") ?? state.tab, false, false);
}

document.addEventListener("claims-lab:navigate", followWorkbenchRoute);
window.addEventListener("popstate", followWorkbenchRoute);

setTab(state.tab, false, false);
requestSnapshot(false);
