/* =========================================================================
   MƏRAM AI — BİLİK BAZASI (KNOWLEDGE BASE)
   -------------------------------------------------------------------------
   "Məlumat" panelindəki bütün bələdçi + sistemin biznes qaydaları burada
   struktur şəklində saxlanılır və hər AI sorğusuna ötürülür.
   Beləliklə AI həm məlumatlara, həm də "necə işləyir?" suallarına cavab verir.
   ========================================================================= */

window.MERAM_KB = {
  /* ---------- Ümumi ---------- */
  about: `
MƏRAM TƏDRİS MƏRKƏZİ — DAXİLİ İDARƏETMƏ SİSTEMİ (ERP)
İki filial var: "Şəhər" (kod: sheher) və "Göynük" (kod: goynuk).
Sistem şagird, müəllim/kadr, davamiyyət, dərs cədvəli, imtahan nəticələri,
maliyyə (gəlir/xərc/maaş), istifadəçi idarəetməsi və AI analiz modullarından ibarətdir.
Bütün məbləğlər Azərbaycan manatı (₼ / AZN) ilədir. İnterfeys dili Azərbaycan dilidir.`,

  /* ---------- Modullar ---------- */
  modules: `
1) DASHBOARD (Ana səhifə)
   - Statistika kartları: tədris ili şagird sayı, yay kursu şagird sayı, kadr sayı,
     bu ay gözlənilən gəlir, ümumi borc.
   - "Gəlir vs Xərc" qrafiki (son 12 ay), "Filiallar üzrə şagird" qrafiki.
   - "Təcili Ödənişlər": ödəniş tarixi keçmiş (overdue) şagird kartları; karta klik → şagird profili.
   - Admin üçün yuxarıda Ümumi / Şəhər / Göynük seçimi var.

2) ŞAGİRDLƏR
   - Siyahı, axtarış (ad, soyad, telefon), sinif filtri, "Tədris ili / Yay kursu" seçimi.
   - Yeni şagird "sehrbaz" (wizard) ilə addım-addım əlavə olunur.
   - Şagird sahələri: ad, soyad, sinif (5-11, abituriyent, universitet, texnikum, peşə, böyük),
     telefon, valideyn adı və telefonu, filial, qeydiyyat tipi (regular/summer), fənlər siyahısı.
   - Hər fənn sətri: fənn adı, müəllim, qiymət (price), endirim (discount),
     endirimin kim tərəfindən qarşılanması (discountCoverage: course / teacher / split),
     ödəniş tarixi (paymentDate), status (paid / unpaid).
   - Profil pəncərəsi tabları: Fənlər, Ödənişlər, İmtahanlar, AI Təhlili.
   - WhatsApp xatırlatma düyməsi valideynə hazır mətn göndərir.

3) DAVAMİYYƏT
   - Gün + filial + fənn üzrə şagird iştirakı qeyd olunur (var / yox / gecikib).
   - Aylıq davamiyyət faizi hesablanır.

4) CƏDVƏL (Dərs cədvəli)
   - Həftəlik grid: gün, başlama/bitmə saatı, müəllim, fənn, otaq, filial.

5) KADRLAR (Müəllimlər və digər işçilər)
   - Rol növləri: müəllim, reception, menecer, administrator, xadimə, digər.
   - Maaş tipləri: "fixed" (sabit aylıq), "hourly" (saatlıq), "revenue_share" (şagird ödənişindən faiz).
   - revenue_share üçün teacherSharePct (default 50%) sahəsi var.
   - Saatlıq işçilər üçün iş saatları qeyd olunur.

6) MALİYYƏ & BÜDCƏ
   - Gəlir və xərc yazıları (tarix, kateqoriya, məbləğ, qeyd, filial).
   - Maaş hesablanması, aylıq hesabat, kateqoriya qrafiki, Excel/PDF ixracı.

7) MƏLUMAT (Sistem bələdçisi)
   - Bu sənədin insanlar üçün olan versiyası.

8) PARAMETRLƏR
   - Tema (işıqlı/qaranlıq), səs, animasiya, fənn siyahıları, AI limiti, backup/ixrac, audit log.

9) İSTİFADƏÇİLƏR
   - Sistem istifadəçilərinin yaradılması, rol/filial təyini, şifrə sıfırlanması, silinməsi.

10) AI MODULLARI
   - "AI Maliyyə Analizi" (yalnız admin): gəlir/xərc/mənfəət təhlili və tövsiyələr.
   - "AI Şagird Hesabatı" (yalnız admin): şagird bazasının ümumi analizi.
   - "AI Proqnoz" (yalnız admin): xətti reqressiya ilə hesablanmış növbəti ay proqnozu + şərh.
   - Şagird profilində "AI Təhlili": imtahan nəticələrinin pedaqoji analizi.
   - AI Köməkçi (chat): sağ aşağıdakı düymə ilə açılır, sistem və məlumatlar haqqında sual-cavab.`,

  /* ---------- Rollar ---------- */
  roles: `
ROLLAR VƏ İCAZƏLƏR
- admin / super_admin: hər şeyə tam çıxış, bütün filiallar, istifadəçi idarəetməsi, AI modulları.
- manager (Müdir): öz filialının şagird, kadr, davamiyyət, cədvəl və maliyyə məlumatları.
- reception: öz filialında şagird və davamiyyət əməliyyatları; maliyyənin böyük hissəsi bağlıdır.
- accountant (Mühasib): maliyyə və hesabatlar.
- hr: kadr idarəetməsi.
- teacher (Müəllim): öz dərsləri, davamiyyət və imtahan nəticələri.
QAYDA: admin olmayan istifadəçi YALNIZ öz filialının məlumatlarını görə bilər.
Başqa filialın və ya ümumi maliyyənin məlumatı soruşulursa cavab: "Bu məlumata icazəniz yoxdur."`,

  /* ---------- Biznes qaydaları ---------- */
  rules: `
HESABLAMA QAYDALARI
- Şagirdin bir fənn üzrə ödəyəcəyi məbləğ: studentPays = price - discount (mənfi ola bilməz).
- Müəllim maaş tipi "revenue_share" deyilsə: kursun gəliri = studentPays, müəllimə pay getmir.
- "revenue_share" olduqda: müəllimin payı = price * teacherSharePct%, qalanı kursa qalır.
  Endirimi kim qarşılayır: 'teacher' → müəllimin payından, 'course' → kursun payından,
  'split' → yarı-yarı çıxılır.
- Bu ay gözlənilən gəlir = bütün aktiv şagirdlərin bütün fənlər üzrə studentPays cəmi.
- BORC (overdue): status 'paid' deyil VƏ paymentDate bugünkü tarixdən əvvəldirsə.
- Mənfəət = gəlir - (xərclər + maaşlar).
- Qeydiyyat tipi: 'regular' = tədris ili, 'summer' = yay kursu.
AI LİMİTİ: hər filial üçün gündəlik AI sorğu limiti var (ümumi limitin yarısı, standart 500/gün).
Limit dolduqda AI cavab vermir və istifadəçiyə xəbərdarlıq göstərilir.`,

  /* ---------- Necə edilir ---------- */
  howto: `
ADDIM-ADDIM TƏLİMATLAR
- Yeni şagird: Şagirdlər → "Yeni Şagird" → sehrbazda şəxsi məlumat → fənn/müəllim/qiymət → təsdiq.
- Ödənişi "ödənilib" etmək: şagird profili → Fənlər/Ödənişlər tabı → müvafiq sətirdə status dəyiş.
- Endirim vermək: fənn sətrində "endirim" məbləği və endirimi kimin qarşıladığını seç.
- Davamiyyət: Davamiyyət → tarix və fənn seç → şagirdləri işarələ → avtomatik yadda saxlanır.
- Dərs əlavə etmək: Cədvəl → boş xanaya klik → müəllim, fənn, saat, otaq.
- Xərc yazmaq: Maliyyə → "Xərc əlavə et" → kateqoriya, məbləğ, tarix.
- İmtahan nəticəsi: şagird profili → İmtahanlar tabı → "Nəticə əlavə et" (fənn, bal, tarix).
- İstifadəçi yaratmaq (yalnız admin): İstifadəçilər → "Yeni istifadəçi" → email, şifrə, rol+filial.
- Temanı dəyişmək: Parametrlər → "İşıqlı rejim" açarı.
- İxrac: Maliyyə və Şagirdlər bölmələrində Excel/PDF düymələri.`,

  /* Tam mətn — AI-a göndərilir */
  full() {
    return [this.about, this.modules, this.roles, this.rules, this.howto].join('\n');
  }
};
