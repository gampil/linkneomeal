// ==========================================================================
// SAGEPOS PRO - LIVE SLIM EDITION (NO LOGIN, NO PPN, NO DISCOUNT, AUTO POPUP)
// ==========================================================================

// ⚠️ PENTING: Ganti dengan URL Web Apps API (/exec) dari Google Apps Script Anda
const API_URL = "https://script.google.com/macros/s/AKfycbzbM_5vS-WQG1UELVDfysFWoIyhIKjtqbOW_R7r1T-9Q8JR-HmOth1ibpanbyLr5k7m/exec";

let products = [];
let transactions = [];
let cart = [];
let financeFilterType = 'today';
let selectedCategory = 'Semua';

let bleDevice = null;
let bleCharacteristic = null;
const fallbackImage = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400";

// Quotes ala Gen Z Ter-update
const genZQuotes = [
    "Mending beli ini daripada beli omong kosong dia.",
    "Beli kopi biar ga ngantuk pas digantungin dia.",
    "Uang bisa dicari, tapi produk ini kalo abis lu nangis.",
    "Work hard, belanja harder. Gini amat nyari duit.",
    "Gpp boncos, yang penting tetep keliatan aesthetic.",
    "Secangkir kopi, sejuta ekspektasi, berujung overthinking.",
    "Adulting itu berat, mending jajan dulu gak sih?",
    "Anak baik beli produk ini, anak broken home beli kenangan."
];

function getRandomQuote() {
    return genZQuotes[Math.floor(Math.random() * genZQuotes.length)];
}

window.onload = async function() {
    await refreshDataFromServer();
};

async function refreshDataFromServer() {
    await fetchProductsFromSheets();
    await fetchTransactionsFromSheets();
    
    renderKasirProducts();
    renderCart();
    renderProductTable();
    renderStrukList(); // Segarkan daftar riwayat nota di layar
    calculateFinancials();
}

async function fetchProductsFromSheets() {
    try {
        let response = await fetch(API_URL, { 
            method: "POST", cache: "no-store", 
            body: JSON.stringify({ action: "getProducts", _ts: Date.now() })
        });
        let res = await response.json();
        if(res.status === "success") products = res.data;
    } catch(e) { console.error(e); }
}

async function fetchTransactionsFromSheets() {
    try {
        let response = await fetch(API_URL, { 
            method: "POST", cache: "no-store", 
            body: JSON.stringify({ action: "getTransactions", _ts: Date.now() })
        });
        let res = await response.json();
        if(res.status === "success") {
            transactions = res.data.sort((a, b) => b.id.localeCompare(a.id));
        }
    } catch(e) { console.error(e); }
}

// --- SPA NAVIGATION ---
function switchPage(pageId, btnElement) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
    document.getElementById(`page-${pageId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => { b.className = "nav-btn flex flex-col items-center justify-center py-1 text-gray-400"; });
    btnElement.className = "nav-btn flex flex-col items-center justify-center py-1 text-sage-600 font-bold";

    if(pageId === 'kasir') { renderKasirProducts(); renderCart(); }
    if(pageId === 'produk') { renderProductTable(); resetProductForm(); }
    if(pageId === 'struk') renderStrukList();
    if(pageId === 'keuangan') calculateFinancials();
}

// --- CRUD MASTER PRODUK ---
function renderProductTable() {
    const tbody = document.getElementById('product-table-body');
    tbody.innerHTML = products.length === 0 ? `<tr><td colspan="6" class="text-center p-6 text-gray-400 text-sm">Belum ada data.</td></tr>` : '';
    products.forEach(p => {
        tbody.innerHTML += `
            <tr class="border-b border-gray-100 hover:bg-gray-50 text-sm">                
                <td class="p-3 text-center"><img src="${p.image || fallbackImage}" class="w-12 h-12 object-cover rounded-xl mx-auto border shadow-xs"></td>
                <td class="p-3 font-semibold text-gray-800">${p.name}</td>
                <td class="p-3 text-gray-500"><span class="bg-gray-100 px-2 py-0.5 rounded-md text-xs">${p.category || 'Lainnya'}</span></td>
                <td class="p-3 text-center font-bold ${p.stock <= 3 ? 'text-red-500' : 'text-gray-700'}">${p.stock || 0}</td>
                <td class="p-3 text-right font-medium text-gray-800">Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}</td>
                <td class="p-3 text-center">
                    <div class="flex justify-center gap-2">
                        <button onclick="editProduct(${p.id})" class="text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl text-xs font-semibold">Edit</button>
                        <button onclick="deleteProduct(${p.id})" class="text-red-600 bg-red-50 px-3 py-1.5 rounded-xl text-xs font-semibold">Hapus</button>
                    </div>
                </td>
            </tr>
        `;
    });
}

async function saveProduct(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btn-submit-product');
    btnSubmit.innerText = "Menyimpan...";
    btnSubmit.setAttribute('disabled', 'true');

    const id = document.getElementById('prod-id').value || Date.now();
    const name = document.getElementById('prod-name').value;
    const price = parseInt(document.getElementById('prod-price').value);
    const category = document.getElementById('prod-category').value;
    const stock = parseInt(document.getElementById('prod-stock').value) || 0;
    const image = document.getElementById('prod-image').value.trim();
    
    const payload = { id: parseInt(id), name, price, category, stock, image };
    try {
        let response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "saveProduct", data: payload })});
        let res = await response.json();
        if(res.status === "success") { resetProductForm(); await refreshDataFromServer(); alert('Berhasil tersimpan!'); }
    } catch(err) { resetProductForm(); setTimeout(async () => { await refreshDataFromServer(); }, 1000); }
    btnSubmit.innerText = "Simpan"; btnSubmit.removeAttribute('disabled');
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (!product) return;
    document.getElementById('prod-id').value = product.id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-price').value = product.price;
    document.getElementById('prod-category').value = product.category || 'Makanan';
    document.getElementById('prod-stock').value = product.stock || 0;
    document.getElementById('prod-image').value = product.image || '';
    document.getElementById('btn-submit-product').innerText = 'Perbarui Data';
    document.getElementById('btn-cancel-edit').classList.remove('hidden');
}

async function deleteProduct(id) {
    if(!confirm('Hapus produk ini?')) return;
    try {
        let response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "deleteProduct", id: id })});
        let res = await response.json();
        if(res.status === "success") { await refreshDataFromServer(); }
    } catch(e) { setTimeout(async () => { await refreshDataFromServer(); }, 1000); }
}

function resetProductForm() {
    document.getElementById('product-form').reset(); document.getElementById('prod-id').value = '';
    document.getElementById('btn-submit-product').innerText = 'Simpan'; document.getElementById('btn-cancel-edit').classList.add('hidden');
}

// --- KASIR ENGINE ---
function filterCategory(cat) {
    selectedCategory = cat;
    document.querySelectorAll('.cat-btn').forEach(b => { b.className = "cat-btn bg-gray-100 text-gray-500 font-medium px-4 py-2 rounded-xl text-sm"; });
    event.target.className = "cat-btn bg-sage-600 text-white font-bold px-4 py-2 rounded-xl text-sm shadow-xs";
    renderKasirProducts();
}

// --- UPDATE: RENDER PRODUK KASIR + LABEL BADGE STOK HABIS OTOMATIS ---
// --- REVISI: HAPUS LABEL STOK DI ATAS GAMBAR, SISAKAN DI BAWAH SAJA ---
function renderKasirProducts() {
    const grid = document.getElementById('kasir-products-grid');
    const searchQuery = document.getElementById('search-product').value.toLowerCase();
    grid.innerHTML = '';
    
    const filtered = products.filter(p => {
        return p.name.toLowerCase().includes(searchQuery) && (selectedCategory === 'Semua' || (p.category || 'Lainnya') === selectedCategory);
    });

    if(filtered.length === 0) { 
        grid.innerHTML = `<p class="col-span-2 text-center text-gray-400 text-sm py-8 font-medium">Produk Kosong</p>`; 
        return; 
    }

    filtered.forEach(p => {
        const cartItem = cart.find(i => i.name === p.name);
        const qtyPicked = cartItem ? cartItem.qty : 0;
        const isPicked = qtyPicked > 0;
        
        // Memeriksa apakah stok produk habis
        const isOut = (parseInt(p.stock) || 0) <= 0;

        const borderStyle = isOut ? 'opacity-40 border-gray-200 bg-gray-100 pointer-events-none' : (isPicked ? 'border-emerald-600 bg-emerald-50 ring-3 ring-emerald-600/20' : 'border-gray-200 bg-white shadow-xs');

        // 2. ATUR BADGE JUMLAH YANG DIPILIH
        const badgeHtml = qtyPicked > 0 ? `<div class="absolute top-2 right-2 bg-sage-600 text-white font-black text-xs w-6 h-6 rounded-full flex items-center justify-center shadow-md z-10">${qtyPicked}</div>` : '';
        
        // 3. LOGIKA LABEL BADGE STOK
        const stockLabelHtml = isOut 
            ? `<span class="bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-md font-black tracking-wider flex items-center gap-1"><i class="fa-solid fa-triangle-exclamation"></i> HABIS</span>` 
            : `<span class="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-md font-semibold">Stok: ${p.stock || 0}</span>`;

        grid.innerHTML += `
            <div onclick="addToCart('${p.name}', ${p.price}, ${p.stock || 0})" class="relative border rounded-2xl p-2.5 hover:shadow-md cursor-pointer flex flex-col justify-between active:scale-95 transition-all overflow-hidden ${borderStyle}">
                
                ${badgeHtml}
                
                <img src="${p.image || fallbackImage}" class="product-card-img mb-2 shadow-inner ${isOut ? 'grayscale contrast-75' : ''}" alt="${p.name}">
                
                <div class="px-0.5 space-y-1">
                    <span class="font-bold text-xs ${isOut ? 'text-gray-400 line-through' : 'text-gray-800'} line-clamp-2 min-h-[32px]">${p.name}</span>
                    <div class="flex justify-between items-center pt-0.5">
                        <span class="${isOut ? 'text-gray-400 font-bold' : 'text-sage-700 font-extrabold'} text-sm">Rp ${(parseInt(p.price)||0).toLocaleString('id-ID')}</span>
                        
                        ${stockLabelHtml}
                    </div>
                </div>
            </div>
        `;
    });
}



function addToCart(name, price, currentStock) {
    const item = cart.find(i => i.name === name);
    if(item) { if(item.qty >= currentStock) { alert(`Stok sisa ${currentStock}!`); return; } item.qty++; } 
    else { cart.push({ name, price, qty: 1 }); }
    renderCart(); renderKasirProducts();
}

function updateCartQty(index, delta) {
    const item = cart[index];
    const maxStock = (products.find(p => p.name === item.name) || {stock: 999}).stock || 0;
    if(delta > 0 && item.qty >= maxStock) { alert('Stok maksimal tercapai!'); return; }
    item.qty += delta; if(item.qty <= 0) cart.splice(index, 1);
    renderCart(); renderKasirProducts();
}

function clearCart() { cart = []; renderCart(); renderKasirProducts(); }

function handleMethodChange() {
    const method = document.getElementById('pay-method').value;
    const cashInput = document.getElementById('pay-cash');
    if (method !== 'Tunai') cashInput.setAttribute('disabled', 'true');
    else { cashInput.value = ''; cashInput.removeAttribute('disabled'); }
    renderCart();
}

function renderCart() {
    const container = document.getElementById('cart-items');
    container.innerHTML = cart.length === 0 ? `<div class="text-center py-6 text-gray-400 font-medium text-sm">Keranjang Kosong</div>` : '';
    let total = 0;
    cart.forEach((item, index) => {
        total += item.price * item.qty;
        container.innerHTML += `
            <div class="flex justify-between items-center text-sm bg-gray-50 border border-gray-100 p-2 rounded-2xl shadow-2xs">
                <div class="flex-1 min-w-0 pr-2">
                    <h4 class="font-bold text-gray-800 truncate">${item.name}</h4>
                    <span class="text-xs font-semibold text-sage-600">Rp ${item.price.toLocaleString('id-ID')}</span>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="updateCartQty(${index}, -1)" class="w-6 h-6 rounded-lg bg-white border text-gray-700 font-black flex items-center justify-center shadow-2xs">-</button>
                    <span class="w-5 text-center font-bold text-gray-800">${item.qty}</span>
                    <button onclick="updateCartQty(${index}, 1)" class="w-6 h-6 rounded-lg bg-white border text-gray-700 font-black flex items-center justify-center shadow-2xs">+</button>
                </div>
                <span class="w-20 text-right font-black text-gray-700">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</span>
            </div>
        `;
    });
    document.getElementById('txt-total').innerText = `Rp ${total.toLocaleString('id-ID')}`;
    if(document.getElementById('pay-method').value !== 'Tunai') document.getElementById('pay-cash').value = total;
    calculateChange();
}

function calculateChange() {
    const total = parseInt(document.getElementById('txt-total').innerText.replace(/[^0-9]/g, '')) || 0;
    const cash = parseInt(document.getElementById('pay-cash').value) || 0;
    const change = cash - total;
    const changeEl = document.getElementById('txt-change');
    if (change >= 0) { changeEl.innerText = `Rp ${change.toLocaleString('id-ID')}`; changeEl.className = "font-extrabold text-sage-700 text-base"; }
    else { changeEl.innerText = 'Kurang Pembayaran'; changeEl.className = "font-extrabold text-red-600 text-sm"; }
}

async function processCheckout() {
    if(cart.length === 0) return alert('Keranjang kosong!');
    const total = parseInt(document.getElementById('txt-total').innerText.replace(/[^0-9]/g, '')) || 0;
    const cash = parseInt(document.getElementById('pay-cash').value) || 0;
    if (cash < total) return alert('Uang bayar kurang!');

    const btn = document.querySelector("#page-kasir button[onclick='processCheckout()']");
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-2"></i> Memproses Nota...`;
    btn.setAttribute('disabled', 'true');

    const customer = document.getElementById('pay-customer').value.trim() || 'Umum';
    const method = document.getElementById('pay-method').value;

    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { year:'numeric', month:'2-digit', day:'2-digit' }) + ' ' + now.toLocaleTimeString('id-ID');
    const assignedQuote = getRandomQuote();

    const transactionData = {
        id: 'TRX-' + Date.now(), date: formattedDate, customer, method, items: [...cart], total, cash, change: cash - total,
        cashier: "Kasir Utama", quote: assignedQuote
    };

    try {
        let response = await fetch(API_URL, { method: "POST", body: JSON.stringify({ action: "saveTransaction", data: transactionData })});
        let res = await response.json();
        if(res.status === "success") {
            transactions.unshift(transactionData); 
            openInvoiceModal(transactionData);
            clearCart();
            document.getElementById('pay-customer').value = '';
            await refreshDataFromServer(); 
        }
    } catch(e) {
        transactions.unshift(transactionData);
        openInvoiceModal(transactionData);
        clearCart();
        setTimeout(async () => { await refreshDataFromServer(); }, 1000);
    }
    btn.innerHTML = `<i class="fa-solid fa-print"></i> Selesaikan & Cetak Nota`; btn.removeAttribute('disabled');
}

// --- LOGIKA KENDALI MODAL POP-UP CARD PREVIEW NOTA ---
function openInvoiceModal(trx) {
    document.getElementById('modal-trx-id').innerText = trx.id;
    document.getElementById('modal-trx-date').innerText = trx.date;
    document.getElementById('modal-trx-customer').innerText = trx.customer;
    document.getElementById('modal-trx-method').innerText = trx.method;
    document.getElementById('modal-trx-total').innerText = `Rp ${trx.total.toLocaleString('id-ID')}`;
    document.getElementById('modal-trx-cash').innerText = `Rp ${trx.cash.toLocaleString('id-ID')}`;
    document.getElementById('modal-trx-change').innerText = `Rp ${trx.change.toLocaleString('id-ID')}`;
    document.getElementById('modal-trx-quote').innerText = `"${trx.quote || 'Stay aesthetic!'}"`;

    const itemsContainer = document.getElementById('modal-trx-items');
    itemsContainer.innerHTML = '';
    trx.items.forEach(i => {
        itemsContainer.innerHTML += `
            <div class="flex justify-between text-xs text-gray-600 font-mono">
                <span>${i.name} (x${i.qty})</span>
                <span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
            </div>
        `;
    });

    // Pasang tombol cetak internal Bluetooth (Fitur Browser di Pop-up dihilangkan)
    document.getElementById('modal-btn-thermal').onclick = function() { printThermal(trx.id); };
    
    // Sembunyikan tombol nota browser bawaan popup jika masih tertinggal di HTML
    const fallbackBtn = document.getElementById('modal-btn-popup');
    if (fallbackBtn) fallbackBtn.style.display = 'none';

    document.getElementById('invoice-modal').classList.remove('hidden');
}

function closeInvoiceModal() {
    document.getElementById('invoice-modal').classList.add('hidden');
}

// --- RENDERING RIWAYAT NOTA (FIXED VARIABEL SINKRONISASI TOTAL) ---
// --- REVISI TOTAL: RENDER RIWAYAT STRUK TANPA TOMBOL BROWSER & SINKRONISASI QUOTE ---
function renderStrukList() {
    const container = document.getElementById('struk-list');
    if (!container) return;
    
    container.innerHTML = transactions.length === 0 ? '<div class="text-center text-sm text-gray-400 py-6">Belum ada riwayat transaksi.</div>' : '';
    
    transactions.forEach(itemTrx => {
        let itemsListHtml = itemTrx.items.map(i => `<div class="flex justify-between text-xs text-gray-500 font-mono"><span>${i.name} (x${i.qty})</span><span>Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span></div>`).join('');
        
        // Memastikan quote yang dibaca adalah quote dari baris Google Sheets transaksi itu
        const currentQuote = itemTrx.quote || "Stay aesthetic.";

        container.innerHTML += `
            <div class="bg-white border border-gray-100 p-4 rounded-2xl shadow-xs space-y-2 text-xs mb-3 animate-scale">
                <div class="flex justify-between font-bold text-gray-700">
                    <span>${itemTrx.id}</span>
                    <span class="bg-sage-600 text-white font-bold px-2.5 py-0.5 rounded-lg text-[10px]">${itemTrx.method}</span>
                </div>
                <div class="text-[10px] text-gray-400"><p>Waktu: <b>${itemTrx.date}</b> | Pelanggan: <b>${itemTrx.customer}</b></p></div>
                <div class="border-t border-b border-dashed border-gray-200 py-2 space-y-1">${itemsListHtml}</div>
                <div class="flex justify-between font-black text-sm text-gray-800"><span>TOTAL BELANJA</span><span class="text-sage-700 text-sm">Rp ${transparentTotal(itemTrx.total).toLocaleString('id-ID')}</span></div>
                
                <div class="text-[11px] text-amber-700 italic font-mono bg-amber-50/50 p-2.5 rounded-xl text-center border border-amber-100/50">
                    "${currentQuote}"
                </div>

                <div class="pt-1">
                    <button onclick="printThermal('${itemTrx.id}')" class="w-full bg-sage-600 hover:bg-sage-700 text-white text-xs py-3 rounded-xl font-bold active:scale-95 transition shadow-sm flex items-center justify-center gap-1.5">
                        <i class="fa-solid fa-print"></i> Cetak Ulang Bluetooth
                    </button>
                </div>
            </div>
        `;
    });
}


function setFinanceFilter(type) {
    financeFilterType = type;
    document.querySelectorAll('.filter-btn').forEach(b => { b.className = "filter-btn text-xs bg-white text-gray-600 py-2 rounded-xl border border-gray-200"; });
    document.getElementById(`btn-flt-${type}`).className = "filter-btn text-xs bg-sage-600 text-white font-semibold py-2 rounded-xl border border-sage-200 shadow-xs";
    document.getElementById('custom-date-container').className = type === 'custom' ? 'grid grid-cols-2 gap-2 pt-1' : 'hidden';
    calculateFinancials();
}

function parseDateStr(dateStr) {
    const parts = dateStr.split(' '); const dateParts = parts[0].split('/');
    return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
}

function getFilteredTransactions() {
    const todayStr = new Date().toLocaleDateString('id-ID', { year:'numeric', month:'2-digit', day:'2-digit' });
    const currentMonth = new Date().getMonth(); const currentYear = new Date().getFullYear();
    return transactions.filter(t => {
        const tDate = parseDateStr(t.date); const tDateStr = tDate.toLocaleDateString('id-ID', { year:'numeric', month:'2-digit', day:'2-digit' });
        if (financeFilterType === 'today') return tDateStr === todayStr;
        if (financeFilterType === 'month') return tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear;
        if (financeFilterType === 'custom') {
            const startInput = document.getElementById('filter-start-date').value; const endInput = document.getElementById('filter-end-date').value;
            if(!startInput || !endInput) return true;
            const startDate = new Date(startInput); startDate.setHours(0,0,0,0); const endDate = new Date(endInput); endDate.setHours(23,59,59,999);
            return tDate >= startDate && tDate <= endDate;
        }
        return true;
    });
}

function calculateFinancials() {
    const filteredTrx = getFilteredTransactions();
    let totalIncome = 0, cashSum = 0, qrisSum = 0, debitSum = 0;
    filteredTrx.forEach(t => {
        let totalVal = parseInt(t.total) || 0; totalIncome += totalVal;
        if(t.method === 'Tunai') cashSum += totalVal; if(t.method === 'QRIS') qrisSum += totalVal; if(t.method === 'Debit') debitSum += totalVal;
    });
    document.getElementById('report-income').innerText = `Rp ${totalIncome.toLocaleString('id-ID')}`;
    document.getElementById('report-count').innerText = `${filteredTrx.length} Nota`;
    document.getElementById('rep-cash-txt').innerText = `Rp ${cashSum.toLocaleString('id-ID')}`;
    document.getElementById('rep-qris-txt').innerText = `Rp ${qrisSum.toLocaleString('id-ID')}`;
    document.getElementById('rep-debit-txt').innerText = `Rp ${debitSum.toLocaleString('id-ID')}`;
    const getPct = (val) => totalIncome === 0 ? 0 : (val / totalIncome) * 100;
    document.getElementById('bar-cash').style.width = `${getPct(cashSum)}%`; document.getElementById('bar-qris').style.width = `${getPct(qrisSum)}%`; document.getElementById('bar-debit').style.width = `${getPct(debitSum)}%`;
}

function exportToExcel() {
    const filteredTrx = getFilteredTransactions(); if(filteredTrx.length === 0) return alert('Tidak ada data.');
    const excelRows = filteredTrx.map(t => ({
        "ID Transaksi": t.id, "Tanggal Jam": t.date, "Nama Pelanggan": t.customer, "Metode": t.method,
        "Item": t.items.map(i => `${i.name} (${i.qty}x)`).join(', '), "Total Omset (Rp)": parseInt(t.total)
    }));
    const worksheet = XLSX.utils.json_to_sheet(excelRows); const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Laporan Omset"); XLSX.writeFile(workbook, `Laporan_SagePOS_${financeFilterType}.xlsx`);
}

// --- BLUETOOTH ENGINE (KUNCI DATA QUOTE 100% VALID) ---
async function connectBluetooth() {
    const textBtn = document.getElementById('btn-bluetooth-txt');
    try {
        bleDevice = await navigator.bluetooth.requestDevice({
            filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }, { namePrefix: 'RPP' }, { namePrefix: 'MTP' }, { namePrefix: 'PT' }],
            optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '0000ff00-0000-1000-8000-00805f9b34fb']
        });
        const server = await bleDevice.gatt.connect();
        let service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb').catch(() => server.getPrimaryService('0000ff00-0000-1000-8000-00805f9b34fb'));
        const characteristics = await service.getCharacteristics();
        bleCharacteristic = characteristics.find(c => c.properties.write || c.properties.writeWithoutResponse);
        if (bleCharacteristic) { textBtn.innerText = "Terhubung ✅"; return true; }
        return false;
    } catch (e) { textBtn.innerText = "Hubungkan Printer"; return false; }
}

async function printThermal(trxId) {
    const trx = transactions.find(t => t.id === trxId); if (!trx) return;
    if (!bleCharacteristic) { const isConnected = await connectBluetooth(); if (!isConnected) return; }

    const currentPrintQuote = trx.quote || "Stay aesthetic.";

    try {
        const encoder = new TextEncoder('utf-8');
        const CMD_INIT = new Uint8Array([27, 64]), CMD_CENTER = new Uint8Array([27, 97, 1]), CMD_LEFT = new Uint8Array([27, 97, 0]), CMD_BOLD_ON = new Uint8Array([27, 69, 1]), CMD_BOLD_OFF = new Uint8Array([27, 69, 0]), CMD_LINE_FEED = new Uint8Array([10]);
        const writeLine = async (t) => { const b = typeof t === 'string' ? encoder.encode(t) : t; if (bleCharacteristic.properties.writeWithoutResponse) await bleCharacteristic.writeValueWithoutResponse(b); else await bleCharacteristic.writeValue(b); await new Promise(r => setTimeout(r, 45)); };

        await writeLine(CMD_INIT); await writeLine(CMD_CENTER); await writeLine(CMD_BOLD_ON);
        await writeLine("     LINK NEO MEAL\n"); await writeLine(CMD_BOLD_OFF);
        await writeLine("==============================\n");
        await writeLine(CMD_LEFT);
        await writeLine(`ID   : ${trx.id}\n`); await writeLine(`Tgl  : ${trx.date}\n`); await writeLine(`Cust : ${trx.customer}\n`);
        await writeLine("------------------------------\n");
        
        for (const i of trx.items) {
            await writeLine(`${i.name}\n`);
            let dLine = `  ${i.qty} x Rp${parseInt(i.price).toLocaleString('id-ID')}`; let sLine = `Rp${(i.price*i.qty).toLocaleString('id-ID')}\n`;
            let spaces = " ".repeat(Math.max(1, 31 - (dLine.length + sLine.length)));
            await writeLine(dLine + spaces + sLine);
        }
        
        await writeLine("------------------------------\n"); await writeLine(CMD_BOLD_ON);
        let totalVal = `Rp ${transparentTotal(trx.total).toLocaleString('id-ID')}\n`;
        let totalSpaces = " ".repeat(Math.max(1, 31 - ("TOTAL    : ".length + totalVal.length)));
        await writeLine("TOTAL    : " + totalSpaces + totalVal); await writeLine(CMD_BOLD_OFF);
        await writeLine(`Bayar    : Rp ${parseInt(trx.cash || 0).toLocaleString('id-ID')}\n`); await writeLine(`Kembali  : Rp ${parseInt(trx.change || 0).toLocaleString('id-ID')}\n`);
        await writeLine("==============================\n"); await writeLine(CMD_CENTER);
        
        await writeLine(`"${currentPrintQuote}"\n`); await writeLine("==============================\n");
        for (let f = 0; f < 5; f++) await writeLine(CMD_LINE_FEED);
    } catch (err) { alert("Printer sibuk, ulangi cetak."); }
}

function printSystemPopup(trxId) {
    const trx = transactions.find(t => t.id === trxId); if(!trx) return;
    const currentPrintQuote = trx.quote || "Stay aesthetic.";
    const printWindow = window.open('', '_blank', 'width=450,height=650');
    
    let itemsHtml = trx.items.map(i => `<tr><td style="padding: 4px 0;"><b>${i.name}</b><br>${i.qty} x Rp ${parseInt(i.price).toLocaleString('id-ID')}</td><td style="text-align:right; vertical-align: bottom;">Rp ${(i.price * i.qty).toLocaleString('id-ID')}</td></tr>`).join('');
    
    printWindow.document.write(`
        <html><head><title>Struk Nota</title><style>body{font-family:'Courier New',monospace;font-size:13px;width:290px;padding:10px;margin:0;}.text-center{text-align:center;}.line{border-top:1px dashed #000;margin:10px 0;}table{width:100%;}.quote-box{background:#f9f9f9; padding:8px; border:1px dashed #708238; border-radius:8px; text-align:center; font-style:italic; margin:12px 0; font-size:11px; color:#5c6b2e;}</style></head>
        <body>
            <div class="text-center"><h3 style="margin:0; font-size:16px;">LINK NEO MEAL</h3><p style="margin:2px 0; font-size:11px;">Kota Telukjambe, Karawang</p></div><div class="line"></div>
            <p style="margin:3px 0;">ID: ${trx.id}<br>Waktu: ${trx.date}<br>Pelanggan: ${trx.customer}</p><div class="line"></div>
            <table>${itemsHtml}</table><div class="line"></div>
            <table style="line-height: 1.6;">
                <tr style="font-weight:bold; font-size:14px;"><td>TOTAL TAGIHAN</td><td style="text-align:right;">Rp ${transparentTotal(trx.total).toLocaleString('id-ID')}</td></tr>
                <tr><td>Bayar</td><td style="text-align:right;">Rp ${parseInt(trx.cash || 0).toLocaleString('id-ID')}</td></tr>
                <tr><td>Kembalian</td><td style="text-align:right;">Rp ${parseInt(trx.change || 0).toLocaleString('id-ID')}</td></tr>
            </table>
            <div class="quote-box">"${currentPrintQuote}"</div>
            <div class="line"></div>
            <script>window.onload=function(){window.print();setTimeout(function(){window.close();},400);}</script>
        </body></html>
    `);
    printWindow.document.close();
}

function transparentTotal(val) { if (typeof val === 'string') return parseInt(val.replace(/[^0-9]/g, '')) || 0; return parseInt(val) || 0; }