import csv
from pathlib import Path

from claims_checker.validators import validate_claim


def load_claims(path):
    with Path(path).open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        return list(reader)


def total_billed(claims):
    total = 0.0
    for claim in claims:
        total += float(claim["billed_amount"])
    return total


def summarize(claims):
    valid = 0
    flagged = 0
    for claim in claims:
        problems = validate_claim(claim)
        if problems:
            flagged += 1
        else:
            valid += 1

    return {
        "total_claims": len(claims),
        "valid_claims": valid,
        "flagged_claims": flagged,
        "total_billed": total_billed(claims),
    }
