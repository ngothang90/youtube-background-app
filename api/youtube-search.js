'use strict';

const MAX_QUERY_LENGTH = 120;
const MAX_RESULTS = 18;

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=180, stale-while-revalidate=300');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Chỉ hỗ trợ phương thức GET.' });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      code: 'MISSING_KEY',
      error: 'Máy chủ chưa được cấu hình YouTube API key. Hãy xem hướng dẫn cài đặt của dự án.'
    });
  }

  const rawQuery = typeof req.query?.q === 'string' ? req.query.q : '';
  const query = rawQuery.trim().slice(0, MAX_QUERY_LENGTH);
  if (!query) {
    return res.status(400).json({ error: 'Vui lòng nhập từ khóa tìm kiếm.' });
  }

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: String(MAX_RESULTS),
    q: query,
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    regionCode: 'VN',
    relevanceLanguage: 'vi',
    fields: 'items(id/videoId,snippet(title,description,channelTitle,publishedAt,thumbnails(default/url,medium/url,high/url))),nextPageToken'
  });

  try {
    // Send the API key in a header rather than in the URL to reduce accidental exposure in logs.
    const upstream = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      headers: {
        Accept: 'application/json',
        'X-Goog-Api-Key': apiKey
      }
    });
    const payload = await upstream.json().catch(() => ({}));

    if (!upstream.ok) {
      const reason = payload?.error?.errors?.[0]?.reason || payload?.error?.status || 'youtube_api_error';
      let message = 'YouTube chưa thể trả kết quả. Hãy kiểm tra cấu hình YouTube Data API v3 và API Key.';
      if (reason === 'quotaExceeded') {
        message = 'Đã dùng hết hạn mức tìm kiếm YouTube trong ngày. Hãy thử lại sau khi hạn mức được làm mới.';
      } else if (reason === 'keyInvalid' || reason === 'API_KEY_INVALID') {
        message = 'API Key không hợp lệ. Hãy tạo API Key mới và cập nhật YOUTUBE_API_KEY trong Vercel.';
      } else if (reason === 'accessNotConfigured') {
        message = 'Project Google Cloud chưa bật YouTube Data API v3.';
      } else if (reason === 'ipRefererBlocked') {
        message = 'API Key đang bị giới hạn ứng dụng không phù hợp với máy chủ Vercel. Hãy chỉ giới hạn API ở YouTube Data API v3 và kiểm tra Application restrictions.';
      }
      return res.status(upstream.status === 403 ? 429 : 502).json({ error: message, reason });
    }

    const items = (Array.isArray(payload.items) ? payload.items : []).map(item => {
      const snippet = item.snippet || {};
      const thumbnails = snippet.thumbnails || {};
      return {
        id: item.id?.videoId || '',
        title: snippet.title || '',
        description: snippet.description || '',
        channelTitle: snippet.channelTitle || '',
        publishedAt: snippet.publishedAt || '',
        thumbnail: thumbnails.high?.url || thumbnails.medium?.url || thumbnails.default?.url || ''
      };
    }).filter(item => item.id);

    return res.status(200).json({ items, query, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({
      error: 'Không thể kết nối tới YouTube. Vui lòng kiểm tra Internet và thử lại.',
      detail: process.env.NODE_ENV === 'development' ? String(error) : undefined
    });
  }
};
