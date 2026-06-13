const axios = require('axios');
const { createGrokError } = require('./grokError');

const createGrokRequestError = (error, context) => createGrokError('GrokImageError', error, context);

class GrokImageService {
  constructor() {
    this.apiKey = process.env.GROK_API;
    this.model = process.env.GROK_IMAGE_MODEL || 'grok-imagine-image';
    this.endpoint = 'https://api.x.ai/v1/images/generations';
  }

  isConfigured() {
    return Boolean(this.apiKey);
  }

  async generateImage({
    prompt,
    aspectRatio = '3:4',
    resolution = '2k',
    responseFormat = 'url',
  }) {
    if (!this.apiKey) {
      throw new Error('GROK_API is not configured');
    }

    let response;

    try {
      response = await axios.post(
        this.endpoint,
        {
          prompt,
          model: this.model,
          response_format: responseFormat,
          aspect_ratio: aspectRatio,
          resolution,
          n: 1,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 45000,
        }
      );
    } catch (error) {
      throw createGrokRequestError(error, {
        endpoint: this.endpoint,
        model: this.model,
        aspectRatio,
        resolution,
        responseFormat,
        promptLength: prompt ? prompt.length : 0,
      });
    }

    const image = response.data?.data?.[0];
    if (!image) {
      return null;
    }

    return {
      url: image.url,
      revisedPrompt: image.revised_prompt,
      model: this.model,
      aspectRatio,
      resolution,
    };
  }
}

module.exports = GrokImageService;