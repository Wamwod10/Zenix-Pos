# Filial bo‘yicha umumiy holat va real-time sinxronizatsiya

## Maqsad

Bir tashkilotning bir filialiga kirgan biznes egasi va barcha xodimlar yagona server holati bilan ishlaydi. Bir foydalanuvchi smena, savdo, mahsulot, qoldiq, mijoz, xarajat, ta’minotchi yoki sozlamani o‘zgartirganda boshqa ochiq sessiyalar sahifani qayta yuklamasdan yangilanadi. Filialga biriktirilgan foydalanuvchi boshqa filial ma’lumotlarini olmaydi.

## Hozirgi muammo

- PostgreSQL ma’lumotlari tashkilot bo‘yicha umumiy, ammo har brauzer `StoreContext` holatini faqat login va o‘z mutationlaridan keyin yangilaydi.
- Boshqa foydalanuvchi qilgan mutation haqida ochiq sessiyalarga signal yuborilmaydi.
- Smena ataylab `user:<userId>` registriga bog‘langan va bootstrap faqat joriy foydalanuvchining ochiq smenasini `activeShifts`ga qo‘shadi.
- `CASHIER` va `SALES` boshqa foydalanuvchi ochgan smenada savdo yoki naqd qaytarish qila olmaydi. Bu umumiy filial kassasi talabiga zid.

## Tanlangan yechim

### 1. Yagona filial smenasi

- Yangi smena registr kaliti `store:<storeId>` bo‘ladi.
- Backend smena ochish tranzaksiyasida filial bo‘yicha transaction-level advisory lock oladi va shu tashkilot/filialda istalgan ochiq smena borligini tekshiradi. Bu bir vaqtda ikki foydalanuvchi ikkita smena ochishining oldini oladi.
- Bootstrap har filialdagi eng yangi ochiq smenani barcha shu filialga ruxsatli foydalanuvchilarga `activeShifts[storeId]` sifatida qaytaradi.
- Deploydan oldin ochilgan eski `user:*` smenalar yopilmaydi yoki o‘zgartirilmaydi. Agar tarixiy sabab bilan bir filialda bir nechta ochiq smena bo‘lsa, eng yangisi faol ko‘rsatiladi; ular odatiy yopish oqimi bilan xavfsiz yakunlanadi.
- `CASHIER` va `SALES` umumiy ochiq smenada savdo qiladi va ruxsati bo‘lsa qaytarish qiladi. Savdoda `seller_id` baribir amaldagi foydalanuvchi bo‘lib qoladi, shuning uchun sotuvchi tahlili buzilmaydi.
- Smenani yopish va qo‘lda kassa kirim/chiqimi mavjud `shiftRecon` ruxsati yoki smenani ochgan foydalanuvchi nazoratida qoladi. Ma’lumot umumiy ko‘rinadi, xavfli boshqaruv amallari esa ruxsat bilan himoyalanadi.

### 2. PostgreSQL revision signali

- Yangi additive migration `workspace_revisions` jadvalini yaratadi: `organization_id` primary key, monoton `revision`, `updated_at`.
- Muvaffaqiyatli autentifikatsiyalangan `POST`, `PATCH`, `PUT` yoki `DELETE` javobidan keyin middleware tashkilot revisionini atomik `UPSERT` bilan oshiradi.
- Revision oshirish xatosi asosiy mutationni bekor qilmaydi; server xatoni loglaydi. Frontenddagi davriy fallback bunday kam uchraydigan holatni keyin baribir tuzatadi.
- `GET /api/sync/version` autentifikatsiya va tashkilot scope tekshiruvi bilan faqat `{ revision, updatedAt }` qaytaradi. Endpoint biznes ma’lumotlarini oshkor qilmaydi.

### 3. Frontend fon sinxronizatsiyasi

- Workspace muvaffaqiyatli yuklangach sync controller ishga tushadi.
- Aktiv tabda har 1 soniyada `/api/sync/version` tekshiriladi. Tab yashirin bo‘lsa polling to‘xtaydi; qayta ko‘ringanda darhol tekshiriladi.
- Revision o‘zgarsa mavjud `hydrateWorkspace({ silent:true })` chaqiriladi. Bu browser reload emas: route, modal, qidiruv, scroll va forma holati saqlanadi; React yangi server state bilan faqat o‘zgargan qiymatlarni qayta chizadi.
- Bir vaqtda faqat bitta version so‘rovi va bitta hydrate ishlaydi. O‘zgarish hydrate vaqtida kelsa, tugagach bitta qo‘shimcha tekshiruv bajariladi.
- Tarmoq xatosida mavjud ma’lumot ekranda qoladi, polling exponential backoff bilan davom etadi va browser online/focus bo‘lganda tez tiklanadi.
- Revision signali yo‘qolgan holatlar uchun 60 soniyalik sekin fallback silent hydrate ishlaydi.
- Logout, account almashishi yoki provider unmount bo‘lganda timer va so‘rovlar bekor qilinadi; eski tashkilot javobi yangi sessiyaga yozilmaydi.

## Ma’lumot oqimi

1. Xodim mutation yuboradi, masalan smena ochadi yoki savdo qiladi.
2. Backend mutationni PostgreSQL’da yakunlaydi va muvaffaqiyatli javob beradi.
3. Revision middleware shu tashkilot revisionini oshiradi.
4. Boshqa sessiya eng ko‘pi bilan taxminan 1 soniyada yangi revisionni ko‘radi.
5. Frontend workspace snapshotini fon rejimida qayta oladi.
6. `StoreContext` serverdagi umumiy holatni qo‘llaydi; joriy sahifa reloadsiz yangilanadi.

## Xavfsizlik va scope

- Barcha sync endpointlari mavjud HttpOnly cookie sessiyasi, `requireAuth`, `requireOrganization` va active-license qoidalaridan foydalanadi.
- Bootstrapdagi mavjud branch filterlar saqlanadi. Revision tashkilot darajasida bo‘lsa ham filial xodimi faqat o‘z filialiga ruxsatli snapshotni oladi.
- Frontenddan kelgan organization yoki cashier identifikatoriga ishonilmaydi; ular `req.user` va serverdagi smena yozuvidan olinadi.
- Platform administrator tenant workspace oqimiga ulanmaydi.

## Moslik va deploy

- Migration faqat yangi jadval/index qo‘shadi; mavjud biznes jadvallarini o‘chirmaydi yoki qayta yozmaydi.
- Backend avval deploy qilinsa eski frontend ishlashda davom etadi.
- Frontend avval deploy qilinsa version endpoint topilmaganda xatoni yutadi va mavjud qo‘lda refresh oqimi saqlanadi; backend deploydan keyin avtomatik ulanadi.
- Monorepo backend o‘zgarishlari `Zenix-Pos-Backend` standalone reposiga ham aynan ko‘chiriladi.

## Test strategiyasi

- Backend unit/contract test: seller ochgan filial smenasi owner bootstrapida faol ko‘rinadi.
- Backend concurrency test: bir filialga ikkinchi ochiq smena rad etiladi.
- Backend authorization test: boshqa filial smenasi ko‘rinmaydi va boshqarilmaydi.
- Backend sync test: muvaffaqiyatli mutation revisionni oshiradi, xato javob oshirmaydi, version endpoint tenant-scoped.
- Frontend controller test: revision o‘zgarganda bitta silent hydrate; o‘zgarmaganda hydrate yo‘q; overlapping so‘rov yo‘q; logout va hidden tab cleanup qiladi.
- Frontend regression test: boshqa foydalanuvchi ochgan umumiy smena savdo uchun ishlatiladi, seller identity esa joriy foydalanuvchida qoladi.
- To‘liq frontend/backend test suite, production readiness va Vite build pushdan oldin o‘tishi shart.

## Qabul mezonlari

- Egasi filialda smena ochsa, shu filial xodimi sahifani yangilamasdan ochiq smenani ko‘radi va savdo qila oladi.
- Xodim smena ochsa, egasi va boshqa ruxsatli sessiyalar uni avtomatik ko‘radi.
- Savdo, qoldiq, xarajat va boshqa server mutationlari boshqa sessiyalarda odatda 1 soniya ichida ko‘rinadi.
- Route, modal, scroll va kiritilayotgan forma holati sinxronizatsiya paytida yo‘qolmaydi.
- Boshqa filial ma’lumotlari aralashmaydi.
- Mavjud permission va audit izlari saqlanadi.
