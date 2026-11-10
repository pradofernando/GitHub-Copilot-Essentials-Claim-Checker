import argparse
from pathlib import Path

from claims_checker.report import load_claims, summarize
from claims_checker.validators import validate_claim


def parse_args():
    parser = argparse.ArgumentParser(
        description="Check a batch of claims and print a billing summary."
    )
    parser.add_argument(
        "csv_path",
        type=Path,
        help="Path to a claims CSV file",
    )
    return parser.parse_args()


def print_flagged(claim, problems):
    claim_id = claim.get("claim_id") or "(unknown claim)"
    provider = claim.get("provider_name") or "(unknown provider)"
    print(f"{claim_id} | {provider}")
    for problem in problems:
        print(f"  - {problem}")


def print_summary(summary):
    print()
    print("Claim summary")
    print("-" * 36)
    print(f"Total claims: {summary['total_claims']}")
    print(f"Valid claims: {summary['valid_claims']}")
    print(f"Flagged claims: {summary['flagged_claims']}")
    print(f"Total billed: ${summary['total_billed']:,.2f}")


def main():
    args = parse_args()
    claims = load_claims(args.csv_path)

    print(f"Claims file: {args.csv_path.name}")
    print(f"Loaded {len(claims)} claims")
    print()
    print("Flagged claims")
    print("-" * 36)
    found = False
    for claim in claims:
        issues = validate_claim(claim)
        if issues:
            print_flagged(claim, issues)
            found = True
    if not found:
        print("No claims were flagged.")

    summary = summarize(claims)
    print_summary(summary)


if __name__ == "__main__":
    main()
