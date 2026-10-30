'use strict';

module.exports = function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Chỉ hỗ trợ phương thức GET.' });
  }

  return res.status(200).json({
    ok: true,
    app: 'NgoThang_video',
    youtubeApiKeyConfigured: Boolean(process.env.YOUTUBE_API_KEY)
  });
};
