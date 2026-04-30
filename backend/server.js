'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');

const app = express();

const PORT = Number(process.env.PORT || 3100);
const KIE_API_KEY = process.env.KIE_API_KEY;
const KIE_IMAGE_MODEL = process.env.KIE_IMAGE_MODEL || 'nano-banana-2';

const KIE_IMAGE_CREATE_URL = 'https://api.kie.ai/api/v1/jobs/createTask';
const KIE_IMAGE_STATUS_URL = 'https://api.kie.ai/api/v1/jobs/recordInfo';

if (!KIE_API_KEY) {
  console.error('Missing KIE_API_KEY in backend/.env');
  process.exit(1);
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));

function kieHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${KIE_API_KEY}`
  };
}

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'kie-image-generator-backend' });
});

app.post('/api/generate-image', async (req, res) => {
  const prompt = String(req.body?.prompt || '').trim();
  if (!prompt) {
    return res.status(400).json({ error: 'Field "prompt" is required.' });
  }

  const model = String(req.body?.model || KIE_IMAGE_MODEL);

  const body = {
    model,
    input: {
      prompt,
      aspect_ratio: '3:4',
      resolution: '1K',
      output_format: 'png'
    }
  };

  try {
    const response = await fetch(KIE_IMAGE_CREATE_URL, {
      method: 'POST',
      headers: kieHeaders(),
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return res.status(response.status).json({ error: `KIE createTask failed: ${text}` });
    }

    const data = await response.json();
    const taskId = data.taskId || data.task_id || data.id || data?.data?.taskId || data?.data?.task_id;
    if (!taskId) {
      return res.status(502).json({ error: 'KIE response does not contain taskId.', raw: data });
    }

    return res.json({ taskId });
  } catch (error) {
    return res.status(502).json({ error: `Network error: ${error.message}` });
  }
});

app.get('/api/image-status', async (req, res) => {
  const taskId = String(req.query.taskId || '').trim();
  if (!taskId) {
    return res.status(400).json({ error: 'Query parameter "taskId" is required.' });
  }

  try {
    const response = await fetch(`${KIE_IMAGE_STATUS_URL}?taskId=${encodeURIComponent(taskId)}`, {
      headers: {
        Authorization: `Bearer ${KIE_API_KEY}`
      }
    });

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      return res.status(response.status).json({ error: `KIE status failed: ${text}` });
    }

    return res.json(await response.json());
  } catch (error) {
    return res.status(502).json({ error: `Network error: ${error.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Backend is running: http://localhost:${PORT}`);
});
