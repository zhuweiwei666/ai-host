const axios = require('axios');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * fal.ai model runner (server-side) using the same pattern already used in this repo:
 * - POST https://fal.run/{modelId} with the model inputs as a flat JSON payload (NOT {input:{...}}).
 * - If it returns request_id, poll https://queue.fal.run/requests/{id} until COMPLETED.
 */
async function falRun(modelId, payload, { timeoutMs = 240_000, pollIntervalMs = 1500 } = {}) {
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY not configured');

  const endpoint = `https://fal.run/${modelId}`;

  const res = await axios.post(endpoint, payload, {
    headers: {
      Authorization: `Key ${process.env.FAL_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 60_000,
  });

  // Immediate response
  if (res.data && !res.data.request_id) {
    return { requestId: null, result: res.data };
  }

  const requestId = res.data?.request_id;
  if (!requestId) {
    throw new Error(`Unexpected fal response: ${JSON.stringify(res.data).slice(0, 500)}`);
  }

  const statusUrl = `https://queue.fal.run/requests/${requestId}/status`;
  const resultUrl = `https://queue.fal.run/requests/${requestId}`;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs);
    const statusRes = await axios.get(statusUrl, {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      timeout: 20_000,
    });

    const status = statusRes.data?.status;
    if (status === 'COMPLETED') {
      const outRes = await axios.get(resultUrl, {
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
        timeout: 30_000,
      });
      return { requestId, result: outRes.data };
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`fal request ${requestId} ${status}: ${JSON.stringify(statusRes.data).slice(0, 800)}`);
    }
  }

  throw new Error(`fal request timeout after ${timeoutMs}ms (model=${modelId})`);
}

module.exports = {
  falRun,
};
