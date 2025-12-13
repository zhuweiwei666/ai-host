/**
 * Backfill ledger + snapshot from legacy UserAIBalance.
 *
 * Usage (inside backend container):
 *   node src/scripts/backfillLedgerFromLegacy.js
 *
 * Safe to re-run: uses deterministic idempotencyKey per user.
 */
const connectDB = require('../config/db');
const UserAIBalance = require('../models/UserAIBalance');
const ledgerService = require('../services/ledgerService');

async function main() {
  await connectDB();

  const users = await UserAIBalance.find({}).select('userId balance').lean();
  let ok = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    const userId = u.userId;
    const bal = Number(u.balance) || 0;
    if (!userId) continue;
    if (bal <= 0) {
      skipped++;
      continue;
    }
    try {
      await ledgerService.applyCreditsMutation({
        userId,
        delta: bal,
        reason: 'open_balance_migration',
        idempotencyKey: `migration:open_balance:${userId}`,
        type: 'adjustment',
        refType: 'legacy',
        refId: userId,
        meta: { legacyBalance: bal },
      });
      ok++;
    } catch (e) {
      failed++;
      console.error('[FAIL]', userId, e?.message || e);
    }
  }

  console.log('DONE', { total: users.length, ok, skipped, failed });
  process.exit(0);
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});

