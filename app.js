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
function noticeMarkup() {
  return `<div class="notice-card"><div class="notice-icon">ⓘ</div><div><strong>Chưa cấu hình khóa YouTube API</strong><p>Ứng dụng đã được cài đặt nhưng máy chủ chưa nhận API Key. Hãy mở tệp <a href="/BAT_DAU_NHANH.html">Hướng dẫn cài đặt từng bước</a> để thêm biến <code>YOUTUBE_API_KEY</code> trong Vercel. Không đưa API Key vào GitHub.</p></div></div>`;
}
function cardMarkup(video) {
  const thumb = safeThumbnail(video.thumbnail);
  const title = escapeHTML(video.title || 'Video YouTube');
  const channel = escapeHTML(video.channelTitle || 'Kênh YouTube');
  const date = formatDate(video.publishedAt);
  const saved = isFavorite(video.id);
  return `<article class="video-card">
    <div class="thumb-wrap">
      ${thumb ? `<img src="${escapeHTML(thumb)}" alt="${title}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin">` : ''}
      <button class="thumb-play" type="button" data-video-id="${escapeHTML(video.id)}" aria-label="Phát ${title}"><span>▶</span></button>
    </div>
    <div class="video-info">
      <div class="channel-avatar" aria-hidden="true">${escapeHTML((video.channelTitle || 'Y').trim().slice(0,1).toUpperCase())}</div>
      <div class="video-copy">
        <h3 class="video-title">${title}</h3>
        <p class="video-sub">${channel}${date ? ` · ${escapeHTML(date)}` : ''}</p>
        <div class="card-actions">
          <button class="mini-action ${saved ? 'saved' : ''}" type="button" data-fav-id="${escapeHTML(video.id)}">${saved ? '♥ Đã lưu' : '♡ Lưu lại'}</button>
          <a class="mini-action" href="https://www.youtube.com/watch?v=${encodeURIComponent(video.id)}" target="_blank" rel="noopener noreferrer">Mở YouTube ↗</a>
        </div>
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
function renderHome() {
  const searchChips = state.searchHistory.length
    ? state.searchHistory.slice(0, 8).map(chipMarkup).join('')
    : ['Nhạc thư giãn', 'Nhạc Nhật Bản', 'Thiết kế CAD', 'Podcast công nghệ'].map(chipMarkup).join('');
  const latestResults = Boolean(state.resultsQuery && state.searchHistory.length && state.resultsQuery.toLocaleLowerCase() === state.searchHistory[0].toLocaleLowerCase());
  let recommendationBlock = '';
  if (state.loading && state.searchHistory.length && latestResults) {
    recommendationBlock = `<div class="section-block"><div class="section-heading"><div><h2>Đang tìm nội dung từ lần trước</h2><p>${escapeHTML(state.searchHistory[0])}</p></div></div><div class="loading-state"><span class="spinner"></span><span>Đang tải gợi ý từ YouTube...</span></div></div>`;
  } else if (latestResults && state.results.length) {
    recommendationBlock = `<div class="section-block"><div class="section-heading"><div><h2>Tiếp tục khám phá</h2><p>Nội dung dựa trên lần tìm gần nhất: “${escapeHTML(state.resultsQuery)}”</p></div><button class="text-button" data-open-search>Đi đến kết quả →</button></div>${gridMarkup(state.results.slice(0,6))}</div>`;
  } else if (state.error && state.searchHistory.length) {
    recommendationBlock = `<div class="section-block">${state.error === 'MISSING_KEY' ? noticeMarkup() : `<div class="notice-card"><div class="notice-icon">!</div><div><strong>Chưa tải được gợi ý</strong><p>${escapeHTML(state.error)}</p></div></div>`}</div>`;
  } else if (latestResults && !state.loading) {
    recommendationBlock = `<div class="section-block"><div class="section-heading"><div><h2>Tiếp tục khám phá</h2><p>Không có kết quả cho “${escapeHTML(state.resultsQuery)}”. Thử một cách tìm khác nhé.</p></div></div>${emptyState('Chưa có video phù hợp', 'Thử thay đổi từ khóa tìm kiếm.', '⌕')}</div>`;
  }
  const watchedBlock = state.watched.length
    ? `<div class="section-block"><div class="section-heading"><div><h2>Đã xem gần đây</h2><p>Những video bạn đã mở trong ứng dụng</p></div><button class="text-button" data-section-link="history">Xem lịch sử →</button></div>${gridMarkup(state.watched.slice(0,6))}</div>`
    : `<div class="section-block"><div class="section-heading"><div><h2>Bắt đầu khám phá</h2><p>Tìm một chủ đề bạn yêu thích để tạo lịch sử và gợi ý riêng.</p></div></div>${emptyState('Thư viện của bạn đang chờ', 'Tìm kiếm một video. Những chủ đề bạn quan tâm sẽ xuất hiện ở đây trong những lần mở tiếp theo.', '✦')}</div>`;
  return `<section class="hero"><div class="hero-content"><div class="hero-kicker"><span></span> THƯ VIỆN VIDEO CÁ NHÂN</div><h1>Khám phá điều bạn muốn xem.</h1><p>Một không gian riêng để tìm kiếm YouTube, lưu lại nội dung yêu thích và tiếp tục khám phá từ lịch sử trong ứng dụng này.</p></div><div class="hero-bubble" aria-hidden="true"><span></span></div></section>
    <section class="section-block"><div class="section-heading"><div><h2>${state.searchHistory.length ? 'Tìm lại điều bạn từng quan tâm' : 'Gợi ý để bắt đầu'}</h2><p>${state.searchHistory.length ? 'Từ khóa tìm kiếm gần đây của bạn' : 'Thử một chủ đề và xây dựng thư viện của riêng mình'}</p></div>${state.searchHistory.length ? '<button class="text-button" data-section-link="history">Tất cả lịch sử →</button>' : ''}</div><div class="chip-list">${searchChips}</div></section>
    ${recommendationBlock}${watchedBlock}
    <div class="section-block"><div class="youtube-credit"><span class="youtube-mark">▶</span> Tìm kiếm và phát bằng dịch vụ YouTube chính thức</div></div>`;
}
function renderSearch() {
  if (state.loading) return `<div class="page-title-row"><div><h1>Kết quả tìm kiếm</h1><p>Đang tìm “${escapeHTML(state.resultsQuery || $('#searchInput').value)}” trên YouTube.</p></div></div><div class="loading-state"><span class="spinner"></span><span>Đang tìm video...</span></div>`;
  if (state.error) return `<div class="page-title-row"><div><h1>Kết quả tìm kiếm</h1><p>${escapeHTML(state.resultsQuery)}</p></div></div>${state.error === 'MISSING_KEY' ? noticeMarkup() : `<div class="notice-card"><div class="notice-icon">!</div><div><strong>Không thể tìm kiếm lúc này</strong><p>${escapeHTML(state.error)}</p></div></div>`}`;
  return `<div class="page-title-row"><div><h1>Kết quả tìm kiếm</h1><p>Kết quả từ YouTube cho “${escapeHTML(state.resultsQuery)}”.</p></div><span class="youtube-credit"><span class="youtube-mark">▶</span> YouTube</span></div><div class="result-summary"><span><strong>${state.results.length}</strong> video được trả về</span><span>Ưu tiên kết quả phù hợp</span></div>${state.results.length ? gridMarkup(state.results) : emptyState('Không tìm thấy kết quả', 'Thử từ khóa ngắn hơn hoặc cách diễn đạt khác.', '⌕')}`;
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
  state.resultsQuery = cleanQuery;
  state.loading = true;
  state.error = '';
  if (showPage) state.section = 'search';
  $('#searchInput').value = cleanQuery;
  render();
  try {
    const response = await fetch(`/api/youtube-search?q=${encodeURIComponent(cleanQuery)}`, { headers: { Accept: 'application/json' } });
    const data = await response.json().catch(() => ({}));
    if (response.status === 503 && data.code === 'MISSING_KEY') throw Object.assign(new Error('MISSING_KEY'), { code: 'MISSING_KEY' });
    if (!response.ok) throw new Error(data.error || `Yêu cầu thất bại (${response.status}).`);
    if (requestId !== state.searchRequestId) return;
    state.results = Array.isArray(data.items) ? data.items : [];
    saveResultCache(cleanQuery, state.results);
    state.error = '';
  } catch (error) {
    if (requestId !== state.searchRequestId) return;
    state.results = [];
    state.error = error.code === 'MISSING_KEY' ? 'MISSING_KEY' : (error.message || 'Không thể kết nối tới YouTube.');
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
$('#closePlayer').addEventListener('click', closePlayer);
$('#playerModal').addEventListener('click', event => { if (event.target === $('#playerModal')) closePlayer(); });
$('#closeInstall').addEventListener('click', () => $('#installModal').classList.add('hidden'));
$('#confirmInstall').addEventListener('click', () => $('#installModal').classList.add('hidden'));
$('#installButton').addEventListener('click', installApp);
$('#topInstallButton').addEventListener('click', installApp);
window.addEventListener('keydown', event => { if (event.key === 'Escape') { closePlayer(); $('#installModal').classList.add('hidden'); } });
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  state.installPrompt = event;
  $('#installButton').innerHTML = '<span>⇩</span> Cài ứng dụng';
});
window.addEventListener('appinstalled', () => showToast('Đã cài NgoThang_video thành công.'));

hydrateStorage();
render();
if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
// Restore the most recent saved YouTube results on launch without spending a new search quota.
// Cached YouTube API metadata is automatically removed after 30 days.
