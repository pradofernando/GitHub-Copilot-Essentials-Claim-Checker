# Claims Lab

**A little claim. A big aha.**

Claims Lab is a beginner-friendly **GitHub Copilot Essentials** training project.
It combines a small Python claims checker with a local browser interface that
makes the code's behavior visible to an audience.

Students can explore fictional healthcare claims, explain unfamiliar code, write
unit tests with a custom Copilot agent, reproduce failures, and make focused
repairs. The homepage explains the app; the workbench exposes inputs, actual
Python return values, saved source code, and exceptions.

> **This is intentionally unfinished teaching code.** Two bugs are planted in
> the Python exercise. The original CLI is expected to crash on the bundled
> sample, and a browser validation run is expected to show a report error.
> Neither outcome means the project was installed incorrectly.
>
> All claims, beneficiaries, and providers are fictional. This is not a
> production claims processor, payment system, medical tool, or compliance tool.
> Do not add real patient information, real claims, credentials, or PHI.

## Contents

- [Quick start](#quick-start)
- [Requirements and environment setup](#requirements-and-environment-setup)
- [Repository structure](#repository-structure)
- [Using the homepage and workbench](#using-the-homepage-and-workbench)
- [Running the command-line exercise](#running-the-command-line-exercise)
- [How the application works](#how-the-application-works)
- [The synthetic dataset](#the-synthetic-dataset)
- [Using the Copilot unit-test agent](#using-the-copilot-unit-test-agent)
- [Suggested classroom activities](#suggested-classroom-activities)
- [Checkpoints and facilitator spoilers](#checkpoints-and-facilitator-spoilers)
- [Local HTTP routes](#local-http-routes)
- [Troubleshooting](#troubleshooting)
- [Preparing and publishing the repository](#preparing-and-publishing-the-repository)
- [Limitations and responsible use](#limitations-and-responsible-use)

## Quick start

1. Install **Python 3.10 or newer**.
2. Open the **repository root** in VS Code: the folder containing this README,
   [`.github`](.github), and [`claims-checker`](claims-checker).
3. In a terminal at that root, run:

   ```powershell
   python .\claims-checker\demo.py
   ```

4. Open [http://127.0.0.1:8765/](http://127.0.0.1:8765/) in a current desktop
   browser. The [workbench](http://127.0.0.1:8765/lab) uses the same server.
5. Select **Live example**, then **Run live example**. An interrupted summary is
   intentional in the starter. Open **Workbench** to inspect the full batch.

Keep the terminal running while using the browser. Press **Ctrl+C** in that
terminal to stop the server.

**No npm installation, frontend build, database, API key, Azure subscription,
or additional Python runtime package is needed.** The app itself does not call
an AI model. Copilot is an optional development assistant used during the class.

## Requirements and environment setup

| Component | Needed for |
| --- | --- |
| Python 3.10+ | The CLI and local demo server |
| A current browser with JavaScript enabled | The homepage and workbench |
| VS Code and access to GitHub Copilot | The guided Copilot exercises and custom agent |
| pytest | Writing and running tests during the class |
| Git and a GitHub account | Version control and publishing, not local execution |

[`claims-checker/requirements.txt`](claims-checker/requirements.txt) contains
**pytest only**. All application imports use the Python standard library.
The frontend is plain HTML, CSS, and JavaScript with no external asset downloads.

### Optional isolated classroom environment

The following Windows PowerShell commands start at the repository root:

```powershell
cd .\claims-checker
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
python demo.py
```

In VS Code, use **Python: Select Interpreter** and choose the interpreter inside
this virtual environment. This keeps the editor and terminal on the same Python.
Use `deactivate` when finished.

If PowerShell prevents environment activation, there is no need to change a
machine-wide execution policy. Use the environment's interpreter directly from
the application directory:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe demo.py
```

If your machine exposes Python as `py` rather than `python`, use the available
Python 3.10+ interpreter consistently. Run `python --version` or `py --version`
first rather than assuming a particular installation is selected.

### Use a different port

From the application directory:

```powershell
python demo.py --port 8766
```

Then open `http://127.0.0.1:8766/`. The port must be between 1 and 65535.
The server always binds to `127.0.0.1`; there is no public-host option.

## Repository structure

The outer repository folder may have any name. Keep the two top-level folders
together so VS Code can discover the custom agent and the agent can find the app.

```text
repository-root/
|-- .gitignore
|-- README.md
|-- .github/
|   `-- agents/
|       `-- claims-unit-tests.agent.md
`-- claims-checker/
    |-- .gitignore
    |-- FACILITATOR_NOTES.md
    |-- main.py
    |-- demo.py
    |-- requirements.txt
    |-- data/
    |   `-- sample_claims.csv
    |-- claims_checker/
    |   |-- __init__.py
    |   |-- validators.py
    |   `-- report.py
    `-- web/
        |-- home.html
        |-- home.css
        |-- home.js
        |-- index.html
        |-- styles.css
        |-- app.js
        |-- header.html
        |-- ui.js
        `-- api.js
```

| File or directory | Purpose |
| --- | --- |
| [Custom testing agent](.github/agents/claims-unit-tests.agent.md) | Copilot instructions for test-only work on this app |
| [Root ignore rules](.gitignore) | Exclude local environments, caches, logs, and environment settings anywhere in the repository |
| [CLI entry point](claims-checker/main.py) | Load a CSV, print flagged claims, then request the summary |
| [Demo server](claims-checker/demo.py) | Serve the local interface and observe real Python execution |
| [Validators](claims-checker/claims_checker/validators.py) | NPI, service/submission date, state, and whole-claim checks |
| [Reporting](claims-checker/claims_checker/report.py) | CSV loading, billed-amount aggregation, and summary counts |
| [Sample claims](claims-checker/data/sample_claims.csv) | The 25-row fictional dataset |
| [Frontend](claims-checker/web) | Homepage, workbench, shared navigation, themes, and API requests |
| [Facilitator notes](claims-checker/FACILITATOR_NOTES.md) | Answer key, exact problematic rows, and teaching guidance |

There are **no test files in the starter**. Students generate them during the
class. The expected future test location is `claims-checker/tests/`.

The root ignore file protects the entire repository. The application's own
ignore file is retained so the original Python starter also has sensible ignore
rules if copied separately. Copying that folder alone does not include the agent.

## Using the homepage and workbench

### Shared top navigation

Both pages have the same header, visual language, and top tabs:

| Tab | What it shows |
| --- | --- |
| Home | The introduction and illustrated claim journey |
| The idea | What this training app is and what a claim represents |
| How it works | The three-step load, validate, and summarize pipeline |
| Live example | A selected claim and the actual Python response from a batch run |
| Workbench | Batch counters, the claims explorer, and the inspector |
| Claims | The searchable, filterable claims table |
| Validation | Calls, arguments, returns, and problem messages for the selected claim |
| Raw data | Original CSV values without browser-side cleaning |
| Python source | The saved Python function snapshot for that run |
| Execution trace | Recorded events, errors, and the full traceback |

**Home** and the Claims Lab logo return to the homepage from the workbench.
Within the workbench, top-tab navigation preserves the loaded run and selected
claim. Homepage example selection is carried into workbench links, including
**Open the workbench**.

Moving between the homepage and workbench is a page navigation; a previous run
is not shared between those pages or persisted across reloads. Click the run
button on the destination page to capture a fresh execution.

Direct links can also identify an inspector tab and claim, for example:

```text
http://127.0.0.1:8765/lab?tab=source&claim=CLM-0005#claim-inspector
```

### Run a live example

1. Choose a claim in the homepage's **Live example** dropdown.
2. Click **Run live example**. Python runs the complete sample batch; the page
   focuses its explanation on the selected row.
3. Read the actual validator arguments and `True`/`False` returns.
4. Inspect the problem list returned by `validate_claim`.
5. Use **See this function** to open saved Python source.
6. Follow **Inspect in the workbench** for the full explorer and execution log.

Changing the dropdown after a run selects another claim from that same captured
batch. It does not execute Python again. A new run is necessary after editing
source code.

### Explore a batch

- **Run checks** reloads the sample and executes the current saved Python.
- Filter by **All**, **Flagged**, or **Valid**, or search the CSV field values.
- Select a claim to update the inspector.
- Expand validation cards to see arguments, return values, and observed duration.
- The NPI card has a separately labeled checksum illustration. The displayed
  validator return is still the actual Python result.
- **Inspect exception** selects the claim involved in the reporting error and
  opens the failing function with its statement highlighted.
- **Replay trace** replays recorded events after the Python request has finished.
  It is not a live debugger and does not change or rerun the results.
- **Download sample CSV** saves the same synthetic input used by the app.

The pass/flag counters describe the completed validation pass. They do not imply
that reporting succeeded. If Python raises an exception, the total billed card
remains unavailable rather than showing an invented total.

### Themes, presentation, and keyboard access

- Use **Dark mode / Light mode** in the header to change the whole site.
- Before an explicit choice, the site follows the system theme. A choice is
  stored in browser local storage and survives navigation and reloads.
- Only the theme choice is saved there, not claims or results.
- Use **Present** in the workbench for larger text. **Escape** exits this mode;
  the top tabs remain available.
- The interface is desktop-first and also supports smaller widths. Top tabs
  scroll horizontally on narrow screens instead of disappearing.
- Links and controls support keyboard focus. The inspector tabs support
  **Left/Right Arrow**, **Home**, and **End**.
- Light and dark text palettes were checked for at least 4.5:1 contrast across
  the exercised page states, including helper text, code, errors, and controls.
  This is not a claim of a complete accessibility certification.

## Running the command-line exercise

From the repository root:

```powershell
python .\claims-checker\main.py .\claims-checker\data\sample_claims.csv
```

Or, from the application directory:

```powershell
python main.py data\sample_claims.csv
```

The CLI accepts one required positional argument: the CSV path. Relative input
paths are resolved from the terminal's current directory. Use `--help` to see
the command's usage.

In the unmodified starter it:

1. Loads 25 claims.
2. Prints 23 flagged claims based on the current, deliberately flawed date rule.
3. Calls the real summary function.
4. Exits with a nonzero status and this expected exception:

```text
ValueError: could not convert string to float: '1,250.00'
```

No final `Claim summary` is printed in that run. Preserve this failure until
students reach the debugging exercise.

## How the application works

### The core Python pipeline

```text
CSV file
  |
  v
load_claims(path)        -> list of dictionaries; CSV values remain strings
  |
  v
validate_claim(row)      -> list of human-readable problems for each claim
  |
  v
summarize(claims)        -> total/valid/flagged counts and total billed
                            or a visible Python exception
```

| Function | Responsibility |
| --- | --- |
| `is_valid_npi(npi)` | Check a 10-digit ASCII NPI using the standard NPI Luhn checksum |
| `is_valid_date_range(date_of_service, date_submitted)` | Parse the dates and compare them; the starter comparison is intentionally wrong |
| `is_valid_state(state)` | Reject missing values; normalize surrounding whitespace and case and check the 50 US states plus DC |
| `validate_claim(row)` | Combine NPI, date, and state findings; return `[]` if its implemented rules find no problems |
| `load_claims(path)` | Read with `csv.DictReader`, including quoted values and UTF-8 BOM handling |
| `total_billed(claims)` | Sum every claim's billed amount, including flagged claims; the starter conversion is intentionally fragile |
| `summarize(claims)` | Revalidate rows, count results, and request the billing total |

A successful summary has exactly these keys:

```text
total_claims
valid_claims
flagged_claims
total_billed
```

The core exercise is roughly 150 Python lines. Its short functions, mixed naming,
and deliberately dense but correct NPI implementation make it suitable for
explanation and refactoring practice.

### The browser does not replace the validators

The local server:

1. Compiles fresh saved validator and report source on each data/run request.
2. Captures source snapshots from those same files.
3. Loads the existing local sample CSV.
4. On a run, observes actual `is_valid_*` calls made by `validate_claim`, recording
   their arguments, return values, and durations.
5. Calls the actual `summarize` function. That function performs its own
   validation/counting pass before calculating billing.
6. Returns JSON to the browser. If an exception occurs, it logs the traceback
   in the terminal and returns HTTP 500 with partial results and error details.

The trace describes the observed validation pass and high-level execution
events, not every Python statement. An added inline validation rule can change
the problem list without producing its own separate function card.

The server injects [the shared header](claims-checker/web/header.html) into both
HTML pages. [The shared UI script](claims-checker/web/ui.js) handles theme and
top navigation; [the API helper](claims-checker/web/api.js) handles browser
requests. There is no separate frontend development server.

After saving changes to the core validators or reporting functions, click
**Run checks** or **Run live example** again; no server restart is needed.
After editing the server's own code or route definitions, restart `demo.py`.
Reload the browser after editing frontend assets.

## The synthetic dataset

[The sample CSV](claims-checker/data/sample_claims.csv) contains **25 fake claims**
with identifiers `CLM-0001` through `CLM-0025`.

| Column | Meaning in this exercise |
| --- | --- |
| `claim_id` | The claim's classroom identifier |
| `beneficiary_id` | An invented, unique 11-character alphanumeric value; not a real Medicare identifier |
| `provider_npi` | A synthetic 10-digit checksum example, with two deliberately incorrect check digits |
| `provider_name` | A clearly fictional provider name |
| `state` | MD, VA, DC, or PA, except for one deliberately missing value |
| `procedure_code` | A procedure-style code, with one deliberately short value |
| `date_of_service` | A service date in 2026 |
| `date_submitted` | A submission date in 2026 |
| `billed_amount` | A decimal string; some contain quoted thousands separators |

Values such as `"1,250.00"` are legitimate quoted CSV fields. The comma belongs
inside one amount; it is not an extra column or a data-quality defect.

A checksum-valid NPI only passes an arithmetic test. It does not establish that
a provider exists or that the synthetic number was assigned to one. The app
does not query any beneficiary, provider, or claims registry.

## Using the Copilot unit-test agent

The workspace includes
[Claims Unit Tests](.github/agents/claims-unit-tests.agent.md).

1. Open the repository root in VS Code, not just its application subfolder.
2. Open Copilot Chat and choose **Claims Unit Tests** from the agent picker.
3. If it is not listed, use **Developer: Reload Window** and check the picker
   again. Also confirm your Copilot access and workspace customization settings.
4. Give it a focused testing request.

Example prompts:

> Create and run beginner-friendly pytest tests for the claim validators.
> Explain each failure. Do not fix the application code.

> Add tests for CSV loading and total billing, including quoted thousands
> separators. Keep the sample CSV unchanged.

> Add tests for summary counts and the exact summary keys. Explain how the
> current date rule affects the results.

The agent is instructed to:

- Work only in the application's future `tests/` directory.
- Read the real source and facilitator context before writing assertions.
- Use pytest and the standard library only.
- Assert intended behavior rather than declaring the planted bugs correct.
- Leave production code, sample data, frontend, dependencies, and documentation
  unchanged.
- Run the requested tests and report genuine pass/fail results.

Once tests have been generated, run them from the application directory:

```powershell
python -m pytest tests -q
```

**Do not expect this command to work before the class creates `tests/`.**
An empty starter has no automated suite to pass. No CI workflow is included
that pretends otherwise.

By default, tests that expose the two bugs should fail until learners fix the
app. If you explicitly request a green starter suite, the agent can use narrowly
scoped `xfail(strict=True)` markers for reproduced planted bugs. It must not
silently skip failures or weaken assertions. Strict XPASS after a repair is a
signal to remove an obsolete expected-failure marker.

These are agent instructions, not a filesystem permission boundary. Review
generated changes and terminal commands before accepting them.

## Suggested classroom activities

Use separate, reviewable steps instead of asking Copilot to rewrite the project.

1. **Explore:** Ask Copilot to explain the repository and trace one sample claim.
2. **Explain:** Ask for a plain-language explanation of the NPI checksum before
   proposing a more readable equivalent implementation.
3. **Test:** Use Claims Unit Tests to add focused tests of intended behavior.
4. **Reproduce:** Run the original CLI and identify the final exception.
5. **Debug:** Compare a validator's inputs, its return value, and the intended
   business rule. Make one repair at a time.
6. **Verify:** Rerun tests and the browser batch after saving each repair.
7. **Document:** Extend this README with lessons learned, examples, or a class
   walkthrough rather than creating duplicate setup instructions.
8. **Stretch:** Add a rule requiring exactly five characters in `procedure_code`
   and cover it with a failing test before implementing it.

For audience demos, start with the homepage explanation, use the live example,
then switch to the workbench's **Validation**, **Python source**, and
**Execution trace** tabs.

## Checkpoints and facilitator spoilers

The starter's failures are intentional. The detailed explanation below and
[facilitator notes](claims-checker/FACILITATOR_NOTES.md) contain exercise answers.
A collapsed section is only presentation, not access control; a public
repository makes these answers available to students.

<details>
<summary>Show the planted bugs, sample-data issues, and expected results</summary>

### The two planted code bugs

1. In `is_valid_date_range`, the starter compares `service >= submitted`. The
   intended rule is service on or before submission, so earlier service dates
   should pass and later service dates should fail. Same-day dates pass either
   comparison.
2. In `total_billed`, direct `float()` conversion raises `ValueError` for a string
   such as `"1,250.00"`. The bundled run first encounters that value at CLM-0004.

The NPI function is correct, despite its intentionally difficult style.
Procedure-code length is not checked yet; that is the stretch task.

### Deliberate data issues

Rows count claims from 1, excluding the CSV header.

| Claim row | Claim ID | Deliberate problem |
| --- | --- | --- |
| 5 | CLM-0005 | Invalid NPI check digit: `9000000057` |
| 7 | CLM-0007 | Service date is after submission date |
| 11 | CLM-0011 | Four-character procedure code: `9300` |
| 14 | CLM-0014 | Invalid NPI check digit: `9000000040` |
| 17 | CLM-0017 | Service date is after submission date |
| 21 | CLM-0021 | Missing state |

Comma-formatted billed amounts appear on rows 4, 9, 13, 18, and 24. They are
valid input formatting, not five additional defective claims.

### Expected checkpoints

| State of the exercise | Valid | Flagged | Total billed |
| --- | --- | --- | --- |
| Unmodified starter, completed validation pass only | 2 | 23 | Unavailable: reporting raises `ValueError` |
| Both bugs fixed, no procedure-length rule | 20 | 5 | $12,264.00 |
| Both bugs fixed and five-character procedure rule added | 19 | 6 | $12,264.00 |

The original starter does not return a summary. The first row above describes
its validation pass, not a successfully returned `summarize` result.

After both repairs, the intended summary output is:

```text
Claim summary
------------------------------------
Total claims: 25
Valid claims: 20
Flagged claims: 5
Total billed: $12,264.00
```

The five flagged IDs are CLM-0005, CLM-0007, CLM-0014, CLM-0017, and CLM-0021.
CLM-0011 is added only after the procedure-length stretch task. The total always
includes all claims, not just those considered valid.

</details>

## Local HTTP routes

These routes belong to the Python demo server; they are not a hosted API.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Explanatory homepage |
| GET | `/lab` or `/lab/` | Full workbench |
| GET | `/api/health` | Server health, without running claim validation |
| GET | `/api/claims` | Load sample rows and source snapshots without validating |
| POST | `/api/run` | Run the actual batch; send no request body |
| GET | `/sample.csv` | Download the synthetic sample |

Frontend CSS and JavaScript have explicit local asset routes. Unknown paths,
including facilitator documentation and arbitrary filesystem paths, are not
served. Nonempty run request bodies are rejected; there is no upload feature.

Health and normal previews return HTTP 200. A run in the unmodified starter
returns **HTTP 500** with a structured error, partial validation results, and a
`null` summary. Once repairs allow reporting to complete, it returns HTTP 200
with the actual summary.

The server accepts the expected loopback host names and same-origin browser
requests. It sets no-store, content-type, and content-security headers. These
are development safeguards, not a production hosting or authentication design.

## Troubleshooting

| Symptom | What to check |
| --- | --- |
| `python` is not recognized | Install/select Python 3.10+; use the interpreter command available on your machine |
| Missing CSV or script | Confirm whether the terminal is at the repository root or application directory and use the matching command above |
| Port 8765 is already in use | Use `--port 8766`, or stop only your previous demo from its terminal with Ctrl+C |
| Browser says Python is unavailable | Keep `demo.py` running; open the same port printed by the server |
| Tabs or theme switch are missing | Restart the current `demo.py`, then reload the browser; older server code may not inject the shared header |
| Homepage opened as a local file does not work | Use the HTTP address; do not open the HTML directly or use a separate static server |
| HTTP 500 after Run checks | In the starter, inspect the intentional reporting `ValueError`; the server itself should remain running |
| Counts show 2 valid and 23 flagged | That is the unmodified date-comparison exercise, not the repaired answer |
| Saved Python changes do not appear | Save the correct file, then capture a new run; a previous trace is a snapshot |
| A newly added rule has no function card | Inline rules still affect problems; only actual `is_valid_*` function calls are observed separately |
| `No module named pytest` | Activate the intended environment and install the existing requirements |
| pytest cannot find `tests` | The starter contains no tests; generate the requested tests first |
| Copilot agent is missing | Open the repository root containing `.github`, check Copilot access, and reload VS Code |
| Theme choice does not persist | Browser storage may be blocked; the UI/console reports that limitation |
| A classmate cannot open your localhost link | Loopback is local to your machine; screen-share it or have them clone and run their own copy |

The application does not need Node.js. If you already have Node installed and
want a JavaScript syntax check, you can optionally run this from the repository
root:

```powershell
node --check .\claims-checker\web\ui.js
node --check .\claims-checker\web\api.js
node --check .\claims-checker\web\home.js
node --check .\claims-checker\web\app.js
```

## Preparing and publishing the repository

**Publish the repository root, not just the inner application folder.** That
includes this README, both application and frontend code, synthetic CSV,
facilitator notes, and the root-level custom agent.

### Before the first push

- Keep the sample dataset fictional; do not substitute real claims or providers.
- Check that no credentials, local environment files, private screenshots,
  virtual environments, caches, or logs are included.
- Keep both planted bugs for the starter version; create a learner branch or
  copy before making classroom repairs.
- Decide whether students should be able to read the facilitator answer key.
- Choose private or public visibility deliberately. Public readers can inspect
  every published source file and the exercise answers.
- Select a license approved for your use before inviting broader redistribution.
  No license has been selected or added to this starter; a public repository
  alone is not a replacement for a license.

The root ignore rules cover local Python environments, bytecode, pytest and
coverage output, common tool caches, `.env` files, local package-index
credentials, logs, and OS metadata. `.env.example` is allowed if you later add
a non-secret example. Ignore rules are not a secret scanner and do not remove
files that have already been committed.

### Create an empty GitHub repository

Use `claims-checker` or your preferred repository name. Because the files already
exist locally, do not initialize the remote with another README, ignore template,
or license during this first-push flow.

Run these commands **only when you are ready to publish**, from the repository
root. Replace `YOUR-OWNER` and the repository name with your actual GitHub values:

```powershell
git init -b main
git status --short
git add .
git --no-pager diff --cached --stat
git --no-pager diff --cached
```

Review the staged content before proceeding:

```powershell
git commit -m "Initial Claims Lab training project"
git remote add origin https://github.com/YOUR-OWNER/claims-checker.git
git push -u origin main
```

If you already initialized Git, have an existing `origin`, or created files in
the remote repository, inspect the existing setup first rather than running this
fresh-repository sequence blindly. Do not use a force push to resolve a first
push mismatch.

This documentation does not initialize Git, create a commit, or publish anything
automatically. No workflow, deployment, or automatic bug-fixing process is added.

### GitHub Pages is not the application server

The interface calls local Python endpoints and relies on server-side shared
header injection. Publishing these files to GitHub, or enabling static GitHub
Pages hosting, does not run that Python backend. Students should clone the
repository and run `demo.py` locally. Internet deployment is outside this lab.

## Limitations and responsible use

- This is a local teaching server, not a service for production use or exposure
  to other devices. It has no user accounts, authentication, payment workflow,
  database, durable results, or claim editing/upload interface.
- The validation rules are deliberately incomplete. An empty problem list means
  only that the current implemented rules returned no problems.
- NPI checks are mathematical, not identity verification.
- Amount aggregation uses floating-point arithmetic for the lesson. It is not a
  recommendation for production financial calculations.
- Full tracebacks may contain local filesystem paths. Review screenshots and
  copied logs before publishing them.
- Do not put real data into the sample, a Copilot prompt, or an issue.
- Copilot-generated explanations and tests can be wrong. Inspect code, run
  commands, and verify measurable results before accepting a change.

For the detailed answer key and suggested debrief, see
[FACILITATOR_NOTES.md](claims-checker/FACILITATOR_NOTES.md).
