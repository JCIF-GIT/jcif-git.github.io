/* ==========================================================================
   ASPAC新潟大会 福山JCコミュニティサイト - メインアプリケーションスクリプト
   ========================================================================== */

// アプリケーションの状態管理
const state = {
  isLoggedIn: false,
  activeTab: 'photos',
  photos: [],
  youtubeVideoId: null
};

// --------------------------------------------------------------------------
// 1. 初期化処理
// --------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  // 直接アプリを表示してデータをロード
  showApp();

  // 設定の有効性を確認
  checkConfig();
});

// 設定がダミーのままか確認する関数
function isConfigDummy() {
  const conf = window.CONFIG;
  if (!conf) {
    console.log("isConfigDummy: window.CONFIG is undefined.");
    return true;
  }
  const isDummy = conf.API_KEY === 'YOUR_GOOGLE_API_KEY' || 
                  conf.API_KEY === '' ||
                  conf.PHOTO_FOLDER_ID === 'YOUR_PHOTO_FOLDER_ID' ||
                  conf.PHOTO_FOLDER_ID === '';
  console.log("isConfigDummy:", isDummy, {
    apiKey: conf.API_KEY,
    photoFolderId: conf.PHOTO_FOLDER_ID
  });
  return isDummy;
}

function checkConfig() {
  if (isConfigDummy()) {
    console.warn('Google ドライブの設定が完了していないため、デモモードで動作します。');
  } else {
    console.log('Google ドライブの設定が正常に読み込まれました。実データモードで動作します。');
  }
}

function showApp() {
  const appContainer = document.getElementById('app-container');
  if (appContainer) appContainer.style.display = 'flex';
  
  // アプリ起動時にデータを読み込む
  loadTabData(state.activeTab);
}

// --------------------------------------------------------------------------
// 3. タブ切り替え制御
// --------------------------------------------------------------------------
function switchTab(tabId) {
  if (state.activeTab === tabId) return;

  // タブボタンのアクティブ状態切り替え
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`tab-btn-${tabId}`);
  if (activeBtn) activeBtn.classList.add('active');

  // コンテンツエリアの表示切り替え
  document.querySelectorAll('.content-section').forEach(section => {
    section.classList.remove('active');
  });
  const activeSection = document.getElementById(`content-${tabId}`);
  if (activeSection) activeSection.classList.add('active');

  state.activeTab = tabId;
  
  // 切り替え先タブのデータを読み込み
  loadTabData(tabId);
}

function loadTabData(tabId) {
  if (tabId === 'photos') {
    fetchPhotos();
  } else if (tabId === 'shiori') {
    fetchShiori();
  } else if (tabId === 'youtube') {
    fetchYouTube();
  }
}

// --------------------------------------------------------------------------
// 4. データ取得ロジック (Google ドライブ API & デモフォールバック)
// --------------------------------------------------------------------------

// 📸 4-1. 写真データの読み込み
function fetchPhotos() {
  const grid = document.getElementById('photo-grid');
  const loading = document.getElementById('photo-loading');
  const empty = document.getElementById('photo-empty');

  grid.innerHTML = '';
  loading.style.display = 'flex';
  empty.style.display = 'none';

  if (isConfigDummy()) {
    // === デモモード用のダミーデータ ===
    setTimeout(() => {
      loading.style.display = 'none';
      const demoPhotos = [
        { id: 'demo1', name: '新潟到着レセプションにて', createdTime: '2026-06-11T18:30:00+09:00', url: 'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=800&q=80' },
        { id: 'demo2', name: '新潟名物へぎそばとメンバー', createdTime: '2026-06-12T12:15:00+09:00', url: 'https://images.unsplash.com/photo-1583224964978-2257b960c3d3?auto=format&fit=crop&w=800&q=80' },
        { id: 'demo3', name: 'ASPAC新潟大会 会場前集合写真', createdTime: '2026-06-12T15:00:00+09:00', url: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=800&q=80' },
        { id: 'demo4', name: '大懇親会での盛り上がり', createdTime: '2026-06-13T20:00:00+09:00', url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=800&q=80' },
        { id: 'demo5', name: '朱鷺メッセ展望台からの日本海', createdTime: '2026-06-14T10:30:00+09:00', url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80' },
        { id: 'demo6', name: '福山帰還前の解団式', createdTime: '2026-06-14T16:00:00+09:00', url: 'https://images.unsplash.com/photo-1517457373958-b7bdd4587205?auto=format&fit=crop&w=800&q=80' }
      ];
      renderPhotos(demoPhotos);
    }, 1000);
    return;
  }

  // === Google Drive API による実データ取得 ===
  const folderId = window.CONFIG.PHOTO_FOLDER_ID;
  const apiKey = window.CONFIG.API_KEY;
  // 画像のみを対象として最新順で取得するクエリ
  const query = `'${folderId}' in parents and mimeType contains 'image/' and trashed = false`;
  const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&orderBy=createdTime+desc&key=${apiKey}&fields=files(id,name,createdTime)`;

  fetch(url)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(`Google Drive API エラー (${response.status}): ${err.error ? err.error.message : 'Unknown'}`);
        }).catch(() => {
          throw new Error(`Google Drive API 呼び出し失敗 (ステータス: ${response.status})`);
        });
      }
      return response.json();
    })
    .then(data => {
      loading.style.display = 'none';
      if (!data.files || data.files.length === 0) {
        empty.style.display = 'flex';
        return;
      }
      // Googleドライブ画像URLに加工
      const photos = data.files.map(file => {
        // 外部公開設定された画像であれば、サムネイル・オリジナルを下記URLで取得可能
        return {
          id: file.id,
          name: file.name.replace(/\.[^/.]+$/, ""), // 拡張子を削除
          createdTime: file.createdTime,
          // web用の高画質画像として1000px幅で取得するURL
          url: `https://drive.google.com/thumbnail?id=${file.id}&sz=w1000`
        };
      });
      renderPhotos(photos);
    })
    .catch(error => {
      console.error(error);
      loading.style.display = 'none';
      const fallbackGrid = document.getElementById('photo-grid');
      if (fallbackGrid) {
        fallbackGrid.innerHTML = `<div class="error-message">写真の読み込みに失敗しました。APIキーまたはフォルダの共有設定を確認してください。<br>${error.message}</div>`;
      }
    });
}

// ギャラリー表示のレンダリング
function renderPhotos(photos) {
  const container = document.getElementById('photo-gallery-container');
  const empty = document.getElementById('photo-empty');
  
  // 以前の動的な日付セクションをすべて削除
  document.querySelectorAll('.date-section').forEach(el => el.remove());
  
  // デフォルトの固定グリッドを非表示にする (動的グリッドを使用するため)
  const defaultGrid = document.getElementById('photo-grid');
  if (defaultGrid) defaultGrid.style.display = 'none';

  if (!photos || photos.length === 0) {
    empty.style.display = 'flex';
    return;
  }

  // 日付グループの初期定義 (ASPAC新潟大会日程 6/11〜14)
  const groups = {
    '6/11': { label: '6月11日 (木) — 大会1日目', photos: [] },
    '6/12': { label: '6月12日 (金) — 大会2日目', photos: [] },
    '6/13': { label: '6月13日 (土) — 大会3日目', photos: [] },
    '6/14': { label: '6月14日 (日) — 大会4日目', photos: [] },
    'other': { label: 'その他の日程', photos: [] }
  };

  // 写真を日付ごとに振り分け (日本時間基準)
  photos.forEach(photo => {
    const date = new Date(photo.createdTime);
    // JSTの月/日を表現する文字列を作成 (例: "6/11")
    const month = date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric' });
    const day = date.toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo', day: 'numeric' });
    const localDateKey = `${month}/${day}`;

    if (groups[localDateKey]) {
      groups[localDateKey].photos.push(photo);
    } else {
      groups['other'].photos.push(photo);
    }
  });

  // 各日付グループのHTML要素を動的に生成
  let hasAnyPhoto = false;
  
  // 表示順を大会日程順 (6/11 -> 6/14 -> other) にループ
  const displayOrder = ['6/11', '6/12', '6/13', '6/14', 'other'];
  
  displayOrder.forEach(key => {
    const group = groups[key];
    if (group.photos.length === 0) return; // 写真がない日は非表示

    hasAnyPhoto = true;

    // セクションコンテナの作成
    const section = document.createElement('div');
    section.className = 'date-section';

    // タイトル要素の作成
    const title = document.createElement('h3');
    title.className = 'date-section-title';
    title.innerHTML = `<span class="icon">📅</span> ${group.label} <span class="photo-count">(${group.photos.length}枚)</span>`;
    section.appendChild(title);

    // グリッドコンテナの作成
    const grid = document.createElement('div');
    grid.className = 'photo-grid';

    // 写真カードの追加
    group.photos.forEach(photo => {
      const card = document.createElement('div');
      card.className = 'photo-card';
      card.onclick = () => openPhotoModal(photo.url, photo.name);

      // 時間のフォーマット (JSTの時:分)
      const date = new Date(photo.createdTime);
      const timeString = date.toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });

      card.innerHTML = `
        <div class="photo-img-wrapper">
          <img src="${photo.url}" alt="${photo.name}" loading="lazy">
        </div>
        <div class="photo-info">
          <h4 class="photo-title">${photo.name}</h4>
          <span class="photo-meta">撮影時刻: ${timeString}</span>
        </div>
      `;
      grid.appendChild(card);
    });

    section.appendChild(grid);
    container.appendChild(section);
  });

  if (!hasAnyPhoto) {
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
  }
}

// アップロード先（Googleドライブ）を開く
function openUploadDrive() {
  if (isConfigDummy()) {
    alert('設定ファイル (config.js) に Google ドライブのフォルダIDが設定されていません。現在はデモモードです。');
    return;
  }
  const folderUrl = `https://drive.google.com/drive/folders/${window.CONFIG.PHOTO_FOLDER_ID}`;
  window.open(folderUrl, '_blank');
}


// 📖 4-2. しおりPDFの読み込み
function fetchShiori() {
  const iframe = document.getElementById('shiori-iframe');
  const downloadBtn = document.getElementById('shiori-download-btn');

  if (isConfigDummy() || !window.CONFIG.SHIORI_FILE_ID || window.CONFIG.SHIORI_FILE_ID === 'YOUR_SHIORI_FILE_ID') {
    // デモ用PDF（ここではダミーのWebサイトやプレビューを表示するか、PDF.jsなどのサンプルを表示）
    // サンプルとしてGoogleドライブ公式が提供しているPDFビューアテストURLを代用
    iframe.src = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf';
    downloadBtn.href = 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf-test.pdf';
    return;
  }

  // GoogleドライブのPDF埋め込み用プレビューURL
  const previewUrl = `https://drive.google.com/file/d/${window.CONFIG.SHIORI_FILE_ID}/preview`;
  const viewUrl = `https://drive.google.com/file/d/${window.CONFIG.SHIORI_FILE_ID}/view?usp=sharing`;

  iframe.src = previewUrl;
  downloadBtn.href = viewUrl;
}


// 🎥 4-3. YouTube Live URLの読み込みと表示
function fetchYouTube() {
  const iframe = document.getElementById('youtube-iframe');
  const wrapper = document.getElementById('youtube-wrapper');
  const loading = document.getElementById('youtube-loading');
  const empty = document.getElementById('youtube-empty');

  loading.style.display = 'flex';
  wrapper.style.display = 'none';
  empty.style.display = 'none';

  if (isConfigDummy() || !window.CONFIG.YOUTUBE_TXT_FILE_ID || window.CONFIG.YOUTUBE_TXT_FILE_ID === 'YOUR_YOUTUBE_TXT_FILE_ID') {
    // デモ用：新潟大会を想起させる適当なプロモーション動画（例として新潟県の観光PV動画など）を表示
    setTimeout(() => {
      loading.style.display = 'none';
      wrapper.style.display = 'block';
      // デモ用動画ID (例: YouTubeで公開されている新潟の美しい映像などを代用。ここではサンプルID)
      iframe.src = `https://www.youtube.com/embed/5F2v_d943h8?autoplay=0`; 
    }, 800);
    return;
  }

  // Googleドライブからテキストファイルの生データを取得する
  const fileId = window.CONFIG.YOUTUBE_TXT_FILE_ID;
  const apiKey = window.CONFIG.API_KEY;
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&key=${apiKey}`;

  fetch(url)
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          throw new Error(`エラー (${response.status}): ${err.error ? err.error.message : 'Unknown'}`);
        }).catch(() => {
          throw new Error(`取得失敗 (ステータス: ${response.status})`);
        });
      }
      return response.text();
    })
    .then(text => {
      loading.style.display = 'none';
      const videoId = extractYouTubeId(text.trim());
      
      if (videoId) {
        wrapper.style.display = 'block';
        iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=0`;
      } else {
        empty.style.display = 'flex';
        console.warn('テキストファイルに有効なYouTubeのURLが見つかりませんでした。中身:', text);
      }
    })
    .catch(error => {
      console.error(error);
      loading.style.display = 'none';
      empty.style.display = 'flex';
      empty.querySelector('p').innerText = `配信情報の読み込みに失敗しました。\n${error.message}`;
    });
}

// YouTubeのURLや共有リンクから動画IDを取り出すユーティリティ
function extractYouTubeId(url) {
  if (!url) return null;
  // 通常URL, 共有URL, モバイルURL, 埋め込みURLに対応する正規表現
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

// --------------------------------------------------------------------------
// 5. 写真拡大プレビューモーダル
// --------------------------------------------------------------------------
function openPhotoModal(imgUrl, captionText) {
  const modal = document.getElementById('photo-modal');
  const modalImg = document.getElementById('modal-img');
  const caption = document.getElementById('modal-caption');
  
  modal.style.display = 'flex';
  modalImg.src = imgUrl;
  caption.innerText = captionText;
}

function closePhotoModal(event) {
  // 画像自体をクリックしたときは閉じない（背景またはバツボタンクリックで閉じる）
  if (event.target.id === 'modal-img') return;
  
  const modal = document.getElementById('photo-modal');
  modal.style.display = 'none';
}
