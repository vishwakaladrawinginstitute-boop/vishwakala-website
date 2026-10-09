
import {
  auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  doc, getDoc, collection, getDocs, ref, listAll, getDownloadURL
} from './firebase.js';

const $ = id => document.getElementById(id);
const modal = $('loginModal');
const nav = $('nav');

document.querySelector('.menu-btn')?.addEventListener('click', () => nav?.classList.toggle('open'));
['loginOpen', 'heroLogin', 'tccLogin', 'footerLogin'].forEach(id =>
  $(id)?.addEventListener('click', openLogin)
);
$('closeLogin')?.addEventListener('click', closeLogin);
modal?.addEventListener('click', e => {
  if (e.target === modal) closeLogin();
});

function openLogin() {
  modal?.classList.remove('hidden');
  if ($('loginStatus')) $('loginStatus').textContent = '';
  $('email')?.focus();
}

function closeLogin() {
  modal?.classList.add('hidden');
}

$('loginForm')?.addEventListener('submit', async e => {
  e.preventDefault();

  const status = $('loginStatus');
  status.className = 'status';
  status.textContent = 'Checking account…';

  try {
    const cred = await signInWithEmailAndPassword(
      auth,
      $('email').value.trim(),
      $('password').value
    );

    const snap = await getDoc(doc(db, 'students', cred.user.uid));

    if (!snap.exists() || snap.data().approved !== true) {
      await signOut(auth);
      throw new Error(
        !snap.exists()
          ? 'Student profile was not found. Please contact Vishwakala Institute.'
          : 'Your account is not approved yet. Please contact Vishwakala Institute.'
      );
    }

    closeLogin();
    showPortal(snap.data());
  } catch (err) {
    const code = err?.code || '';
    status.className = 'status error';

    status.textContent =
      code.includes('invalid-credential') ||
      code.includes('invalid-login-credentials')
        ? 'Incorrect email or password.'
        : code.includes('too-many-requests')
        ? 'Too many attempts. Please try again later.'
        : code.includes('network-request-failed')
        ? 'Network problem. Please check your internet connection.'
        : err?.message || 'Unable to sign in.';
  }
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    $('student')?.classList.add('hidden');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'students', user.uid));

    if (snap.exists() && snap.data().approved === true) {
      showPortal(snap.data());
    } else {
      $('student')?.classList.add('hidden');
      await signOut(auth);
    }
  } catch (err) {
    console.error('Student session check failed:', err);
  }
});

function showPortal(data) {
  $('student')?.classList.remove('hidden');

  if ($('studentName')) {
    $('studentName').textContent = data.name || 'Student';
  }

  if ($('studentCourse')) {
    $('studentCourse').textContent =
      `${data.course || 'Approved student'} • Approved`;
  }

  if ($('profileInfo')) {
    $('profileInfo').textContent =
      `${data.mobile || ''}${data.email ? ' • ' + data.email : ''}`;
  }

  $('student')?.scrollIntoView({ behavior: 'smooth' });
}

$('logoutBtn')?.addEventListener('click', async () => {
  await signOut(auth);
  stopAndClearVideos();

  if ($('videoArea')) $('videoArea').innerHTML = '';
  if ($('pdfArea')) $('pdfArea').innerHTML = '';

  $('student')?.classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[char]));
}

function stopAndClearVideos() {
  document.querySelectorAll('#videoArea video').forEach(video => {
    video.pause();
    video.removeAttribute('src');
    video.querySelectorAll('source').forEach(source => {
      source.removeAttribute('src');
    });
    video.load();
  });
}

// VIDEO CLASSES
// Shows a list first. Selecting a video opens it inside the website.
$('loadVideos')?.addEventListener('click', async () => {
  const area = $('videoArea');
  area.innerHTML = '<div class="portal-card">Loading video classes…</div>';

  try {
    const result = await listAll(ref(storage, 'videos'));
    const items = result.items.filter(item => /\.mp4$/i.test(item.name));

    if (!items.length) {
      area.innerHTML = '<div class="portal-card">No MP4 videos found.</div>';
      return;
    }

    const videos = await Promise.all(items.map(async item => ({
      title: item.name.replace(/\.mp4$/i, '').replace(/[_-]+/g, ' '),
      url: await getDownloadURL(item)
    })));

    area.innerHTML = `
      <div class="portal-list-head">
        <h3>Video Classes</h3>
        <button class="small-btn" id="closeVideoList">Close List ✕</button>
      </div>

      <div class="media-list">
        ${videos.map((video, index) => `
          <button class="media-row" type="button" data-video="${index}">
            ▶ ${escapeHtml(video.title)}
            <span>Play</span>
          </button>
        `).join('')}
      </div>

      <div id="videoPlayerPanel" class="portal-card" hidden></div>
    `;

    area.querySelectorAll('[data-video]').forEach(button => {
      button.addEventListener('click', () => {
        const video = videos[Number(button.dataset.video)];
        const panel = $('videoPlayerPanel');

        stopAndClearVideos();
        panel.hidden = false;

        panel.innerHTML = `
          <div class="media-viewer-head">
            <h3>${escapeHtml(video.title)}</h3>
            <button class="small-btn" id="closeVideo">Close Video ✕</button>
          </div>

          <video
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsinline
            preload="metadata"
            oncontextmenu="return false"
            style="width:100%;border-radius:12px;background:#000"
          >
            <source src="${escapeHtml(video.url)}" type="video/mp4">
            Your browser does not support video playback.
          </video>
        `;

        $('closeVideo').addEventListener('click', () => {
          stopAndClearVideos();
          panel.hidden = true;
          panel.innerHTML = '';
        });
      });
    });

    $('closeVideoList').addEventListener('click', () => {
      stopAndClearVideos();
      area.innerHTML = '';
    });
  } catch (err) {
    console.error(err);
    area.innerHTML = `
      <div class="portal-card">
        <b>Unable to load videos.</b>
        <p>${escapeHtml(err.message || 'Check Firebase Storage rules.')}</p>
      </div>
    `;
  }
});

// PDF NOTES
// Uses PDF.js to display pages without the browser's standard PDF toolbar.
$('loadPdfs')?.addEventListener('click', async () => {
  const area = $('pdfArea');
  area.innerHTML = '<div class="portal-card">Loading PDF notes…</div>';

  try {
    const snap = await getDocs(collection(db, 'pdfs'));

    if (snap.empty) {
      area.innerHTML = '<div class="portal-card">No PDF notes found.</div>';
      return;
    }

    const pdfs = [];

    snap.forEach(document => {
      const item = document.data();

      if (item.pdfUrl) {
        pdfs.push({
          title: item.title || 'PDF Notes',
          course: item.course || '',
          description: item.description || '',
          url: item.pdfUrl
        });
      }
    });

    if (!pdfs.length) {
      area.innerHTML = '<div class="portal-card">No PDF URLs were found.</div>';
      return;
    }

    area.innerHTML = `
      <div class="portal-list-head">
        <h3>PDF Notes</h3>
        <button class="small-btn" id="closePdfList">Close List ✕</button>
      </div>

      <div class="media-list">
        ${pdfs.map((pdf, index) => `
          <button class="media-row" type="button" data-pdf="${index}">
            📄 ${escapeHtml(pdf.title)}
            <span>Open</span>
          </button>
        `).join('')}
      </div>

      <div id="pdfViewerPanel" class="portal-card" hidden></div>
    `;

    area.querySelectorAll('[data-pdf]').forEach(button => {
      button.addEventListener('click', async () => {
        const pdfItem = pdfs[Number(button.dataset.pdf)];
        const panel = $('pdfViewerPanel');

        panel.hidden = false;

        panel.innerHTML = `
          <div class="media-viewer-head">
            <div>
              <h3>${escapeHtml(pdfItem.title)}</h3>
              <p>${escapeHtml(pdfItem.course)} ${escapeHtml(pdfItem.description)}</p>
            </div>
            <button class="small-btn" id="closePdf">Close PDF ✕</button>
          </div>

          <div
            id="pdfPages"
            style="display:grid;gap:16px;justify-content:center;overflow:auto;max-height:75vh;background:#e9edf3;padding:12px"
          >
            Opening PDF…
          </div>
        `;

        $('closePdf').addEventListener('click', () => {
          panel.hidden = true;
          panel.innerHTML = '';
        });

        try {
          const pdfjs = await import(
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs'
          );

          pdfjs.GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

          const pdf = await pdfjs.getDocument({ url: pdfItem.url }).promise;
          const pages = $('pdfPages');

          if (!pages || panel.hidden) return;
          pages.innerHTML = '';

          for (let number = 1; number <= pdf.numPages; number++) {
            if (panel.hidden) break;

            const page = await pdf.getPage(number);
            const viewport = page.getViewport({ scale: 1.2 });
            const canvas = document.createElement('canvas');

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.maxWidth = '100%';
            canvas.style.height = 'auto';
            canvas.style.background = '#fff';

            pages.appendChild(canvas);

            await page.render({
              canvasContext: canvas.getContext('2d'),
              viewport
            }).promise;
          }
        } catch (err) {
          console.error('PDF viewer error:', err);

          const pages = $('pdfPages');
          if (pages) {
            pages.textContent =
              'Could not display this PDF. Check the PDF URL and Firebase Storage CORS settings.';
          }
        }
      });
    });

    $('closePdfList').addEventListener('click', () => {
      area.innerHTML = '';
    });
  } catch (err) {
    console.error(err);

    area.innerHTML = `
      <div class="portal-card">
        <b>Unable to load PDF notes.</b>
        <p>${escapeHtml(err.message || 'Check Firestore and Storage rules.')}</p>
      </div>
    `;
  }
});
