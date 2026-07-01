const express = require('express');
const Transaction = require('../models/Transaction');

const router = express.Router();

/**
 * GET /api/transactions
 * Returns paginated list of transactions with optional filtering
 */
router.get('/api/transactions', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    console.log(
      `[Transactions] Fetching transactions: page=${page}, limit=${limit}, status=${status}`
    );

    // Build query filter
    const filter = {};
    if (status) {
      filter.status = status;
    }

    // Calculate skip for pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(
      100,
      Math.max(1, parseInt(limit, 10) || 20)
    );
    const skip = (pageNum - 1) * limitNum;

    // Query transactions
    const transactions = await Transaction.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    // Get total count
    const total = await Transaction.countDocuments(filter);

    console.log(
      `[Transactions] Returned ${transactions.length} of ${total} transactions`
    );

    res.json({
      transactions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/transactions/:id
 * Returns a single transaction with full webhookEvents array
 */
router.get('/api/transactions/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log(`[Transactions] Fetching transaction: ${id}`);

    const transaction = await Transaction.findById(id);

    if (!transaction) {
      throw {
        status: 404,
        message: 'Transaction not found'
      };
    }

    console.log(`[Transactions] Transaction found: ${id}`);

    res.json(transaction);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
