// ==========================================================================
// AUDIO FEEDBACK (MICRO-INTERACTIONS) - BROWSER SAFE
// ==========================================================================
let audioCtx; 

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
        osc.frequency.setValueAtTime(800, ctx.currentTime); 
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime); 
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
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1); 
        gainNode.gain.setValueAtTime(0.2, ctx.currentTime); 
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
let globalExpenses = []; 
let currentFinanceFilter = 'today';
let selectedCategory = 'Semua';
let customerMode = 'new';
let currentOrderType = 'Dine In';

let bleDevice = null;
let bleCharacteristic = null;
let isConnectingBle = false;

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

document.addEventListener("DOMContentLoaded", () => {
    listenToActiveSession();
    setCustomerMode('new');
    const imageInput = document.getElementById('prod-image-file');
    if (imageInput) imageInput.addEventListener('change', handleImageUpload);
    setupRealtimeListeners();
});

// ------------------------------------------------------------------------
// REAL-TIME FIREBASE LISTENERS
// ------------------------------------------------------------------------
function setupRealtimeListeners() {
    db.ref('products').on('value', (snap) => {
        products = [];
        if (snap.exists()) {
            snap.forEach(child => { products.push(child.val()); });
        }
        renderKasirProducts();
        renderProductTable();
    });

    db.ref('transactions').orderByKey().limitToLast(100).on('value', (snap) => {
        transactions = [];
        if (snap.exists()) {
            snap.forEach(child => { transactions.push(child.val()); });
        }
        transactions.reverse(); 
        renderStrukList();
        renderPromoCustomers();
        calculateFinancials();
    });

  db.ref('customers').on('value', (snap) => {
    savedCustomersArray = [];
    if (snap.exists()) {
        snap.forEach(child => { savedCustomersArray.push(child.val()); });
    }
    renderCustomerList(); // Ini akan memicu dropdown terisi otomatis
});

    db.ref('expenses').on('value', (snap) => {
        globalExpenses = [];
        if (snap.exists()) {
            snap.forEach(child => { globalExpenses.push(child.val()); });
        }
        calculateFinancials(); 
    });
}

function listenToActiveSession() {
    db.ref('attendance').orderByKey().limitToLast(1).on('value', (snapshot) => {
        let activeSessionFound = false;
        currentCashier = "Kasir"; 

        snapshot.forEach((child) => {
            const data = child.val();
            if (data.status === 'Sedang Bekerja') {
                activeSessionFound = true;
                currentCashier = data.cashierName; 
            }
        });

        const loginOverlay = document.getElementById('login-overlay');
        if (loginOverlay) {
            if (activeSessionFound) {
                loginOverlay.classList.add('hidden');
                const activeCashierLabel = document.getElementById('active-cashier-name');
                if (activeCashierLabel) activeCashierLabel.innerText = currentCashier;
                const mName = document.getElementById('m-cashier-name');
                if (mName) mName.innerText = currentCashier;
                const avatar = document.getElementById('avatar-initial');
                if (avatar) avatar.innerText = currentCashier.charAt(0).toUpperCase();
                document.getElementById('logout-pin-modal').classList.add('hidden');
            } else {
                loginOverlay.classList.remove('hidden');
            }
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
        const pinSnapshot = await db.ref(`cashier_pins/${name.toLowerCase()}`).once('value');
        
        if (!pinSnapshot.exists()) {
            alert('Akses Ditolak: Username kasir tidak ditemukan / belum didaftarkan!');
            btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs ml-1"></i>`;
            btn.disabled = false;
            pinEl.value = ""; 
            return;
        }

        const validPin = String(pinSnapshot.val());

        if (pin !== validPin) {
            alert('Akses Ditolak: PIN Kasir Salah!');
            btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs ml-1"></i>`;
            btn.disabled = false;
            pinEl.value = ""; 
            return;
        }

        const displayName = name.replace(/\b\w/g, l => l.toUpperCase());
        processAbsensi(displayName);
        
    } catch (error) {
        console.error("Error Login:", error);
        alert("Gagal memvalidasi PIN. Periksa koneksi internet.");
        btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs ml-1"></i>`;
        btn.disabled = false;
    }
}

async function processAbsensi(name) {
    const sessionId = 'ABSEN-' + Date.now();
    const loginTime = getFormattedDate();
    const btn = document.getElementById('btn-login');

    btn.innerHTML = `<i class="fa-solid fa-location-dot animate-bounce"></i> Mengunci Lokasi GPS...`;
    btn.disabled = true;

    const getGPS = () => new Promise((resolve) => {
        if (!navigator.geolocation) {
            resolve('Browser tidak mendukung GPS');
        } else {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const mapLink = `https://www.google.com/maps?q=$${pos.coords.latitude},${pos.coords.longitude}`;
                    resolve(mapLink);
                },
                (err) => resolve('Akses GPS ditolak / Sinyal lemah'),
                { enableHighAccuracy: true, timeout: 8000 } 
            );
        }
    });

    const locationData = await getGPS();
    if (locationData.includes('Gagal')) {
        alert(locationData);
        btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs ml-1"></i>`;
        btn.disabled = false;
        return; 
    }

    showToast('Merekam data kehadiran...', 'loading');

    db.ref('attendance/' + sessionId).set({
        id: sessionId,
        cashierName: name,
        loginTime: loginTime,
        logoutTime: '-',
        loginLocation: locationData, 
        status: 'Sedang Bekerja'
    }).then(() => {
        btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs ml-1"></i>`;
        btn.disabled = false;
        showToast('Berhasil Buka Kasir!', 'success');
    }).catch(e => {
        console.error(e);
        showToast('Gagal absen, periksa koneksi internet.', 'error');
        btn.innerHTML = `Buka Kasir <i class="fa-solid fa-arrow-right text-xs ml-1"></i>`;
        btn.disabled = false;
    });
}

function openLogoutModal() {
    const modal = document.getElementById('logout-pin-modal');
    if (modal) {
        modal.classList.remove('hidden');
        const pinInput = document.getElementById('logout-pin');
        if (pinInput) {
            pinInput.value = "";
            setTimeout(() => pinInput.focus(), 100);
        }
    }
}

function closeLogoutModal() {
    document.getElementById('logout-pin-modal').classList.add('hidden');
}

async function handleLogout() {
    const pinInput = document.getElementById('logout-pin');
    const pin = pinInput.value.trim();
    const btn = document.getElementById('btn-confirm-logout');
    
    if (pin.length !== 4) return alert('PIN harus diisi 4 digit angka!');

    const activeName = document.getElementById('active-cashier-name').innerText.trim();
    
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Memverifikasi...`;
    btn.disabled = true;

    try {
        const pinSnapshot = await db.ref(`cashier_pins/${activeName.toLowerCase()}`).once('value');
        if (!pinSnapshot.exists() || pin !== String(pinSnapshot.val())) {
            alert('Akses Ditolak: PIN Kasir Salah!');
            pinInput.value = "";
            btn.innerHTML = `Konfirmasi Absen Pulang`;
            btn.disabled = false;
            return;
        }

        const sessionSnap = await db.ref('attendance')
            .orderByChild('status')
            .equalTo('Sedang Bekerja')
            .once('value');

        let foundSessionId = null;
        sessionSnap.forEach(child => {
            if (child.val().cashierName.toLowerCase() === activeName.toLowerCase()) {
                foundSessionId = child.key;
            }
        });

        if (!foundSessionId) {
            throw new Error("Sesi kerja tidak ditemukan. Silakan hubungi Owner.");
        }

        showToast('Merekam absensi pulang...', 'loading');
        
        await db.ref('attendance/' + foundSessionId).update({
            logoutTime: getFormattedDate(),
            status: 'Selesai Shift'
        });

        showToast('Berhasil Absen Pulang!', 'success');
        document.getElementById('login-cashier-name').value = "";
        pinInput.value = "";
        closeLogoutModal();

    } catch (e) {
        console.error("Error Logout:", e);
        showToast(e.message || 'Koneksi terputus.', 'error');
    } finally {
        btn.innerHTML = `Konfirmasi Absen Pulang`;
        btn.disabled = false;
    }
}

function calculateShiftRecap() {
    const todayPrefix = getFormattedDate().split(' ')[0];
    let totalNota = 0; let omset = 0; let tunai = 0; let qris = 0; let debit = 0;

    // PERBAIKAN: Ambil nama kasir dari DOM UI yang paling akurat
    const cashierNameStr = document.getElementById('active-cashier-name') ? document.getElementById('active-cashier-name').innerText.trim() : (currentCashier || "Kasir");
    const activeCashier = cashierNameStr.toLowerCase();

    transactions.forEach(t => {
        const tDate = String(t.date || '');
        const tCashier = String(t.cashier || '').trim().toLowerCase();

        // Pencocokan kasir dan tanggal hari ini
        if (tDate.startsWith(todayPrefix) && tCashier === activeCashier) {
            totalNota++;
            let val = parseInt(t.total) || 0;
            omset += val;
            
            let method = String(t.method || '').trim().toLowerCase();
            if (method === 'tunai' || method === 'cash') tunai += val;
            else if (method === 'qris') qris += val;
            else if (method === 'debit' || method === 'transfer') debit += val;
            else tunai += val; 
        }
    });

    // PERBAIKAN: Gunakan cashierNameStr yang diambil di atas untuk data print
    return { kasir: cashierNameStr, waktu: getFormattedDate(), totalNota, omset, tunai, qris, debit };
}

// ------------------------------------------------------------------------
// MANAJEMEN UI & NAVIGASI
// ------------------------------------------------------------------------
function renderAllUI() {
    renderKasirProducts(); renderCart(); renderProductTable();
    renderStrukList(); renderPromoCustomers(); renderCustomerList(); calculateFinancials();
}

// ==========================================
// TAMBAHKAN FUNGSI LOADING INI
// ==========================================
function showLoading(containerId) {
    const container = document.getElementById(containerId);
    if(container) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 w-full col-span-full">
                <i class="fa-solid fa-spinner animate-spin text-3xl text-emerald-500 mb-3"></i>
                <p class="text-[11px] font-bold text-gray-400 animate-pulse uppercase tracking-widest">Memuat Data...</p>
            </div>`;
    }
}

// ==========================================
// TIMPA FUNGSI switchPage() YANG LAMA DENGAN INI
// ==========================================
function switchPage(pageId, btnElement) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    
    document.querySelectorAll('aside .nav-btn').forEach(b => { 
        b.className = "nav-btn w-full flex items-center gap-4 p-3.5 rounded-2xl text-gray-500 hover:bg-gray-50 hover:text-emerald-600 font-semibold transition"; 
    });
    
    document.querySelectorAll('nav.md\\:hidden .nav-btn').forEach(b => {
        b.className = "nav-btn flex flex-col items-center justify-end pb-1 text-gray-400 hover:text-emerald-600 w-[20%] transition-colors";
    });

    if(btnElement) {
        if (window.innerWidth >= 768) { 
            btnElement.className = "nav-btn w-full flex items-center gap-4 p-3.5 rounded-2xl bg-emerald-600 text-white font-bold transition shadow-md shadow-emerald-200/50";
        } else { 
            btnElement.className = "nav-btn flex flex-col items-center justify-end pb-1 text-emerald-600 font-bold w-[20%] transition-colors";
        }
    }

    const floatingCart = document.getElementById('floating-cart-btn');
    if (floatingCart) {
        if (pageId === 'kasir' && typeof cart !== 'undefined' && cart.length > 0) {
            floatingCart.classList.remove('translate-y-32', 'opacity-0', 'pointer-events-none');
        } else {
            floatingCart.classList.add('translate-y-32', 'opacity-0', 'pointer-events-none');
        }
    }

    // EFEK LOADING SAAT PINDAH HALAMAN
    if(pageId === 'kasir') { 
        showLoading('kasir-products-grid');
        setTimeout(() => { renderKasirProducts(); renderCart(); renderCustomerList(); }, 250);
    }
    if(pageId === 'produk') { 
        showLoading('product-table-body');
        setTimeout(() => { renderProductTable(); resetProductForm(); }, 250);
    }
    if(pageId === 'struk') {
        showLoading('struk-list');
        setTimeout(() => renderStrukList(), 250);
    }
    if(pageId === 'promo') {
        showLoading('promo-customer-list');
        setTimeout(() => renderPromoCustomers(), 250);
    }
    if(pageId === 'keuangan') {
        showLoading('cashier-list-pemasukan');
        showLoading('cashier-list-pengeluaran');
        setTimeout(() => calculateFinancials(), 250);
    }
}

let isSidebarOpen = true;
function toggleSidebar() {
    const sidebar = document.querySelector('aside');
    const navTexts = sidebar.querySelectorAll('.nav-text');
    if (sidebar.classList.contains('lg:w-64')) {
        sidebar.classList.remove('lg:w-64'); sidebar.classList.add('lg:w-[90px]');
        navTexts.forEach(el => el.classList.add('hidden')); 
    } else {
        sidebar.classList.remove('lg:w-[90px]'); sidebar.classList.add('lg:w-64');
        navTexts.forEach(el => el.classList.remove('hidden')); 
    }
}

// ------------------------------------------------------------------------
// MANAJEMEN PRODUK KASIR
// ------------------------------------------------------------------------
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
            statusEl.className = "text-[11px] text-emerald-600 font-bold";
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> Gambar terunggah!`;
        } else { throw new Error(result.error.message); }
    } catch (error) {
        statusEl.className = "text-[11px] text-red-600 font-bold";
        statusEl.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1"></i> Gagal unggah gambar.`;
    } finally { btnSubmit.removeAttribute('disabled'); }
}

function renderProductTable() {
    const container = document.getElementById('product-table-body');
    if (!container) return;
    
    if (products.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center py-10 text-gray-400 text-sm flex flex-col items-center"><i class="fa-solid fa-box-open text-4xl mb-2 opacity-50"></i> Belum ada data produk.</div>`;
        return;
    }

    let htmlBuffer = '';
    products.forEach(p => {
        const isLowStock = (parseInt(p.stock) || 0) <= 3;
        htmlBuffer += `
            <div class="bg-white border border-gray-100 p-3 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.02)] flex gap-3 items-center hover:shadow-md hover:border-emerald-200 transition-all">
                <img src="${p.image || fallbackImage}" loading="lazy" class="w-14 h-14 object-cover rounded-xl border border-gray-100 shrink-0 shadow-inner">
                <div class="flex-1 min-w-0">
                    <h4 class="font-bold text-gray-800 text-sm truncate" title="${p.name}">${p.name}</h4>
                    <div class="flex items-center gap-1.5 mt-1">
                        <span class="text-[11px] font-black text-emerald-600">Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}</span>
                        <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold ${isLowStock ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-gray-100 text-gray-500 border border-gray-200'}">
                            Stok: ${p.stock || 0}
                        </span>
                    </div>
                    <p class="text-[9px] text-gray-400 mt-0.5">${p.category || 'Lainnya'}</p>
                </div>
                <div class="flex flex-col gap-1.5 shrink-0">
                    <button onclick="editProduct('${p.id}')" class="w-14 bg-blue-50 hover:bg-blue-500 text-blue-600 hover:text-white py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm active:scale-95">Edit</button>
                    <button onclick="deleteProduct('${p.id}')" class="w-14 bg-red-50 hover:bg-red-500 text-red-500 hover:text-white py-1.5 rounded-lg text-[10px] font-bold transition-colors shadow-sm active:scale-95">Hapus</button>
                </div>
            </div>`;
    });
    container.innerHTML = htmlBuffer;
}

async function saveProduct(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-product');
    const originalText = btnSubmit.innerText;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Menyimpan...`;
    btnSubmit.setAttribute('disabled', 'true');
    
    const prodId = document.getElementById('prod-id').value || String(Date.now());
    
   
    const existingProd = products.find(p => String(p.id) === String(prodId));
    const retainedCost = existingProd ? (parseInt(existingProd.cost) || 0) : 0;

    const payload = { 
        id: prodId, 
        name: document.getElementById('prod-name').value, 
        price: parseInt(document.getElementById('prod-price').value), 
        category: document.getElementById('prod-category').value, 
        stock: parseInt(document.getElementById('prod-stock').value) || 0, 
        image: document.getElementById('prod-image-url').value.trim(),
        cost: retainedCost // <- Mempertahankan Harga Modal milik Owner
    };
    
    try {
        await db.ref('products/' + payload.id).set(payload);
        showToast('Produk berhasil disimpan!', 'success');
        resetProductForm(); 
    } catch(err) { 
        console.error(err); 
        showToast('Gagal menyimpan ke database.', 'error');
    } finally { 
        btnSubmit.innerText = originalText; 
        btnSubmit.removeAttribute('disabled'); 
    }
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
    statusEl.className = "text-[11px] text-emerald-600 font-semibold";
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

function filterCategory(cat, btnElement) {
    selectedCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => { 
        b.className = "cat-btn flex flex-col items-center justify-center w-[80px] h-[90px] rounded-2xl bg-white text-gray-500 shadow-sm shrink-0 transition-all border border-transparent hover:border-gray-200"; 
    });
    if (btnElement) {
        btnElement.className = "cat-btn flex flex-col items-center justify-center w-[80px] h-[90px] rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm shrink-0 transition-all border border-emerald-200";
    } else if (event && event.target) {
        event.target.className = "cat-btn flex flex-col items-center justify-center w-[80px] h-[90px] rounded-2xl bg-emerald-100 text-emerald-700 shadow-sm shrink-0 transition-all border border-emerald-200";
    }
    renderKasirProducts();
}

function renderKasirProducts() {
    const grid = document.getElementById('kasir-products-grid');
    if (!grid) return;
    
    grid.classList.add('min-h-0'); 
    const searchQuery = document.getElementById('search-product').value.toLowerCase();
    
    const filtered = products.filter(p => p.name.toLowerCase().includes(searchQuery) && (selectedCategory === 'Semua' || (p.category || 'Lainnya') === selectedCategory));
    
    if(filtered.length === 0) { 
        grid.innerHTML = `<div class="col-span-full text-center text-gray-400 text-sm py-12 flex flex-col items-center"><i class="fa-solid fa-box-open text-4xl mb-3 opacity-20"></i>Menu tidak ditemukan</div>`; 
        return; 
    }
    
    let htmlBuffer = '';
    filtered.forEach(p => {
        const cartItem = cart.find(i => String(i.id) === String(p.id));
        const qtyPicked = cartItem ? cartItem.qty : 0;
        const isOut = (parseInt(p.stock) || 0) <= 0;
        
        let cardStyle = isOut 
            ? 'opacity-50 border-gray-200 bg-gray-50 pointer-events-none grayscale' 
            : (qtyPicked > 0 
                ? 'border-[#059669] bg-[#ecfdf5] shadow-[0_4px_12px_rgba(5,150,105,0.15)] ring-1 ring-[#059669] scale-[0.98]' 
                : 'border-gray-200 bg-white hover:border-[#34d399] hover:shadow-lg hover:-translate-y-1');
            
        const badgeHtml = qtyPicked > 0 
            ? `<div class="absolute top-2.5 left-2.5 bg-[#059669] text-white font-black text-[11px] px-2 py-1 rounded-md shadow-md z-10 flex items-center gap-1">
                 <i class="fa-solid fa-check text-[9px]"></i> ${qtyPicked}x
               </div>` 
            : '';
            
        const stockLabelHtml = isOut 
            ? `<span class="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded flex items-center font-black tracking-wide">HABIS</span>` 
            : `<span class="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-bold border border-gray-200">Stok: ${p.stock || 0}</span>`;
        
        htmlBuffer += `
            <div onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.stock || 0})" class="relative border rounded-2xl p-3 cursor-pointer flex flex-col h-full transition-all duration-300 ${cardStyle} will-change-transform">
                ${badgeHtml}
                <div class="w-full aspect-[4/3] rounded-xl overflow-hidden mb-3 shrink-0 shadow-sm border border-gray-100/50 bg-gray-50">
                    <img src="${p.image || fallbackImage}" loading="lazy" class="w-full h-full object-cover ${isOut ? 'grayscale contrast-75' : ''}">
                </div>
                <div class="flex flex-col flex-1">
                    <span class="font-bold text-xs sm:text-sm ${isOut ? 'text-gray-400 line-through' : 'text-gray-800'} line-clamp-2 leading-snug">${p.name}</span>
                    <div class="mt-auto pt-3 flex justify-between items-end border-t border-dashed ${qtyPicked > 0 ? 'border-[#059669]/30' : 'border-gray-200/80'}">
                        <span class="${isOut ? 'text-gray-400 font-bold' : (qtyPicked > 0 ? 'text-[#047857] font-black' : 'text-[#059669] font-extrabold')} text-xs sm:text-sm">
                            Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}
                        </span>
                        ${stockLabelHtml}
                    </div>
                </div>
            </div>`;
    });
    grid.innerHTML = htmlBuffer;
}

// ------------------------------------------------------------------------
// CART & TRANSAKSI KASIR
// ------------------------------------------------------------------------
function addToCart(id, name, price, currentStock) {
    playBeep(); 
    const item = cart.find(i => String(i.id) === String(id));
    if(item) { if(item.qty >= currentStock) return alert(`Stok sisa ${currentStock}!`); item.qty++; } 
    else { cart.push({ id: String(id), name, price, qty: 1 }); }
    renderCart(); renderKasirProducts();
}

function updateCartQty(index, delta) {
    playBeep(); 
    const item = cart[index];
    const targetProd = products.find(p => String(p.id) === String(item.id));
    if(delta > 0 && item.qty >= (targetProd ? targetProd.stock : 999)) return alert('Stok maksimal!');
    item.qty += delta; 
    
    // Hapus item dari array jika jumlahnya 0 atau ke bawah
    if(item.qty <= 0) cart.splice(index, 1);
    
    renderCart(); 
    renderKasirProducts();

    // LOGIKA AUTO-CLOSE: Jika keranjang kosong setelah dihapus, tutup otomatis laci keranjangnya
    if (cart.length === 0) {
        const cartDrawer = document.getElementById('cart-drawer');
        if (cartDrawer) cartDrawer.classList.add('translate-y-full');
    }
}

function clearCart(forceClear = false) { 
    if (!forceClear && cart.length > 0) {
        const setuju = confirm('Apakah Anda yakin ingin mengosongkan keranjang belanja?');
        if (!setuju) return; 
    }
    cart = []; 
    if(document.getElementById('pay-discount-percent')) document.getElementById('pay-discount-percent').value = ''; 
    renderCart(); 
    renderKasirProducts(); 

    // LOGIKA AUTO-CLOSE: Tutup laci juga ketika kasir sengaja menekan tombol "Kosongkan"
    const cartDrawer = document.getElementById('cart-drawer');
    if (cartDrawer) cartDrawer.classList.add('translate-y-full');
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
    document.getElementById('pay-method').value = method;
    const btnTunai = document.getElementById('btn-pay-tunai');
    const btnQris = document.getElementById('btn-pay-qris');
    const btnDebit = document.getElementById('btn-pay-debit');
    const activeStyle = "py-2 px-1 text-[11px] font-bold bg-[#059669] text-white border border-[#059669] rounded-lg shadow-sm transition text-center";
    const inactiveStyle = "py-2 px-1 text-[11px] font-bold bg-white text-gray-500 border border-gray-200 hover:bg-gray-50 rounded-lg transition text-center";
    if(btnTunai) btnTunai.className = inactiveStyle;
    if(btnQris) btnQris.className = inactiveStyle;
    if(btnDebit) btnDebit.className = inactiveStyle;
    if (method === 'Tunai' && btnTunai) btnTunai.className = activeStyle;
    if (method === 'QRIS' && btnQris) btnQris.className = activeStyle;
    if (method === 'Debit' && btnDebit) btnDebit.className = activeStyle;
    
    const cashInput = document.getElementById('pay-cash');
    if (cashInput) {
        if (method !== 'Tunai') { 
            cashInput.setAttribute('disabled', 'true'); 
            cashInput.classList.add('opacity-50');
        } else { 
            cashInput.value = ''; 
            cashInput.removeAttribute('disabled'); 
            cashInput.classList.remove('opacity-50');
        }
    }
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
        btnNew.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold bg-white text-emerald-600 rounded-lg shadow-sm transition leading-tight text-center";
        btnMember.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold text-gray-500 hover:text-gray-700 bg-transparent rounded-lg transition leading-tight text-center";
        conNew.classList.remove('hidden'); conMember.classList.add('hidden');
    } else {
        btnMember.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold bg-white text-emerald-600 rounded-lg shadow-sm transition leading-tight text-center";
        btnNew.className = "flex-1 py-1.5 px-1 text-[10px] sm:text-xs font-bold text-gray-500 hover:text-gray-700 bg-transparent rounded-lg transition leading-tight text-center";
        conMember.classList.remove('hidden'); conNew.classList.add('hidden');
        renderCustomerList();
    }
}

function renderCustomerList() {
    const selectEl = document.getElementById('pay-customer-member');
    if (!selectEl) return;
    selectEl.innerHTML = '<option value="">-- Klik untuk memilih --</option>';
    savedCustomersArray.forEach(c => {
        let phoneStr = String(c.phone || '');
        const phoneSuffix = (phoneStr && phoneStr !== '-') ? ` (${phoneStr})` : '';
        selectEl.innerHTML += `<option value="${c.name}">${c.name}${phoneSuffix}</option>`;
    });
}

// 1. Update fungsi render untuk membaca dari node 'customers'
async function renderPromoCustomers() {
    const container = document.getElementById('promo-customer-list');
    if (!container) return;
    
    // Ambil data langsung dari Firebase node 'customers'
    const snap = await db.ref('customers').once('value');
    let customersList = [];
    if (snap.exists()) {
        snap.forEach(child => {
            customersList.push({ key: child.key, ...child.val() });
        });
    }

    const search = document.getElementById('search-promo-customer').value.toLowerCase();
    const filtered = customersList.filter(u => u.name.toLowerCase().includes(search));

    container.innerHTML = filtered.length === 0 ? '<div class="text-center text-xs text-gray-400 py-6">Belum ada member terdaftar.</div>' : '';
    
    filtered.forEach(c => {
        container.innerHTML += `
            <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
                <div>
                    <h4 class="font-bold text-gray-800 text-sm">${c.name}</h4>
                    <p class="text-[10px] text-gray-500 font-mono"><i class="fa-solid fa-phone mr-1"></i>${c.phone || '-'}</p>
                </div>
                <div class="flex gap-2">
                    <button onclick="editPromoCustomer('${c.key}')" class="bg-blue-50 text-blue-600 px-3 py-2 rounded-lg text-xs font-bold transition">Edit</button>
                    <button onclick="sendWaPromo('${c.phone}', '${c.name.replace(/'/g, "\\'")}')" class="bg-emerald-500 text-white px-3 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5">
                        <i class="fa-brands fa-whatsapp"></i> Promo
                    </button>
                </div>
            </div>`;
    });
}

// 2. Tambahkan fungsi Edit
function editPromoCustomer(key) {
    // Kita ambil data dari 'customers' atau gunakan data dari list
    db.ref('customers/' + key).once('value', (snap) => {
        const c = snap.val();
        document.getElementById('edit-cust-key').value = key;
        document.getElementById('edit-cust-name').value = c.name;
        document.getElementById('edit-cust-phone').value = c.phone || '';
        document.getElementById('promo-edit-modal').classList.remove('hidden');
    });
}

async function savePromoCustomer() {
    const key = document.getElementById('edit-cust-key').value;
    const name = document.getElementById('edit-cust-name').value.trim();
    const phone = document.getElementById('edit-cust-phone').value.trim() || '-';
    
    try {
        if (key !== name) {
            await db.ref('customers/' + key).remove();
        }
        await db.ref('customers/' + name).set({ name, phone });
        alert("Member berhasil diupdate!");
        document.getElementById('promo-edit-modal').classList.add('hidden');
        renderPromoCustomers();
    } catch (e) {
        alert("Gagal: " + e.message);
    }
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
    container.innerHTML = cart.length === 0 ? `<div class="text-center py-10 flex flex-col items-center justify-center opacity-50"><i class="fa-solid fa-basket-shopping text-4xl mb-2 text-gray-300"></i><p class="font-medium text-sm text-gray-500">Keranjang Kosong</p></div>` : '';
    
    let subtotal = 0;
    let totalItemsCount = 0; // Penampung untuk jumlah badge

    cart.forEach((item, index) => {
        subtotal += item.price * item.qty;
        totalItemsCount += item.qty; // Hitung akumulasi barang masuk
        
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
    
    const finalTotal = Math.max(0, subtotal - discountCalculated);
    
    if (document.getElementById('txt-subtotal')) document.getElementById('txt-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    if (document.getElementById('txt-subtotal-modal')) document.getElementById('txt-subtotal-modal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    if (document.getElementById('txt-total')) document.getElementById('txt-total').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    if (document.getElementById('txt-total-modal')) document.getElementById('txt-total-modal').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    if (document.getElementById('sidebar-total')) document.getElementById('sidebar-total').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    
    if (document.getElementById('pay-cash') && document.getElementById('pay-method').value !== 'Tunai') {
        document.getElementById('pay-cash').value = finalTotal;
    }

    // UPDATE DATA TOMBOL MELAYANG (FLOATING CART) SEKALIGUS EFEK SEMBUNYI/MUNCUL
    const floatCart = document.getElementById('floating-cart-btn');
    const floatCount = document.getElementById('floating-cart-count');
    const floatTotal = document.getElementById('floating-cart-total');
    
    if (floatCart) {
        const pageKasir = document.getElementById('page-kasir');
        const isKasirPage = pageKasir && !pageKasir.classList.contains('hidden');
        
        // Pemicu Animasi Slide Up (Muncul) atau Slide Down (Sembunyi)
        if (cart.length > 0 && isKasirPage) {
            floatCart.classList.remove('translate-y-32', 'opacity-0', 'pointer-events-none');
        } else {
            floatCart.classList.add('translate-y-32', 'opacity-0', 'pointer-events-none');
        }
    }
    
    if (floatCount) floatCount.innerText = `${totalItemsCount} Item`;
    if (floatTotal) floatTotal.innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    
    if(typeof calculateChange === 'function') calculateChange();
}

function calculateChange() {
    const totalEl = document.getElementById('txt-total-modal');
    if (!totalEl) return;
    const total = parseInt(totalEl.innerText.replace(/[^0-9]/g, '')) || 0;
    const cash = parseInt(document.getElementById('pay-cash').value) || 0;
    const change = cash - total;
    const changeEl = document.getElementById('txt-change');
    
    if (!changeEl) return;
    if (change >= 0) { 
        changeEl.innerText = `Rp ${change.toLocaleString('id-ID')}`; 
        changeEl.className = "font-bold text-amber-600 text-sm pt-2"; 
    } else { 
        changeEl.innerText = 'Kurang Uang'; 
        changeEl.className = "font-extrabold text-red-600 text-sm pt-2"; 
    }
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
    transactions.forEach(t => {
        if (/^\d+$/.test(t.id)) {
            let num = parseInt(t.id, 10);
            if (num > maxId) maxId = num;
        }
    });
    let nextId = maxId + 1;
    return String(nextId).padStart(4, '0');
}

async function processCheckout() {
    if (cart.length === 0) return alert('Keranjang masih kosong! Silakan pilih produk terlebih dahulu.');

    const total = parseInt(document.getElementById('txt-total').innerText.replace(/[^0-9]/g, '')) || 0;
    const method = document.getElementById('pay-method').value;
    const cashInputEl = document.getElementById('pay-cash');
    const cashInputStr = cashInputEl.value.trim();

    if (method === 'Tunai' && cashInputStr === '') {
        cashInputEl.focus(); 
        return alert('Kolom uang bayar masih kosong! Mohon isi nominal uang yang diterima.');
    }

    const cash = parseInt(cashInputStr) || 0;
    if (cash < total) {
        cashInputEl.focus();
        return alert('Nominal uang bayar kurang dari total tagihan!');
    }
    
    let customer = ''; 
    let phone = '';

    if (customerMode === 'new') {
        const customerInputEl = document.getElementById('pay-customer-new');
        customer = customerInputEl.value.trim();
        if (customer === '') {
            customerInputEl.focus(); 
            return alert('Nama pelanggan wajib diisi! (Ketik "Umum" jika pelanggan menolak sebut nama)');
        }
        phone = document.getElementById('pay-phone-new').value.trim();
    } else {
        customer = document.getElementById('pay-customer-member').value;
        if (!customer) return alert('Silakan pilih nama member dari daftar terlebih dahulu!');
        const matchedTrx = transactions.find(t => t.customer === customer && t.phone);
        if (matchedTrx) phone = matchedTrx.phone;
    }
    
    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountInput = parseInt(document.getElementById('pay-discount-percent').value) || 0;
    let discount = 0; 
    if (discountInput > 0 && discountInput <= 100) discount = Math.round((discountInput / 100) * subtotal);

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

    // 1. Kurangi Stok
    cart.forEach(cartItem => {
        const prod = products.find(p => String(p.id) === String(cartItem.id));
        if (prod) prod.stock = Math.max(0, (prod.stock || 0) - cartItem.qty);
    });
    
    transactions.unshift(transactionData); 
    renderAllUI(); 
    openInvoiceModal(transactionData); 
    
    clearCart(true); 
    setCustomerMode('new');
    renderCustomerList();
    
    showToast('Menyinkronkan nota ke database...', 'loading');
    
    // 2. Simpan Transaksi ke Firebase
 try {
        await db.ref('transactions/' + transactionData.id).set(transactionData);
        showToast('Nota berhasil diamankan ke Database!', 'success');
        playSuccessSound();
        transactionData.items.forEach(soldItem => {
            const prod = products.find(p => String(p.id) === String(soldItem.id));
            if (prod) { db.ref('products/' + prod.id).update({ stock: prod.stock }); }
        });
    } catch (e) { 
        console.error("Gagal simpan transaksi:", e); 
        showToast('Gagal sinkronisasi transaksi.', 'error'); 
    }

// 3. SIMPAN PELANGGAN (VERSI DEBUGGING)
    if (customer && customer.trim().toLowerCase() !== 'umum') {
        // Sanitasi nama: Firebase tidak mengizinkan karakter . # $ [ ] /
        // Kita ubah karakter tersebut menjadi "_"
        const cleanName = customer.trim().replace(/[.#$[\]/]/g, "_");
        
        try {
            // Kita coba tulis data ke Firebase
            await db.ref('customers/' + cleanName).set({
                name: customer.trim(),
                phone: phone || '-'
            });
            
            console.log("Berhasil simpan ke: customers/" + cleanName);
            renderCustomerList(); 
        } catch (err) {
            console.error("Gagal simpan:", err);
            // KITA PAKAI ALERT SUPAYA ANDA TAHU PESAN ERRORNYA
            alert("Gagal simpan pelanggan ke Database: " + err.message);
        }
    }
}
function renderStrukList() {
    const container = document.getElementById('struk-list');
    if (!container) return;

    // Logika Pencarian
    const searchInput = document.getElementById('search-struk');
    const search = searchInput ? searchInput.value.toLowerCase() : '';

    const filteredTrx = transactions.filter(t => {
        const idMatch = t.id && t.id.toLowerCase().includes(search);
        const custMatch = t.customer && t.customer.toLowerCase().includes(search);
        const dateMatch = t.date && t.date.toLowerCase().includes(search);
        return idMatch || custMatch || dateMatch;
    });

    if (filteredTrx.length === 0) {
        container.innerHTML = '<div class="text-center text-sm text-gray-400 py-10 flex flex-col items-center"><i class="fa-solid fa-file-invoice text-4xl mb-3 opacity-30"></i>Data nota tidak ditemukan.</div>';
        return;
    }
    
    let htmlBuffer = '';
    filteredTrx.forEach(t => {
        let subtotal = 0;
        const itemsArray = Array.isArray(t.items) ? t.items : [];
        itemsArray.forEach(i => subtotal += (i.price * i.qty));
        
        let discountPercent = subtotal > 0 && t.discount > 0 ? Math.round((t.discount / subtotal) * 100) : 0;
        
        // Rincian Item (Tanpa background/div tambahan)
        let itemsHtml = itemsArray.map(i => `
            <div class="flex justify-between items-start text-xs text-gray-600 mb-1.5">
                <div class="flex-1 pr-2">
                    <span class="font-bold text-gray-800">${i.name}</span>
                    <span class="text-[10px] text-gray-400 block mt-0.5">${i.qty} x Rp ${parseInt(i.price).toLocaleString('id-ID')}</span>
                </div>
                <span class="font-bold text-gray-800 mt-0.5">Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
            </div>`).join('');
            
        const discHtml = t.discount > 0 ? `
            <div class="flex justify-between items-center text-xs text-red-500 mt-2 border-t border-dashed border-gray-200 pt-2">
                <span class="font-bold">Diskon (${discountPercent}%)</span>
                <span class="font-black">- Rp ${t.discount.toLocaleString('id-ID')}</span>
            </div>` : '';
            
        // Warna lencana (badge) disesuaikan tipe pembayaran
        const badgeColor = t.method.toLowerCase() === 'tunai' || t.method.toLowerCase() === 'cash' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                          (t.method.toLowerCase() === 'qris' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-amber-50 text-amber-600 border-amber-100');
        
        htmlBuffer += `
            <div class="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm mb-4 transition-all hover:shadow-md hover:border-emerald-200">
                
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                            <span class="font-black text-sm text-gray-800">#${t.id}</span>
                            <span class="px-2 py-0.5 rounded text-[9px] font-bold border uppercase tracking-wide ${badgeColor}">${t.method}</span>
                            <span class="px-2 py-0.5 rounded text-[9px] font-bold border bg-gray-50 text-gray-500 border-gray-200 uppercase">${t.orderType || 'Dine In'}</span>
                        </div>
                        <div class="text-[10px] text-gray-400 font-medium">
                            <i class="fa-regular fa-calendar-check mr-1"></i> ${t.date}
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center font-black shrink-0 text-xs">
                        <i class="fa-solid fa-user"></i>
                    </div>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-gray-800 truncate">${t.customer}</p>
                        <p class="text-[10px] text-gray-400 font-mono"><i class="fa-brands fa-whatsapp mr-1 text-emerald-500"></i> ${t.phone || '-'}</p>
                    </div>
                </div>

                <div class="py-3 border-t border-b border-dashed border-gray-200 mb-3">
                    ${itemsHtml}
                    ${discHtml}
                </div>

                <div class="flex justify-between items-center">
                    <div>
                        <span class="block text-[9px] text-gray-400 font-bold uppercase tracking-wider mb-0.5">Total Bayar</span>
                        <span class="font-black text-lg text-emerald-600 leading-none block">Rp ${(parseInt(t.total)||0).toLocaleString('id-ID')}</span>
                    </div>
                    <button onclick="openInvoiceModalById('${t.id}')" class="bg-gray-800 hover:bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold shadow-sm transition-colors active:scale-95 flex items-center gap-2">
                        <i class="fa-solid fa-print"></i> Cetak
                    </button>
                </div>

            </div>`;
    });
    container.innerHTML = htmlBuffer;
}

// ------------------------------------------------------------------------
// FITUR KEUANGAN KASIR (UPGRADED)
// ------------------------------------------------------------------------
function setFinanceFilter(type) {
    currentFinanceFilter = type;
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.className = "filter-btn text-sm bg-white text-gray-500 font-bold py-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition";
    });
    document.getElementById(`btn-flt-${type}`).className = "filter-btn text-sm bg-emerald-600 text-white font-bold py-3 rounded-xl border border-emerald-600 transition";
    document.getElementById('custom-date-container').classList.toggle('hidden', type !== 'custom');
    calculateFinancials();
}

function switchCashierListTab(tab) {
    const btnIn = document.getElementById('btn-cashier-pemasukan');
    const btnOut = document.getElementById('btn-cashier-pengeluaran');
    const listIn = document.getElementById('cashier-list-pemasukan');
    const listOut = document.getElementById('cashier-list-pengeluaran');

    if(!btnIn || !btnOut || !listIn || !listOut) return;

    if(tab === 'pemasukan') {
        btnIn.className = "px-2.5 py-1 text-[9px] font-bold rounded-md bg-white text-emerald-600 shadow-xs transition";
        btnOut.className = "px-2.5 py-1 text-[9px] font-bold rounded-md text-gray-400 hover:text-orange-500 transition";
        listIn.classList.remove('hidden');
        listOut.classList.add('hidden');
    } else {
        btnOut.className = "px-2.5 py-1 text-[9px] font-bold rounded-md bg-white text-orange-600 shadow-xs transition";
        btnIn.className = "px-2.5 py-1 text-[9px] font-bold rounded-md text-gray-400 hover:text-emerald-500 transition";
        listOut.classList.remove('hidden');
        listIn.classList.add('hidden');
    }
}

function calculateFinancials() {
    const listIn = document.getElementById('cashier-list-pemasukan');
    const listOut = document.getElementById('cashier-list-pengeluaran');
    if(!listIn || !listOut) return;

    let htmlIn = ''; let htmlOut = '';
    let totalNetto = 0; let totalDiskon = 0; let totalExpense = 0;
    let totalCash = 0; let totalQris = 0; let totalDebit = 0;
    
    const today = new Date();

    const filteredTrx = transactions.filter(t => {
        if(!t.date) return false;
        const tDateStr = t.date.split(' ')[0];
        const parts = tDateStr.split('/');
        const tDate = new Date(parts[2], parts[1] - 1, parts[0]);
        
        if (currentFinanceFilter === 'today') return tDate.getDate() === today.getDate() && tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear();
        if (currentFinanceFilter === 'month') return tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear();
        if (currentFinanceFilter === 'custom') {
            const st = document.getElementById('filter-start-date').value; const ed = document.getElementById('filter-end-date').value;
            if(!st || !ed) return true;
            return tDate >= new Date(st) && tDate <= new Date(ed);
        }
        return true;
    });

   // ==========================================
    // 1. RENDER LIST PEMASUKAN (MUTASI MASUK)
    // ==========================================
    filteredTrx.forEach(t => {
        let netto = parseInt(t.total) || 0;
        let diskon = parseInt(t.discount) || 0;
        let method = String(t.method || '').trim().toUpperCase();

        totalNetto += netto;
        totalDiskon += diskon;

        if (method === 'TUNAI' || method === 'CASH') totalCash += netto;
        else if (method === 'QRIS') totalQris += netto;
        else if (method === 'DEBIT' || method === 'TRANSFER') totalDebit += netto;
        else totalCash += netto;

        // Desain baru untuk list pemasukan
        htmlIn += `
            <div class="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm flex items-center gap-3 transition-all hover:shadow-md hover:border-emerald-200 mb-2">
                <!-- Ikon Indikator -->
                <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-black border border-emerald-100">
                    <i class="fa-solid fa-arrow-turn-down"></i>
                </div>
                
                <!-- Info Utama -->
                <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1.5 mb-0.5">
                        <span class="font-bold text-gray-800 text-sm truncate block">${t.customer || 'Umum'}</span>
                        <span class="px-1.5 py-0.5 bg-gray-50 text-gray-400 rounded text-[9px] font-bold border border-gray-200">#${t.id}</span>
                    </div>
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium truncate">
                        <span><i class="fa-regular fa-clock mr-0.5"></i> ${t.date}</span>
                        <span class="text-gray-300">•</span>
                        <span class="text-emerald-600 font-bold uppercase"><i class="fa-solid fa-wallet mr-0.5"></i> ${t.method}</span>
                    </div>
                </div>
                
                <!-- Nominal -->
                <div class="shrink-0 text-right">
                    <span class="block font-black text-emerald-600 text-sm">+ Rp ${netto.toLocaleString('id-ID')}</span>
                </div>
            </div>`;
    });

 // ==========================================
    // 2. RENDER LIST PENGELUARAN (MUTASI KELUAR)
    // ==========================================
    let expensesData = (typeof globalExpenses !== 'undefined') ? globalExpenses : [];
    const filteredExp = expensesData.filter(e => {
        if(!e.date) return false;
        const eDateStr = e.date.split(' ')[0];
        const parts = eDateStr.split('/');
        const eDate = new Date(parts[2], parts[1] - 1, parts[0]);
        
        if (currentFinanceFilter === 'today') return eDate.getDate() === today.getDate() && eDate.getMonth() === today.getMonth() && eDate.getFullYear() === today.getFullYear();
        if (currentFinanceFilter === 'month') return eDate.getMonth() === today.getMonth() && eDate.getFullYear() === today.getFullYear();
        if (currentFinanceFilter === 'custom') {
            const st = document.getElementById('filter-start-date').value; const ed = document.getElementById('filter-end-date').value;
            if(!st || !ed) return true;
            return eDate >= new Date(st) && eDate <= new Date(ed);
        }
        return true;
    });

    filteredExp.forEach(e => {
        let amt = parseInt(e.amount) || 0;
        totalExpense += amt;
        
        // Desain baru untuk list pengeluaran
        htmlOut += `
            <div class="bg-white border border-gray-100 p-3 rounded-2xl shadow-sm flex items-center gap-3 transition-all hover:shadow-md hover:border-orange-200 mb-2">
                <!-- Ikon Indikator -->
                <div class="w-10 h-10 rounded-full bg-orange-50 text-orange-500 flex items-center justify-center shrink-0 font-black border border-orange-100">
                    <i class="fa-solid fa-arrow-turn-up"></i>
                </div>
                
                <!-- Info Utama -->
                <div class="flex-1 min-w-0">
                    <div class="font-bold text-gray-800 text-sm truncate block mb-0.5">${e.description}</div>
                    <div class="flex items-center gap-1.5 text-[10px] text-gray-400 font-medium truncate">
                        <span><i class="fa-regular fa-clock mr-0.5"></i> ${e.date}</span>
                        <span class="text-gray-300">•</span>
                        <span class="text-orange-500 font-bold uppercase"><i class="fa-solid fa-money-bill-transfer mr-0.5"></i> KAS KELUAR</span>
                    </div>
                </div>
                
                <!-- Nominal -->
                <div class="shrink-0 text-right">
                    <span class="block font-black text-orange-600 text-sm">- Rp ${amt.toLocaleString('id-ID')}</span>
                </div>
            </div>`;
    });

    listIn.innerHTML = htmlIn || `<div class="text-center text-gray-400 text-xs py-6">Belum ada pemasukan.</div>`;
    listOut.innerHTML = htmlOut || `<div class="text-center text-gray-400 text-xs py-6">Belum ada pengeluaran.</div>`;

    let finalGross = totalNetto + totalDiskon;
    let cashInDrawer = totalCash - totalExpense; 

    const safeSetText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };
    
    safeSetText('cashier-total-gross', `Rp ${finalGross.toLocaleString('id-ID')}`);
    safeSetText('cashier-total-diskon', `Rp ${totalDiskon.toLocaleString('id-ID')}`);
    safeSetText('cashier-total-expense', `Rp ${totalExpense.toLocaleString('id-ID')}`);
    safeSetText('cashier-cash-in-drawer', `Rp ${cashInDrawer.toLocaleString('id-ID')}`);

    safeSetText('rep-cash-txt', `Rp ${totalCash.toLocaleString('id-ID')}`);
    safeSetText('rep-qris-txt', `Rp ${totalQris.toLocaleString('id-ID')}`);
    safeSetText('rep-debit-txt', `Rp ${totalDebit.toLocaleString('id-ID')}`);

    let totalMethods = totalCash + totalQris + totalDebit;
    const barCash = document.getElementById('bar-cash');
    const barQris = document.getElementById('bar-qris');
    const barDebit = document.getElementById('bar-debit');
    
    if(barCash) barCash.style.width = totalMethods ? `${(totalCash / totalMethods) * 100}%` : '0%';
    if(barQris) barQris.style.width = totalMethods ? `${(totalQris / totalMethods) * 100}%` : '0%';
    if(barDebit) barDebit.style.width = totalMethods ? `${(totalDebit / totalMethods) * 100}%` : '0%';
}

function exportToExcel() {
    const today = new Date();
    const filteredTrx = transactions.filter(t => {
        if(!t.date) return false;
        const parts = t.date.split(' ')[0].split('/');
        const tDate = new Date(parts[2], parts[1] - 1, parts[0]);
        
        if (currentFinanceFilter === 'today') return tDate.getDate() === today.getDate() && tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear();
        if (currentFinanceFilter === 'month') return tDate.getMonth() === today.getMonth() && tDate.getFullYear() === today.getFullYear();
        if (currentFinanceFilter === 'custom') {
            const st = document.getElementById('filter-start-date').value; 
            const ed = document.getElementById('filter-end-date').value;
            if(!st || !ed) return true;
            return tDate >= new Date(st) && tDate <= new Date(ed);
        }
        return true;
    });

    if(filteredTrx.length === 0) return alert('Tidak ada data pada periode ini untuk diexport.');
    
    const rows = filteredTrx.map(t => ({
        "ID Transaksi": t.id, "Waktu": t.date, "Nama Pelanggan": t.customer, "No WA": t.phone || '-', "Metode Bayar": t.method,
        "Rincian Item": (Array.isArray(t.items) ? t.items : []).map(i => `${i.name} (${i.qty}x)`).join(', '), "Diskon (Rp)": parseInt(t.discount) || 0, "Omset Bersih (Rp)": parseInt(t.total) || 0
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows); const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan"); XLSX.writeFile(wb, `Laporan_Kasir_${currentFinanceFilter}.xlsx`);
}

// ------------------------------------------------------------------------
// BLUETOOTH PRINTING
// ------------------------------------------------------------------------
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

function openInvoiceModalById(trxId) {
    const trx = transactions.find(t => t.id === trxId);
    if (!trx) return alert("Data transaksi tidak ditemukan!");
    openInvoiceModal(trx);
}

function openInvoiceModal(trx) {
    let sub = 0;
    
    let html = `
        <div class="text-center font-black text-sm mb-1 tracking-wider">LINK NEO MEAL</div>
        <div class="border-t-[1.5px] border-dashed border-gray-800 my-2"></div>
        <div class="grid grid-cols-[70px_1fr] gap-1 text-[11px] text-gray-700">
            <div class="text-gray-500">ID</div><div class="font-bold">: ${trx.id}</div>
            <div class="text-gray-500">Waktu</div><div class="font-bold">: ${trx.date}</div>
            <div class="text-gray-500">Kasir</div><div class="font-bold">: ${trx.cashier}</div>
            <div class="text-gray-500">Tipe</div><div class="font-bold">: ${trx.orderType || 'Dine In'}</div>
        </div>
        <div class="border-t border-dashed border-gray-400 my-2"></div>
    `;
    
    trx.items.forEach(i => {
        sub += (i.price * i.qty);
        html += `
            <div class="text-[11px] mb-2">
                <div class="font-bold text-gray-800">${i.name}</div>
                <div class="flex justify-between text-gray-600">
                    <span>${i.qty} x Rp ${parseInt(i.price).toLocaleString('id-ID')}</span>
                    <span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
                </div>
            </div>`;
    });
    
    html += `<div class="border-t border-dashed border-gray-400 my-2"></div>`;
    html += `<div class="flex justify-between text-[11px] text-gray-600"><span>Subtotal</span><span>Rp ${sub.toLocaleString('id-ID')}</span></div>`;
    
    if (trx.discount > 0) {
        html += `<div class="flex justify-between text-[11px] text-red-600 font-bold"><span>Diskon</span><span>-Rp ${trx.discount.toLocaleString('id-ID')}</span></div>`;
    }
    
    html += `
        <div class="flex justify-between font-black text-[13px] text-gray-900 mt-2 border-t border-gray-800 pt-2">
            <span>TOTAL</span>
            <span>Rp ${(parseInt(trx.total)||0).toLocaleString('id-ID')}</span>
        </div>
    `;
    
    html += `
        <div class="mt-2 space-y-0.5 text-[11px] text-gray-700">
            <div class="flex justify-between"><span>Bayar (${trx.method})</span><span>Rp ${parseInt(trx.cash||0).toLocaleString('id-ID')}</span></div>
            <div class="flex justify-between font-bold text-emerald-700"><span>Kembali</span><span>Rp ${parseInt(trx.change||0).toLocaleString('id-ID')}</span></div>
        </div>
    `;
    
    html += `
        <div class="border-t border-dashed border-gray-400 my-3"></div>
        <div class="text-center italic text-[10px] text-gray-500 px-2">"${trx.quote || 'Terima kasih atas kunjungan Anda'}"</div>
        <div class="border-t-[1.5px] border-dashed border-gray-800 my-2"></div>
    `;

    document.getElementById('receipt-preview-container').innerHTML = html;
    
    const btnPrint = document.getElementById('modal-btn-thermal');
    if(btnPrint) {
        btnPrint.onclick = async function() { 
            const originalText = btnPrint.innerHTML;
            btnPrint.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Sedang Mencetak...`;
            btnPrint.disabled = true;
            await printThermal(trx.id); 
            btnPrint.innerHTML = originalText;
            btnPrint.disabled = false;
        };
    }
    document.getElementById('invoice-modal').classList.remove('hidden');
}

function closeInvoiceModal() {
    document.getElementById('invoice-modal').classList.add('hidden');
}

async function printThermal(trxId) {
    const trx = transactions.find(t => t.id === trxId); 
    if (!trx) return;
    
    if (!navigator.bluetooth) return alert("Peringatan: Browser tidak mendukung Bluetooth Web.");
    
    if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) { 
        try { const conn = await connectBluetooth(); if (!conn) return; } catch (e) { return; }
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
            if (bleCharacteristic.properties.writeWithoutResponse) await bleCharacteristic.writeValueWithoutResponse(b); 
            else await bleCharacteristic.writeValue(b); 
            await new Promise(r => setTimeout(r, 50)); 
        };
        
        await w(I); await w(C); await w(B1); await w("LINK NEO MEAL\n"); 
        await w(B0); await w("--------------------------------\n"); 
        await w(L);
        await w(`ID    : ${trx.id}\n`); await w(`Waktu : ${trx.date}\n`); await w(`Kasir : ${trx.cashier}\n`); await w(`Tipe  : ${trx.orderType || 'Dine In'}\n`);
        await w("--------------------------------\n");
        
        let sub = 0;
        for (const i of (Array.isArray(trx.items) ? trx.items : [])) {
            await w(`${i.name}\n`); 
            sub += (i.price * i.qty);
            let d = `${i.qty} x Rp ${parseInt(i.price).toLocaleString('id-ID')}`; 
            let s = `Rp ${(i.price * i.qty).toLocaleString('id-ID')}`;
            let space = " ".repeat(Math.max(1, 32 - (d.length + s.length)));
            await w(d + space + s + "\n");
        }
        await w("--------------------------------\n");
        
        let subTxt = `Rp ${sub.toLocaleString('id-ID')}`;
        await w("Subtotal" + " ".repeat(32 - (8 + subTxt.length)) + subTxt + "\n");
        
        if (trx.discount > 0) {
            let dTxt = `-Rp ${trx.discount.toLocaleString('id-ID')}`;
            await w("Diskon" + " ".repeat(32 - (6 + dTxt.length)) + dTxt + "\n");
        }
        
        await w(B1); 
        let tTxt = `Rp ${(parseInt(trx.total)||0).toLocaleString('id-ID')}`; 
        await w("TOTAL" + " ".repeat(32 - (5 + tTxt.length)) + tTxt + "\n"); 
        await w(B0);
        
        let bTxt = `Rp ${parseInt(trx.cash||0).toLocaleString('id-ID')}`;
        await w(`Bayar (${trx.method})` + " ".repeat(Math.max(1, 32 - (13 + bTxt.length))) + bTxt + "\n"); 
        
        let kTxt = `Rp ${parseInt(trx.change||0).toLocaleString('id-ID')}`;
        await w("Kembali" + " ".repeat(32 - (7 + kTxt.length)) + kTxt + "\n");
        
        await w("--------------------------------\n"); await w(C); await w(`"${trx.quote || 'Terima kasih'}"\n`); 
        for (let f = 0; f < 4; f++) await w(LF);
        
    } catch (err) { 
        console.error(err); alert("Printer error. Pastikan printer menyala."); 
    }
}

async function printRecapThermal(recap) {
    if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) throw new Error("Printer tidak terhubung");
    
    const enc = new TextEncoder('utf-8'); 
    const I = new Uint8Array([27, 64]); const C = new Uint8Array([27, 97, 1]); const L = new Uint8Array([27, 97, 0]); 
    const B1 = new Uint8Array([27, 69, 1]); const B0 = new Uint8Array([27, 69, 0]); const LF = new Uint8Array([10]); 
    
    const w = async (t) => { 
        const b = typeof t === 'string' ? enc.encode(t) : t; 
        if (bleCharacteristic.properties.writeWithoutResponse) await bleCharacteristic.writeValueWithoutResponse(b); 
        else await bleCharacteristic.writeValue(b); 
        await new Promise(r => setTimeout(r, 50)); 
    };
    
    await w(I); await w(C); await w(B1); await w("REKAP CLOSING SHIFT\n"); await w("LINK NEO MEAL\n"); await w(B0); 
    await w("================================\n"); await w(L);
    await w(`Kasir  : ${recap.kasir}\n`); await w(`Waktu  : ${recap.waktu}\n`); 
    await w("--------------------------------\n");
    await w(B1); 
    
    let tNota = `${recap.totalNota}\n`; await w("Total Nota : " + " ".repeat(Math.max(1, 32 - (13 + tNota.length - 1))) + tNota); 
    let tOmset = `Rp ${parseInt(recap.omset).toLocaleString('id-ID')}\n`; await w("TOTAL OMSET: " + " ".repeat(Math.max(1, 32 - (13 + tOmset.length - 1))) + tOmset); 
    await w(B0);
    
    await w("--------------------------------\n"); await w("Rincian Pembayaran:\n");
    let tTunai = `Rp ${parseInt(recap.tunai).toLocaleString('id-ID')}\n`; await w("Tunai  : " + " ".repeat(Math.max(1, 32 - (9 + tTunai.length - 1))) + tTunai); 
    let tQris = `Rp ${parseInt(recap.qris).toLocaleString('id-ID')}\n`; await w("QRIS   : " + " ".repeat(Math.max(1, 32 - (9 + tQris.length - 1))) + tQris); 
    let tDebit = `Rp ${parseInt(recap.debit).toLocaleString('id-ID')}\n`; await w("Debit  : " + " ".repeat(Math.max(1, 32 - (9 + tDebit.length - 1))) + tDebit); 
    
    await w("================================\n"); await w(C); await w("Harap setorkan uang fisik\n"); await w("sesuai dengan rincian Tunai.\n"); await w("================================\n");
    for (let f = 0; f < 4; f++) await w(LF);
}

async function manualPrintClosing() {
    try {
        const recap = calculateShiftRecap();
        if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) { 
            const setuju = confirm("Printer belum terhubung! Ingin menghubungkan printer sekarang?");
            if (!setuju) return;
            const conn = await connectBluetooth(); 
            if (!conn) return alert("Koneksi gagal! Pastikan printer bluetooth menyala.");
        }

        const btn = document.getElementById('btn-print-closing');
        let originalText = "";
        if (btn) {
            originalText = btn.innerHTML;
            btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Mencetak...`;
            btn.disabled = true;
        }

        await printRecapThermal(recap);
        showToast("Rekap closing berhasil dicetak ke printer!", "success");

        if (btn) { btn.innerHTML = originalText; btn.disabled = false; }
    } catch (e) {
        console.error("Gagal cetak rekap:", e);
        alert("Gagal mencetak. Coba muat ulang (Refresh) halaman dan pastikan printer menyala.");
        const btn = document.getElementById('btn-print-closing');
        if (btn) { btn.innerHTML = `<i class="fa-solid fa-print"></i> Print Rekap`; btn.disabled = false; }
    }
}

// ------------------------------------------------------------------------
// MANAJEMEN MODAL & LAIN-LAIN
// ------------------------------------------------------------------------
setInterval(() => {
    const sidebarTotalEl = document.getElementById('txt-total');
    const sidebarSubtotalEl = document.getElementById('txt-subtotal');
    const modalTotalEl = document.getElementById('txt-total-modal');
    const modalSubtotalEl = document.getElementById('txt-subtotal-modal');
    
    if(sidebarTotalEl && modalTotalEl) modalTotalEl.innerText = sidebarTotalEl.innerText;
    if(sidebarSubtotalEl && modalSubtotalEl) modalSubtotalEl.innerText = sidebarSubtotalEl.innerText;
}, 300);

function openPaymentModal() {
    if (typeof cart !== 'undefined' && cart.length === 0) return alert('Keranjang masih kosong!');
    document.getElementById('payment-modal').classList.remove('hidden');
}

function closePaymentModal() { document.getElementById('payment-modal').classList.add('hidden'); }

async function handleModalCheckout() {
    const isMemberMode = document.getElementById('btn-mode-member').classList.contains('bg-white'); 
    let customerName = "";

    if (isMemberMode) {
        const memberSelect = document.getElementById('pay-customer-member');
        customerName = memberSelect.value;
        if (!customerName) {
            alert("⚠️ Silakan pilih nama member!");
            memberSelect.focus();
            return;
        }
    } else {
        const nameInput = document.getElementById('pay-customer-new');
        customerName = nameInput.value ? nameInput.value.trim() : "";
        if (!customerName) {
            alert("⚠️ Mohon isi Nama Pelanggan!");
            nameInput.focus();
            return;
        }
    }

    const activeCashier = document.getElementById('active-cashier-name') ? document.getElementById('active-cashier-name').innerText : "Kasir";
    const total = parseInt(document.getElementById('txt-total-modal').innerText.replace(/[^0-9]/g, '')) || 0;
    
    const newTrx = {
        id: generateNextTrxId(),
        date: getFormattedDate(),
        cashier: activeCashier,
        customer: customerName,
        items: [...cart],
        total: total,
        discount: parseInt(document.getElementById('pay-discount-percent').value) || 0,
        cash: parseInt(document.getElementById('pay-cash').value) || 0,
        change: parseInt(document.getElementById('txt-change').innerText.replace(/[^0-9]/g, '')) || 0,
        method: document.getElementById('pay-method').value,
        quote: getRandomQuote(),
        orderType: currentOrderType
    };

    try {
        // 1. Simpan Transaksi
        await db.ref('transactions/' + newTrx.id).set(newTrx);
        
        // 2. Update Stok
        cart.forEach(item => {
            const p = products.find(prod => String(prod.id) === String(item.id));
            if(p) db.ref('products/' + p.id).update({ stock: Math.max(0, (parseInt(p.stock) || 0) - item.qty) });
        });

        // 3. SIMPAN PELANGGAN (DITAMBAHKAN DI SINI)
        if (customerName && customerName.toLowerCase() !== 'umum') {
            const cleanName = customerName.trim().replace(/[.#$[\]/]/g, "_");
            await db.ref('customers/' + cleanName).set({
                name: customerName.trim(),
                phone: '-' // Jika ada input phone di modal, ganti '-' dengan phone
            });
            console.log("Member berhasil disimpan via Modal!");
        }

        openInvoiceModal(newTrx);
        clearCart(true); 
        closePaymentModal();
    } catch (err) {
        console.error(err);
        alert("Gagal memproses transaksi: " + err.message);
    }
}

function openExpenseModal() {
    const modal = document.getElementById('expense-modal');
    const content = document.getElementById('expense-modal-content');
    modal.classList.remove('hidden');
    setTimeout(() => {
        content.classList.remove('translate-y-full', 'sm:scale-95');
        document.getElementById('expense-desc').focus();
    }, 10);
}

function closeExpenseModal() {
    const content = document.getElementById('expense-modal-content');
    content.classList.add('translate-y-full', 'sm:scale-95');
    setTimeout(() => {
        document.getElementById('expense-modal').classList.add('hidden');
        document.getElementById('expense-desc').value = "";
        document.getElementById('expense-amount').value = "";
    }, 300);
}

async function saveExpense() {
    const desc = document.getElementById('expense-desc').value.trim();
    const amount = parseInt(document.getElementById('expense-amount').value);
    
    if(!desc || !amount || amount <= 0) return alert("Keterangan dan nominal valid wajib diisi!");

    const btn = document.getElementById('btn-save-expense');
    btn.disabled = true;
    btn.innerHTML = "Menyimpan...";

    const activeName = document.getElementById('active-cashier-name') ? document.getElementById('active-cashier-name').innerText : 'Umum';

    const payload = {
        id: 'EXP-' + Date.now(),
        date: getFormattedDate(), 
        description: desc,
        amount: amount,
        cashier: activeName
    };

    try {
        await db.ref('expenses/' + payload.id).set(payload);
        showToast("Pengeluaran berhasil dicatat!", "success");
        closeExpenseModal();
    } catch (e) {
        alert("Gagal mencatat pengeluaran.");
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerHTML = "Simpan Pengeluaran";
    }
}


// ==========================================================================
// PWA INSTALLATION HANDLER
// ==========================================================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Mencegah browser memunculkan pop-up default secara otomatis (opsional)
    e.preventDefault();
    
    // Simpan event agar bisa dipanggil nanti saat tombol ditekan
    deferredPrompt = e;
    
    // Tampilkan tombol install kustom kita
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) {
        installBtn.classList.remove('hidden');
    }
});

window.addEventListener('appinstalled', () => {
    // Sembunyikan tombol jika aplikasi berhasil di-install
    const installBtn = document.getElementById('btn-install-pwa');
    if (installBtn) installBtn.classList.add('hidden');
    
    // Bersihkan prompt
    deferredPrompt = null;
    console.log('PWA berhasil di-install');
});

async function installPWA() {
    if (!deferredPrompt) {
        alert("Aplikasi sudah terinstal atau browser tidak mendukung fitur ini.");
        return;
    }
    
    // Munculkan pop-up install bawaan browser
    deferredPrompt.prompt();
    
    // Tunggu respon pengguna (apakah mereka klik Install atau Cancel)
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
        console.log('User menerima instalasi PWA');
        const installBtn = document.getElementById('btn-install-pwa');
        if (installBtn) installBtn.classList.add('hidden');
    } else {
        console.log('User menolak instalasi PWA');
    }
    
    // Reset prompt karena hanya bisa dipanggil satu kali
    deferredPrompt = null;
}
