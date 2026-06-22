// ==========================================================================
// AUDIO FEEDBACK (MICRO-INTERACTIONS) - BROWSER SAFE
// ==========================================================================
let audioCtx; // Deklarasi kosong tanpa langsung memicu audio

// Fungsi pembangun audio yang baru berjalan saat ada klik
function getAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
}

function playBeep() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime); // Nada tinggi
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime); // Volume standar
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch (e) { 
        console.warn("Audio terblokir browser:", e); 
    }
}

function playSuccessSound() {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); // Nada naik
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime); // Volume sedikit lebih keras
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) { 
        console.warn("Audio terblokir browser:", e); 
    }
}



// ==========================================================================
// SAGEPOS PRO - LIVE PERSISTENCE WITH PIN & REAL-TIME ATTENDANCE SINKRON
// ==========================================================================

const firebaseConfig = {
    apiKey: "AIzaSyCAvkrPfkMs4TKofAwBPIPAmSVXnAAYF2s",
    authDomain: "linkneomeal-001.firebaseapp.com",
    projectId: "linkneomeal-001",
    storageBucket: "linkneomeal-001.firebasestorage.app",
    messagingSenderId: "518165236588",
    appId: "1:518165236588:web:0606d3da403339fd620149",
    databaseURL: "https://linkneomeal-001-default-rtdb.firebaseio.com"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.database();

const IMGBB_API_KEY = "74a8a5c720111b4162e8e2d237aee552";

let products = [];
let transactions = [];
let cart = [];
let savedCustomersArray = [];
let financeFilterType = 'today';
let selectedCategory = 'Semua';
let customerMode = 'new';
let currentOrderType = 'Dine In';

let bleDevice = null;
let bleCharacteristic = null;
let isConnectingBle = false;

// State Sesi yang dikendalikan oleh Real-time Listener
let currentSessionId = null;
let currentCashier = null;

const fallbackImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
const genZQuotes = [
    "Mending beli ini daripada beli omong kosong dia.",
    "Beli kopi biar ga ngantuk pas digantungin dia.",
    "Uang bisa dicari, tapi produk ini kalo abis lu nangis.",
    "Work hard, belanja harder."
];

function getRandomQuote() { return genZQuotes[Math.floor(Math.random() * genZQuotes.length)]; }

function getFormattedDate() {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const y = now.getFullYear();
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    return `${d}/${m}/${y} ${hh}:${mm}`;
}

document.addEventListener("DOMContentLoaded", async () => {
    // Jalankan Real-time Session Listener mendeteksi shift aktif menggantung
    listenToActiveSession();
    
    renderAllUI();
    setCustomerMode('new');

    const imageInput = document.getElementById('prod-image-file');
    if (imageInput) imageInput.addEventListener('change', handleImageUpload);

    document.querySelectorAll('.nav-btn').forEach(btn => btn.style.opacity = '0.5');
    await refreshDataFromServer();
    document.querySelectorAll('.nav-btn').forEach(btn => btn.style.opacity = '1');
});

// ------------------------------------------------------------------------
// FUNGSI TARIK DATA DARI FIREBASE (YANG SEMPAT HILANG)
// ------------------------------------------------------------------------
async function refreshDataFromServer() {
    try {
        // Tarik data produk
        const prodSnap = await db.ref('products').once('value');
        products = [];
        if (prodSnap.exists()) {
            prodSnap.forEach(child => { products.push(child.val()); });
        }

        // Tarik data transaksi
        const trxSnap = await db.ref('transactions').once('value');
        transactions = [];
        if (trxSnap.exists()) {
            trxSnap.forEach(child => { transactions.push(child.val()); });
        }
        // Balik urutan transaksi agar yang terbaru ada di atas
        transactions.reverse();

        // --- MULAI PENAMBAHAN: Tarik data pelanggan (Member) ---
        const custSnap = await db.ref('customers').once('value');
        savedCustomersArray = [];
        if (custSnap.exists()) {
            custSnap.forEach(child => { savedCustomersArray.push(child.val()); });
        }
        // --- SELESAI PENAMBAHAN ---

        // Render ulang antarmuka setelah data lengkap
        renderAllUI();
    } catch (error) {
        console.error("Gagal menarik data dari server:", error);
        showToast('Gagal memuat data. Periksa koneksi internet.', 'error');
    }
}

// ------------------------------------------------------------------------
// LOGIKA UTAMA: REAL-TIME SESSION PERSISTENCE LISTENER
// ------------------------------------------------------------------------
function listenToActiveSession() {
    db.ref('attendance').orderByKey().limitToLast(1).on('value', (snapshot) => {
        let activeSessionFound = false;

        if (snapshot.exists()) {
            snapshot.forEach((child) => {
                const session = child.val();
                if (session.status === 'Sedang Bekerja') {
                    activeSessionFound = true;
                    currentSessionId = session.id;
                    currentCashier = session.cashierName;
                }
            });
        }

        const loginOverlay = document.getElementById('login-overlay');
        const activeCashierLabel = document.getElementById('active-cashier-name');

        if (activeSessionFound) {
            loginOverlay.classList.add('hidden');
            if (activeCashierLabel) {
                activeCashierLabel.innerHTML = `<i class="fa-solid fa-user mr-1"></i> ${currentCashier}`;
            }
            document.getElementById('logout-pin-modal').classList.add('hidden');
        } else {
            currentSessionId = null;
            currentCashier = null;
            loginOverlay.classList.remove('hidden');
            if (activeCashierLabel) activeCashierLabel.innerHTML = `<i class="fa-solid fa-user mr-1"></i> -`;
            
            // Kosongkan input PIN standar
            const loginPinEl = document.getElementById('login-pin');
            if(loginPinEl) loginPinEl.value = "";
        }
    });
}

async function handleLogin() {
    const nameEl = document.getElementById('login-cashier-name');
    const pinEl = document.getElementById('login-pin');
    const name = nameEl.value.trim();
    const pin = pinEl.value.trim();
    
    if (!name) return alert('Silakan ketik username kasir terlebih dahulu!');
    if (pin.length !== 4) return alert('PIN harus diisi tepat 4 digit angka!');
    
    const btn = document.getElementById('btn-login');
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memverifikasi...`;
    btn.disabled = true;

    try {
        // VERIFIKASI KE FIREBASE (Otomatis ubah inputan kasir ke huruf kecil agar cocok dengan database Owner)
        const pinSnapshot = await db.ref(`cashier_pins/${name.toLowerCase()}`).once('value');
        
        // 1. BLOKIR USERNAME ASAL: Jika nama yang diketik TIDAK ADA di database Owner, tolak!
        if (!pinSnapshot.exists()) {
            alert('Akses Ditolak: Username kasir tidak ditemukan / belum didaftarkan!');
            btn.innerHTML = `Buka Kasir`;
            btn.disabled = false;
            pinEl.value = ""; // Kosongkan PIN saja
            return;
        }

        // 2. Jika nama ADA di database, ambil PIN aslinya
        const validPin = String(pinSnapshot.val());

        // 3. Cocokkan PIN yang diketik dengan PIN dari database
        if (pin !== validPin) {
            alert('Akses Ditolak: PIN Kasir Salah!');
            btn.innerHTML = `Buka Kasir`;
            btn.disabled = false;
            pinEl.value = ""; 
            return;
        }

        // 4. Jika lolos (Nama ada & PIN benar), rapikan format namanya untuk ditampilkan (Huruf Awal Kapital)
        const displayName = name.replace(/\b\w/g, l => l.toUpperCase());
        
        // Buka kasir!
        processAbsensi(displayName);
        
    } catch (error) {
        console.error("Error Login:", error);
        alert("Gagal memvalidasi PIN. Periksa koneksi internet.");
        btn.innerHTML = `Buka Kasir`;
        btn.disabled = false;
    }
}
// ------------------------------------------------------------------------
// FUNGSI ABSENSI (DILENGKAPI PELACAK GPS REAL-TIME)
// ------------------------------------------------------------------------
async function processAbsensi(name) {
    const sessionId = 'ABSEN-' + Date.now();
    const loginTime = getFormattedDate();
    const btn = document.getElementById('btn-login');

    // Ubah visual tombol agar kasir tahu sistem sedang mencari lokasi
    btn.innerHTML = `<i class="fa-solid fa-location-dot animate-bounce"></i> Mengunci Lokasi GPS...`;
    btn.disabled = true;

    let locationData = '-';

    // Fungsi pencari GPS (Maksimal nunggu 8 detik agar tidak nge-hang jika sinyal susah)
    const getGPS = () => new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve('Browser tidak mendukung GPS');
        } else {
            navigator.geolocation.getCurrentPosition(
                (pos) => resolve(`https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`),
                (err) => resolve('Akses GPS ditolak / Sinyal lemah'),
                { enableHighAccuracy: true, timeout: 8000 } 
            );
        }
    });

    // Tunggu hasil GPS didapatkan
    locationData = await getGPS();

    showToast('Merekam data kehadiran...', 'loading');

    // Simpan data absensi masuk ke Firebase beserta link GPS-nya
    db.ref('attendance/' + sessionId).set({
        id: sessionId,
        cashierName: name,
        loginTime: loginTime,
        logoutTime: '-',
        loginLocation: locationData, // <--- Link Google Maps terisi otomatis di sini!
        status: 'Sedang Bekerja'
    }).then(() => {
        btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs"></i>`;
        btn.disabled = false;
        showToast('Berhasil Buka Kasir!', 'success');
    }).catch(e => {
        console.error(e);
        showToast('Gagal absen, periksa koneksi internet.', 'error');
        btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs"></i>`;
        btn.disabled = false;
    });
}

// ------------------------------------------------------------------------
// SINKRONISASI ABSEN PULANG WITH PIN CHALLENGE
// ------------------------------------------------------------------------
function openLogoutModal() {
    if (!currentSessionId) return;
    const logoutPinEl = document.getElementById('logout-pin');
    if (logoutPinEl) logoutPinEl.value = "";
    document.getElementById('logout-pin-modal').classList.remove('hidden');
}

function closeLogoutModal() {
    document.getElementById('logout-pin-modal').classList.add('hidden');
}

// ------------------------------------------------------------------------
// SINKRONISASI ABSEN PULANG DENGAN DELAY BLUETOOTH
// ------------------------------------------------------------------------
// ------------------------------------------------------------------------
// SINKRONISASI ABSEN PULANG (KEMBALI BERSIH & CEPAT)
// ------------------------------------------------------------------------
async function handleLogout() {
    const pin = document.getElementById('logout-pin').value;
    if (pin.length !== 4) return alert('PIN harus diisi 4 digit angka!');

    const btn = document.getElementById('btn-confirm-logout');
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memverifikasi...`;
    btn.disabled = true;

    try {
        const pinSnapshot = await db.ref(`cashier_pins/${currentCashier.toLowerCase()}`).once('value');
        const validPin = pinSnapshot.exists() ? String(pinSnapshot.val()) : "1234";

        if (pin !== validPin) {
            alert('Akses Ditolak: PIN Kasir Salah!');
            btn.innerHTML = `Konfirmasi Absen Pulang`;
            btn.disabled = false;
            document.getElementById('logout-pin').value = ""; 
            return;
        }

        // Logout murni tanpa delay print
        showToast('Merekam absensi pulang...', 'loading');
        
        await db.ref('attendance/' + currentSessionId).update({
            logoutTime: getFormattedDate(),
            status: 'Selesai Shift'
        });

        showToast('Berhasil Absen Pulang!', 'success');
        document.getElementById('login-cashier-name').value = "";
        
        btn.innerHTML = `Konfirmasi Absen Pulang`;
        btn.disabled = false;
        closeLogoutModal();

    } catch (e) {
        console.error("Error Logout:", e);
        showToast('Koneksi terputus. Gagal logout.', 'error');
        btn.innerHTML = `Konfirmasi Absen Pulang`;
        btn.disabled = false;
    }
}

// ------------------------------------------------------------------------
// KALKULASI & CETAK REKAP TUTUP SHIFT (STRICT PER SHIFT / KASIR)
// ------------------------------------------------------------------------
function calculateShiftRecap() {
    const todayPrefix = getFormattedDate().split(' ')[0]; // Ambil tanggal hari ini (DD/MM/YYYY)
    let totalNota = 0;
    let omset = 0;
    let tunai = 0;
    let qris = 0;
    let debit = 0;

    // Nama kasir yang sedang bertugas saat ini (diubah ke huruf kecil agar kebal dari typo)
    const activeCashier = String(currentCashier || '').trim().toLowerCase();

    transactions.forEach(t => {
        const tDate = String(t.date || '');
        const tCashier = String(t.cashier || '').trim().toLowerCase();
        
        // KUNCI: Hanya hitung jika tanggalnya HARI INI dan namanya SAMA PERSIS dengan kasir yang login
        if (tDate.startsWith(todayPrefix) && tCashier === activeCashier) {
            totalNota++;
            let val = parseInt(t.total) || 0;
            omset += val;
            
            let method = String(t.method || '').trim().toLowerCase();
            if (method === 'tunai') tunai += val;
            else if (method === 'qris') qris += val;
            else if (method === 'debit') debit += val;
            else tunai += val; // Default fallback ke tunai jika metode kosong
        }
    });

    return {
        kasir: currentCashier || "Kasir",
        waktu: getFormattedDate(),
        totalNota,
        omset,
        tunai,
        qris,
        debit
    };
}

// ------------------------------------------------------------------------
// SISA LOGIKA POS KASIR (TETAP SAMA SEPERTI ASLI)
// ------------------------------------------------------------------------
function renderAllUI() {
    renderKasirProducts();
    renderCart();
    renderProductTable();
    renderStrukList();
    renderPromoCustomers();
    renderCustomerList();
    calculateFinancials();
}

function switchPage(pageId, btnElement) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => { 
        b.className = "nav-btn flex flex-col items-center justify-center py-1 text-gray-400 transition-all duration-200"; 
    });
    btnElement.className = "nav-btn flex flex-col items-center justify-center py-1 text-sage-600 font-bold scale-105 transition-all duration-200";

    if(pageId === 'kasir') { renderKasirProducts(); renderCart(); renderCustomerList(); }
    if(pageId === 'produk') { renderProductTable(); resetProductForm(); }
    if(pageId === 'struk') renderStrukList();
    if(pageId === 'promo') renderPromoCustomers();
    if(pageId === 'keuangan') calculateFinancials();
}

async function handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    const statusEl = document.getElementById('upload-status');
    const btnSubmit = document.getElementById('btn-submit-product');
    statusEl.classList.remove('hidden');
    statusEl.className = "text-[11px] text-amber-600 font-medium animate-pulse";
    statusEl.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Mengunggah...`;
    btnSubmit.setAttribute('disabled', 'true');
    const formData = new FormData();
    formData.append('image', file);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
        const result = await response.json();
        if (result.success) {
            document.getElementById('prod-image-url').value = result.data.url;
            statusEl.className = "text-[11px] text-sage-600 font-bold";
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> Gambar terunggah!`;
        } else { throw new Error(result.error.message); }
    } catch (error) {
        statusEl.className = "text-[11px] text-red-600 font-bold";
        statusEl.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1"></i> Gagal unggah gambar.`;
    } finally { btnSubmit.removeAttribute('disabled'); }
}

function renderProductTable() {
    const tbody = document.getElementById('product-table-body');
    if (!tbody) return;
    tbody.innerHTML = products.length === 0 ? `<tr><td colspan="6" class="text-center p-6 text-gray-400 text-sm">Belum ada data.</td></tr>` : '';
    products.forEach(p => {
        tbody.innerHTML += `
            <tr class="border-b border-gray-100 hover:bg-sage-50/50 text-sm transition-colors">                
                <td class="p-3 text-center"><img src="${p.image || fallbackImage}" class="w-12 h-12 object-cover rounded-xl mx-auto border shadow-xs"></td>
                <td class="p-3 font-semibold text-gray-800">${p.name}</td>
                <td class="p-3 text-gray-500"><span class="bg-gray-100 px-2 py-0.5 rounded-md text-xs">${p.category || 'Lainnya'}</span></td>
                <td class="p-3 text-center font-bold ${p.stock <= 3 ? 'text-red-500' : 'text-gray-700'}">${p.stock || 0}</td>
                <td class="p-3 text-right font-medium text-gray-800">Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}</td>
                <td class="p-3 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="editProduct('${p.id}')" class="text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
                        <button onclick="deleteProduct('${p.id}')" class="text-red-600 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl text-xs font-semibold">Hapus</button>
                    </div>
                </td>
            </tr>`;
    });
}

async function saveProduct(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-product');
    const originalText = btnSubmit.innerText;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Menyimpan...`;
    btnSubmit.setAttribute('disabled', 'true');
    const payload = { 
        id: document.getElementById('prod-id').value || String(Date.now()), 
        name: document.getElementById('prod-name').value, 
        price: parseInt(document.getElementById('prod-price').value), 
        category: document.getElementById('prod-category').value, 
        stock: parseInt(document.getElementById('prod-stock').value) || 0, 
        image: document.getElementById('prod-image-url').value.trim() 
    };
    try {
        await db.ref('products/' + payload.id).set(payload);
        showToast('Produk berhasil disimpan!', 'success');
        resetProductForm(); 
        await refreshDataFromServer(); 
    } catch(err) { 
        console.error(err); 
        showToast('Gagal menyimpan ke database.', 'error');
    } finally { btnSubmit.innerText = originalText; btnSubmit.removeAttribute('disabled'); }
}

function editProduct(id) {
    const product = products.find(p => String(p.id) === String(id));
    if (!product) return;
    document.getElementById('prod-id').value = product.id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-category').value = product.category || 'Makanan';
    document.getElementById('prod-stock').value = product.stock || 0;
    document.getElementById('prod-image-url').value = product.image || '';
    const statusEl = document.getElementById('upload-status');
    statusEl.classList.remove('hidden');
    statusEl.className = "text-[11px] text-sage-600 font-semibold";
    statusEl.innerHTML = product.image ? "<i class='fa-solid fa-image mr-1'></i> Gambar aktif." : "Belum ada gambar.";
    document.getElementById('btn-submit-product').innerText = 'Perbarui';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProduct(id) {
    if(!confirm('Hapus produk permanen?')) return;
    document.body.style.cursor = 'wait';
    try {
        await db.ref('products/' + id).remove();
        showToast('Produk berhasil dihapus!', 'success');
        await refreshDataFromServer();
    } catch(e) { console.error(e); showToast('Gagal menghapus produk.', 'error'); } 
    finally { document.body.style.cursor = 'default'; }
}

function resetProductForm() {
    document.getElementById('product-form').reset(); 
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-image-url').value = ''; 
    document.getElementById('upload-status').classList.add('hidden');
    document.getElementById('btn-submit-product').innerText = 'Simpan'; 
    document.getElementById('btn-cancel-edit').classList.add('hidden');
}

function filterCategory(cat) {
    selectedCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => { 
        b.className = "cat-btn bg-gray-100 text-gray-500 font-medium px-4 py-2 rounded-xl text-sm transition"; 
    });
    if (event && event.target) {
        event.target.className = "cat-btn bg-sage-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-xs transition";
    }
    renderKasirProducts();
}

function renderKasirProducts() {
    const grid = document.getElementById('kasir-products-grid');
    if (!grid) return;
    const searchQuery = document.getElementById('search-product').value.toLowerCase();
    grid.innerHTML = '';
    
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery) && (selectedCategory === 'Semua' || (p.category || 'Lainnya') === selectedCategory));
    
    if(filtered.length === 0) { 
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 text-sm py-12 flex flex-col items-center"><i class="fa-solid fa-box-open text-4xl mb-3 opacity-20"></i>Produk tidak ditemukan</div>`; 
        return; 
    }
    
    filtered.forEach(p => {
        // Cari index item di cart untuk mengetahui kuantitasnya
        const cartIndex = cart.findIndex(i => String(i.id) === String(p.id));
        const qtyPicked = cartIndex !== -1 ? cart[cartIndex].qty : 0;
        const isOut = (parseInt(p.stock) || 0) <= 0;
        
        // Style kartu diubah menjadi cursor-pointer dan merespon klik
        let cardStyle = isOut 
            ? 'opacity-60 bg-gray-50 border-gray-200 grayscale cursor-not-allowed' 
            : (qtyPicked > 0 ? 'bg-emerald-50/50 border-emerald-500 shadow-md ring-1 ring-emerald-500 cursor-pointer active:scale-95' : 'bg-white border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all duration-200 cursor-pointer active:scale-95');

        // Tag Vegan / Non-Veg
        const isVeg = p.category === 'Minuman' ? 'Veg' : 'Non Veg';
        const vegColor = isVeg === 'Veg' ? 'text-emerald-500' : 'text-red-500';
        const vegIcon = isVeg === 'Veg' ? 'fa-leaf' : 'fa-drumstick-bite';
        
        // Logika klik: Jika stok habis, klik dimatikan. Jika ada, jalankan addToCart.
        const clickHandler = isOut ? "" : `onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.stock || 0})"`;

        grid.innerHTML += `
            <div ${clickHandler} class="relative border rounded-[20px] p-2.5 sm:p-3 flex flex-col justify-between overflow-hidden shadow-sm select-none ${cardStyle}">
                
                ${qtyPicked > 0 ? `<div class="absolute top-2 left-2 bg-amber-400 text-white font-black text-[11px] px-2 py-1 rounded-lg z-10 shadow-sm">${qtyPicked}x</div>` : ''}
                
                <div class="h-20 sm:h-28 mb-2 sm:mb-3 bg-gray-100 rounded-xl overflow-hidden shrink-0 relative pointer-events-none">
                    <img src="${p.image || fallbackImage}" class="w-full h-full object-cover" alt="${p.name}">
                    ${isOut ? `<div class="absolute inset-0 bg-black/40 flex items-center justify-center"><span class="bg-red-600 text-white text-[10px] font-black px-2 py-1 rounded">HABIS</span></div>` : ''}
                </div>
                
                <div class="flex-1 flex flex-col justify-between pointer-events-none">
                    <span class="font-bold text-xs sm:text-sm text-gray-800 leading-tight line-clamp-2 min-h-[34px] mb-1">${p.name}</span>
                    
                    <div class="flex justify-between items-center mt-1">
                        <span class="text-emerald-600 font-black text-xs sm:text-sm">Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}</span>
                        <div class="flex items-center gap-1 text-[9px] font-bold ${vegColor} bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                            <i class="fa-solid ${vegIcon}"></i> <span class="hidden sm:inline">${isVeg}</span>
                        </div>
                    </div>
                </div>
            </div>`;
    });
}

function addToCart(id, name, price, currentStock) {
    playBeep(); // <--- Suara Beep saat produk diklik
    
    const item = cart.find(i => String(i.id) === String(id));
    if(item) { if(item.qty >= currentStock) return alert(`Stok sisa ${currentStock}!`); item.qty++; } 
    else { cart.push({ id: String(id), name, price, qty: 1 }); }
    renderCart(); renderKasirProducts();
}


function updateCartQty(index, delta) {
    playBeep(); // <--- Suara Beep saat tombol + atau - di keranjang diklik
    
    const item = cart[index];
    const targetProd = products.find(p => String(p.id) === String(item.id));
    if(delta > 0 && item.qty >= (targetProd ? targetProd.stock : 999)) return alert('Stok maksimal!');
    item.qty += delta; 
    if(item.qty <= 0) cart.splice(index, 1);
    renderCart(); renderKasirProducts();
}


function clearCart(forceClear = false) { 
    // Hanya munculkan alert JIKA bukan dari proses checkout (forceClear = false)
    if (!forceClear && cart.length > 0) {
        const setuju = confirm('Apakah Anda yakin ingin mengosongkan keranjang belanja?');
        if (!setuju) return; 
    }
    
    cart = []; 
    document.getElementById('pay-discount-percent').value = ''; 
    renderCart(); 
    renderKasirProducts(); 
}

function setOrderType(type) {
    currentOrderType = type;
    
    const btnDineIn = document.getElementById('btn-type-dinein');
    const btnTakeAway = document.getElementById('btn-type-takeaway');
    const btnDelivery = document.getElementById('btn-type-delivery');
    
    const activeClass = "flex-1 py-2 text-xs font-bold bg-white text-gray-800 rounded-lg shadow-sm transition-all";
    const inactiveClass = "flex-1 py-2 text-xs font-bold text-gray-500 hover:text-gray-700 transition-all";
    
    if(btnDineIn) btnDineIn.className = inactiveClass;
    if(btnTakeAway) btnTakeAway.className = inactiveClass;
    if(btnDelivery) btnDelivery.className = inactiveClass;
    
    if(type === 'Dine In' && btnDineIn) btnDineIn.className = activeClass;
    if(type === 'Take Away' && btnTakeAway) btnTakeAway.className = activeClass;
    if(type === 'Delivery' && btnDelivery) btnDelivery.className = activeClass;
}

function setPaymentMethod(method) {
    // Simpan nilai ke input tersembunyi
    document.getElementById('pay-method').value = method;
    
    const btnTunai = document.getElementById('btn-pay-tunai');
    const btnQris = document.getElementById('btn-pay-qris');
    const btnDebit = document.getElementById('btn-pay-debit');
    
    // Style Tema Emerald Baru untuk tombol aktif & non-aktif
    const activeStyle = "py-2.5 px-1 text-[11px] sm:text-xs font-bold bg-emerald-600 text-white border border-emerald-600 rounded-xl shadow-sm text-center transition-all";
    const inactiveStyle = "py-2.5 px-1 text-[11px] sm:text-xs font-bold bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100 rounded-xl text-center transition-all";
    
    // Reset semua tombol menjadi non-aktif terlebih dahulu (jika elemennya ada)
    if(btnTunai) btnTunai.className = inactiveStyle;
    if(btnQris) btnQris.className = inactiveStyle;
    if(btnDebit) btnDebit.className = inactiveStyle;
    
    // Berikan warna hijau Emerald aktif hanya pada tombol yang diklik
    if (method === 'Tunai' && btnTunai) btnTunai.className = activeStyle;
    if (method === 'QRIS' && btnQris) btnQris.className = activeStyle;
    if (method === 'Debit' && btnDebit) btnDebit.className = activeStyle;
    
    // Jalankan logika input uang tunai
    const cashInput = document.getElementById('pay-cash');
    if (cashInput) {
        if (method !== 'Tunai') { 
            cashInput.setAttribute('disabled', 'true'); 
            cashInput.classList.add('opacity-50'); // Efek visual redup jika bukan tunai
        } else { 
            cashInput.value = ''; 
            cashInput.removeAttribute('disabled'); 
            cashInput.classList.remove('opacity-50');
        }
    }
    
    // Refresh kalkulasi
    renderCart();
}


function setCustomerMode(mode) {
    customerMode = mode;
    const btnNew = document.getElementById('btn-mode-new');
    const btnMember = document.getElementById('btn-mode-member');
    const conNew = document.getElementById('customer-new-container');
    const conMember = document.getElementById('customer-member-container');
    document.getElementById('pay-customer-new').value = '';
    document.getElementById('pay-phone-new').value = '';
    document.getElementById('pay-customer-member').value = '';
    if (mode === 'new') {
        btnNew.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold bg-white text-sage-600 rounded-lg shadow-sm transition leading-tight text-center";
        btnMember.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold text-gray-500 hover:text-gray-700 bg-transparent rounded-lg transition leading-tight text-center";
        conNew.classList.remove('hidden'); conMember.classList.add('hidden');
    } else {
        btnMember.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold bg-white text-sage-600 rounded-lg shadow-sm transition leading-tight text-center";
        btnNew.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold text-gray-500 hover:text-gray-700 bg-transparent rounded-lg transition leading-tight text-center";
        conMember.classList.remove('hidden'); conNew.classList.add('hidden');
        renderCustomerList();
    }
}

function renderCustomerList() {
    const selectEl = document.getElementById('pay-customer-member');
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- Klik untuk memilih --</option>';
    
    // Sekarang mengambil dari savedCustomersArray, bukan dari transactions lagi
    savedCustomersArray.forEach(c => {
        let phoneStr = String(c.phone || '');
        const phoneSuffix = (phoneStr && phoneStr !== '-') ? ` (${phoneStr})` : '';
        selectEl.innerHTML += `<option value="${c.name}">${c.name}${phoneSuffix}</option>`;
    });
}

function renderPromoCustomers() {
    const container = document.getElementById('promo-customer-list');
    if (!container) return;
    const search = document.getElementById('search-promo-customer').value.toLowerCase();
    let unique = []; let seen = new Set();
    transactions.forEach(t => {
        let phoneStr = String(t.phone || ''); 
        if (phoneStr.length > 5 && t.customer && t.customer.toLowerCase() !== 'umum') {
            const p = phoneStr.replace(/[^0-9+]/g, '');
            if(p.length > 5 && !seen.has(p)) { seen.add(p); unique.push({name: t.customer, phone: p}); }
        }
    });
    const filtered = unique.filter(u => u.name.toLowerCase().includes(search));
    container.innerHTML = filtered.length === 0 ? '<div class="text-center text-xs text-gray-400 py-6">Belum ada pelanggan dengan No WA.</div>' : '';
    filtered.forEach(c => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-gray-50 hover:bg-sage-50 p-3 rounded-xl border border-gray-100 transition mb-2">
                <div>
                    <h4 class="font-bold text-gray-800 text-sm">${c.name}</h4>
                    <p class="text-[10px] text-gray-500 font-mono"><i class="fa-solid fa-phone mr-1"></i>${c.phone}</p>
                </div>
                <button onclick="sendWaPromo('${c.phone}', '${c.name.replace(/'/g, "\\'")}')" class="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
                    <i class="fa-brands fa-whatsapp text-sm"></i> Kirim Promo
                </button>
            </div>`;
    });
}

function sendWaPromo(phone, name) {
    let template = document.getElementById('promo-template').value;
    if (!template.trim()) return alert('Tulis pesan promonya dulu!');
    let message = template.replace(/\[NAMA\]/g, name);
    let formattedPhone = phone;
    if (formattedPhone.startsWith('0')) formattedPhone = '62' + formattedPhone.substring(1);
    window.open(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    
    // Tampilan jika keranjang kosong
    container.innerHTML = cart.length === 0 ? `<div class="text-center py-10 flex flex-col items-center justify-center opacity-50"><i class="fa-solid fa-basket-shopping text-4xl mb-2 text-gray-300"></i><p class="font-medium text-sm text-gray-500">Keranjang Kosong</p></div>` : '';
    
    let subtotal = 0;
    cart.forEach((item, index) => {
        subtotal += item.price * item.qty;
        // Ambil gambar produk asli
        const prodData = products.find(p => String(p.id) === String(item.id));
        const itemImg = prodData ? (prodData.image || fallbackImage) : fallbackImage;

        container.innerHTML += `
            <div class="flex items-center gap-3 bg-white border border-gray-100 p-3 rounded-2xl shadow-sm hover:shadow-md transition">
                <img src="${itemImg}" class="w-14 h-14 rounded-xl object-cover border border-gray-100 shrink-0">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-sm text-gray-800 truncate mb-1">${item.name}</h4>
                    <div class="flex items-center justify-between mt-1.5">
                        <span class="text-xs font-bold text-emerald-600">Rp ${item.price.toLocaleString('id-ID')}</span>
                        
                        <div class="flex items-center gap-1 bg-gray-50 border border-gray-200 p-0.5 rounded-lg shadow-inner">
                            <button onclick="updateCartQty(${index}, -1)" class="w-6 h-6 rounded-md bg-white shadow-sm text-gray-500 hover:text-red-500 hover:bg-red-50 font-black flex items-center justify-center transition-all active:scale-95">
                                <i class="fa-solid fa-minus text-[10px]"></i>
                            </button>
                            <span class="text-xs font-black w-5 text-center text-gray-800">${item.qty}</span>
                            <button onclick="updateCartQty(${index}, 1)" class="w-6 h-6 rounded-md bg-white shadow-sm text-emerald-600 hover:bg-emerald-500 hover:text-white font-black flex items-center justify-center transition-all active:scale-95">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                            </button>
                        </div>
                        
                    </div>
                </div>
                <div class="text-right pl-2 flex flex-col justify-between items-end h-14">
                    <span class="block font-black text-sm text-gray-800">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
                    <button onclick="updateCartQty(${index}, -${item.qty})" class="text-[10px] text-gray-400 hover:text-red-600 font-bold underline transition-colors">Hapus</button>
                </div>
            </div>`;
    });

    // Kalkulasi Total & Diskon
    const finalTotal = subtotal; 
    
    // Update teks di Sidebar
    if (document.getElementById('txt-subtotal')) document.getElementById('txt-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    if (document.getElementById('txt-total')) document.getElementById('txt-total').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    if (document.getElementById('sidebar-total')) document.getElementById('sidebar-total').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    if (document.getElementById('pay-cash') && document.getElementById('pay-method').value !== 'Tunai') {
        document.getElementById('pay-cash').value = finalTotal;
    }
    
    // Update teks di Modal Pembayaran (Termasuk Diskon jika ada)
    const discountInput = document.getElementById('pay-discount-percent');
    let discountCalculated = 0;
    if (discountInput) {
        const discVal = parseInt(discountInput.value) || 0;
        if (discVal > 0 && discVal <= 100) {
            discountCalculated = Math.round((discVal / 100) * subtotal);
            if(document.getElementById('txt-discount-display')) document.getElementById('txt-discount-display').innerText = `- Rp ${discountCalculated.toLocaleString('id-ID')}`;
            if(document.getElementById('div-discount')) document.getElementById('div-discount').classList.remove('hidden');
        } else { 
            if(document.getElementById('div-discount')) document.getElementById('div-discount').classList.add('hidden'); 
        }
    }
    
    const afterDiscount = Math.max(0, subtotal - discountCalculated);
    if (document.getElementById('txt-total-modal')) document.getElementById('txt-total-modal').innerText = `Rp ${afterDiscount.toLocaleString('id-ID')}`;
    
    // Cek uang kembalian jika form pembayaran sedang aktif
    if(typeof calculateChange === 'function') calculateChange();
}

function calculateChange() {
    const total = parseInt(document.getElementById('txt-total').innerText.replace(/[^0-9]/g, '')) || 0;
    const cash = parseInt(document.getElementById('pay-cash').value) || 0;
    const change = cash - total;
    const changeEl = document.getElementById('txt-change');
    if (!changeEl) return;
    if (change >= 0) { changeEl.innerText = `Rp ${change.toLocaleString('id-ID')}`; changeEl.className = "font-bold text-amber-600 text-sm"; } 
    else { changeEl.innerText = 'Kurang Uang'; changeEl.className = "font-extrabold text-red-600 text-sm"; }
}

function showToast(message, type = 'info') {
    let toast = document.getElementById('pos-toast');
    if (!toast) { toast = document.createElement('div'); toast.id = 'pos-toast'; document.body.appendChild(toast); }
    toast.style.opacity = '1'; toast.style.transform = 'translate(-50%, 0)';
    if (type === 'loading') {
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 bg-blue-500 text-white';
        toast.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> ${message}`;
    } else if (type === 'success') {
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 bg-emerald-500 text-white';
        toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, -20px)'; }, 3000);
    } else if (type === 'error') {
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg flex items-center gap-2 bg-red-500 text-white';
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, -20px)'; }, 4000);
    }
}

function generateNextTrxId() {
    let maxId = 0;
    
    // Looping semua transaksi untuk mencari angka ID tertinggi
    transactions.forEach(t => {
        // Regex ini memastikan kita hanya membaca ID yang murni angka 
        // (Mengabaikan data lama yang berawalan "TRX-")
        if (/^\d+$/.test(t.id)) {
            let num = parseInt(t.id, 10);
            if (num > maxId) {
                maxId = num;
            }
        }
    });
    
    // Tambahkan 1 dari ID tertinggi yang ditemukan
    let nextId = maxId + 1;
    
    // Pad dengan angka 0 di depannya agar selalu 4 digit (contoh: 0001)
    return String(nextId).padStart(4, '0');
}


async function processCheckout() {
    // 1. Validasi Keranjang Kosong
    if (cart.length === 0) {
        return alert('Keranjang masih kosong! Silakan pilih produk terlebih dahulu.');
    }

    const total = parseInt(document.getElementById('txt-total').innerText.replace(/[^0-9]/g, '')) || 0;
    const method = document.getElementById('pay-method').value;
    const cashInputEl = document.getElementById('pay-cash');
    const cashInputStr = cashInputEl.value.trim();

    // 2. Validasi Uang Tunai Kosong
    if (method === 'Tunai' && cashInputStr === '') {
        cashInputEl.focus(); // Layar otomatis menyorot ke kolom uang
        return alert('Kolom uang bayar masih kosong! Mohon isi nominal uang yang diterima.');
    }

    const cash = parseInt(cashInputStr) || 0;
    if (cash < total) {
        cashInputEl.focus();
        return alert('Nominal uang bayar kurang dari total tagihan!');
    }
    
    // 3. Validasi Form Pelanggan Kosong
    let customer = ''; 
    let phone = '';

    if (customerMode === 'new') {
        const customerInputEl = document.getElementById('pay-customer-new');
        customer = customerInputEl.value.trim();
        
        // KUNCI: Nama pelanggan wajib diisi (tidak boleh lolos)
        if (customer === '') {
            customerInputEl.focus(); // Otomatis menyorot kotak nama
            return alert('Nama pelanggan wajib diisi! (Ketik "Umum" jika pelanggan menolak sebut nama)');
        }
        
        phone = document.getElementById('pay-phone-new').value.trim();
    } else {
        customer = document.getElementById('pay-customer-member').value;
        if (!customer) return alert('Silakan pilih nama member dari daftar terlebih dahulu!');
        const matchedTrx = transactions.find(t => t.customer === customer && t.phone);
        if (matchedTrx) phone = matchedTrx.phone;
    }
    
    // 4. Proses Kalkulasi Diskon (Boleh kosong, otomatis 0)
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountInput = parseInt(document.getElementById('pay-discount-percent').value) || 0;
    let discount = 0; 
    if (discountInput > 0 && discountInput <= 100) discount = Math.round((discountInput / 100) * subtotal);

    // 5. Buat ID 4 angka berurutan
    const newTrxId = generateNextTrxId();

    const transactionData = {
        id: newTrxId, 
        date: getFormattedDate(), 
        customer, 
        phone, 
        method, 
        orderType: currentOrderType,
        items: [...cart], 
        discount, 
        total, 
        cash, 
        change: cash - total, 
        cashier: currentCashier || "Kasir Utama", 
        quote: getRandomQuote()
    };

    // 6. Kurangi stok di memori lokal layar kasir terlebih dahulu
    cart.forEach(cartItem => {
        const prod = products.find(p => String(p.id) === String(cartItem.id));
        if (prod) prod.stock = Math.max(0, (prod.stock || 0) - cartItem.qty);
    });
    
    transactions.unshift(transactionData); 
    renderAllUI(); 
    openInvoiceModal(transactionData); 
    
    // Keranjang di layar dikosongkan tanpa permisi karena transaksi sukses
    clearCart(true); 
    setCustomerMode('new');

    showToast('Menyinkronkan nota ke database...', 'loading');
    
    // 7. Simpan Nota ke Firebase
    db.ref('transactions/' + transactionData.id).set(transactionData)
    .then(() => {
        showToast('Nota berhasil diamankan ke Database!', 'success');
        playSuccessSound();
        
        transactionData.items.forEach(soldItem => {
            const prod = products.find(p => String(p.id) === String(soldItem.id));
            if (prod) { 
                db.ref('products/' + prod.id).update({ stock: prod.stock }); 
            }
        });
    })
    .catch(e => { 
        console.error(e); 
        showToast('Koneksi terputus. Gagal sinkronisasi.', 'error'); 
    });
}


function renderStrukList() {
    const container = document.getElementById('struk-list');
    if (!container) return;
    container.innerHTML = transactions.length === 0 ? '<div class="text-center text-sm text-gray-400 py-6">Belum ada riwayat transaksi.</div>' : '';
    
    transactions.forEach(t => {
        let subtotal = 0;
        const itemsArray = Array.isArray(t.items) ? t.items : [];
        itemsArray.forEach(i => subtotal += (i.price * i.qty));
        
        let discountPercent = subtotal > 0 && t.discount > 0 ? Math.round((t.discount / subtotal) * 100) : 0;
        let itemsHtml = itemsArray.map(i => `<div class="flex justify-between text-xs text-gray-500 font-mono"><span>${i.name} (x${i.qty})</span><span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span></div>`).join('');
        const discHtml = t.discount > 0 ? `<div class="flex justify-between text-xs font-bold text-red-500 pt-1"><span>Diskon (${discountPercent}%)</span><span>- Rp ${t.discount.toLocaleString('id-ID')}</span></div>` : '';
        const phoneTxt = t.phone ? ` | WA: <b>${t.phone}</b>` : '';
        const typeBadge = t.orderType ? ` | Tipe: <b>${t.orderType}</b>` : ''; // <--- TAMBAHAN BARU
        
        container.innerHTML += `
            <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm space-y-2 text-xs mb-3 transition-all hover:shadow-md">
                <div class="flex justify-between items-center font-bold text-gray-700">
                    <span>ID: ${t.id}</span>
                    <span class="bg-emerald-100 text-emerald-700 font-bold px-2.5 py-1 rounded-lg text-[10px] uppercase tracking-wider">${t.method}</span>
                </div>
                <div class="text-[10px] text-gray-400"><p>Waktu: <b>${t.date}</b> | Cust: <b>${t.customer}</b>${phoneTxt}${typeBadge}</p></div> <!-- MASUKKAN KE SINI -->
                <div class="border-t border-b border-dashed border-gray-200 py-2 space-y-1.5">${itemsHtml}${discHtml}</div>
                <div class="flex justify-between items-center font-black text-sm text-gray-800">
                    <span>TOTAL</span>
                    <span class="text-emerald-600 text-sm">Rp ${(parseInt(t.total)||0).toLocaleString('id-ID')}</span>
                </div>
                <div class="pt-2">
                    <button onclick="openInvoiceModalById('${t.id}')" class="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs py-3 rounded-xl font-bold shadow-sm flex items-center justify-center gap-2 transition-colors active:scale-95">
                        <i class="fa-solid fa-eye"></i> Preview & Cetak
                    </button>
                </div>
            </div>`;
    });
}


function setFinanceFilter(type) {
    financeFilterType = type;
    
    // Style Tema Emerald Baru untuk tombol Non-aktif
    const inactiveStyle = "filter-btn text-sm bg-white text-gray-500 font-bold py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition";
    
    // Style Tema Emerald Baru untuk tombol Aktif
    const activeStyle = "filter-btn text-sm bg-emerald-600 text-white font-bold py-3 rounded-xl border border-emerald-600 transition shadow-sm";

    // Kembalikan semua tombol ke kondisi non-aktif
    document.querySelectorAll('.filter-btn').forEach(b => { 
        b.className = inactiveStyle; 
    });
    
    // Berikan style aktif (hijau) hanya pada tombol yang diklik
    const activeBtn = document.getElementById(`btn-flt-${type}`);
    if (activeBtn) {
        activeBtn.className = activeStyle;
    }

    // Tampilkan atau sembunyikan kontainer tanggal kustom
    const customContainer = document.getElementById('custom-date-container');
    if (customContainer) {
        customContainer.className = type === 'custom' ? 'grid grid-cols-2 gap-3 pt-2' : 'hidden';
    }
    
    // Hitung ulang laporan
    calculateFinancials();
}

function parseDateStr(dateStr) {
    if (!dateStr) return new Date();
    let str = String(dateStr).trim();
    if (str.includes('T') || str.includes('Z')) return new Date(str);
    if (str.includes('/')) {
        const parts = str.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1] ? parts[1].split(':') : [0, 0];
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
    }
    return new Date(str);
}

function getFilteredTransactions() {
    const today = new Date(); const curDate = today.getDate(); const curMonth = today.getMonth(); const curYear = today.getFullYear();
    return transactions.filter(t => {
        if(!t.date) return false;
        const tDate = parseDateStr(t.date); 
        if (financeFilterType === 'today') return tDate.getDate() === curDate && tDate.getMonth() === curMonth && tDate.getFullYear() === curYear;
        if (financeFilterType === 'month') return tDate.getMonth() === curMonth && tDate.getFullYear() === curYear;
        if (financeFilterType === 'custom') {
            const st = document.getElementById('filter-start-date').value; const ed = document.getElementById('filter-end-date').value;
            if(!st || !ed) return true;
            const start = new Date(st); start.setHours(0,0,0,0); const end = new Date(ed); end.setHours(23,59,59,999);
            return tDate >= start && tDate <= end;
        }
        return true;
    });
}

function calculateFinancials() {
    const data = getFilteredTransactions();
    let inc = 0, disc = 0, cash = 0, qris = 0, debit = 0;
    data.forEach(t => {
        let val = parseInt(t.total) || 0; inc += val; disc += parseInt(t.discount) || 0;
        let method = String(t.method || '').trim();
        if(method === 'Tunai') cash += val; if(method === 'QRIS') qris += val; if(method === 'Debit') debit += val;
    });
    if(document.getElementById('report-income')) document.getElementById('report-income').innerText = `Rp ${inc.toLocaleString('id-ID')}`;
    if(document.getElementById('report-discount')) document.getElementById('report-discount').innerText = `Rp ${disc.toLocaleString('id-ID')}`;
    if(document.getElementById('rep-cash-txt')) document.getElementById('rep-cash-txt').innerText = `Rp ${cash.toLocaleString('id-ID')}`;
    if(document.getElementById('rep-qris-txt')) document.getElementById('rep-qris-txt').innerText = `Rp ${qris.toLocaleString('id-ID')}`;
    if(document.getElementById('rep-debit-txt')) document.getElementById('rep-debit-txt').innerText = `Rp ${debit.toLocaleString('id-ID')}`;
    const p = (v) => inc === 0 ? 0 : (v / inc) * 100;
    if(document.getElementById('bar-cash')) document.getElementById('bar-cash').style.width = `${p(cash)}%`; 
    if(document.getElementById('bar-qris')) document.getElementById('bar-qris').style.width = `${p(qris)}%`; 
    if(document.getElementById('bar-debit')) document.getElementById('bar-debit').style.width = `${p(debit)}%`;
}

function exportToExcel() {
    const data = getFilteredTransactions(); if(data.length === 0) return alert('Tidak ada data.');
    const rows = data.map(t => ({
        "ID Transaksi": t.id, "Waktu": t.date, "Nama Pelanggan": t.customer, "No WA": t.phone || '-', "Metode Bayar": t.method,
        "Rincian Item": (Array.isArray(t.items) ? t.items : []).map(i => `${i.name} (${i.qty}x)`).join(', '), "Diskon (Rp)": parseInt(t.discount) || 0, "Omset Bersih (Rp)": parseInt(t.total) || 0
    }));
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan"); XLSX.writeFile(wb, `Laporan_SagePOS_${financeFilterType}.xlsx`);
}

async function connectBluetooth() {
    if (isConnectingBle) return; isConnectingBle = true;
    const btn = document.getElementById('btn-bluetooth-txt'); btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i>...`;
    try {
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, { namePrefix: 'RPP' }, { namePrefix: 'MTP' }, { namePrefix: 'PT' }],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']
        });
        bleDevice.addEventListener('gattserverdisconnected', onBluetoothDisconnected);
        const srv = await bleDevice.gatt.connect();
        let svc; try { svc = await srv.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb'); } catch(e) { svc = await srv.getPrimaryService('0000ff00-0000-1000-8000-00805f9b34fb'); }
        const chars = await svc.getCharacteristics();
        bleCharacteristic = chars.find(c => c.properties.write || c.properties.writeWithoutResponse);
        if (bleCharacteristic) { btn.innerText = "Terhubung ✅"; isConnectingBle = false; return true; }
        throw new Error("Tidak didukung.");
    } catch (e) { btn.innerText = "Hubungkan Printer"; isConnectingBle = false; return false; }
}
function onBluetoothDisconnected() { bleCharacteristic = null; bleDevice = null; document.getElementById('btn-bluetooth-txt').innerText = "Hubungkan Printer"; }

// ------------------------------------------------------------------------
// PREVIEW NOTA 1:1 DENGAN PRINTER THERMAL
// ------------------------------------------------------------------------
function openInvoiceModal(trx) {
    let sub = 0;
    
    let html = `
        <div class="text-center font-bold text-xs mb-1 tracking-widest">LINK NEO MEAL</div>
        <div class="border-t-[1.5px] border-double border-gray-800 my-1.5"></div>
        <div class="flex justify-between"><span>ID</span><span>: ${trx.id}</span></div>
        <div class="flex justify-between"><span>Tgl</span><span>: ${trx.date}</span></div>
        <div class="flex justify-between"><span>Kasir</span><span>: ${trx.cashier}</span></div>
        <div class="flex justify-between"><span>Cust</span><span>: ${trx.customer}</span></div>
        <div class="flex justify-between"><span>Tipe</span><span>: ${trx.orderType || 'Dine In'}</span></div>
        <div class="border-t border-dashed border-gray-600 my-1.5"></div>
    `;
    
    trx.items.forEach(i => {
        html += `<div class="truncate">${i.name}</div>`;
        let qtyText = `  ${i.qty} x Rp ${parseInt(i.price).toLocaleString('id-ID')}`;
        let totalText = `Rp ${(i.price * i.qty).toLocaleString('id-ID')}`;
        html += `<div class="flex justify-between mb-0.5"><span>${qtyText}</span><span>${totalText}</span></div>`;
        sub += (i.price * i.qty);
    });
    
    html += `<div class="border-t border-dashed border-gray-600 my-1.5"></div>`;
    
    if (trx.discount > 0) {
        html += `<div class="flex justify-between"><span>Subtotal</span><span>Rp ${sub.toLocaleString('id-ID')}</span></div>`;
        html += `<div class="flex justify-between"><span>Diskon</span><span>-Rp ${trx.discount.toLocaleString('id-ID')}</span></div>`;
    }
    
    html += `
        <div class="flex justify-between font-bold text-xs mt-1"><span>TOTAL</span><span>Rp ${(parseInt(trx.total)||0).toLocaleString('id-ID')}</span></div>
        <div class="flex justify-between"><span>Bayar</span><span>Rp ${parseInt(trx.cash||0).toLocaleString('id-ID')}</span></div>
        <div class="flex justify-between"><span>Kembali</span><span>Rp ${parseInt(trx.change||0).toLocaleString('id-ID')}</span></div>
        <div class="flex justify-between mt-0.5"><span>Metode</span><span>${trx.method}</span></div>
        <div class="border-t-[1.5px] border-double border-gray-800 my-1.5"></div>
        <div class="text-center italic text-[10px]">"${trx.quote || 'Stay aesthetic.'}"</div>
        <div class="border-t-[1.5px] border-double border-gray-800 my-1.5"></div>
    `;

    document.getElementById('receipt-preview-container').innerHTML = html;
    
    // Perbaikan: Tambahkan efek loading & proteksi pada tombol print di dalam modal
    const btnPrint = document.getElementById('modal-btn-thermal');
    btnPrint.onclick = async function() { 
        const originalText = btnPrint.innerHTML;
        btnPrint.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Sedang Mencetak...`;
        btnPrint.disabled = true;
        
        await printThermal(trx.id); 
        
        btnPrint.innerHTML = originalText;
        btnPrint.disabled = false;
    };
    
    document.getElementById('invoice-modal').classList.remove('hidden');
}

// Fungsi untuk memanggil modal preview berdasarkan ID transaksi
function openInvoiceModalById(trxId) {
    const trx = transactions.find(t => t.id === trxId);
    if (trx) {
        openInvoiceModal(trx);
    }
}

// Fungsi untuk menutup modal
function closeInvoiceModal() {
    document.getElementById('invoice-modal').classList.add('hidden');
}


// ------------------------------------------------------------------------
// CETAK KE PRINTER THERMAL (DENGAN PROTEKSI ERROR NOTIFICATION)
// ------------------------------------------------------------------------
async function printThermal(trxId) {
    const trx = transactions.find(t => t.id === trxId); 
    if (!trx) return;
    
    // Validasi apakah browser mendukung Bluetooth
    if (!navigator.bluetooth) {
        alert("Peringatan: Browser atau perangkat ini tidak mendukung Bluetooth Web. Gunakan Google Chrome versi terbaru.");
        return;
    }
    
    // Proses koneksi printer
    if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) { 
        try {
            const conn = await connectBluetooth(); 
            if (!conn) {
                alert("Koneksi gagal! Pastikan printer bluetooth menyala, siap (tidak berkedip merah), dan izinkan akses di browser.");
                return; 
            }
        } catch (e) {
            console.error("Gagal saat mencoba konek: ", e);
            alert("Terjadi kesalahan saat memindai printer bluetooth.");
            return;
        }
    }
    
    try {
        const enc = new TextEncoder('utf-8'); 
        const I = new Uint8Array([27, 64]); 
        const C = new Uint8Array([27, 97, 1]); 
        const L = new Uint8Array([27, 97, 0]); 
        const B1 = new Uint8Array([27, 69, 1]); 
        const B0 = new Uint8Array([27, 69, 0]); 
        const LF = new Uint8Array([10]);
        
        const w = async (t) => { 
            const b = typeof t === 'string' ? enc.encode(t) : t; 
            if (bleCharacteristic.properties.writeWithoutResponse) {
                await bleCharacteristic.writeValueWithoutResponse(b); 
            } else {
                await bleCharacteristic.writeValue(b); 
            }
            await new Promise(r => setTimeout(r, 50)); 
        };
        
        await w(I); await w(C); await w(B1); 
        await w("LINK NEO MEAL\n"); 
        await w(B0); 
        await w("================================\n"); 
        await w(L);
        
        await w(`ID     : ${trx.id}\n`); 
        await w(`Tgl    : ${trx.date}\n`); 
        await w(`Kasir  : ${trx.cashier}\n`);
        await w(`Cust   : ${trx.customer}\n`);
        await w(`Tipe   : ${trx.orderType || 'Dine In'}\n`);
        await w("--------------------------------\n");
        
        let sub = 0;
        for (const i of (Array.isArray(trx.items) ? trx.items : [])) {
            await w(`${i.name}\n`); 
            sub += (i.price * i.qty);
            
            let d = `  ${i.qty} x Rp ${parseInt(i.price).toLocaleString('id-ID')}`; 
            let s = `Rp ${(i.price * i.qty).toLocaleString('id-ID')}\n`;
            await w(d + " ".repeat(Math.max(1, 32 - (d.length + s.length - 1))) + s);
        }
        await w("--------------------------------\n");
        
        if (trx.discount > 0) {
            let sb = `Rp ${sub.toLocaleString('id-ID')}\n`; 
            await w("Subtotal : " + " ".repeat(Math.max(1, 32 - (11 + sb.length - 1))) + sb);
            
            let ds = `-Rp ${trx.discount.toLocaleString('id-ID')}\n`; 
            await w("Diskon   : " + " ".repeat(Math.max(1, 32 - (11 + ds.length - 1))) + ds);
        }
        
        await w(B1); 
        let t = `Rp ${(parseInt(trx.total)||0).toLocaleString('id-ID')}\n`; 
        await w("TOTAL    : " + " ".repeat(Math.max(1, 32 - (11 + t.length - 1))) + t); 
        await w(B0);
        
        let byr = `Rp ${parseInt(trx.cash||0).toLocaleString('id-ID')}\n`; 
        await w("Bayar    : " + " ".repeat(Math.max(1, 32 - (11 + byr.length - 1))) + byr); 
        
        let kmb = `Rp ${parseInt(trx.change||0).toLocaleString('id-ID')}\n`; 
        await w("Kembali  : " + " ".repeat(Math.max(1, 32 - (11 + kmb.length - 1))) + kmb);
        
        await w(`Metode   : ${trx.method}\n`);
        
        await w("================================\n"); 
        await w(C); 
        await w(`"${trx.quote || 'Stay aesthetic.'}"\n`); 
        await w("================================\n");
        
        for (let f = 0; f < 4; f++) await w(LF);
        
    } catch (err) { 
        console.error(err);
        alert("Printer sibuk, kertas habis, atau koneksi terputus tiba-tiba."); 
        // Kosongkan variabel bluetooth agar sistem memaksa mencari ulang perangkat saat diklik lagi
        bleCharacteristic = null;
        bleDevice = null;
    }
}

// ==========================================================================
// 1. FUNGSI ALAT CETAK REKAP KE PRINTER THERMAL
// ==========================================================================
async function printRecapThermal(recap) {
    if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) {
        throw new Error("Printer tidak terhubung");
    }
    
    const enc = new TextEncoder('utf-8'); 
    const I = new Uint8Array([27, 64]); 
    const C = new Uint8Array([27, 97, 1]); 
    const L = new Uint8Array([27, 97, 0]); 
    const B1 = new Uint8Array([27, 69, 1]); 
    const B0 = new Uint8Array([27, 69, 0]); 
    const LF = new Uint8Array([10]); 
    
    const w = async (t) => { 
        const b = typeof t === 'string' ? enc.encode(t) : t; 
        if (bleCharacteristic.properties.writeWithoutResponse) {
            await bleCharacteristic.writeValueWithoutResponse(b); 
        } else {
            await bleCharacteristic.writeValue(b); 
        }
        await new Promise(r => setTimeout(r, 50)); 
    };
    
    await w(I); await w(C); await w(B1); 
    await w("REKAP CLOSING SHIFT\n");
    await w("LINK NEO MEAL\n"); 
    await w(B0); 
    await w("================================\n"); 
    await w(L);
    
    await w(`Kasir  : ${recap.kasir}\n`); 
    await w(`Waktu  : ${recap.waktu}\n`); 
    await w("--------------------------------\n");
    
    await w(B1); 
    let tNota = `${recap.totalNota}\n`; 
    await w("Total Nota : " + " ".repeat(Math.max(1, 32 - (13 + tNota.length - 1))) + tNota); 
    
    let tOmset = `Rp ${parseInt(recap.omset).toLocaleString('id-ID')}\n`; 
    await w("TOTAL OMSET: " + " ".repeat(Math.max(1, 32 - (13 + tOmset.length - 1))) + tOmset); 
    await w(B0);
    
    await w("--------------------------------\n");
    await w("Rincian Pembayaran:\n");
    
    let tTunai = `Rp ${parseInt(recap.tunai).toLocaleString('id-ID')}\n`; 
    await w("Tunai  : " + " ".repeat(Math.max(1, 32 - (9 + tTunai.length - 1))) + tTunai); 
    
    let tQris = `Rp ${parseInt(recap.qris).toLocaleString('id-ID')}\n`; 
    await w("QRIS   : " + " ".repeat(Math.max(1, 32 - (9 + tQris.length - 1))) + tQris); 
    
    let tDebit = `Rp ${parseInt(recap.debit).toLocaleString('id-ID')}\n`; 
    await w("Debit  : " + " ".repeat(Math.max(1, 32 - (9 + tDebit.length - 1))) + tDebit); 
    
    await w("================================\n"); 
    await w(C); 
    await w("Harap setorkan uang fisik\n");
    await w("sesuai dengan rincian Tunai.\n");
    await w("================================\n");
    
    for (let f = 0; f < 4; f++) await w(LF);
}

// ==========================================================================
// 2. FUNGSI TOMBOL CETAK REKAP CLOSING SHIFT MANUAL
// ==========================================================================
async function manualPrintClosing() {
    try {
        console.log("Tombol Cetak Rekap Ditekan!"); // Untuk cek di Inspect Element
        
        // 1. Tarik data kalkulasi rekap
        const recap = calculateShiftRecap();
        
        // 2. Cek Koneksi Printer (Otomatis minta connect jika belum)
        if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) { 
            const setuju = confirm("Printer belum terhubung! Ingin menghubungkan printer sekarang?");
            if (!setuju) return;
            
            const conn = await connectBluetooth(); 
            if (!conn) {
                alert("Koneksi gagal! Pastikan printer bluetooth menyala.");
                return; 
            }
        }

        // 3. Animasi tombol loading
        const btn = document.getElementById('btn-print-closing');
        let originalText = "";
        if (btn) {
            originalText = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Mencetak...`;
            btn.disabled = true;
        }

        // 4. Eksekusi Print (Panggil fungsi thermal di atas)
        await printRecapThermal(recap);
        showToast("Rekap closing berhasil dicetak ke printer!", "success");

        // 5. Kembalikan kondisi tombol
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }

    } catch (e) {
        console.error("Gagal cetak rekap:", e);
        alert("Gagal mencetak. Coba muat ulang (Refresh) halaman dan pastikan printer menyala.");
        const btn = document.getElementById('btn-print-closing');
        if (btn) {
            btn.innerHTML = `<i class="fa-solid fa-print"></i> Print Rekap`;
            btn.disabled = false;
        }
    }
}