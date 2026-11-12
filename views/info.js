/* ================= INFO ================= */
function renderInfo() {
  const isAdmin = state.profile.role === 'admin';
  const branchScope = isAdmin ? 'Bütün filiallar' : BRANCH_LABEL[state.profile.branch] + ' filialı';
  $('view-info').innerHTML = `
  <div class="glass rounded-3xl p-6 sm:p-8 doc-section mb-5">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-12 h-12 rounded-2xl flex items-center justify-center text-xl" style="background:var(--ink-950);color:var(--teal-400);"><i class="fa-solid fa-book"></i></div>
      <div>
        <h3 class="font-head text-xl font-bold" style="color:var(--text-strong);">Sistem bələdçisi</h3>
        <p class="text-xs" style="color:var(--text-muted);">${branchScope} üçün sadə və ətraflı izah</p>
      </div>
    </div>
    <p class="text-sm leading-relaxed" style="color:var(--text);">Bu bələdçi sistemin bütün hissələrini sadə dildə izah edir. Hər bölmədə hansı düymənin nə işə yaradığı, hansı sahənin nə üçün olduğu və addım-addım necə işləmək lazım olduğu yazılıb. Yeni başlayırsınızsa, sırası ilə oxumağınızı tövsiyə edirik.</p>
  </div>

  <div class="grid lg:grid-cols-2 gap-5">

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-house text-emerald-400"></i>1. Dashboard (Ana səhifə)</h4>
      <p>Sistemə girəndə açılan ilk səhifə. Bir baxışda bütün vəziyyəti görmək üçündür.</p>
      <ul>
        <li><b>Statistika kartları</b> — Tədris ili şagird sayı, Yay kursu şagird sayı, müəllim sayı, bu ay gözlənilən gəlir və ümumi borc məbləği.</li>
        <li><b>Gəlir vs Xərc qrafiki</b> — Son 12 ayın gəlir və xərclərini yan-yana göstərir. Hansı ay daha gəlirli, hansı ayda xərc çox olub aydın görünür.</li>
        <li><b>Filiallar üzrə şagird</b> qrafiki — Şəhər və Göynük filiallarındakı şagirdləri müqayisə edir.</li>
        <li><b>Təcili Ödənişlər</b> — Borcu olan şagirdlərin qırmızı kartları. Karta tıklayanda birbaşa həmin şagirdin profili açılır.</li>
        ${isAdmin ? '<li><b>Admin xüsusi:</b> Yuxarıda <i>Ümumi / Şəhər / Göynük</i> seçim düymələri var — hər birinə tıklayanda yalnız həmin filialın məlumatları göstərilir.</li>' : ''}
      </ul>
    </div>

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-graduation-cap text-emerald-400"></i>2. Şagirdlər bölməsi</h4>
      <p>Bütün şagirdlərin siyahısı və yenilərini əlavə etmək buradadır.</p>
      <p class="mt-3 font-bold text-white">Üst paneldəki düymələr:</p>
      <ul>
        <li><b>Tədris ili / Yay kursu</b> seçimi — siyahını filtərləyir. <i>Tədris ili</i> = il boyu davam edən şagirdlər. <i>Yay kursu</i> = yalnız yay aylarında qeydiyyatdan keçən şagirdlər.</li>
        <li><b>Axtarış sahəsi</b> — şagirdin adı, soyadı və ya telefon nömrəsi ilə tapırsınız.</li>
        <li><b>Sinif filteri</b> — yalnız müəyyən sinfin şagirdlərini görmək üçün.</li>
        <li><b>"Yeni Şagird"</b> düyməsi — tədris ili üçün şagird əlavə edir.</li>
        <li><b>"Yay kursu şagirdi"</b> düyməsi (narıncı) — Yay kursu seçimindəykən görünür. Yay kursu üçün ayrıca qeydiyyat açır.</li>
      </ul>
      <p class="mt-3 font-bold text-white">Yeni şagird əlavə edərkən doldurulan sahələr:</p>
      <ul>
        <li><b>Ad, Soyad, Valideyn adı</b> — şəxsi məlumatlar.</li>
        <li><b>Sinif / Kateqoriya</b> — 1–11 sinif, ya da Abituriyent, Universitet, Texnikum, Peşə məktəbi, Böyük (vətəndaş). <b>Yay kursunda yalnız 1–11 sinif</b> seçimi var.</li>
        <li><b>Əlaqə nömrələri</b> — birinci və ikinci telefon.</li>
        <li><b>Filial</b> — şagirdin hansı filiala aid olduğu. (Filial işçisi yalnız öz filialını seçə bilər.)</li>
        <li><b>Qeyd</b> — xüsusi qeyd üçün (məs: "Şəhid ailəsi", "qardaşı da bizdədir" və s.).</li>
      </ul>
      <p class="mt-3 font-bold text-white">Fənn sətirləri (hər şagird üçün bir və ya bir neçə fənn):</p>
      <ul>
        <li><b>Fənn</b> seçirsiniz → sistem avtomatik o fənnin müəllimlərini siyahıda göstərir.</li>
        <li><b>Müəllim seçimi MƏCBURİDİR.</b> Müəllim seçməsəniz forma yadda saxlanmır.</li>
        <li>Müəllim siyahısında <b>yalnız sizin filialın müəllimləri</b> görünür (admin bütün müəllimləri görür).</li>
        <li><b>Tarix, Qiymət (AZN), Ödəniş statusu</b> (Borc / Ödənildi) — ödənişin detalları.</li>
        <li><b>Güzəşt (AZN)</b> — bu fənn üçün şagirdə verilən endirim. Boş qoysanız 0 deməkdir.</li>
        <li><b>Güzəşt qeydi</b> — niyə endirim verildiyini yazırsınız (məs: "Şəhid ailəsi").</li>
        <li><b>Güzəşti kim qarşılayır?</b> — 3 seçim: <i>Kurs</i> (endirim kursun gəlirindən tutulur), <i>Müəllim</i> (müəllimin payından tutulur), <i>50/50</i> (yarısı kursdan, yarısı müəllimdən).</li>
      </ul>
    </div>

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-id-card text-purple-400"></i>3. Şagird profili</h4>
      <p>Şagirdin adına və ya <i class="fa-solid fa-eye"></i> ikonuna tıklayanda açılır. Şagird haqqında bütün məlumatları bir yerdə göstərir.</p>
      <ul>
        <li><b>Yuxarı hissə</b> — ad, sinif, filial, telefon, qeyd, qalıq borc və ödənilmiş cəm.</li>
        <li><b>Fənlər tabı</b> — qeydiyyatdakı bütün fənlər, qiymət, güzəşt, ödəniş statusu. Yaşıl <i class="fa-solid fa-money-bill-wave"></i> düyməsi ilə statusu bir kliklə dəyişmək olar (Borc ↔ Ödənildi).</li>
        <li><b>İmtahanlar tabı</b> — sınaq imtahanlarının nəticələri, trend qrafiki və A4 formatında <b>Çap</b> düyməsi.</li>
        <li><b>Ödəniş tarixçəsi tabı</b> — bütün ödənişlərin tarix sırası ilə siyahısı.</li>
      </ul>
    </div>

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-clipboard-check text-purple-400"></i>4. İmtahan nəticələri</h4>
      <p>Hər şagird üçün sınaq imtahanlarının qeydini aparmaq üçün.</p>
      <ul>
        <li>Profildə "İmtahanlar" tabına keçin və <b>"Yeni nəticə"</b> düyməsinə basın.</li>
        <li><b>Tarix, imtahan adı, ümumi bal və maksimum bal</b> daxil edin.</li>
        <li><b>Fənlər üzrə bal</b> — hər fənn üçün ayrıca sətir əlavə edilə bilər (sayı limitsizdir).</li>
        <li><b>Yer / reytinq</b> (məcburi deyil) və <b>qeyd</b> yazıla bilər.</li>
        <li>Profildə yuxarıda <b>trend qrafiki</b> — keçmiş imtahanların faiz nəticələrini xətti qrafik şəklində göstərir.</li>
        <li><b>Çap</b> düyməsi — bütün nəticələri A4 vərəqdə valideynə vermək üçün açır.</li>
      </ul>
    </div>

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-chalkboard-user text-blue-400"></i>5. Müəllimlər bölməsi</h4>
      <p>Müəllimlərin qeydiyyatı və onların maaş tipinin idarə edilməsi.</p>
      <p class="mt-3 font-bold text-white">Müəllim əlavə edərkən:</p>
      <ul>
        <li><b>Ad, telefon, fənn, filial</b> — əsas məlumatlar.</li>
        <li><b>Maaş tipi</b> — 3 variantdan biri seçilməlidir:
          <ul>
            <li><b>Sabit aylıq</b> — Müəllim hər ay eyni məbləği alır (məs: 500 AZN). Şagird sayından və ödənişdən asılı deyil.</li>
            <li><b>Saatlıq</b> — Saat başı bir tarif (məs: 10 AZN/saat) təyin edilir. Hər ay müəllim kartındakı <b>"Saatlar"</b> düyməsi ilə həmin ay işlədiyi saatlar yazılır. Maaş = saat × tarif.</li>
            <li><b>Şagirddən %</b> — Şagirdlərin ödədiyi məbləğin müəyyən faizi (default 50%, lazım olsa 40%, 60% və s. ola bilər) müəllimə düşür, qalanı kursa qalır. <b>Güzəştli şagirdlər ayrıca hesablanır</b> — güzəşt "kim qarşılayır" seçiminə görə müvafiq tərəfdən tutulur.</li>
          </ul>
        </li>
      </ul>
      <p class="mt-3"><b>Vacib:</b> Müəllim kartında o müəllimin neçə şagirdi olduğu, maaş tipi (badge ilə) və silmə/redaktə düymələri görünür.</p>
    </div>

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-wallet text-amber-400"></i>6. Maliyyə (Büdcə)</h4>
      <p>Pul axınının tam mənzərəsi. <b>4 tab</b> var:</p>
      <ul>
        <li><b>Hesabat</b> — Seçilmiş ay üçün <i>Ümumi Gəlir, Ümumi Xərc (xərclərin başlıqları kiçik hərflərlə altında), Müəllim payı və Net Mənfəət</i> kartları. <i>Tədris ili / Yay kursu</i> filteri də var.</li>
        <li><b>Müəllim Maaşları</b> — Bütün müəllimlərin avtomatik hesablanmış maaşları. Şagirddən %-lə işləyən müəllimlər üçün <b>"Bölgü" sütunu</b> adi və güzəştli şagirdlərdən gələn məbləği ayrıca göstərir. Əl ilə hesablamaq lazım deyil.</li>
        <li><b>Gəlirlər</b> — Təlim haqqından əlavə gəlirləri (məs: kitab satışı) əl ilə qeyd etmək.</li>
        <li><b>Xərclər</b> — İcarə, kommunal, marketinq və s. xərcləri əl ilə daxil etmək. Hər xərcin <b>başlığı</b> ümumi xərc kartında siyahı olaraq görünür.</li>
      </ul>
      <p class="mt-3"><b>Hesablama məntiqi (sadə):</b></p>
      <ul>
        <li>Hər ödənilmiş fənn üçün: <b>Şagird ödəyir = Qiymət − Güzəşt</b></li>
        <li>Müəllim <i>Şagirddən %</i> tipindədirsə: <b>Müəllim payı = Qiymət × faiz%</b>, <b>Kurs payı = qalanı</b>. Sonra güzəşt seçilən tərəfdən tutulur (Kurs / Müəllim / 50-50).</li>
        <li>Müəllim <i>Sabit</i> və ya <i>Saatlıq</i> isə güzəşt yalnız kursun gəlirinə təsir edir, müəllimin maaşına dəxli yoxdur.</li>
        <li><b>Net Mənfəət = Ümumi Gəlir − Ümumi Xərc</b> (avto maaşlar + əl ilə xərclər)</li>
      </ul>
    </div>

    ${isAdmin ? `
    <div class="glass rounded-3xl p-6 doc-section lg:col-span-2" style="border-color:var(--gold-100);">
      <h4 style="color:var(--gold-600);"><i class="fa-solid fa-user-shield"></i>7. Admin xüsusi səlahiyyətlər</h4>
      <p>Admin olaraq aşağıdakı əlavə imkanlarınız var:</p>
      <ul>
        <li><b>Bütün filialları görmək</b> — sağ üst küncdəki filial seçimi ilə Ümumi / Şəhər / Göynük arasında keçid.</li>
        <li><b>Yeni istifadəçi yaratmaq</b> — Sol menyudan "İstifadəçilər" → "Yeni İstifadəçi" düyməsi. Email, şifrə, ad, rol və filial seçilir. Sistem avtomatik hesab yaradır (sizin öz sessiyanız təsirlənmir).</li>
        <li><b>İstifadəçini deaktiv/aktiv etmək</b> — İstifadəçilər siyahısındakı keçid düyməsi ilə, hesabı silmədən girişini bağlaya bilərsiniz.</li>
        <li><b>İstifadəçinin profilini silmək</b> — istifadəçi siyahısındakı <i class="fa-solid fa-trash"></i> ilə (Firebase Auth hesabı qalır, yalnız profil deaktiv/silinir).</li>
        <li><b>Şifrə sıfırlamaq</b> — İstifadəçilər siyahısındakı <i class="fa-solid fa-key"></i> ilə, ya yeni şifrə təyin edərək, ya da email linki göndərərək. Filial işçiləri özləri şifrə dəyişə bilməz, sizə müraciət edirlər.</li>
        <li><b>Fənləri idarə etmək</b> — Parametrlərdə Tədris ili fənləri və Yay kursu fənləri ayrı-ayrı siyahılardır. Yenisini əlavə edə və ya silə bilərsiniz.</li>
        <li><b>Məlumat ixracı</b> — Parametrlər səhifəsində bütün filialların məlumatlarını JSON/Excel/PDF formatında endirə bilərsiniz.</li>
        <li><b>Audit log</b> — Son 200 dəyişikliyin tarixçəsi: kim, nə vaxt, hansı qeydi (şagird/müəllim/xərc) əlavə etdi, dəyişdi və ya sildi.</li>
        <li>Filial işçiləri yalnız <b>öz filiallarındakı</b> qeydləri görür və redaktə edir; siz hamısını görürsünüz.</li>
      </ul>
    </div>` : ''}

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-gear" style="color:var(--text-faint);"></i>8. Parametrlər</h4>
      <ul>
        <li><b>Profil</b> — emailiniz, rolunuz və filialınız göstərilir.</li>
        ${isAdmin ? '<li><b>Şifrəni dəyiş</b> — yalnız admin üçün.</li>' : '<li><b>Şifrə dəyişmək</b> burada YOXDUR — yalnız admin tərəfindən dəyişdirilə bilər.</li>'}
        <li><b>Görünüş</b> — tünd/açıq mövzu, səs effektləri və animasiya seçimləri.</li>
        <li><b>Fənlər</b> — sistemdəki tədris ili fənlərinin siyahısı.</li>
        ${isAdmin ? '<li><b>Yay kursu fənləri</b> — yalnız yay kursunda istifadə olunan ayrıca fənn siyahısı.</li><li><b>Audit log</b> bölməsi — bütün dəyişikliklərin tarixçəsi.</li><li>İstifadəçi idarəsi ayrıca <b>"İstifadəçilər"</b> menyu bölməsindədir (sol menyu).</li>' : ''}
      </ul>
    </div>

    <div class="glass rounded-3xl p-6 doc-section">
      <h4><i class="fa-solid fa-keyboard text-emerald-400"></i>9. Tez işləmə məsləhətləri</h4>
      <ul>
        <li>Şagirdin adına klikləyərək birbaşa profilə daxil olun — siyahıda <i class="fa-solid fa-eye"></i> ikonuna basmaq lazım deyil.</li>
        <li>Ödəniş statusunu profildə yaşıl <i class="fa-solid fa-money-bill-wave"></i> düyməsi ilə bir kliklə dəyişin (Borc ↔ Ödənildi).</li>
        <li>Yay kursu üçün siyahıda yuxarıdakı <b>Yay kursu</b> seçimini aktivləşdirin, sonra "Yay kursu şagirdi" düyməsi ilə qeydiyyat aparın.</li>
        <li>Güzəşt verərkən mütləq <b>"kim qarşılayır"</b> seçimini düzgün təyin edin — bu, müəllimin maaşına və kursun gəlirinə təsir edir.</li>
        <li>Hər ayın əvvəli saatlıq müəllimlərin saatlarını qeyd etməyi unutmayın — yoxsa maaş 0 görünür.</li>
      </ul>
    </div>

  </div>`;
}


