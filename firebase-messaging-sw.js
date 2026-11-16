// Receives AMCAG chat push notifications while the site is closed or in the background.
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDArX-BdyqmTaLV0GRn8mAJ6jMlPN_12LI',
  authDomain: 'amcag-af624.firebaseapp.com',
  projectId: 'amcag-af624',
  storageBucket: 'amcag-af624.firebasestorage.app',
  messagingSenderId: '772149261606',
  appId: '1:772149261606:web:b3b805d94ab018da643de7'
});

// Messages that carry a "notification" block are shown by the browser itself; clicking opens the link set on the server.
firebase.messaging();
