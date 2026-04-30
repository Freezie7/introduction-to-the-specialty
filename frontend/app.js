'use strict';

const BACKEND_URL = 'http://localhost:3100';
const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 5 * 60 * 1000;

const promptInput = document.getElementById('promptInput');
const generateBtn = document.getElementById('generateBtn');
const statusEl = document.getElementById('status');
const resultEl = document.getElementById('result');
const openLinkEl = document.getElementById('openLink');
const previewEl = document.getElementById('preview');

generateBtn.addEventListener('click', async () => {
  const prompt = promptInput.value.trim();
  if (!prompt) {
    statusEl.textContent = 'Введите промпт.';
    return;
  }

  toggleLoading(true);
  resultEl.classList.add('hidden');
  openLinkEl.removeAttribute('href');
  previewEl.removeAttribute('src');

  try {
    statusEl.textContent = 'Запускаю задачу генерации...';
    const taskId = await createTask(prompt);

    statusEl.textContent = `Задача запущена: ${taskId}. Ожидаю результат...`;
    const { imageUrl } = await waitForImage(taskId);

    statusEl.textContent = 'Готово!';
    openLinkEl.href = imageUrl;
    previewEl.src = imageUrl;
    resultEl.classList.remove('hidden');
  } catch (error) {
    statusEl.textContent = `Ошибка: ${error.message}`;
  } finally {
    toggleLoading(false);
  }
});

function toggleLoading(isLoading) {
  generateBtn.disabled = isLoading;
  generateBtn.textContent = isLoading ? 'Генерирую...' : 'Сгенерировать картинку';
}

async function createTask(prompt) {
  const response = await fetch(`${BACKEND_URL}/api/generate-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  if (!data.taskId) {
    throw new Error('taskId не найден в ответе backend.');
  }

  return data.taskId;
}

async function waitForImage(taskId) {
  const startedAt = Date.now();

  while (true) {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      throw new Error('Таймаут ожидания результата.');
    }

    await sleep(POLL_INTERVAL_MS);
    const data = await fetchStatus(taskId);
    const normalized = data.data || data;
    const status = String(
      normalized.status ||
        normalized.taskStatus ||
        normalized.task_status ||
        normalized.state ||
        ''
    ).toLowerCase();

    const imageUrl = extractImageUrl(data);
    if (imageUrl) {
      return { imageUrl };
    }

    if (['failed', 'error', 'cancelled'].includes(status)) {
      const message = normalized.error || normalized.msg || normalized.message || 'Unknown error';
      throw new Error(message);
    }

    statusEl.textContent = `Статус: ${status || 'processing'}...`;
  }
}

async function fetchStatus(taskId) {
  const response = await fetch(`${BACKEND_URL}/api/image-status?taskId=${encodeURIComponent(taskId)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }
  return data;
}

function extractImageUrl(raw) {
  const d = raw.data || raw;
  let url =
    d.output?.url ||
    d.outputUrl ||
    d.result?.url ||
    d.resultUrl ||
    d.imageUrl ||
    d.image_url ||
    d.fileUrl ||
    d.url;

  if (!url && Array.isArray(d.output) && d.output[0]) {
    url = typeof d.output[0] === 'string' ? d.output[0] : d.output[0].url;
  }

  if (!url && Array.isArray(d.images) && d.images[0]) {
    url = typeof d.images[0] === 'string' ? d.images[0] : d.images[0].url;
  }

  if (!url && typeof d.result === 'string' && d.result.startsWith('{')) {
    try {
      const parsed = JSON.parse(d.result);
      url = parsed.url || parsed.imageUrl || parsed.image_url;
    } catch (_e) {
      // ignore
    }
  }

  if (!url) {
    const match = JSON.stringify(raw).match(/https?:\/\/[^\s"'}\],]+/);
    if (match) url = match[0].replace(/\\/g, '');
  }

  return url || null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
