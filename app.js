'use strict';

const STORAGE_KEYS = {
  searches: 'ngothang_video_searches_v1',
  watched: 'ngothang_video_watched_v1',
  favorites: 'ngothang_video_favorites_v1',
  resultCache: 'ngothang_video_result_cache_v1'
};
const VIDEO_DATA_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_SEARCHES = 25;
const MAX_SAVED_VIDEOS = 40;

const state = {
  section: 'home',
  searchHistory: [],
  watched: [],
  favorites: [],
  resultCache: [],
  results: [],
  resultsQuery: '',
  loading: false,
  error: '',
  errorCode: '',
  selectedVideo: null,
  installPrompt: null,
  searchRequestId: 0
};

const $ = (selector, root = document) => root.querySelector(selector);
const systemTheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', systemTheme && systemTheme.matches ? '#111318' : '#f5f6f8');
}
syncThemeColor();
if (systemTheme && systemTheme.addEventListener) systemTheme.addEventListener('change', syncThemeColor);
const escapeHTML = (value = '') => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));
const safeThumbnail = (url = '') => /^https:\/\/i\.ytimg\.com\//i.test(url) ? url : '';

function readStorage(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value ?? fallback;
  } catch {
    return fallback;
  }
}
function writeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch { showToast('Không thể lưu dữ liệu. Bộ nhớ trình duyệt có thể đã đầy.'); }
}
function cleanExpiredVideos(items) {
  const now = Date.now();
  return (Array.isArray(items) ? items : [])
    .filter(item => item && item.id && Number(item.savedAt) && now - Number(item.savedAt) <= VIDEO_DATA_TTL_MS)
    .slice(0, MAX_SAVED_VIDEOS);
}
function cleanExpiredResultCache(items) {
  const now = Date.now();
  return (Array.isArray(items) ? items : [])
    .filter(entry => entry && typeof entry.query === 'string' && Number(entry.savedAt) && now - Number(entry.savedAt) <= VIDEO_DATA_TTL_MS && Array.isArray(entry.items))
    .slice(0, 8);
}
function hydrateStorage() {
  const searches = readStorage(STORAGE_KEYS.searches, []);
  state.searchHistory = Array.isArray(searches) ? searches.filter(item => typeof item === 'string').slice(0, MAX_SEARCHES) : [];
  state.watched = cleanExpiredVideos(readStorage(STORAGE_KEYS.watched, []));
  state.favorites = cleanExpiredVideos(readStorage(STORAGE_KEYS.favorites, []));
  state.resultCache = cleanExpiredResultCache(readStorage(STORAGE_KEYS.resultCache, []));
  persistVideoLists();
  writeStorage(STORAGE_KEYS.resultCache, state.resultCache);
  restoreLatestCachedResults();
}
function persistVideoLists() {
  writeStorage(STORAGE_KEYS.watched, state.watched);
  writeStorage(STORAGE_KEYS.favorites, state.favorites);
}
function saveResultCache(query, items) {
  const entry = { query, items, savedAt: Date.now() };
  state.resultCache = [entry, ...state.resultCache.filter(item => item.query.toLocaleLowerCase() !== query.toLocaleLowerCase())].slice(0, 8);
  writeStorage(STORAGE_KEYS.resultCache, state.resultCache);
}
function getCachedResults(query) {
  return state.resultCache.find(item => item.query.toLocaleLowerCase() === query.toLocaleLowerCase());
}
function restoreLatestCachedResults() {
  const latestQuery = state.searchHistory[0];
  if (!latestQuery) return;
  const cached = getCachedResults(latestQuery);
  if (!cached) return;
  state.resultsQuery = cached.query;
  state.results = cached.items;
}
function addSearchHistory(query) {
  const normalized = query.trim();
  if (!normalized) return;
  state.searchHistory = [normalized, ...state.searchHistory.filter(item => item.toLocaleLowerCase() !== normalized.toLocaleLowerCase())].slice(0, MAX_SEARCHES);
  writeStorage(STORAGE_KEYS.searches, state.searchHistory);
  renderSearchSuggestions();
}
function addWatched(video) {
  const saved = { ...video, savedAt: Date.now() };
  state.watched = [saved, ...state.watched.filter(item => item.id !== video.id)].slice(0, MAX_SAVED_VIDEOS);
  persistVideoLists();
}
function isFavorite(id) { return state.favorites.some(item => item.id === id); }
function toggleFavorite(video) {
  if (isFavorite(video.id)) {
    state.favorites = state.favorites.filter(item => item.id !== video.id);
    showToast('Đã xóa khỏi danh sách yêu thích.');
  } else {
    state.favorites = [{ ...video, savedAt: Date.now() }, ...state.favorites].slice(0, MAX_SAVED_VIDEOS);
    showToast('Đã lưu vào danh sách yêu thích.');
  }
  persistVideoLists();
  render();
}
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
}
function showToast(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}
function renderSearchSuggestions() {
  $('#searchSuggestions').innerHTML = state.searchHistory.map(term => `<option value="${escapeHTML(term)}"></option>`).join('');
}
function setSection(section) {
  state.section = section;
  render();
}
function navMarkup() {
  document.querySelectorAll('[data-section]').forEach(button => {
    button.classList.toggle('active', button.dataset.section === state.section);
  });
}
function emptyState(title, message, icon = '⌕') {
  return `<div class="empty-card"><div class="empty-symbol">${icon}</div><h3>${escapeHTML(title)}</h3><p>${escapeHTML(message)}</p></div>`;
}
function getApiKey() {
  const key = String(window.NGOTHANG_CONFIG?.YOUTUBE_API_KEY || '').trim();
  if (!key || key === 'PASTE_YOUR_NEW_RESTRICTED_API_KEY_HERE') return '';
  return key;
}
function noticeMarkup() {
  return `<div class="notice-card"><div class="notice-icon">ⓘ</div><div><strong>Ứng dụng chưa được cấu hình API dùng chung</strong><p>Chủ ứng dụng cần thêm YouTube API Key một lần vào file <strong>config.js</strong> trong GitHub. Sau đó tất cả mọi người mở cùng đường link đều tìm kiếm được, không phải nhập khóa riêng.</p><button class="text-button" type="button" data-open-settings>Xem cách cấu hình →</button></div></div>`;
}
function cardMarkup(video) {
  const thumb = safeThumbnail(video.thumbnail);
  const title = escapeHTML(video.title || 'Video YouTube');
  const channel = escapeHTML(video.channelTitle || 'Kênh YouTube');
  const saved = isFavorite(video.id);
  return `<article class="video-card">
    <div class="thumb-wrap">
      ${thumb ? `<img src="${escapeHTML(thumb)}" alt="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin">` : '<div class="thumb-fallback">▶</div>'}
      <span class="thumb-source">YOUTUBE</span>
      <button class="thumb-play" type="button" data-video-id="${escapeHTML(video.id)}" aria-label="Phát ${title}"><span>▶</span></button>
      <button class="thumb-fav ${saved ? 'saved' : ''}" type="button" data-fav-id="${escapeHTML(video.id)}" aria-label="${saved ? 'Bỏ yêu thích' : 'Thêm yêu thích'}">${saved ? '♥' : '♡'}</button>
    </div>
    <div class="video-info">
      <div class="channel-avatar" aria-hidden="true">${escapeHTML((video.channelTitle || 'Y').trim().slice(0,1).toUpperCase())}</div>
      <div class="video-copy">
        <h3 class="video-title">${title}</h3>
        <p class="video-sub">${channel}</p>
      </div>
    </div>
  </article>`;
}
function gridMarkup(videos) {
  if (!videos.length) return emptyState('Chưa có video ở đây', 'Hãy tìm kiếm một chủ đề trên YouTube hoặc chọn từ khóa gợi ý phía trên.', '▷');
  return `<div class="video-grid">${videos.map(cardMarkup).join('')}</div>`;
}
function chipMarkup(term) {
  return `<button class="search-chip" type="button" data-search-term="${escapeHTML(term)}"><span class="chip-symbol">⌕</span>${escapeHTML(term)}</button>`;
}
const HOME_CATEGORIES = [
  { title: 'Âm nhạc', sub: 'Thư giãn · Remix · Live', emoji: '🎧', term: 'nhạc hay tuyển chọn', tone: 'music' },
  { title: 'Công nghệ', sub: 'AI · Thiết bị · Review', emoji: '🚀', term: 'công nghệ mới AI', tone: 'tech' },
  { title: 'Phim & giải trí', sub: 'Trailer · Hài · Show', emoji: '🍿', term: 'phim hay trailer giải trí', tone: 'movie' },
  { title: 'Thể thao', sub: 'Bóng đá · Highlight', emoji: '⚽', term: 'bóng đá highlights', tone: 'sport' },
  { title: 'Kiến thức', sub: 'Khám phá · Học nhanh', emoji: '🧠', term: 'kiến thức thú vị', tone: 'learn' },
  { title: 'Du lịch', sub: 'Khám phá thế giới', emoji: '🌍', term: 'du lịch khám phá thế giới', tone: 'travel' }
];
function categoryMarkup(item) {
  return `<button class="category-tile category-${item.tone}" type="button" data-search-term="${escapeHTML(item.term)}">
    <span class="category-art" aria-hidden="true">${item.emoji}</span>
    <span class="category-copy"><strong>${escapeHTML(item.title)}</strong><small>${escapeHTML(item.sub)}</small></span>
    <span class="category-arrow" aria-hidden="true">↗</span>
  </button>`;
}
function renderHome() {
  const latestResults = Boolean(state.resultsQuery && state.searchHistory.length && state.resultsQuery.toLocaleLowerCase() === state.searchHistory[0].toLocaleLowerCase());
  const recentSearches = state.searchHistory.slice(0, 6).map(chipMarkup).join('');
  let recommendationBlock = '';
  if (state.loading && latestResults) {
    recommendationBlock = `<div class="section-block"><div class="section-heading"><h2>Dành cho bạn</h2></div><div class="loading-state"><span class="spinner"></span><span>Đang tải video...</span></div></div>`;
  } else if (latestResults && state.results.length) {
    recommendationBlock = `<div class="section-block"><div class="section-heading"><h2>Tiếp tục khám phá</h2><button class="text-button" data-open-search>Xem tất cả →</button></div>${gridMarkup(state.results.slice(0,6))}</div>`;
  } else if (state.error && state.searchHistory.length) {
    recommendationBlock = `<div class="section-block">${errorCardMarkup(state.error, state.errorCode)}</div>`;
  }
  const watchedBlock = state.watched.length
    ? `<div class="section-block"><div class="section-heading"><h2>Đã xem gần đây</h2><button class="text-button" data-section-link="history">Xem tất cả →</button></div>${gridMarkup(state.watched.slice(0,6))}</div>`
    : '';
  const setupBlock = !getApiKey() ? `<div class="section-block">${noticeMarkup()}</div>` : '';
  return `<section class="hero-visual">
      <div class="hero-visual-copy"><span class="hero-kicker"><i></i> NGOTHANG VIDEO</span><h1>Chọn mood.<br><em>Bấm phát.</em></h1><button class="hero-cta" type="button" data-focus-search>Tìm video ngay <span>→</span></button></div>
      <div class="hero-visual-art" aria-hidden="true"><div class="hero-orbit orbit-one"></div><div class="hero-orbit orbit-two"></div><div class="hero-disc"><span>▶</span></div><div class="hero-float float-one">🎧</div><div class="hero-float float-two">🎬</div><div class="hero-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>
    </section>
    ${setupBlock}
    <section class="section-block category-section"><div class="section-heading"><h2>Khám phá theo chủ đề</h2></div><div class="category-grid">${HOME_CATEGORIES.map(categoryMarkup).join('')}</div></section>
    ${state.searchHistory.length ? `<section class="section-block"><div class="section-heading"><h2>Tìm gần đây</h2><button class="text-button" data-section-link="history">Lịch sử →</button></div><div class="chip-list">${recentSearches}</div></section>` : ''}
    ${recommendationBlock}${watchedBlock}
    <div class="home-footer"><span class="youtube-mark">▶</span><span>YouTube chính thức</span></div>`;
}
function errorCardMarkup(message, code = '') {
  const siteOrigin = `https://${window.location.hostname}`;
  const referrerAdvice = /referrer|referer|forbidden|403|blocked|network_or_cors/i.test(`${message} ${code}`)
    ? `<p class="error-next">Trong Google Cloud → Credentials → API Key → Website restrictions, thêm đúng 2 dòng này:<br><code>${escapeHTML(siteOrigin)}</code><br><code>${escapeHTML(siteOrigin)}/*</code><br>Không thêm riêng đường dẫn <code>/NgoThang_video/*</code> vì trình duyệt chỉ gửi domain gốc khi gọi Google.</p>`
    : '<p class="error-next">Mở Google Cloud → APIs & Services → Enabled APIs để kiểm tra YouTube Data API v3 đã bật trong đúng Project. Kiểm tra thêm API restrictions và quota.</p>';
  return `<div class="api-error-card"><div class="api-error-icon">!</div><div class="api-error-content"><strong>Không kết nối được YouTube</strong><p>${escapeHTML(message)}</p>${code ? `<code class="api-error-code">${escapeHTML(code)}</code>` : ''}${referrerAdvice}<button class="text-button" type="button" data-open-settings>Xem cài đặt API →</button></div></div>`;
}
function renderSearch() {
  if (state.loading) return `<div class="page-title-row"><div><h1>Kết quả</h1><p>${escapeHTML(state.resultsQuery || $('#searchInput').value)}</p></div></div><div class="loading-state"><span class="spinner"></span><span>Đang tìm video...</span></div>`;
  if (state.error) return `<div class="page-title-row"><div><h1>Kết quả</h1><p>${escapeHTML(state.resultsQuery)}</p></div></div>${state.error === 'MISSING_KEY' ? noticeMarkup() : errorCardMarkup(state.error, state.errorCode)}`;
  return `<div class="page-title-row"><div><h1>Kết quả tìm kiếm</h1><p>${escapeHTML(state.resultsQuery)}</p></div><span class="youtube-credit"><span class="youtube-mark">▶</span></span></div><div class="result-summary"><span><strong>${state.results.length}</strong> video</span></div>${state.results.length ? gridMarkup(state.results) : emptyState('Không tìm thấy video', 'Thử từ khóa khác nhé.', '⌕')}`;
}
function renderHistory() {
  const searches = state.searchHistory.length
    ? `<div class="chip-list">${state.searchHistory.map(chipMarkup).join('')}</div>`
    : emptyState('Chưa có lịch sử tìm kiếm', 'Các từ khóa bạn tìm trong NgoThang_video sẽ xuất hiện ở đây.', '◷');
  const videos = state.watched.length ? gridMarkup(state.watched) : emptyState('Chưa có video đã xem', 'Khi bạn mở một video từ kết quả tìm kiếm, video sẽ được lưu tạm ở đây trong tối đa 30 ngày.', '▷');
  return `<div class="page-title-row"><div><h1>Lịch sử của bạn</h1><p>Tìm kiếm gần đây và những video đã mở trên thiết bị này.</p></div><button class="clear-button" data-clear-history>Xóa dữ liệu</button></div><div class="section-block"><div class="section-heading"><div><h2>Từ khóa đã tìm</h2><p>Lịch sử này được lưu trên thiết bị hiện tại.</p></div></div>${searches}</div><div class="section-block"><div class="section-heading"><div><h2>Video đã mở gần đây</h2><p>Thông tin video được làm mới/xóa trong vòng 30 ngày.</p></div></div>${videos}</div>`;
}
function renderFavorites() {
  return `<div class="page-title-row"><div><h1>Video yêu thích</h1><p>Danh sách nội dung bạn tự chọn lưu lại trên thiết bị này.</p></div></div>${state.favorites.length ? gridMarkup(state.favorites) : emptyState('Chưa có video yêu thích', 'Nhấn “Lưu lại” trên một video để thêm vào thư viện của bạn.', '♡')}`;
}
function render() {
  navMarkup();
  const content = $('#pageContent');
  if (state.section === 'home') content.innerHTML = renderHome();
  else if (state.section === 'history') content.innerHTML = renderHistory();
  else if (state.section === 'favorites') content.innerHTML = renderFavorites();
  else content.innerHTML = renderSearch();
  renderSearchSuggestions();
}

function explainYouTubeError(data, httpStatus) {
  const apiError = data?.error || {};
  const reason = String(apiError.errors?.[0]?.reason || apiError.status || '').trim();
  const message = String(apiError.message || 'YouTube không trả về kết quả.');
  const code = `HTTP ${httpStatus}${reason ? ` · ${reason}` : ''}${apiError.code ? ` · ${apiError.code}` : ''}`;
  const probe = `${reason} ${apiError.status} ${message}`.toLowerCase();
  let friendly = message;
  if (/quota|daily.?limit|rate.?limit/.test(probe)) {
    friendly = 'Project Google Cloud đã hết hạn mức tìm kiếm YouTube trong ngày. Hãy đợi quota được cấp lại hoặc kiểm tra quota trong Google Cloud.';
  } else if (/referrer|referer|api_key_http_referrer_blocked/.test(probe)) {
    friendly = 'Google đang chặn website do Website restrictions chưa khớp. Hãy thêm domain github.io ở cấp domain (xem hướng dẫn ngay bên dưới).';
  } else if (/accessnotconfigured|service_disabled|youtube.*not.*enabled/.test(probe)) {
    friendly = 'YouTube Data API v3 chưa được bật trong đúng Google Cloud Project đang chứa API Key.';
  } else if (/keyinvalid|api_key_invalid|invalid api key/.test(probe)) {
    friendly = 'API Key không hợp lệ hoặc đang bị thu hồi. Hãy kiểm tra lại file config.js trên GitHub.';
  } else if (/api_key_service_blocked|service.*blocked/.test(probe)) {
    friendly = 'API Key đang bị giới hạn không cho dùng YouTube Data API v3. Hãy sửa API restrictions.';
  } else if (/invalidsearchfilter|invalidrelevancelanguage|badrequest/.test(probe)) {
    friendly = 'YouTube không chấp nhận một tham số tìm kiếm. Hãy thử lại; ứng dụng đã gửi yêu cầu tìm kiếm video tiêu chuẩn.';
  } else if (httpStatus === 403) {
    friendly = 'Google từ chối yêu cầu (403). Thường do giới hạn referrer, giới hạn API hoặc quota. Mã lỗi bên dưới giúp xác định chính xác.';
  }
  return { message: friendly, code };
}

async function searchYouTube(query, { save = true, showPage = true, useCache = false } = {}) {
  const cleanQuery = String(query || '').trim().slice(0, 120);
  if (!cleanQuery) {
    showToast('Hãy nhập từ khóa cần tìm.');
    return;
  }
  const requestId = ++state.searchRequestId;
  if (save) addSearchHistory(cleanQuery);
  if (useCache) {
    const cached = getCachedResults(cleanQuery);
    const cacheAge = cached ? Date.now() - cached.savedAt : Infinity;
    if (cached && cacheAge < 6 * 60 * 60 * 1000) {
      state.resultsQuery = cached.query;
      state.results = cached.items;
      state.error = '';
      state.loading = false;
      if (showPage) state.section = 'search';
      $('#searchInput').value = cleanQuery;
      render();
      return;
    }
  }

  const apiKey = getApiKey();
  state.resultsQuery = cleanQuery;
  state.errorCode = '';
  if (!apiKey) {
    state.loading = false;
    state.error = 'MISSING_KEY';
    if (showPage) state.section = 'search';
    $('#searchInput').value = cleanQuery;
    render();
    openSettings();
    return;
  }

  state.loading = true;
  state.error = '';
  if (showPage) state.section = 'search';
  $('#searchInput').value = cleanQuery;
  render();

  const params = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '18',
    q: cleanQuery,
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    regionCode: 'VN',
    relevanceLanguage: 'vi',
    order: 'relevance'
  });
  // YouTube Data API v3 documents the API key as the `key` request parameter.
  params.set('key', apiKey);

  try {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const explained = explainYouTubeError(data, response.status);
      const error = new Error(explained.message);
      error.code = explained.code;
      throw error;
    }

    if (requestId !== state.searchRequestId) return;
    state.results = (Array.isArray(data.items) ? data.items : []).map(item => {
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
    saveResultCache(cleanQuery, state.results);
    state.error = '';
    state.errorCode = '';
  } catch (error) {
    if (requestId !== state.searchRequestId) return;
    state.results = [];
    if (error.name === 'TypeError') {
      state.error = navigator.onLine
        ? 'Trình duyệt không nhận được phản hồi từ Google API. Hãy kiểm tra kết nối Internet, quyền truy cập mạng và Website restrictions của API Key.'
        : 'Thiết bị hiện không có kết nối Internet.';
    } else {
      state.error = error.message || 'Không thể kết nối YouTube. Hãy thử lại.';
    }
    state.errorCode = error.code || (error.name === 'TypeError' ? 'NETWORK_OR_CORS_ERROR' : 'UNKNOWN_ERROR');
  } finally {
    if (requestId === state.searchRequestId) {
      state.loading = false;
      render();
    }
  }
}
function openPlayer(videoId) {
  const allVideos = [...state.results, ...state.watched, ...state.favorites];
  const video = allVideos.find(item => item.id === videoId);
  if (!video) return;
  state.selectedVideo = video;
  addWatched(video);
  $('#playerFrameWrap').innerHTML = `<iframe src="https://www.youtube.com/embed/${encodeURIComponent(video.id)}?autoplay=1&playsinline=1" title="${escapeHTML(video.title || 'YouTube video')}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  $('#playerMeta').innerHTML = `<h2>${escapeHTML(video.title || 'Video YouTube')}</h2><p>${escapeHTML(video.channelTitle || 'Kênh YouTube')}</p><a href="https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}" target="_blank" rel="noopener noreferrer">Mở video trong YouTube ↗</a>`;
  $('#playerModal').classList.remove('hidden');
  render();
}
function closePlayer() {
  $('#playerFrameWrap').innerHTML = '';
  $('#playerModal').classList.add('hidden');
  state.selectedVideo = null;
}
function clearPersonalData() {
  const accepted = window.confirm('Xóa toàn bộ lịch sử tìm kiếm, video đã mở và danh sách yêu thích được lưu trên thiết bị này? Thao tác này không xóa lịch sử trên tài khoản YouTube của bạn.');
  if (!accepted) return;
  Object.values(STORAGE_KEYS).forEach(key => localStorage.removeItem(key));
  state.searchHistory = [];
  state.watched = [];
  state.favorites = [];
  state.resultCache = [];
  state.results = [];
  state.resultsQuery = '';
  state.error = '';
  state.section = 'home';
  render();
  showToast('Đã xóa dữ liệu NgoThang_video trên thiết bị này.');
}
function openSettings() {
  const configured = Boolean(getApiKey());
  $('#apiKeyState').textContent = configured
    ? 'Đã đọc thấy API Key trong config.js. Điều này chưa xác nhận quyền API, Website restrictions hoặc quota.'
    : 'Chưa cấu hình API Key dùng chung. Chủ ứng dụng hãy mở file config.js trong GitHub, nhấn Edit và thay dòng giữ chỗ bằng API Key mới.';
  $('#settingsSetupInstructions').classList.toggle('hidden', configured);
  $('#sharedKeyWarning').classList.toggle('hidden', !configured);
  $('#settingsModal').classList.remove('hidden');
}
function closeSettings() {
  $('#settingsModal').classList.add('hidden');
}

function showInstallHelp() {
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const instructions = $('#installInstructions');
  if (isStandalone) {
    instructions.innerHTML = '<p>NgoThang_video đã được mở ở chế độ ứng dụng trên thiết bị này.</p>';
  } else if (ios) {
    instructions.innerHTML = '<p>Trên iPhone hoặc iPad:</p><ol><li>Mở trang này bằng Safari.</li><li>Nhấn nút <strong>Chia sẻ</strong> ở thanh công cụ.</li><li>Chọn <strong>Thêm vào MH chính</strong> (Add to Home Screen).</li><li>Bật <strong>Mở dưới dạng ứng dụng web</strong> nếu tùy chọn này xuất hiện, sau đó nhấn Thêm.</li></ol><p>Lần sau, hãy mở bằng biểu tượng NgoThang_video trên màn hình chính.</p>';
  } else {
    instructions.innerHTML = '<p>Chọn <strong>Cài ứng dụng</strong> hoặc <strong>Install app</strong> trong menu của trình duyệt. Trên Android, bạn cũng có thể thấy lời nhắc cài đặt xuất hiện ở thanh địa chỉ.</p>';
  }
  $('#installModal').classList.remove('hidden');
}
async function installApp() {
  if (state.installPrompt) {
    state.installPrompt.prompt();
    await state.installPrompt.userChoice.catch(() => null);
    state.installPrompt = null;
    return;
  }
  showInstallHelp();
}

$('#searchForm').addEventListener('submit', event => {
  event.preventDefault();
  searchYouTube($('#searchInput').value);
});
$('#pageContent').addEventListener('click', event => {
  const target = event.target.closest('button, a');
  if (!target) return;
  if (target.dataset.section) { setSection(target.dataset.section); return; }
  if (target.dataset.sectionLink) { setSection(target.dataset.sectionLink); return; }
  if (target.hasAttribute('data-open-search')) { setSection('search'); return; }
  if (target.hasAttribute('data-focus-search')) { $('#searchInput').focus(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
  if (target.hasAttribute('data-open-settings')) { openSettings(); return; }
  if (target.dataset.searchTerm) { searchYouTube(target.dataset.searchTerm, { useCache: true }); return; }
  if (target.dataset.videoId) { openPlayer(target.dataset.videoId); return; }
  if (target.dataset.favId) {
    const video = [...state.results, ...state.watched, ...state.favorites].find(item => item.id === target.dataset.favId);
    if (video) toggleFavorite(video);
    return;
  }
  if (target.hasAttribute('data-clear-history')) { clearPersonalData(); }
});
document.querySelectorAll('[data-section]').forEach(button => button.addEventListener('click', () => setSection(button.dataset.section)));
$('#settingsButton').addEventListener('click', openSettings);
$('#closeSettings').addEventListener('click', closeSettings);
$('#settingsModal').addEventListener('click', event => { if (event.target === $('#settingsModal')) closeSettings(); });
$('#closePlayer').addEventListener('click', closePlayer);
$('#playerModal').addEventListener('click', event => { if (event.target === $('#playerModal')) closePlayer(); });
$('#closeInstall').addEventListener('click', () => $('#installModal').classList.add('hidden'));
$('#confirmInstall').addEventListener('click', () => $('#installModal').classList.add('hidden'));
$('#installButton').addEventListener('click', installApp);
$('#topInstallButton').addEventListener('click', installApp);
window.addEventListener('keydown', event => { if (event.key === 'Escape') { closePlayer(); closeSettings(); $('#installModal').classList.add('hidden'); } });
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  state.installPrompt = event;
  $('#installButton').innerHTML = '<span>⇩</span> Cài ứng dụng';
});
window.addEventListener('appinstalled', () => showToast('Đã cài NgoThang_video thành công.'));

hydrateStorage();
render();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
// Restore the most recent saved YouTube results on launch without spending a new search quota.
// Cached YouTube API metadata is automatically removed after 30 days.
