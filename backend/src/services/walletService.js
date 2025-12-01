const UserAIBalance = require('../models/UserAIBalance');
const WalletTransaction = require('../models/WalletTransaction');
const WalletTrace = require('../models/WalletTrace');

class WalletService {
  
  /**
   * Get user balance, creating wallet if not exists (with default 100 coins)
   */
  async getBalance(userId) {
    let wallet = await UserAIBalance.findOne({ userId });
    if (!wallet) {
      wallet = await UserAIBalance.create({ userId, balance: 100 });
      // Log initial gift
      await WalletTransaction.create({
        userId,
        type: 'reward',
        amount: 100,
        beforeBalance: 0,
        afterBalance: 100,
        itemType: 'new_user_gift',
        meta: { note: 'Welcome bonus' }
      });
    }
    return wallet.balance;
  }

  /**
   * Deduct coins. Throws error if insufficient funds.
   * Uses atomic operation to prevent race conditions.
   */
  async consume(userId, amount, itemType, refId = null) {
    if (amount <= 0) return true; // No cost

    // 1. Check balance first (optional optimization, but good for UX error message)
    const wallet = await UserAIBalance.findOne({ userId });
    if (!wallet || wallet.balance < amount) {
      console.log(`[Wallet] Insufficient funds for ${userId}. Has: ${wallet?.balance}, Needs: ${amount}`);
      throw new Error('INSUFFICIENT_FUNDS');
    }

    // 2. Atomic update: verify balance >= amount AND deduct
    const updatedWallet = await UserAIBalance.findOneAndUpdate(
      { userId, balance: { $gte: amount } },
      { $inc: { balance: -amount } },
      { new: true } // return updated doc
    );

    if (!updatedWallet) {
      // Double check fail - means concurrent deduction made balance insufficient
      console.log(`[Wallet] Concurrent insufficient funds for ${userId}`);
      throw new Error('INSUFFICIENT_FUNDS');
    }

    console.log(`[Wallet] Consumed ${amount} for ${userId}. New Balance: ${updatedWallet.balance}`);

    // Async log transaction
    WalletTransaction.create({
      userId,
      type: 'consume',
      amount: -amount,
      beforeBalance: updatedWallet.balance + amount,
      afterBalance: updatedWallet.balance,
      itemType,
      refId
    }).catch(err => console.error('[Wallet] Transaction Log Error:', err));

    return updatedWallet.balance;
  }

  /**
   * Add coins (e.g. ad reward)
   * @param {string} userId - User ID
   * @param {number} amount - Amount to reward
   * @param {string} itemType - Type of reward (e.g. 'ad_reward')
   * @param {string} refId - Optional reference ID (can be traceId for duplicate prevention)
   * @param {string} traceId - Optional trace ID for duplicate prevention (if provided, checks for duplicates)
   */
  async reward(userId, amount, itemType, refId = null, traceId = null) {
    if (amount <= 0) return;

    // Check for duplicate traceId if provided
    if (traceId) {
      const existingTrace = await WalletTrace.findOne({ traceId });
      if (existingTrace) {
        throw new Error('DUPLICATE_REWARD');
      }
    }

    // Atomic upsert
    const updatedWallet = await UserAIBalance.findOneAndUpdate(
        { userId },
        { $inc: { balance: amount } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    console.log(`[Wallet] Rewarded ${amount} to ${userId}. New Balance: ${updatedWallet.balance}`);

    // Record traceId if provided (for duplicate prevention)
    if (traceId) {
      await WalletTrace.create({
        traceId,
        userId,
        itemType,
        amount
      }).catch(err => console.error('[Wallet] Trace Log Error:', err));
    }

    // Log transaction
    WalletTransaction.create({
      userId,
      type: 'reward',
      amount: amount,
      beforeBalance: updatedWallet.balance - amount,
      afterBalance: updatedWallet.balance,
      itemType,
      refId: refId || traceId
    }).catch(err => console.error('[Wallet] Transaction Log Error:', err));

    return updatedWallet.balance;
  }
}

module.exports = new WalletService();

