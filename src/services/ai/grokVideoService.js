const axios = require('axios');
const { createGrokError } = require('./grokError');

const createGrokVideoError = (error, context) => createGrokError('GrokVideoError', error, context);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Grok Imagine Video — image-to-video generation.
 *
 * Flow: submit a job with an image URL + prompt + duration, get a request_id,
 * poll until status === 'done', return the resulting video URL.
 */
class GrokVideoService {
  constructor() {
    this.apiKey = process.env.GROK_API;
    // Defaults to the public 1.5 preview identifier; override via env if xAI
    // ships a new preview slug.
    this.model = process.env.GROK_VIDEO_MODEL || 'grok-imagine-video-1.5-preview';
    this.submitEndpoint = 'https://api.x.ai/v1/videos/generations';
    this.pollEndpoint = 'https://api.x.ai/v1/videos';
    this.pollIntervalMs = 3000;
    this.maxPollAttempts = 60; // 60 * 3s = 3 min ceiling
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generateVideo({ prompt, imageUrl, durationSec = 5 }) {
    if (!this.apiKey) throw new Error('GROK_API is not configured');
    if (!imageUrl) throw new Error('imageUrl is required for video generation');

    // 1) Submit the job
    let submitResponse;
    try {
      submitResponse = await axios.post(
        this.submitEndpoint,
        {
          model: this.model,
          prompt,
          image: { url: imageUrl },
          duration: durationSec,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );
    } catch (error) {
      throw createGrokVideoError(error, {
        endpoint: this.submitEndpoint,
        model: this.model,
        durationSec,
        promptLength: prompt ? prompt.length : 0,
      });
    }

    const requestId = submitResponse.data?.request_id || submitResponse.data?.id;
    if (!requestId) {
      throw new Error('Grok video API did not return a request_id');
    }

    // 2) Poll for completion
    for (let attempt = 0; attempt < this.maxPollAttempts; attempt++) {
      await sleep(this.pollIntervalMs);

      let pollResponse;
      try {
        pollResponse = await axios.get(`${this.pollEndpoint}/${requestId}`, {
          headers: { Authorization: `Bearer ${this.apiKey}` },
          timeout: 15000,
        });
      } catch (error) {
        // Transient poll errors — try again unless we're out of attempts.
        if (attempt === this.maxPollAttempts - 1) {
          throw createGrokVideoError(error, {
            endpoint: `${this.pollEndpoint}/${requestId}`,
            phase: 'poll',
            attempt,
          });
        }
        continue;
      }

      const status = pollResponse.data?.status;
      if (status === 'done' || status === 'completed' || status === 'succeeded') {
        const videoUrl = pollResponse.data?.video?.url
          || pollResponse.data?.data?.[0]?.url
          || pollResponse.data?.url;
        if (!videoUrl) throw new Error('Grok video API returned no video URL');
        return {
          url: videoUrl,
          model: this.model,
          durationSec,
        };
      }
      if (status === 'failed' || status === 'error') {
        const reason = pollResponse.data?.error || pollResponse.data?.message || 'unknown';
        throw new Error(`Grok video generation failed: ${reason}`);
      }
      // Otherwise still 'queued' / 'processing' — keep polling
    }

    throw new Error(`Grok video generation timed out after ${this.maxPollAttempts * this.pollIntervalMs / 1000}s`);
  }
}

module.exports = GrokVideoService;
