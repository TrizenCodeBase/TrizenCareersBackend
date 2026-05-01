import express from 'express';
import fetch from 'node-fetch';
import { logger } from '../utils/logger.js';

const router = express.Router();

/**
 * Proxy route for sending emails via the Support Email Service
 * This avoids CORS issues when calling the service directly from the frontend
 */
router.post('/send-email', async (req, res) => {
  try {
    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || process.env.VITE_EMAIL_SERVICE_URL || 'https://trizensupportemailservice.llp.trizenventures.com';
    const apiKey = process.env.EMAIL_SERVICE_API_KEY || process.env.VITE_EMAIL_SERVICE_API_KEY || 'trizen-support-email-2024-secure-key-xyz789';

    logger.info('Proxying email request to support service:', {
      url: `${emailServiceUrl}/api/support/send-custom`,
      recipient: req.body.clientEmail
    });

    const response = await fetch(`${emailServiceUrl}/api/support/send-custom`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    
    if (!response.ok) {
      logger.error('Email service responded with error:', {
        status: response.status,
        data
      });
      return res.status(response.status).json(data);
    }

    res.status(200).json(data);
  } catch (error) {
    logger.error('Email proxy error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error while proxying email',
      error: error.message
    });
  }
});

export default router;
