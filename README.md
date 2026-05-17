# ThinkPack Solo Backend

Cloud backend for ThinkPack Solo - a fractal AI conversation app with multi-agent support.

## Features

- 📱 **Device-based Authentication** - Simple, secure auth for mobile apps
- 💬 **Conversation Storage** - Cloud sync for fractal conversations
- 📚 **Document Management** - Store and sync e-reader documents
- 🔄 **Real-time Sync** - Keep data synchronized across devices
- 🛡️ **Security** - Rate limiting, input validation, and error handling
- 📊 **Monitoring** - Health checks and detailed metrics
- 🐳 **Containerized** - Ready for Google Cloud Run deployment

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB (with MongoDB Atlas support)
- **Deployment**: Docker + Google Cloud Run
- **Authentication**: Device ID + JWT (optional)

## Getting Started

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Docker (for containerization)

### Local Development

1. **Clone and setup**:
   ```bash
   cd backend
   npm install
   ```

2. **Environment configuration**:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB URI and other settings
   ```

3. **Start MongoDB** (if using local):
   ```bash
   mongod
   ```

4. **Run the server**:
   ```bash
   npm run dev  # Development with nodemon
   npm start    # Production
   ```

5. **Test the API**:
   ```bash
   curl http://localhost:8080/health
   ```

### Docker Development

```bash
# Build image
docker build -t thinkpack-solo-backend .

# Run container
docker run -p 8080:8080 --env-file .env thinkpack-solo-backend
```

## API Endpoints

### Health Checks
- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed system health
- `GET /health/ready` - Readiness probe
- `GET /health/live` - Liveness probe

### Conversations
- `GET /api/conversations` - List conversations
- `GET /api/conversations/:id` - Get specific conversation
- `POST /api/conversations` - Create new conversation
- `PUT /api/conversations/:id` - Update conversation
- `POST /api/conversations/:id/messages` - Add message
- `DELETE /api/conversations/:id` - Delete conversation
- `GET /api/conversations/search/:query` - Search conversations

### Documents
- `GET /api/documents` - List documents
- `GET /api/documents/:id` - Get specific document
- `POST /api/documents` - Upload document
- `PATCH /api/documents/:id` - Update document progress
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/search/:query` - Search documents
- `GET /api/documents/stats/overview` - Document statistics

## Authentication

The API uses device-based authentication:

```javascript
// Required headers for all /api/* endpoints
headers: {
  'X-User-ID': 'your-device-id',
  'Authorization': 'Bearer your-jwt-token' // Optional but recommended
}
```

## Data Models

### Conversation
```json
{
  "id": "string",
  "title": "string",
  "messages": [
    {
      "id": "string",
      "content": "string",
      "role": "user|assistant",
      "timestamp": "date",
      "agentType": "openai|claude|gemini",
      "context": "string",
      "metadata": {}
    }
  ],
  "activeAgents": [
    {
      "id": "string",
      "name": "string",
      "type": "openai|claude|gemini",
      "isEnabled": true
    }
  ],
  "characterName": "string|null",
  "fractalDepth": 0,
  "createdAt": "date",
  "updatedAt": "date",
  "metadata": {}
}
```

### Document
```json
{
  "id": "string",
  "title": "string",
  "content": "string",
  "filePath": "string",
  "fileType": "string",
  "dateAdded": "date",
  "totalPages": 0,
  "currentPage": 0,
  "pages": ["string"],
  "bookmarks": [0],
  "highlights": [
    {
      "pageNumber": 0,
      "startIndex": 0,
      "endIndex": 0,
      "text": "string",
      "color": "yellow",
      "timestamp": "date"
    }
  ],
  "notes": [
    {
      "pageNumber": 0,
      "content": "string",
      "timestamp": "date"
    }
  ],
  "metadata": {}
}
```

## Deployment

### Google Cloud Run

1. **Setup Google Cloud**:
   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   ```

2. **Deploy using the repo script**:
  ```powershell
  cd scripts
  .\deploy.ps1
  ```

  Optional parameters:
  ```powershell
  .\deploy.ps1 -ProjectId YOUR_PROJECT_ID -Region us-central1 -ServiceName thinkpack-solo-backend
  ```

3. **Set environment variables**:
  ```powershell
  .\setup-env.ps1 -Environment production -ProjectId YOUR_PROJECT_ID -MongoDbUri "your-mongodb-atlas-uri"
   ```

4. **Alternative: deploy using Cloud Build**:
  ```bash
  gcloud builds submit --config cloudbuild.yaml
  ```

### Manual Docker Deployment

```bash
# Build and tag
docker build -t gcr.io/YOUR_PROJECT/thinkpack-solo-backend .

# Push to Container Registry
docker push gcr.io/YOUR_PROJECT/thinkpack-solo-backend

# Deploy to Cloud Run
gcloud run deploy thinkpack-solo-backend \
  --image gcr.io/YOUR_PROJECT/thinkpack-solo-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Database Setup

### MongoDB Atlas (Recommended for Production)

1. Create a MongoDB Atlas cluster
2. Get connection string
3. Set `MONGODB_URI` environment variable
4. Indexes will be created automatically on startup

### Local MongoDB

```bash
# Install MongoDB
# macOS: brew install mongodb-community
# Ubuntu: sudo apt install mongodb

# Start MongoDB
mongod

# Set MONGODB_URI=mongodb://localhost:27017/thinkpack_solo
```

## Security Considerations

- Device IDs should be UUIDs or similar secure identifiers
- Use HTTPS in production
- Set strong JWT secrets
- Configure MongoDB authentication
- Set up proper CORS origins
- Monitor rate limiting logs

## Monitoring

- Health checks at `/health/*`
- Request logging with Morgan
- Error tracking ready for Sentry integration
- MongoDB connection monitoring

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run with file watching
npm run dev

# Lint code
npm run lint
```

## Environment Variables

See `.env.example` for all available configuration options.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.