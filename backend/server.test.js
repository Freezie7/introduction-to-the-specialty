'use strict';

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

  return url || null;
}

test('извлекает url из поля imageUrl', () => {
  const result = extractImageUrl({ imageUrl: 'https://example.com/img.png' });
  expect(result).toBe('https://example.com/img.png');
});

test('извлекает url из вложенного data', () => {
  const result = extractImageUrl({ data: { imageUrl: 'https://example.com/img.png' } });
  expect(result).toBe('https://example.com/img.png');
});

test('извлекает url из массива output', () => {
  const result = extractImageUrl({ output: ['https://example.com/img.png'] });
  expect(result).toBe('https://example.com/img.png');
});

test('возвращает null если url нет', () => {
  const result = extractImageUrl({ status: 'processing' });
  expect(result).toBeNull();
});