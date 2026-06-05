// ==========================================================================
// SAGEPOS PRO - LIVE SLIM EDITION (FIREBASE RTDB + PROMO + DISCOUNT)
// ==========================================================================

// 1. MASUKKAN KONFIGURASI FIREBASE KAMU DI SINI NANTI
const firebaseConfig = {
  apiKey: "AIzaSyCAvkrPfkMs4TKofAwBPIPAmSVXnAAYF2s",
  authDomain: "linkneomeal-001.firebaseapp.com",
  projectId: "linkneomeal-001",
  storageBucket: "linkneomeal-001.firebasestorage.app",
  messagingSenderId: "518165236588",
  appId: "1:518165236588:web:0606d3da403339fd620149",
  databaseURL :"https://linkneomeal-001-default-rtdb.firebaseio.com"
  };

// 2. Inisialisasi Firebase & Realtime Database
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); 

const IMGBB_API_KEY = "74a8a5c720111b4162e8e2d237aee552"; 

let products = [];
let transactions = [];
let cart = [];
let financeFilterType = 'today';
let selectedCategory = 'Semua';
let customerMode = 'new';

let bleDevice = null;
let bleCharacteristic = null;
let isConnectingBle = false;

const fallbackImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";
const genZQuotes = [
    "Mending beli ini daripada beli omong kosong dia.",
    "Beli kopi biar ga ngantuk pas digantungin dia.",
    "Uang bisa dicari, tapi produk ini kalo abis lu nangis.",
    "Work hard, belanja harder.",
    "Gpp boncos, yang penting aesthetic."
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
    renderAllUI();
    setCustomerMode('new');
    
    const imageInput = document.getElementById('prod-image-file');
    if (imageInput) imageInput.addEventListener('change', handleImageUpload);
    
    document.querySelectorAll('.nav-btn').forEach(btn => btn.style.opacity = '0.5');
    await refreshDataFromServer();
    document.querySelectorAll('.nav-btn').forEach(btn => btn.style.opacity = '1');
});

function renderAllUI() {
    renderKasirProducts();
    renderCart();
    renderProductTable();
    renderStrukList();
    renderPromoCustomers();
    renderCustomerList();
    calculateFinancials();
}

// ------------------------------------------------------------------------
// BACA DATA DARI FIREBASE (READ)
// ------------------------------------------------------------------------
async function refreshDataFromServer() {
    try {
        // Ambil data Produk dari Firebase
        const prodSnapshot = await db.ref('products').once('value');
        products = [];
        if (prodSnapshot.exists()) {
            prodSnapshot.forEach((child) => { products.push(child.val()); });
        }

        // Ambil data Transaksi dari Firebase
        const trxSnapshot = await db.ref('transactions').once('value');
        transactions = [];
        if (trxSnapshot.exists()) {
            trxSnapshot.forEach((child) => { transactions.push(child.val()); });
            // Urutkan transaksi dari yang terbaru (berdasarkan ID)
            transactions.sort((a, b) => b.id.localeCompare(a.id));
        }

        renderAllUI();
    } catch (e) {
        console.error("Gagal terhubung Firebase RTDB:", e);
    }
}

// ------------------------------------------------------------------------
// NAVIGASI MENU
// ------------------------------------------------------------------------
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

// ------------------------------------------------------------------------
// AUTO UPLOAD IMGBB
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
            statusEl.className = "text-[11px] text-sage-600 font-bold";
            statusEl.innerHTML = `<i class="fa-solid fa-circle-check mr-1"></i> Gambar terunggah!`;
        } else { throw new Error(result.error.message); }
    } catch (error) {
        statusEl.className = "text-[11px] text-red-600 font-bold";
        statusEl.innerHTML = `<i class="fa-solid fa-circle-xmark mr-1"></i> Gagal unggah gambar.`;
    } finally {
        btnSubmit.removeAttribute('disabled');
    }
}

// ------------------------------------------------------------------------
// CRUD PRODUK (FIREBASE)
// ------------------------------------------------------------------------
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
        // Simpan produk ke Firebase
        await db.ref('products/' + payload.id).set(payload);
        showToast('Produk berhasil disimpan!', 'success');
        resetProductForm(); 
        await refreshDataFromServer(); 
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
        // Hapus produk dari Firebase
        await db.ref('products/' + id).remove();
        showToast('Produk berhasil dihapus!', 'success');
        await refreshDataFromServer();
    } catch(e) { 
        console.error(e); 
        showToast('Gagal menghapus produk.', 'error');
    } finally { 
        document.body.style.cursor = 'default'; 
    }
}

function resetProductForm() {
    document.getElementById('product-form').reset(); 
    document.getElementById('prod-id').value = '';
    document.getElementById('prod-image-url').value = ''; 
    document.getElementById('upload-status').classList.add('hidden');
    document.getElementById('btn-submit-product').innerText = 'Simpan'; 
    document.getElementById('btn-cancel-edit').classList.add('hidden');
}

// ------------------------------------------------------------------------
// KASIR & KERANJANG
// ------------------------------------------------------------------------
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

    if(filtered.length === 0) { grid.innerHTML = `<p class="col-span-2 text-center text-gray-400 text-sm py-8">Produk Kosong</p>`; return; }

    filtered.forEach(p => {
        const cartItem = cart.find(i => String(i.id) === String(p.id));
        const qtyPicked = cartItem ? cartItem.qty : 0;
        const isOut = (parseInt(p.stock) || 0) <= 0;

        // Desain Full Hijau (Sage) dengan border tipis dan animasi melayang
        let borderStyle = isOut 
            ? 'opacity-50 border-sage-200 bg-sage-50/50 pointer-events-none' 
            : (qtyPicked > 0 
                ? 'border-sage-200 bg-sage-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 ease-in-out' 
                : 'border-sage-200 bg-white hover:bg-sage-50 hover:shadow-md hover:-translate-y-1 transition-all duration-300 ease-in-out');

        const badgeHtml = qtyPicked > 0 ? `<div class="absolute top-2 right-2 bg-sage-600 text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-sm z-10">${qtyPicked}</div>` : '';
        const stockLabelHtml = isOut ? `<span class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-md font-black">HABIS</span>` : `<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-semibold">Stok: ${p.stock || 0}</span>`;

        grid.innerHTML += `
            <div onclick="addToCart('${p.id}', '${p.name.replace(/'/g, "\\'")}', ${p.price}, ${p.stock || 0})" class="relative border rounded-2xl p-2.5 cursor-pointer flex flex-col justify-between active:scale-95 overflow-hidden ${borderStyle}">
                ${badgeHtml}
                <img src="${p.image || fallbackImage}" class="product-card-img mb-2 shadow-inner rounded-xl ${isOut ? 'grayscale contrast-75' : ''}">
                <div class="px-0.5 space-y-1">
                    <span class="font-bold text-xs ${isOut ? 'text-gray-400 line-through' : 'text-gray-800'} line-clamp-2 min-h-[32px]">${p.name}</span>
                    <div class="flex justify-between items-center pt-0.5">
                        <span class="${isOut ? 'text-gray-400 font-bold' : 'text-sage-700 font-extrabold'} text-sm">Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}</span>
                        ${stockLabelHtml}
                    </div>
                </div>
            </div>`;
    });
}

function addToCart(id, name, price, currentStock) {
    const item = cart.find(i => String(i.id) === String(id));
    if(item) { if(item.qty >= currentStock) return alert(`Stok sisa ${currentStock}!`); item.qty++; } 
    else { cart.push({ id: String(id), name, price, qty: 1 }); }
    renderCart(); renderKasirProducts();
}

function updateCartQty(index, delta) {
    const item = cart[index];
    const targetProd = products.find(p => String(p.id) === String(item.id));
    if(delta > 0 && item.qty >= (targetProd ? targetProd.stock : 999)) return alert('Stok maksimal!');
    item.qty += delta; 
    if(item.qty <= 0) cart.splice(index, 1);
    renderCart(); renderKasirProducts();
}

function clearCart() { cart = []; document.getElementById('pay-discount-percent').value = ''; renderCart(); renderKasirProducts(); }

function handleMethodChange() {
    const method = document.getElementById('pay-method').value;
    const cashInput = document.getElementById('pay-cash');
    if (method !== 'Tunai') { cashInput.setAttribute('disabled', 'true'); } 
    else { cashInput.value = ''; cashInput.removeAttribute('disabled'); }
    renderCart();
}

// ------------------------------------------------------------------------
// PELANGGAN & PROMO WA
// ------------------------------------------------------------------------
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
    let seen = new Set();
    transactions.forEach(t => {
        if (t.customer && t.customer.toLowerCase() !== 'umum' && t.customer.toLowerCase() !== 'baru' && !seen.has(t.customer.toLowerCase())) {
            seen.add(t.customer.toLowerCase());
            let phoneStr = String(t.phone || '');
            const phoneSuffix = phoneStr.length > 4 ? ` (${phoneStr})` : '';
            selectEl.innerHTML += `<option value="${t.customer}">${t.customer}${phoneSuffix}</option>`;
        }
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
            if(p.length > 5 && !seen.has(p)) { 
                seen.add(p); 
                unique.push({name: t.customer, phone: p}); 
            }
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

// ------------------------------------------------------------------------
// CHECKOUT & CALCULATIONS
// ------------------------------------------------------------------------
function renderCart() {
    const container = document.getElementById('cart-items');
    if (!container) return;
    container.innerHTML = cart.length === 0 ? `<div class="text-center py-6 text-gray-400 font-medium text-sm">Keranjang Kosong</div>` : '';
    let subtotal = 0;
    
    cart.forEach((item, index) => {
        subtotal += item.price * item.qty;
        container.innerHTML += `
            <div class="flex justify-between items-center text-sm bg-gray-50 border border-gray-100 p-2 rounded-2xl shadow-2xs">
                <div class="flex-1 min-w-0 pr-2">
                    <h4 class="font-bold text-gray-800 truncate">${item.name}</h4>
                    <span class="text-xs font-semibold text-sage-600">Rp ${item.price.toLocaleString('id-ID')}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="updateCartQty(${index}, -1)" class="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-700 font-black">-</button>
                    <span class="w-5 text-center font-bold text-gray-800">${item.qty}</span>
                    <button onclick="updateCartQty(${index}, 1)" class="w-6 h-6 rounded-lg bg-white border border-gray-200 text-gray-700 font-black">+</button>
                </div>
                <span class="w-20 text-right font-black text-gray-700">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
            </div>`;
    });

    const discountInput = parseInt(document.getElementById('pay-discount-percent').value) || 0;
    let discountCalculated = 0;
    
    if (discountInput > 0 && discountInput <= 100) {
        discountCalculated = Math.round((discountInput / 100) * subtotal);
        document.getElementById('txt-discount-display').innerText = `- Rp ${discountCalculated.toLocaleString('id-ID')}`;
        document.getElementById('div-discount').classList.remove('hidden');
    } else { document.getElementById('div-discount').classList.add('hidden'); }

    const finalTotal = Math.max(0, subtotal - discountCalculated);
    document.getElementById('txt-subtotal').innerText = `Rp ${subtotal.toLocaleString('id-ID')}`;
    document.getElementById('txt-total').innerText = `Rp ${finalTotal.toLocaleString('id-ID')}`;
    
    if(document.getElementById('pay-method').value !== 'Tunai') document.getElementById('pay-cash').value = finalTotal;
    calculateChange();
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

// ========================================================================
// SISTEM NOTIFIKASI MELAYANG (TOAST ALERT)
// ========================================================================
function showToast(message, type = 'info') {
    let toast = document.getElementById('pos-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'pos-toast';
        document.body.appendChild(toast);
    }
    
    toast.style.opacity = '1';
    toast.style.transform = 'translate(-50%, 0)';

    if (type === 'loading') {
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all duration-300 flex items-center gap-2 bg-blue-500 text-white';
        toast.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> ${message}`;
    } else if (type === 'success') {
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all duration-300 flex items-center gap-2 bg-emerald-500 text-white';
        toast.innerHTML = `<i class="fa-solid fa-check-circle"></i> ${message}`;
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, -20px)'; }, 3000);
    } else if (type === 'error') {
        toast.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 z-[100] px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg transition-all duration-300 flex items-center gap-2 bg-red-500 text-white';
        toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${message}`;
        setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translate(-50%, -20px)'; }, 4000);
    }
}

// ========================================================================
// PROSES CHECKOUT INSTAN (FIREBASE)
// ========================================================================
async function processCheckout() {
    if(cart.length === 0) return alert('Keranjang kosong!');
    const total = parseInt(document.getElementById('txt-total').innerText.replace(/[^0-9]/g, '')) || 0;
    const cash = parseInt(document.getElementById('pay-cash').value) || 0;
    if (cash < total) return alert('Uang bayar kurang!');

    let customer = 'Umum'; let phone = '';
    if (customerMode === 'new') {
        customer = document.getElementById('pay-customer-new').value.trim() || 'Umum';
        phone = document.getElementById('pay-phone-new').value.trim();
    } else {
        customer = document.getElementById('pay-customer-member').value;
        if (!customer) return alert('Pilih member terlebih dahulu!');
        const matchedTrx = transactions.find(t => t.customer === customer && t.phone);
        if (matchedTrx) phone = matchedTrx.phone;
    }

    let subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    const discountInput = parseInt(document.getElementById('pay-discount-percent').value) || 0;
    let discount = 0; if (discountInput > 0 && discountInput <= 100) discount = Math.round((discountInput / 100) * subtotal);

    const transactionData = {
        id: 'TRX-' + Date.now(), date: getFormattedDate(), customer, phone, method: document.getElementById('pay-method').value, 
        items: [...cart], discount, total, cash, change: cash - total, cashier: "Kasir Utama", quote: getRandomQuote()
    };

    // 1. UPDATE UI LOKAL INSTAN
    cart.forEach(cartItem => {
        const prod = products.find(p => String(p.id) === String(cartItem.id));
        if (prod) prod.stock = Math.max(0, (prod.stock || 0) - cartItem.qty);
    });
    transactions.unshift(transactionData); 
    
    renderAllUI(); 
    openInvoiceModal(transactionData); 
    clearCart(); 
    setCustomerMode('new');

    // 2. PROSES BACKGROUND SYNC KE FIREBASE
    showToast('Menyinkronkan nota ke database...', 'loading');

    // Simpan nota ke Firebase
    db.ref('transactions/' + transactionData.id).set(transactionData)
    .then(() => {
        showToast('Nota berhasil diamankan ke Database!', 'success');
        
        // Update stok produk yang terjual di Firebase
        cart.forEach(cartItem => {
            const prod = products.find(p => String(p.id) === String(cartItem.id));
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

// ------------------------------------------------------------------------
// MODAL NOTA & STRUK
// ------------------------------------------------------------------------
function openInvoiceModal(trx) {
    document.getElementById('modal-trx-id').innerText = trx.id;
    document.getElementById('modal-trx-date').innerText = trx.date;
    document.getElementById('modal-trx-customer').innerText = trx.customer;
    document.getElementById('modal-trx-method').innerText = trx.method;
    
    if (trx.phone) { document.getElementById('modal-trx-phone').innerText = trx.phone; document.getElementById('modal-phone-container').classList.remove('hidden'); } 
    else { document.getElementById('modal-phone-container').classList.add('hidden'); }

    let sub = 0; trx.items.forEach(i => sub += (i.price * i.qty));
    document.getElementById('modal-trx-subtotal').innerText = `Rp ${sub.toLocaleString('id-ID')}`;
    
    if (trx.discount > 0) {
        document.getElementById('modal-trx-discount').innerText = `- Rp ${trx.discount.toLocaleString('id-ID')}`;
        document.getElementById('modal-discount-container').classList.remove('hidden');
    } else { document.getElementById('modal-discount-container').classList.add('hidden'); }

    document.getElementById('modal-trx-total').innerText = `Rp ${trx.total.toLocaleString('id-ID')}`;
    document.getElementById('modal-trx-cash').innerText = `Rp ${trx.cash.toLocaleString('id-ID')}`;
    document.getElementById('modal-trx-change').innerText = `Rp ${trx.change.toLocaleString('id-ID')}`;
    document.getElementById('modal-trx-quote').innerText = `"${trx.quote || 'Stay aesthetic!'}"`;

    const itemsContainer = document.getElementById('modal-trx-items');
    itemsContainer.innerHTML = '';
    trx.items.forEach(i => { itemsContainer.innerHTML += `<div class="flex justify-between text-xs text-gray-600 font-mono"><span>${i.name} (x${i.qty})</span><span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span></div>`; });

    document.getElementById('modal-btn-thermal').onclick = function() { printThermal(trx.id); };
    document.getElementById('invoice-modal').classList.remove('hidden');
}

function closeInvoiceModal() { document.getElementById('invoice-modal').classList.add('hidden'); }

function renderStrukList() {
    const container = document.getElementById('struk-list');
    if (!container) return;
    container.innerHTML = transactions.length === 0 ? '<div class="text-center text-sm text-gray-400 py-6">Belum ada riwayat transaksi.</div>' : '';
    
    transactions.forEach(t => {
        // Hitung subtotal untuk persentase diskon
        let subtotal = 0;
        const itemsArray = Array.isArray(t.items) ? t.items : [];
        itemsArray.forEach(i => subtotal += (i.price * i.qty));
        
        let discountPercent = subtotal > 0 && t.discount > 0 ? Math.round((t.discount / subtotal) * 100) : 0;

        let itemsHtml = itemsArray.map(i => `<div class="flex justify-between text-xs text-gray-500 font-mono"><span>${i.name} (x${i.qty})</span><span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span></div>`).join('');
        
        const discHtml = t.discount > 0 ? `<div class="flex justify-between text-xs font-bold text-red-500 pt-1"><span>Diskon (${discountPercent}%)</span><span>- Rp ${t.discount.toLocaleString('id-ID')}</span></div>` : '';
        const phoneTxt = t.phone ? ` | WA: <b>${t.phone}</b>` : '';

        container.innerHTML += `
            <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-2 text-xs mb-3">
                <div class="flex justify-between font-bold text-gray-700"><span>${t.id}</span><span class="bg-sage-600 text-white font-bold px-2.5 py-0.5 rounded-lg text-[10px]">${t.method}</span></div>
                <div class="text-[10px] text-gray-400"><p>Waktu: <b>${t.date}</b> | Cust: <b>${t.customer}</b>${phoneTxt}</p></div>
                <div class="border-t border-b border-dashed border-gray-200 py-2 space-y-1">${itemsHtml}${discHtml}</div>
                <div class="flex justify-between font-black text-sm text-gray-800"><span>TOTAL</span><span class="text-sage-700 text-sm">Rp ${(parseInt(t.total)||0).toLocaleString('id-ID')}</span></div>
                <div class="pt-1"><button onclick="printThermal('${t.id}')" class="w-full bg-sage-600 hover:bg-sage-700 text-white text-xs py-3 rounded-xl font-bold shadow-sm flex items-center justify-center gap-1.5"><i class="fa-solid fa-print"></i> Cetak Ulang</button></div>
            </div>`;
    });
}

// ------------------------------------------------------------------------
// KEUANGAN
// ------------------------------------------------------------------------
function setFinanceFilter(type) {
    financeFilterType = type;
    document.querySelectorAll('.filter-btn').forEach(b => { 
        b.className = "filter-btn text-xs bg-white text-gray-600 py-2 rounded-xl border border-gray-200"; 
    });
    document.getElementById(`btn-flt-${type}`).className = "filter-btn text-xs bg-sage-600 text-white font-semibold py-2 rounded-xl border border-sage-200 shadow-xs";
    document.getElementById('custom-date-container').className = type === 'custom' ? 'grid grid-cols-2 gap-2 pt-1' : 'hidden';
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
    const today = new Date();
    const curDate = today.getDate();
    const curMonth = today.getMonth(); 
    const curYear = today.getFullYear();
    
    return transactions.filter(t => {
        if(!t.date) return false;
        const tDate = parseDateStr(t.date); 
        
        if (financeFilterType === 'today') {
            return tDate.getDate() === curDate && tDate.getMonth() === curMonth && tDate.getFullYear() === curYear;
        }
        if (financeFilterType === 'month') {
            return tDate.getMonth() === curMonth && tDate.getFullYear() === curYear;
        }
        if (financeFilterType === 'custom') {
            const st = document.getElementById('filter-start-date').value; 
            const ed = document.getElementById('filter-end-date').value;
            if(!st || !ed) return true; 
            
            const start = new Date(st); start.setHours(0,0,0,0); 
            const end = new Date(ed); end.setHours(23,59,59,999);
            return tDate >= start && tDate <= end;
        }
        return true;
    });
}

function calculateFinancials() {
    const data = getFilteredTransactions();
    let inc = 0, disc = 0, cash = 0, qris = 0, debit = 0;
    
    data.forEach(t => {
        let val = parseInt(t.total) || 0; 
        inc += val;
        disc += parseInt(t.discount) || 0;
        
        let method = String(t.method || '').trim();
        if(method === 'Tunai') cash += val; 
        if(method === 'QRIS') qris += val; 
        if(method === 'Debit') debit += val;
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
    const data = getFilteredTransactions(); 
    if(data.length === 0) return alert('Tidak ada data keuangan untuk diekspor pada filter ini.');
    
    const rows = data.map(t => ({
        "ID Transaksi": t.id, 
        "Waktu": t.date, 
        "Nama Pelanggan": t.customer, 
        "No WA": t.phone || '-', 
        "Metode Bayar": t.method,
        "Rincian Item": (Array.isArray(t.items) ? t.items : []).map(i => `${i.name} (${i.qty}x)`).join(', '), 
        "Diskon (Rp)": parseInt(t.discount) || 0, 
        "Omset Bersih (Rp)": parseInt(t.total) || 0
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows); 
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Keuangan"); 
    XLSX.writeFile(wb, `Laporan_SagePOS_${financeFilterType}.xlsx`);
}

// ------------------------------------------------------------------------
// BLUETOOTH PRINTER
// ------------------------------------------------------------------------
async function connectBluetooth() {
    if (isConnectingBle) return; isConnectingBle = true;
    const btn = document.getElementById('btn-bluetooth-txt'); btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menghubungkan...`;
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

async function printThermal(trxId) {
    const trx = transactions.find(t => t.id === trxId); if (!trx) return;
    if (!bleCharacteristic || !bleDevice || !bleDevice.gatt.connected) { const conn = await connectBluetooth(); if (!conn) return; }
    try {
        const enc = new TextEncoder('utf-8'); const I = new Uint8Array([27, 64]); const C = new Uint8Array([27, 97, 1]); const L = new Uint8Array([27, 97, 0]); const B1 = new Uint8Array([27, 69, 1]); const B0 = new Uint8Array([27, 69, 0]); const LF = new Uint8Array([10]);
        const w = async (t) => { const b = typeof t === 'string' ? enc.encode(t) : t; if (bleCharacteristic.properties.writeWithoutResponse) await bleCharacteristic.writeValueWithoutResponse(b); else await bleCharacteristic.writeValue(b); await new Promise(r => setTimeout(r, 50)); };

        await w(I); await w(C); await w(B1); await w("     LINK NEO MEAL\n"); await w(B0); await w("==============================\n"); await w(L);
        await w(`ID   : ${trx.id}\n`); await w(`Tgl  : ${trx.date}\n`); await w(`Cust : ${trx.customer}\n`);
        if(trx.phone) await w(`WA   : ${trx.phone}\n`);
        await w("------------------------------\n");
        let sub = 0;
        for (const i of (Array.isArray(trx.items)?trx.items:[])) {
            await w(`${i.name}\n`); sub += (i.price*i.qty);
            let d = `  ${i.qty} x Rp${parseInt(i.price).toLocaleString('id-ID')}`; let s = `Rp${(i.price*i.qty).toLocaleString('id-ID')}\n`;
            await w(d + " ".repeat(Math.max(1, 31 - (d.length + s.length))) + s);
        }
        await w("------------------------------\n");
        if(trx.discount > 0) {
            let sb = `Rp ${sub.toLocaleString('id-ID')}\n`; await w("Subtotal : " + " ".repeat(Math.max(1, 31 - (11 + sb.length))) + sb);
            let ds = `-Rp ${trx.discount.toLocaleString('id-ID')}\n`; await w("Diskon   : " + " ".repeat(Math.max(1, 31 - (11 + ds.length))) + ds);
        }
        await w(B1); let t = `Rp ${(parseInt(trx.total)||0).toLocaleString('id-ID')}\n`; await w("TOTAL    : " + " ".repeat(Math.max(1, 31 - (11 + t.length))) + t); await w(B0);
        await w(`Bayar    : Rp ${parseInt(trx.cash||0).toLocaleString('id-ID')}\n`); await w(`Kembali  : Rp ${parseInt(trx.change||0).toLocaleString('id-ID')}\n`);
        await w("==============================\n"); await w(C); await w(`"${trx.quote || 'Stay aesthetic.'}"\n`); await w("==============================\n");
        for (let f = 0; f < 4; f++) await w(LF);
    } catch (err) { alert("Printer sibuk. Coba lagi."); }
}