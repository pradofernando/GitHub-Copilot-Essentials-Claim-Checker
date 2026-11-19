import pytest

from claims_checker.validators import validate_claim


@pytest.mark.parametrize(
    ("code", "is_valid"),
    [
        ("", False),
        ("9300", False),
        ("93000", True),
        ("A1234", True),
        ("930000", False),
        (None, False),
    ],
)
def test_validate_claim_procedure_code_length(code, is_valid):
    claim = {
        "provider_npi": "9000000015",
        "date_of_service": "2026-01-05",
        "date_submitted": "2026-01-05",
        "state": "MD",
        "procedure_code": code,
    }

    problems = validate_claim(claim)

    assert ("Procedure code must be exactly 5 characters." not in problems) == is_valid


def test_validate_claim_missing_procedure_code():
    claim = {
        "provider_npi": "9000000015",
        "date_of_service": "2026-01-05",
        "date_submitted": "2026-01-05",
        "state": "MD",
    }

    assert "Procedure code must be exactly 5 characters." in validate_claim(claim)