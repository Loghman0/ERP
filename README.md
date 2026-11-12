# Məram Tədris Mərkəzi — ERP (modular build)

Tam statik tətbiq. Serverə ehtiyac yoxdur — `index.html` faylını hostinqə qoymaq kifayətdir.

## Struktur
```
index.html            – yalnız HTML skeleti (view konteynerləri, modal-lar)
css/base.css          – əsas tema, tipoqrafiya, animasiyalar
css/components.css    – komponentlər, səhifə keçidləri (view-enter/exit)
css/theme-light.css   – CSS dəyişənləri ilə işıqlı tema
css/extra.css         – çap, cədvəl, kiçik düzəlişlər
js/config.js          – BÜTÜN açarlar və limitlər (deploy zamanı yalnız bunu dəyişin)
js/firebase-init.js   – Firebase başlatması
js/state.js           – qlobal state və sabitlər
js/permissions.js     – icazə kataloqu
js/rbac.js            – rol/icazə yoxlama (can())
js/utils.js           – köməkçi funksiyalar ($ , toast, format)
js/auth.js            – giriş / çıxış / profil yüklənməsi
js/compat.js          – ödəniş və maaş hesablamaları
js/router.js          – boot + yumşaq səhifə keçidləri
js/admin.js           – admin əməliyyatları, audit
js/ai/knowledge.js    – AI bilik bazası ("Məlumat" paneli + biznes qaydaları)
js/ai/prompts.js      – sistem promptları + mövzu filtri (yalnız Məram sualları)
js/ai/gemini.js       – Gemini çağırışı, keş, kvota
js/ai/context.js      – rola görə məlumat konteksti
views/*.js            – hər bölmənin render kodu
views/ai/*.js         – AI chat və AI alətləri
```

## Konfiqurasiya
`js/config.js` faylını açın və `firebase` + `gemini` açarlarını öz layihənizinki ilə əvəz edin.
Nümunə: `js/config.example.js`.

Tətbiq brauzerdə işlədiyi üçün açarlar istifadəçiyə görünür. Qorunma:
1. Google Cloud Console → Gemini açarına **HTTP referrer** məhdudiyyəti qoyun.
2. Firebase → Authentication → Authorized domains.
3. Firebase Realtime Database Rules ilə yalnız autentifikasiya olunmuş istifadəçilərə icazə verin.

## AI
- Bütün cavablar Azərbaycan dilindədir, məbləğlər ₼ ilə göstərilir.
- AI yalnız Məram sistemi ilə bağlı suallara cavab verir; kənar mövzular avtomatik rədd edilir.
- Gündəlik kvota: `aiQuota/config/dailyTotal` (default 500), filiallar arasında 50/50 bölünür.
