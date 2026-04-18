def compute_forum_type_by_claim_amount(claim_amount: float | int | None) -> int:
    amount = float(claim_amount or 0)

    # Preserving your stable mapping:
    # DCDRC = 1, SCDRC = 2, NCDRC = 3
    if amount <= 5000000:
        return 1
    if amount <= 20000000:
        return 2
    return 3