const express = require('express');
const { ObjectId } = require('mongodb');
const { getDatabase } = require('../config/database');
const { validateDocument, validatePagination } = require('../middleware/validation');

const router = express.Router();

// Get all documents for a user
router.get('/', validatePagination, async (req, res) => {
  try {
    const db = getDatabase();
    const { page = 1, limit = 20, fileType, sortBy = 'dateAdded', sortOrder = 'desc' } = req.query;
    const userId = req.user.id;

    const skip = (page - 1) * limit;
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Build filter
    const filter = { userId };
    if (fileType) {
      filter.fileType = fileType;
    }

    const [documents, total] = await Promise.all([
      db.collection('documents')
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray(),
      db.collection('documents').countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: {
        documents: documents.map(doc => ({
          ...doc,
          _id: doc._id.toString(),
          // Don't send full content in list view for performance
          content: undefined,
          pages: undefined,
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
    console.error('Error fetching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch documents'
    });
  }
});

// Get a specific document with full content
router.get('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    const document = await db.collection('documents').findOne({
      _id: new ObjectId(id),
      userId
    });

    if (!document) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...document,
        _id: document._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document'
    });
  }
});

// Create/upload a new document
router.post('/', validateDocument, async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const documentData = {
      ...req.body,
      userId,
      dateAdded: new Date(),
      lastOpened: null,
      syncStatus: 'synced',
      metadata: {
        ...req.body.metadata,
        uploadedAt: new Date(),
        platform: req.headers['user-agent'] || 'unknown',
      }
    };

    const result = await db.collection('documents').insertOne(documentData);

    const newDocument = await db.collection('documents').findOne({
      _id: result.insertedId
    });

    res.status(201).json({
      success: true,
      data: {
        ...newDocument,
        _id: newDocument._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create document'
    });
  }
});

// Update document progress/metadata
router.patch('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    const allowedUpdates = ['currentPage', 'lastOpened', 'bookmarks', 'highlights', 'notes'];
    const updateData = {};

    // Only allow specific fields to be updated
    Object.keys(req.body).forEach(key => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = req.body[key];
      }
    });

    updateData.lastOpened = new Date();

    const result = await db.collection('documents').findOneAndUpdate(
      { _id: new ObjectId(id), userId },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!result.value) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      data: {
        ...result.value,
        _id: result.value._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update document'
    });
  }
});

// Delete a document
router.delete('/:id', async (req, res) => {
  try {
    const db = getDatabase();
    const { id } = req.params;
    const userId = req.user.id;

    if (!ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid document ID'
      });
    }

    const result = await db.collection('documents').findOneAndDelete({
      _id: new ObjectId(id),
      userId
    });

    if (!result.value) {
      return res.status(404).json({
        success: false,
        error: 'Document not found'
      });
    }

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete document'
    });
  }
});

// Search documents
router.get('/search/:query', async (req, res) => {
  try {
    const db = getDatabase();
    const { query } = req.params;
    const userId = req.user.id;

    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 2 characters'
      });
    }

    const searchRegex = new RegExp(query, 'i');

    const documents = await db.collection('documents')
      .find({
        userId,
        $or: [
          { title: searchRegex },
          { content: searchRegex },
          { fileType: searchRegex },
        ]
      })
      .sort({ dateAdded: -1 })
      .limit(50)
      .project({ content: 0, pages: 0 }) // Exclude large fields for search results
      .toArray();

    res.json({
      success: true,
      data: {
        documents: documents.map(doc => ({
          ...doc,
          _id: doc._id.toString(),
        })),
        query,
        count: documents.length
      }
    });
  } catch (error) {
    console.error('Error searching documents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search documents'
    });
  }
});

// Get document statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const db = getDatabase();
    const userId = req.user.id;

    const stats = await db.collection('documents').aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: null,
          totalDocuments: { $sum: 1 },
          totalPages: { $sum: '$totalPages' },
          fileTypes: { $addToSet: '$fileType' },
          totalSize: { $sum: '$metadata.fileSize' },
          averagePages: { $avg: '$totalPages' },
        }
      }
    ]).toArray();

    const fileTypeStats = await db.collection('documents').aggregate([
      { $match: { userId } },
      {
        $group: {
          _id: '$fileType',
          count: { $sum: 1 },
          totalPages: { $sum: '$totalPages' },
        }
      },
      { $sort: { count: -1 } }
    ]).toArray();

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalDocuments: 0,
          totalPages: 0,
          fileTypes: [],
          totalSize: 0,
          averagePages: 0,
        },
        fileTypes: fileTypeStats
      }
    });
  } catch (error) {
    console.error('Error fetching document stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch document statistics'
    });
  }
});

module.exports = router;