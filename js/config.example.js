/* =========================================================================
   MƏRAM ERP — MƏRKƏZİ KONFİQURASİYA
   -------------------------------------------------------------------------
   Bütün açarlar və mühit parametrləri BURADA saxlanılır.
   Deploy zamanı yalnız bu faylı dəyişmək kifayətdir.

   TƏHLÜKƏSİZLİK QEYDİ:
   Bu tətbiq tam statikdir (server yoxdur), ona görə brauzerə göndərilən
   hər hansı açar istifadəçi tərəfindən görünə bilər. Real qorunma:
     1) Google Cloud Console → Credentials → Gemini açarı üçün
        "HTTP referrer" məhdudiyyəti qoyun (yalnız öz domeniniz).
     2) Firebase Console → Authentication → Authorized domains.
     3) Firebase Realtime Database Rules ilə oxu/yazma icazələrini
        yalnız autentifikasiya olunmuş istifadəçilərə verin.
   Ətraflı: README.md
   ========================================================================= */
window.MERAM_CONFIG = {
  appName: 'Məram Tədris Mərkəzi',
  firebase: {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "meramdata.firebaseapp.com",
    databaseURL: "https://meramdata-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "meramdata",
    storageBucket: "meramdata.firebasestorage.app",
    messagingSenderId: "162721431418",
    appId: "1:162721431418:web:2452f3b7aaa54ab05fe0c3"
  },
  gemini: {
    apiKey: 'YOUR_GEMINI_API_KEY', // restrict by HTTP referrer in Google Cloud Console — see js/config.js comment
    model: 'gemini-3.6-flash',
    get endpoint() {
      return 'https://generativelanguage.googleapis.com/v1beta/models/' + this.model + ':generateContent';
    },
    dailyTotalFallback: 500,   // gündəlik ümumi sorğu limiti (DB-də yoxdursa)
    cacheTTLMinutes: 10,
    maxOutputTokens: 2048,
    temperature: 0.3
  },
  branches: { sheher: 'Şəhər', goynuk: 'Göynük' },
  // Auto-logout after this many minutes of inactivity. 0 disables it.
  idleTimeoutMinutes: 20
};
