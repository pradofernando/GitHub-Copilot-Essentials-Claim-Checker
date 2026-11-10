# Facilitator notes

## Training setup

This is deliberately unfinished classroom code, not a production claims system.
Every beneficiary, provider, identifier, and claim is fictional. The NPIs are
synthetic checksum examples, not real provider assignments. Do not send this data
to a claims system or replace it with real patient information.

Use Python 3.10 or newer. From the project directory, run:

```text
python main.py data/sample_claims.csv
```

The repository includes a detailed [README](../README.md) for setup, architecture,
the visual demo, and publishing. The starter still contains no tests so learners
can generate them with Copilot. Installing the optional classroom dependency
with `python -m pip install -r requirements.txt` makes pytest available for that
work. For documentation practice, have learners improve or extend the existing
README rather than generate a second, conflicting setup guide.

Avoid opening these answer-key notes during the learner exercise until the
debrief. Publishing the full repository makes these notes and the README's
collapsed facilitator section readable; neither is access-controlled.

## Copilot unit-test agent

The workspace includes a [Claims Unit Tests custom agent](../.github/agents/claims-unit-tests.agent.md).
With the parent `CMS Essentials Demo` folder open in VS Code, open Copilot Chat
and select **Claims Unit Tests** from the agent picker. If the new agent is not
listed yet, use **Developer: Reload Window** and open the picker again.

Example class prompts:

- "Create and run beginner-friendly pytest tests for the claim validators.
  Do not fix the application code."
- "Add tests for CSV loading and total billing, including quoted thousands
  separators. Explain any failures."
- "Create a green starter suite using strict expected-failure markers only for
  the two reproduced classroom bugs."

The agent writes tests under `claims-checker/tests/` when invoked. By default,
tests assert intended behavior and expose the planted bugs as failures; they
do not redefine the broken behavior as correct. It runs pytest from the app
directory, keeps the sample data and application unchanged, and explains results
for beginners. Adding the agent does not generate tests; the testing agent also
does not edit repository documentation.

## Optional audience dashboard

The original command-line exercise is unchanged. For a visual, local-only demo,
run this from the project directory:

```text
python demo.py
```

Open `http://127.0.0.1:8765` for the explanatory homepage, or
`http://127.0.0.1:8765/lab` for the full workbench. Use
`python demo.py --port 8766` if the default port is already in use.
Stop the server with Ctrl+C.
No npm install, web framework, or additional Python dependency is needed.
The [demo server](demo.py) serves the [homepage](web/home.html) and
[workbench](web/index.html) and reads only the existing synthetic sample CSV;
there is no upload feature or cloud service.
The core exercise remains 148 Python lines; the optional demo is separate.

The homepage and workbench share the same paper-trail design and sticky top
navigation. Every section is available from either page: **Home**, **The idea**,
**How it works**, **Live example**, **Workbench**, **Claims**, **Validation**,
**Raw data**, **Python source**, and **Execution trace**. Inspector links open the
requested tab directly. Selecting a sample claim also updates workbench links
so entering the workbench keeps that claim rather than resetting to the first row.
Switching top tabs within the workbench keeps the current run and selected claim.

Use the **Dark mode / Light mode** button in the header to change the whole site.
Your choice is saved in this browser and survives navigation and reloads. Before
an explicit choice is saved, the site follows the system theme. Both palettes
use high-contrast text, including helper labels, source code, errors, inputs,
and inactive or disabled controls. Theme settings contain no claim data.

Suggested audience flow:

Start on the homepage at desktop width. **The idea** explains what a claim is
without requiring healthcare knowledge. **How it works** follows the real
`load_claims` -> `validate_claim` -> `summarize` pipeline. In **Live example**,
choose a claim and click **Run live example**. This runs the actual sample batch
and focuses on the selected row; changing the dropdown after a run inspects
another row from that same recorded batch, not a newly executed call.
CLM-0001 returns NPI `True`, date comparison `False`, and state `True` in the
unmodified starter. CLM-0005 illustrates a failed NPI check, and CLM-0007 shows
the current date rule returning `True` for a reversed date range.
**See this function** opens actual saved Python source. The batch error remains
visible even when the selected claim itself has no returned problems.
**Inspect in the workbench** carries the selected claim to the full explorer;
click **Run checks** there to capture a fresh run.

Then open the workbench:

1. Start on **Workbench** and explain the input: 25 synthetic claims, with no
   patient or real provider information. Nothing has been validated yet.
2. Click **Run checks**. The counters and claim badges come from the actual
   `validate_claim` return values. The unmodified starter shows 2 valid and
   23 flagged claims. The billing card stays unavailable because the real
   `summarize` call raises an exception; this is not a successful summary.
3. Select a claim. Expand its validation cards to see real function arguments
   and returns. **Raw data** shows the CSV fields without cleaning them.
   The NPI card also includes a labeled arithmetic illustration, separate from
   the observed Python result.
4. Open **Python source** to show the function as saved on disk. Pipeline steps
   and **View Python source** buttons link directly to the relevant snapshot.
5. In **Execution trace**, inspect the recorded events and full traceback.
   **Inspect exception** selects CLM-0004 and highlights the failing billing
   statement. **Replay trace** replays the already-recorded execution; it does
   not pretend Python is still running or change validation results.
6. Make a repair with Copilot in VS Code, save it, and click **Run checks** again.
   The server reloads the actual saved validator and report source on every run,
   including rapid edits; no server restart is needed. There is no repaired
   demonstration mode and no alternate validator hiding the planted bugs.
7. Use **Present** for larger text when sharing your screen. Top navigation stays
   available; the workbench has no separate sidebar. Escape exits presentation
   mode. At mobile widths, the top tabs scroll horizontally rather than hiding.

The server observes calls to `is_valid_*` functions without replacing their
logic. New inline rules still affect the returned problems and badges, even
when they do not have a separate function card. Python failures are visible in
the browser and logged to the terminal; an interrupted run returns HTTP 500
with its partial validation results, not a made-up billing total.
Code, CSS, JavaScript, and data are all served locally without external assets.
Only loopback connections and same-origin requests are accepted. This small
teaching server is not intended for deployment or real claims.

## The two planted bugs

| File | Function | What goes wrong | How it shows up in class |
| --- | --- | --- | --- |
| [validators.py](claims_checker/validators.py) | `is_valid_date_range` | The comparison uses `service >= submitted` instead of `service <= submitted`. Same-day dates pass, but earlier service dates fail and later service dates pass. | Most ordinary claims get a misleading date problem. The two genuinely reversed date ranges slip through. The initial validation pass flags 23 claims and treats 2 as valid. |
| [report.py](claims_checker/report.py) | `total_billed` | `float()` receives the billed string without removing thousands separators. | After printing flagged claims, the CLI crashes at CLM-0004 with `ValueError: could not convert string to float: '1,250.00'`. No summary is printed. Remove commas before conversion to repair this exercise. |

Preserve these bugs in the starter. The dense NPI validator is correct and is a
separate readability/refactoring exercise, not a third planted bug.

## Deliberate data problems

Rows below count claims starting at 1; CSV file lines include the header.
All problems are in [sample_claims.csv](data/sample_claims.csv).

| Claim row | CSV line | Claim ID | Problem |
| --- | --- | --- | --- |
| 5 | 6 | CLM-0005 | NPI `9000000057` has the wrong check digit; the checksum-valid value is `9000000056`. |
| 7 | 8 | CLM-0007 | Service date `2026-01-20` is after submission date `2026-01-16`. |
| 11 | 12 | CLM-0011 | Procedure code `9300` has only 4 characters. The starter does not check procedure length. |
| 14 | 15 | CLM-0014 | NPI `9000000040` has the wrong check digit; the checksum-valid value is `9000000049`. |
| 17 | 18 | CLM-0017 | Service date `2026-02-16` is after submission date `2026-02-12`. |
| 21 | 22 | CLM-0021 | State is empty. |

Comma-formatted billed amounts occur on claim rows 4, 9, 13, 18, and 24. These
are legitimate formatted amounts, not additional data errors. The CSV quotes
each amount so its comma stays inside one field.

## How an NPI check digit works

An NPI has 10 digits. The first 9 form the body; the last digit is a check digit
chosen to catch common typing errors. Passing this arithmetic check does not
prove that a provider exists or that an identifier has been assigned.

1. Put the fixed prefix `80840` in front of the full 10-digit NPI.
2. Start at the far right. Leave the rightmost digit alone, double the next one,
   leave the next one alone, and keep alternating toward the left.
3. If doubling gives two digits, add those digits together: 16 becomes 1 + 6 = 7.
4. Add all the resulting digits. A valid NPI produces a multiple of 10.

For a 10-digit NPI, the prefix always contributes 24 to this sum. That is why
the compact implementation can check the NPI digits and add 24 instead of
building the prefixed string.

To generate a check digit, start with a 9-digit body and a temporary final zero.
Run the same calculation, then choose the final digit that rounds the sum up to
the next multiple of 10 (use zero if the sum already divides evenly). For example,
body `900000001` needs check digit `5`, producing `9000000015`.

## Expected result after both bugs are fixed

Keep the sample data unchanged and do not add the procedure-length rule yet:

```text
Claim summary
------------------------------------
Total claims: 25
Valid claims: 20
Flagged claims: 5
Total billed: $12,264.00
```

The flagged IDs are CLM-0005, CLM-0007, CLM-0014, CLM-0017, and CLM-0021.
The billing total includes all 25 claims, including flagged claims.
CLM-0011 still counts as valid because no procedure-length check exists yet.

## Suggested stretch task

Add a check in `validate_claim` that `procedure_code` is exactly 5 characters.
After both bugs are fixed and this rule is added, CLM-0011 should also be flagged:
19 valid claims, 6 flagged claims, and the same total billed amount of $12,264.00.
