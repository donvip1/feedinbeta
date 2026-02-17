

# FeedIn Wallet: 70/30 Supply Distribution

## How It Will Work

The total credit supply is 1 billion. The Super Admin/CEO holds 70% as the unlimited minting reserve, and 30% flows into the FeedIn Wallet for circulation to all users.

```text
Total Supply: 1,000,000,000
    |
    +-- 70% Super Admin Reserve: 700,000,000 (minting source, stays untouched)
    |
    +-- 30% FeedIn Wallet: 300,000,000 (circulation fund)
              |
              +-- Already distributed to users: 10,297
              |
              +-- Available balance: 299,989,703
```

The Super Admin's personal balance (~999,997,055) remains as-is -- it represents the unlimited minting power. When the CEO funds the FeedIn Wallet, credits move from this reserve into the wallet.

## Data Changes

| Record | Field | Current Value | New Value |
|--------|-------|---------------|-----------|
| `credit_supply` | `total_supply` | 100,000,000 | 1,000,000,000 |
| `credit_supply` | `circulating_supply` | ~1,000,007,352 | 10,297 |
| `platform_wallet` | `balance` | 0 | 299,989,703 |

The Super Admin's personal balance stays unchanged at ~999,997,055.

## How Credits Flow Going Forward

1. **CEO/Super Admin funds FeedIn Wallet** -- Credits transfer from the 70% reserve into the FeedIn Wallet (minting)
2. **FeedIn Wallet distributes** -- All subscriptions, admin transfers, gifts, and purchases deduct from the FeedIn Wallet's 299,989,703 balance
3. **When FeedIn Wallet runs low** -- The CEO mints more from their reserve into the wallet

## Technical Steps

1. Update `credit_supply`: set `total_supply` to 1B, `circulating_supply` to 10,297
2. Update `platform_wallet`: set `balance` to 299,989,703
3. Insert an audit `credit_transaction` recording this correction

No schema changes or code changes needed -- just data corrections to align with the 70/30 model.

