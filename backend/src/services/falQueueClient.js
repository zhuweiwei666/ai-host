const axios = require('axios');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Minimal fal.ai Queue API client (server-side).
 * Docs: https://docs.fal.ai/model-endpoints/queue/
 */
async function falQueueSubmit(modelId, input, { timeoutMs = 180_000 } = {}) {
  if (!process.env.FAL_KEY) {
    throw new Error('FAL_KEY not configured');
  }

  const url = `https://queue.fal.run/${modelId}`;
  const res = await axios.post(
    url,
    { input },
    {
      headers: {
        Authorization: `Key ${process.env.FAL_KEY}`,
        'Content-Type': 'application/json',
      },
      timeout: 30_000,
    },
  );

  const data = res.data;
  if (!data?.request_id || !data?.status_url || !data?.response_url) {
    throw new Error(`Unexpected fal queue submit response: ${JSON.stringify(data).slice(0, 500)}`);
  }

  const deadline = Date.now() + timeoutMs;
  let backoffMs = 700;

  while (Date.now() < deadline) {
    const statusRes = await axios.get(data.status_url, {
      headers: { Authorization: `Key ${process.env.FAL_KEY}` },
      timeout: 20_000,
    });

    const status = statusRes.data?.status;
    if (status === 'COMPLETED') {
      const outRes = await axios.get(data.response_url, {
        headers: { Authorization: `Key ${process.env.FAL_KEY}` },
        timeout: 30_000,
      });
      return {
        requestId: data.request_id,
        result: outRes.data,
      };
    }

    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`fal request ${data.request_id} ${status}: ${JSON.stringify(statusRes.data).slice(0, 800)}`);
    }

    await sleep(backoffMs);
    backoffMs = Math.min(2500, Math.floor(backoffMs * 1.15));
  }

  throw new Error(`fal request timeout after ${timeoutMs}ms (model=${modelId})`);
}

module.exports = {
  falQueueSubmit,
};
