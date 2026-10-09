```javascript
import {
  auth, db, storage, onAuthStateChanged,
  signInWithEmailAndPassword, signOut,
  doc, getDoc, collection, getDocs,
  ref, listAll, getDownloadURL
} from './firebase.js';

const $ = id => document.getElementById(id);
const modal = $('loginModal');
const nav = $('nav');

// Mobile menu
document.querySelector('.menu-btn')?.addEventListener('click', () => {
  nav.classList.toggle('open');
});

// Login modal
['loginOpen', 'heroLogin', 'tccLogin', 'footerLogin'].forEach(id => {
  $(id)?.addEventListener('click', openLogin);
});

$('closeLogin')?.addEventListener('click', closeLogin);

modal?.addEventListener('click', e => {
  if (e.target === modal) closeLogin();
});

function openLogin() {
  modal.classList.remove('hidden');
  $('loginStatus').textContent = '';
  $('email').focus();
}

function closeLogin() {
  modal.classList.add('hidden');
}

// Student login and approval check
$('loginForm').addEventListener('submit', async e => {
  e.preventDefault();

  const email = $('email').value.trim();
  const password = $('password').value;
  const status = $('loginStatus');

  status.className = 'status';
  status.textContent = 'Checking account…';

  try {
    const cred = await signInWithEmailAndPassword(
      auth, email, password
    );

    const snap = await getDoc(doc(db, 'students', cred.user.uid));

    if (!snap.exists()) {
      await signOut(auth);
      throw new Error(
        'Student profile was not found. Please contact Vishwakala Institute.'
      );
    }

    const data = snap.data();

    if (data.approved !== true) {
      await signOut(auth);
      throw new Error(
        'Your account is not approved yet. Please contact Vishwakala Institute.'
      );
    }

    closeLogin();
    showPortal(data);

  } catch (err) {
    status.className = 'status error';
    status.textContent = friendlyError(err);
  }
});

function friendlyError(err) {
  const code = err?.code || '';

  if (
    code.includes('invalid-credential') ||
    code.includes('invalid-login-credentials')
  ) {
    return 'Incorrect email or password.';
  }

  if (code.includes('too-many-requests')) {
    return 'Too many attempts. Please try again later.';
  }

  if (code.includes('network-request-failed')) {
    return 'Network problem. Please check your internet connection.';
  }

  return err?.message || 'Unable to sign in.';
}

// Restore an approved student's session
onAuthStateChanged(auth, async user => {
  if (!user) {
    $('student').classList.add('hidden');
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'students', user.uid));

    if (snap.exists() && snap.data().approved === true) {
      showPortal(snap.data());
    } else {
      $('student').classList.add('hidden');
      await signOut(auth);
    }
  } catch (err) {
    console.error('Student session check failed:', err);
  }
});

// Show student portal
function showPortal(data) {
  $('student').classList.remove('hidden');
  $('studentName').textContent = data.name || 'Student';
  $('studentCourse').textContent =
    (data.course || 'Approved student') + ' • Approved';

  $('profileInfo').textContent =
    `${data.mobile || ''}${data.email ? ' • ' + data.email : ''}`;

  $('student').scrollIntoView({ behavior: 'smooth' });
}

// Logout
$('logoutBtn').addEventListener('click', async () => {
  await signOut(auth);

  $('student').classList.add('hidden');
  $('videoArea').innerHTML = '';
  $('pdfArea').innerHTML = '';

  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// HTML escaping
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[char]);
}

// VIDEO CLASSES
$('loadVideos').addEventListener('click', async () => {
  const area = $('videoArea');

  area.innerHTML =
    '<div class="portal-card">Loading video classes…</div>';

  try {
    const result = await listAll(ref(storage, 'videos'));

    const files = result.items.filter(item =>
      /\.mp4$/i.test(item.name)
    );

    if (!files.length) {
      area.innerHTML =
        '<div class="portal-card">No MP4 videos found.</div>';
      return;
    }

    const cards = [];

    for (const item of files) {
      const url = await getDownloadURL(item);
      const title = item.name
        .replace(/\.mp4$/i, '')
        .replace(/[_-]+/g, ' ');

      cards.push(`
        <article class="video-item">
          <h3>${escapeHtml(title)}</h3>

          <video
            controls
            controlsList="nodownload"
            disablePictureInPicture
            playsinline
            preload="metadata"
            oncontextmenu="return false"
            src="${escapeHtml(url)}"
            style="width:100%;max-width:100%;border-radius:12px;background:#000"
          >
            Your browser does not support video playback.
          </video>
        </article>
      `);
    }

    area.innerHTML = cards.join('');

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
$('loadPdfs').addEventListener('click', async () => {
  const area = $('pdfArea');

  area.innerHTML =
    '<div class="portal-card">Loading PDF notes…</div>';

  try {
    const snap = await getDocs(collection(db, 'pdfs'));

    if (snap.empty) {
      area.innerHTML =
        '<div class="portal-card">No PDF notes found.</div>';
      return;
    }

    const cards = [];

    snap.forEach(d => {
      const data = d.data();

      if (!data.pdfUrl) return;

      // Hide the normal PDF toolbar where the browser viewer supports it.
      const viewerUrl = data.pdfUrl +
        '#toolbar=0&navpanes=0&scrollbar=0&view=FitH';

      cards.push(`
        <article class="pdf-item">
          <h3>${escapeHtml(data.title || 'PDF Notes')}</h3>

          <p>${escapeHtml(data.course || '')}</p>

          <p>${escapeHtml(data.description || '')}</p>

          <div style="width:100%;height:650px;overflow:hidden;border-radius:10px;background:#f5f5f5">
            <iframe
              loading="lazy"
              src="${escapeHtml(viewerUrl)}"
              title="${escapeHtml(data.title || 'PDF Notes')}"
              style="width:100%;height:100%;border:0"
              referrerpolicy="no-referrer"
              oncontextmenu="return false"
            ></iframe>
          </div>
        </article>
      `);
    });

    area.innerHTML = cards.length
      ? cards.join('')
      : '<div class="portal-card">No PDF URLs were found.</div>';

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
```
