const vision = require('@google-cloud/vision');
const fs = require('fs');

let client = null;

function getVisionClient() {
  const keyPath = process.env.GOOGLE_VISION_KEY;

  if (!keyPath || !fs.existsSync(keyPath)) {
    return null;
  }

  if (!client) {
    client = new vision.ImageAnnotatorClient({ keyFilename: keyPath });
  }

  return client;
}

/**
 * Extract text from receipt image using Google Vision API
 */
exports.extractReceiptData = async (imagePath) => {
  try {
    if (!fs.existsSync(imagePath)) {
      throw new Error('Image file not found');
    }

    const visionClient = getVisionClient();
    if (!visionClient) {
      console.warn('Google Vision key not configured or file not found. Using fallback OCR values.');
      return {
        amount: null,
        storeName: null,
        date: null,
        confidence: 0,
        rawText: 'Vision key missing'
      };
    }

    // Read image file
    const imageContent = fs.readFileSync(imagePath);

    // Call Google Vision API
    const request = {
      image: { content: imageContent },
    };

    console.log('Sending to Google Vision API...');
    const [result] = await visionClient.textDetection(request);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      return {
        amount: null,
        storeName: 'Unknown Store',
        date: new Date().toISOString().split('T')[0],
        confidence: 0,
        rawText: ''
      };
    }

    // Get full text
    const fullText = detections[0].description;
    console.log('Extracted text:', fullText.substring(0, 100) + '...');

    // Extract amount (looks for currency patterns)
    const amount = extractAmount(fullText);

    // Extract store name (usually first few words)
    const storeName = extractStoreName(fullText);

    // Extract date
    const date = extractDate(fullText);

    return {
      amount: amount || null,
      storeName: storeName || 'Receipt Purchase',
      date: date || new Date().toISOString().split('T')[0],
      confidence: detections[0].confidence || 0.85,
      rawText: fullText
    };

  } catch (err) {
    console.error('OCR error:', err.message);
    // Return null for all fields - let controller handle fallback
    return {
      amount: null,
      storeName: null,
      date: null,
      confidence: 0,
      rawText: err.message
    };
  }
};

/**
 * Extract amount from OCR text
 * Looks for currency amounts like: ₹500, $50.99, 100.50
 */
function extractAmount(text) {
  // Match patterns like: ₹500, $50.99, 100.50
  const patterns = [
    /₹\s*([0-9]+\.?[0-9]*)/,           // Indian Rupee
    /\$\s*([0-9]+\.?[0-9]*)/,          // Dollar
    /[Tt]otal[^\n]*?([0-9]+\.?[0-9]+)/, // "Total 500"
    /[Aa]mount[^\n]*?([0-9]+\.?[0-9]+)/ // "Amount 500"
  ];

  for (let pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const amount = parseFloat(match[1]);
      if (amount > 0 && amount < 1000000) { // Sanity check
        return amount;
      }
    }
  }

  return null;
}

/**
 * Extract store name from OCR text
 */
function extractStoreName(text) {
  // Usually first line or first few words
  const lines = text.split('\n').filter(l => l.trim().length > 0);

  if (lines.length === 0) return null;

  // Get first non-empty line (usually store name)
  const firstLine = lines[0].trim();

  // Remove common words
  return firstLine
    .replace(/Receipt|Invoice|Bill|Memo/gi, '')
    .trim()
    .substring(0, 50); // Limit length
}

/**
 * Extract date from OCR text
 */
function extractDate(text) {
  // Look for date patterns: DD/MM/YYYY, MM-DD-YYYY, etc.
  const patterns = [
    /(\d{1,2})\/(\d{1,2})\/(\d{4})/,     // DD/MM/YYYY
    /(\d{1,2})-(\d{1,2})-(\d{4})/,       // DD-MM-YYYY
    /(\d{4})\/(\d{1,2})\/(\d{1,2})/,    // YYYY/MM/DD
  ];

  for (let pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      try {
        // Parse and return as ISO string
        const date = new Date(match[3], match[2] - 1, match[1]);
        return date.toISOString().split('T')[0];
      } catch (e) {
        continue;
      }
    }
  }

  // Fallback to today
  return new Date().toISOString().split('T')[0];
}

module.exports = exports;