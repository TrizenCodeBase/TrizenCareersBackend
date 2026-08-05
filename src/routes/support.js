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
    const targetUrl = `${emailServiceUrl.replace(/\/$/, '')}/api/support/send-custom`;

    logger.info('Proxying email request to support service:', {
      url: targetUrl,
      recipient: req.body.clientEmail
    });

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey
      },
      body: JSON.stringify(req.body)
    });

    const rawBody = await response.text();
    let data;

    try {
      data = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      logger.error('Email service returned non-JSON response:', {
        status: response.status,
        contentType: response.headers.get('content-type'),
        bodyPreview: rawBody.slice(0, 200)
      });
      return res.status(502).json({
        success: false,
        message: 'Email service returned an unexpected response (not JSON). Check EMAIL_SERVICE_URL and that the support email service is healthy.',
        status: response.status
      });
    }

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
