const express = require('express');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../config/database');
const { validateConversation, validatePagination } = require('../middleware/validation');

const router = express.Router();

function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Get all conversations for a user
router.get('/', validatePagination, async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, sortBy = 'updatedAt', sortOrder = 'desc' } = req.query;
    const userId = req.user.id;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    const [conversations, total] = await Promise.all([
      db.collection('conversations')
        .find({ userId })
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      db.collection('conversations').countDocuments({ userId })
    ]);

    res.json({
      success: true,
      data: {
        conversations: conversations.map(conv => ({
          ...conv,
          _id: conv._id.toString(),
        })),
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          hasNextPage: page * limit < total,
          hasPrevPage: page > 1,
        }
      }
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversations'
    });
  }
});

// Get a specific conversation
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID'
      });
    }

    const conversation = await db.collection('conversations').findOne({
      _id: new ObjectId(id),
      userId
    });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...conversation,
        _id: conversation._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch conversation'
    });
  }
});

// Create a new conversation
router.post('/', validateConversation, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const conversationData = {
      ...req.body,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      metadata: {
        ...req.body.metadata,
        version: '1.0',
        platform: req.headers['user-agent'] || 'unknown',
      }
    };

    const result = await db.collection('conversations').insertOne(conversationData);

    const newConversation = await db.collection('conversations').findOne({
      _id: result.insertedId
    });

    res.status(201).json({
      success: true,
      data: {
        ...newConversation,
        _id: newConversation._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create conversation'
    });
  }
});

// Update a conversation
router.put('/:id', validateConversation, async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID'
      });
    }

    const updateData = {
      ...req.body,
      updatedAt: new Date(),
      userId, // Ensure userId cannot be changed
    };

    // Remove fields that shouldn't be updated
    delete updateData._id;
    delete updateData.createdAt;

    // mongodb-driver v6 returns the document directly, not wrapped in { value }.
    const updated = await db.collection('conversations').findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...updated,
        _id: updated._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update conversation'
    });
  }
});

// Add a message to a conversation
router.post('/:id/messages', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;
    const { message } = req.body;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID'
      });
    }

    if (!message || !message.content || !message.role) {
      return res.status(400).json({
        success: false,
        error: 'Message content and role are required'
      });
    }

    const messageData = {
      ...message,
      id: require('uuid').v4(),
      timestamp: new Date(),
    };

    const updated = await db.collection('conversations').findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      {
        $push: { messages: messageData },
        $set: { updatedAt: new Date() }
      },
      { returnDocument: 'after' }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: {
        conversation: {
          ...updated,
          _id: updated._id.toString(),
        },
        newMessage: messageData
      }
    });
  } catch (error) {
    console.error('Error adding message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add message'
    });
  }
});

// Delete a conversation
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid conversation ID'
      });
    }

    const deleted = await db.collection('conversations').findOneAndDelete({
      _id: new ObjectId(id),
      userId
    });

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting conversation:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete conversation'
    });
  }
});

// Search conversations
router.get('/search/:query', async (req, res) => {
  try {
    const db = getDatabase();
    const { query } = req.params;
    const userId = req.user.id;

    if (!query || query.trim().length < 2 || query.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be 2-200 characters'
      });
    }

    const searchRegex = new RegExp(escapeRegex(query), 'i');

    const conversations = await db.collection('conversations')
      .find({
        userId,
        $or: [
          { title: searchRegex },
          { 'messages.content': searchRegex },
          { 'metadata.characterName': searchRegex },
        ]
      })
      .sort({ updatedAt: -1 })
      .limit(50)
      .toArray();

    res.json({
      success: true,
      data: {
        conversations: conversations.map(conv => ({
          ...conv,
          _id: conv._id.toString(),
        })),
        query,
        count: conversations.length
      }
    });
  } catch (error) {
    console.error('Error searching conversations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search conversations'
    });
  }
});

module.exports = router;