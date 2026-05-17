const axios = require('axios');

const MAX_LOG_VALUE_LENGTH = 4000;

function truncateForLog(value, maxLength = MAX_LOG_VALUE_LENGTH) {
  if (value === undefined || value === null) {
    return value;
  }

  const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
  if (stringValue.length <= maxLength) {
    return stringValue;
  }

  return `${stringValue.slice(0, maxLength)}...[truncated]`;
}

function createGrokRequestError(error, context) {
  const response = error.response;
  const requestId = response?.headers?.['x-request-id'] || response?.headers?.['request-id'] || null;
  const enrichedError = new Error(error.message);

  enrichedError.name = 'GrokImageError';
  enrichedError.code = error.code;
  enrichedError.statusCode = response?.status;
  enrichedError.statusText = response?.statusText;
  enrichedError.requestId = requestId;
  enrichedError.responseData = truncateForLog(response?.data);
  enrichedError.context = context;
  enrichedError.cause = error;

  return enrichedError;
}

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