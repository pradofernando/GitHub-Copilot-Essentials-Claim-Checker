from datetime import date


STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC",
    "FL", "GA", "HI", "ID", "IL", "IN", "IA", "KS", "KY",
    "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT",
    "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
    "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT",
    "VT", "VA", "WA", "WV", "WI", "WY",
}


def is_valid_npi(npi):
    n = str(npi).strip()
    if len(n) != 10 or not n.isascii() or not n.isdigit():
        return False
    return (24 + sum((int(x) * 2 // 10 + int(x) * 2 % 10) if i % 2 else int(x) for i, x in enumerate(n[::-1]))) % 10 == 0


def is_valid_date_range(date_of_service, date_submitted):
    service = date.fromisoformat(date_of_service)
    submitted = date.fromisoformat(date_submitted)
    return service >= submitted


def is_valid_state(state):
    if not state:
        return False
    return state.strip().upper() in STATES


def validate_claim(row):
    problems = []
    if not is_valid_npi(row.get("provider_npi", "")):
        problems.append("Provider NPI is invalid.")

    try:
        dates_ok = is_valid_date_range(
            row.get("date_of_service", ""), row.get("date_submitted", "")
        )
    except ValueError:
        problems.append("Service and submission dates must use YYYY-MM-DD.")
    else:
        if not dates_ok:
            problems.append("Date of service cannot be after date submitted.")

    if not is_valid_state(row.get("state", "")):
        problems.append("State must be a two-letter US state code.")

    return problems
