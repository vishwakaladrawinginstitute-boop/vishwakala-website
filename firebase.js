import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore, doc, getDoc, collection, getDocs, query, orderBy } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';
import { getStorage, ref, listAll, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAcxd3pll1HOXfGAO1aG4-RqoLwlrTBs10',
  authDomain: 'vishwakala-drawing-institute.firebaseapp.com',
  projectId: 'vishwakala-drawing-institute',
  storageBucket: 'vishwakala-drawing-institute.firebasestorage.app',
  messagingSenderId: '519705954257',
  appId: '1:519705954257:web:05f7af25097fa411d802f0',
  measurementId: 'G-FJLD0GEDZJ'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage, onAuthStateChanged, signInWithEmailAndPassword, signOut, doc, getDoc, collection, getDocs, query, orderBy, ref, listAll, getDownloadURL };
