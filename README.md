# Synapic Search: Gizlilik Odaklı Yerel Arama Motorunuz

Synapic Search, kullanıcı gizliliğini ön planda tutarak hızlı ve etkili arama deneyimi sunan, Deno tabanlı bir arama motoru uygulamasıdır. Geleneksel arama motorlarının aksine, Synapic Search herhangi bir kişisel veri toplamaz veya harici sunuculara göndermez. Tüm arama geçmişiniz ve tercihleriniz, tamamen sizin kontrolünüzde olmak üzere yerel cihazınızda saklanır.
## Özellikler
- Gizlilik Odaklı: Hiçbir kişisel bilgi toplanmaz, izlenmez veya üçüncü taraflarla paylaşılmaz.
- Yerel Veri Saklama: Arama geçmişiniz ve dil tercihleriniz gibi tüm veriler cihazınızda yerel olarak tutulur.
- Çoklu Arama Türleri: Web, Görsel, Video, Haber ve Wikipedia aramaları yapabilme yeteneği.
- Hızlı ve Modern Arayüz: Tailwind CSS ile oluşturulmuş duyarlı ve kullanıcı dostu tasarım.
- Deno Tabanlı: Güvenli ve hızlı bir çalışma zamanı ortamı sunar.
- Özelleştirilebilir Dil Ayarları: Arama dilinizi tercihinize göre ayarlayabilir ve bu ayarı yerel olarak kaydedebilirsiniz.
- Arama Geçmişi Yönetimi: Yerel olarak kaydedilen arama geçmişinize erişebilir ve istediğiniz zaman temizleyebilirsiniz.
## Gereksinimler
- Synapic Search'ü çalıştırmak için sisteminizde Deno kurulu olması gerekmektedir. Deno, JavaScript, TypeScript ve WebAssembly için güvenli bir çalışma zamanıdır. Deno'yu kurmak için aşağıdaki komutları kullanabilirsiniz: <br />

**Shell (Mac, Linux):** ```curl -fsSL https://deno.land/x/install/install.sh | sh``` <br />
**PowerShell (Windows):** ```irm https://deno.land/install.ps1 | iex```

Kurulumdan sonra Deno'nun doğru bir şekilde kurulduğunu doğrulamak için:
```
deno --version
```
## Kurulum Adımları
Synapic Search projesini yerel makinenize kurmak ve çalıştırmak için aşağıdaki adımları izleyin:
## 1. Depoyu Klonlayın
Öncelikle projenin kaynak kodunu GitHub deposundan klonlamanız gerekmektedir. Terminalinizi açın ve aşağıdaki komutu çalıştırın:
```
git clone https://github.com/yigitkabak/Synapic
cd Synapic
```
## 2. Geçmiş Dosyasının Otomatik Oluşturulması (backend/src/json/sites.json)
Arama geçmişi verileriniz `backend/src/json/sites.json` dosyasında yerel olarak saklanacaktır. Bu dosya, uygulama ilk başlatıldığında otomatik olarak oluşturulur. Manuel olarak oluşturmanıza gerek yoktur. Ancak, içeriğini görmek veya düzenlemek isterseniz, boş bir JSON dizisi [] ile başlatıldığını göreceksiniz.
## 3. Bağımlılıkları Yükleyin
Deno, Node.js'teki gibi ayrı bir npm install adımına ihtiyaç duymaz. Bağımlılıklar, app.ts dosyasında belirtilen URL'lerden ilk çalıştırmada otomatik olarak indirilir ve önbelleğe alınır.
## Uygulamayı Çalıştırma
Tüm kurulum adımlarını tamamladıktan sonra, Synapic Search uygulamasını başlatabilirsiniz.
 1. Projenizin backend dizinine gidin:
```
cd backend
```
 2. Uygulamayı başlatmak için aşağıdaki Deno komutunu çalıştırın. Bu komut, uygulamanın ağ bağlantıları kurmasına `(--allow-net),` dosyaları okumasına `(--allow-read)` ve yazmasına `(--allow-write)` izin verir (geçmişi yerel olarak kaydetmek için gereklidir).
```
 deno run --allow-net --allow-read --allow-write app.ts
```
Terminalde "Sunucu başlatıldı: http://localhost:8000" mesajını görmelisiniz.
 3. Web tarayıcınızı açın ve aşağıdaki adrese gidin: 
 ```
 https://localhost:8000
```
Artık Synapic Search arama motorunuzu kullanmaya başlayabilirsiniz!
## Kullanım
- Arama Yapma: Anasayfadaki arama çubuğuna sorgunuzu yazın ve Enter tuşuna basın veya arama ikonuna tıklayın.
- Arama Türleri: Arama sonuçları sayfasında, arama çubuğunun altındaki butonları kullanarak arama türleri (Web, Görsel, Video, Haber, Wiki) arasında geçiş yapabilirsiniz.
- Geçmiş: Menüden (sağ üstteki üç çizgi ikonuna tıklayarak) "Geçmiş" sayfasına giderek önceki aramalarınızı görebilirsiniz.
- Ayarlar: Sağ üstteki dişli ikonuna tıklayarak dil tercihlerinizi yönetebilirsiniz.
- Gizlilik ve Şartlar: Footer'daki "Gizlilik ve Şartlar" bağlantısına tıklayarak uygulamanın veri işleme politikalarını okuyabilirsiniz.
## Gizlilik Notu
Synapic Search, kullanıcılardan herhangi bir kişisel bilgi toplamaz veya harici sunuculara göndermez. Tüm arama geçmişi ve dil tercihleri gibi veriler, uygulamanın çalıştığı cihazın yerel depolama alanında (`sites.json` dosyası aracılığıyla) saklanır. Bu, verilerinizin kontrolünün tamamen sizde olduğu ve gizliliğinizin maksimum düzeyde korunduğu anlamına gelir. Uygulama, internetten arama sonuçlarını getirmek için harici API'leri kullanır, ancak bu API çağrıları sırasında sizin kişisel bilgileriniz paylaşılmaz.
# Lisans
```
MIT License

Copyright (c) 2023 Aperture Labs.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
## Katkıda Bulunma
Synapic Search projesine katkıda bulunmak isterseniz, lütfen GitHub deposunu ziyaret edin ve pull request göndermekten çekinmeyin. Her türlü katkı (hata düzeltmeleri, yeni özellikler, dokümantasyon iyileştirmeleri vb.) memnuniyetle karşılanır.
## İletişim

Herhangi bir sorunuz, geri bildiriminiz veya öneriniz varsa, lütfen `yigitkabak@tuta.io` adresinden bizimle iletişime geçin.

---

**Aperture Labs.**
