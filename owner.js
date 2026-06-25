// ==========================================================================
// KONFIGURASI FIREBASE LINK NEO MEAL
// ==========================================================================
const firebaseConfig = {
    apiKey: "AIzaSyCAvkrPfkMs4TKofAwBPIPAmSVXnAAYF2s",
    authDomain: "linkneomeal-001.firebaseapp.com",
    projectId: "linkneomeal-001",
    storageBucket: "linkneomeal-001.firebasestorage.app",
    messagingSenderId: "518165236588",
    appId: "1:518165236588:web:0606d3da403339fd620149",
    databaseURL : "https://linkneomeal-001-default-rtdb.firebaseio.com"
};
  
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); 

// ==========================================================================
// CONFIG & DATA GLOBAL REAL-TIME
// ==========================================================================
let globalAttendanceData = [];
let globalTransactions = []; 
let globalProducts = [];
let globalVoidLogs = [];
let ownerFinanceFilter = 'semua';
let globalExpenses = [];

// Data Keamanan Owner
let currentOwnerPin = "1234"; // PIN Default jika belum diatur

document.addEventListener("DOMContentLoaded", () => {
    setupOwnerRealtimeListeners();

    // Set Default Bulan pada Rekap Absensi
    const monthInput = document.getElementById('filter-bulan-rekap');
    if(monthInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        monthInput.value = `${yyyy}-${mm}`;
        monthInput.addEventListener('change', renderRekapAbsensi);
    }
});

// ==========================================================================
// 1. OTORISASI LOGIN & LOGOUT OWNER (SISTEM SESI PERMANEN)
// ==========================================================================
function checkLoginPersistence() {
    const savedPin = localStorage.getItem('owner_logged_in_pin');
    
    // Validasi: Apakah PIN di memori HP sama dengan PIN terbaru di Database?
    if (savedPin && savedPin === currentOwnerPin) {
        document.getElementById('owner-login-overlay').classList.add('hidden');
        renderHomeDashboard(); 
    } else {
        // Jika PIN diganti atau belum login, arahkan ke layar login
        document.getElementById('owner-login-overlay').classList.remove('hidden');
    }
}

function handleOwnerLogin() {
    const pinInput = document.getElementById('owner-login-pin');
    const pin = pinInput.value.trim();
    
    if (pin === currentOwnerPin) {
        localStorage.setItem('owner_logged_in_pin', pin); // Simpan sesi login ke perangkat
        document.getElementById('owner-login-overlay').classList.add('hidden');
        pinInput.value = "";
        renderHomeDashboard(); 
    } else {
        alert("Akses Ditolak: PIN Owner Salah!");
        pinInput.value = "";
    }
}

function logoutOwner() {
    const setuju = confirm("Apakah Anda yakin ingin keluar dari Sesi Owner?");
    if (!setuju) return;
    
    localStorage.removeItem('owner_logged_in_pin'); // Hapus sesi login dari memori perangkat
    document.getElementById('owner-login-overlay').classList.remove('hidden');
    
    // Tutup laci menu hamburger jika sedang terbuka
    const drawer = document.getElementById('mobile-menu-drawer');
    if(drawer && !drawer.classList.contains('-translate-x-full')) {
        toggleMobileMenu();
    }
    switchTab('home'); 
}

// ==========================================================================
// 2. INTEGRASI REAL-TIME SENSOR FIREBASE DB
// ==========================================================================
function setupOwnerRealtimeListeners() {
    // Pantau PIN Owner
    db.ref('owner_pin').on('value', (snap) => {
        if(snap.exists()) currentOwnerPin = String(snap.val());
        else currentOwnerPin = "1234";
        checkLoginPersistence();
    });

    // LISTENER PRODUK - Pastikan ini dipanggil tepat
    db.ref('products').on('value', (snap) => {
        globalProducts = [];
        if (snap.exists()) {
            snap.forEach(child => {
                let p = child.val();
                p.id = child.key; // Pastikan ID diambil dari key Firebase
                globalProducts.push(p);
            });
        }
        console.log("Data Produk Diterima:", globalProducts); // Debug: Cek di console browser
        renderProductsOwner();
        renderKeuangan(); 
    });

db.ref('transactions').on('value', (snap) => {
    globalTransactions = [];
    if (snap.exists()) {
        snap.forEach(child => { 
            let t = child.val();
            // PENTING: Pastikan ID disimpan di dalam objek agar bisa diproses
            if(!t.id) t.id = child.key; 
            globalTransactions.push(t); 
        });
        console.log("Total Transaksi dari Firebase:", globalTransactions.length); // <--- CEK INI DI CONSOLE BROWSER
    }
    renderKeuangan();
    renderHomeDashboard(); 
});

    db.ref('attendance').on('value', (snap) => {
        globalAttendanceData = [];
        if (snap.exists()) {
            snap.forEach(child => globalAttendanceData.push(child.val()));
            globalAttendanceData.reverse(); 
        }
        renderLogAbsensi();
        renderRekapAbsensi();
        renderLiveMonitorShift();
        renderHomeDashboard(); 
    });

    db.ref('cashier_pins').on('value', (snap) => {
        renderConfiguredPins(snap);
    });

    db.ref('void_logs').on('value', (snap) => {
        globalVoidLogs = [];
        if (snap.exists()) {
            snap.forEach(child => globalVoidLogs.push(child.val()));
            globalVoidLogs.reverse();
        }
        renderVoidLogs();
    });

    db.ref('expenses').on('value', (snap) => {
        globalExpenses = [];
        if (snap.exists()) snap.forEach(child => globalExpenses.push(child.val()));
        renderKeuangan(); 
    });
}

// ==========================================================================
// 3. NAVIGASI SWITCH TAB 
// ==========================================================================
function switchTab(tabId) {
    const panels = ['home', 'keuangan', 'produk', 'pengaturan', 'rekapabsensi', 'absensi', 'void', 'sistem'];
    panels.forEach(p => {
        const el = document.getElementById(`panel-${p}`);
        if(el) el.classList.add('hidden');
    });
    
    const desktopInactive = "nav-btn w-full flex items-center gap-4 p-3.5 rounded-2xl text-gray-500 hover:bg-gray-50 hover:text-emerald-600 font-semibold transition";
    const desktopActive = "nav-btn w-full flex items-center gap-4 p-3.5 rounded-2xl bg-emerald-600 text-white font-bold transition shadow-md shadow-emerald-200/50";
    
    panels.forEach(p => {
        const dTab = document.getElementById(`tab-desktop-${p}`);
        if(dTab) dTab.className = desktopInactive;
    });

    const activePanel = document.getElementById(`panel-${tabId}`);
    if(activePanel) activePanel.classList.remove('hidden');
    
    const activeDTab = document.getElementById(`tab-desktop-${tabId}`);
    if(activeDTab) activeDTab.className = desktopActive;
    
    if(tabId === 'home') renderHomeDashboard();
}

// ==========================================================================
// 4. HOME DASHBOARD (PENJUALAN HARI INI & KASIR AKTIF)
// ==========================================================================
function renderHomeDashboard() {
    const todayStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });
    
    // Hitung Penjualan Kotor Hari ini (Total Transaksi + Diskon yang diberikan)
    let todaySales = 0;
    globalTransactions.forEach(t => {
        if (t.date && t.date.startsWith(todayStr)) {
            todaySales += (parseInt(t.total) || 0) + (parseInt(t.discount) || 0);
        }
    });

    const salesEl = document.getElementById('home-total-sales');
    if(salesEl) salesEl.innerText = `Rp ${todaySales.toLocaleString('id-ID')}`;

    // Hitung Kasir yang Laci/Shift-nya Aktif saat ini
    let activeCount = 0;
    globalAttendanceData.forEach(a => {
        if (a.status === 'Sedang Bekerja' && a.loginTime && a.loginTime.startsWith(todayStr)) {
            activeCount++;
        }
    });

    const cashierEl = document.getElementById('home-active-cashiers');
    if(cashierEl) cashierEl.innerHTML = `${activeCount} <span class="text-sm text-white md:text-gray-500 font-bold ml-1">Orang</span>`;
}

// ==========================================================================
// 5. PENGATURAN OWNER (UBAH PIN & MANAJEMEN DATABASE)
// ==========================================================================

async function changeOwnerPin(e) {
    e.preventDefault();
    const oldPin = document.getElementById('config-owner-old-pin').value;
    const newPin = document.getElementById('config-owner-new-pin').value;
    const btn = document.getElementById('btn-save-owner-pin');
    
    if (oldPin !== currentOwnerPin) return alert("Verifikasi Gagal: PIN Lama yang Anda masukkan salah!");
    if (newPin.length !== 4) return alert("PIN Baru harus terdiri dari 4 angka!");

    const originalText = btn.innerHTML;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;
    btn.disabled = true;

    try {
        await db.ref('owner_pin').set(newPin);
        localStorage.setItem('owner_logged_in_pin', newPin); // Langsung perbarui memori lokal agar tidak logout
        alert("Berhasil! PIN Keamanan Owner telah diperbarui.");
        e.target.reset();
    } catch (err) {
        alert("Gagal memperbarui PIN, periksa koneksi internet Anda.");
        console.error(err);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

async function backupDatabaseNode() {
    const node = document.getElementById('db-node-select').value;
    
    try {
        const snapshot = await db.ref(node).once('value');
        if (!snapshot.exists()) {
            alert(`Tidak ada data tersimpan pada kategori [${node}]. File kosong.`);
            return;
        }

        const dataObj = snapshot.val();
        let rows = [];

        for (let key in dataObj) {
            let item = dataObj[key];
            let flatItem = {};
            for (let prop in item) {
                if (typeof item[prop] === 'object') {
                    flatItem[prop] = JSON.stringify(item[prop]); // Stringify objek array seperti isi keranjang
                } else {
                    flatItem[prop] = item[prop];
                }
            }
            rows.push(flatItem);
        }

        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, node);
        XLSX.writeFile(wb, `Backup_${node}_${new Date().toISOString().slice(0,10)}.xlsx`);
        
        alert(`SUKSES: File Excel untuk backup database [${node}] berhasil diunduh!`);
        
    } catch (err) {
        alert("Gagal melakukan backup cloud. Cek koneksi internet Anda.");
        console.error(err);
    }
}

async function deleteDatabaseNode() {
    const node = document.getElementById('db-node-select').value;
    const textConfirm = prompt(`TINDAKAN BERBAHAYA!\nAnda akan MENGHAPUS SEMUA DATA PERMANEN pada [${node}].\nKetik "HAPUS" (huruf besar) untuk melanjutkan:`);
    
    if (textConfirm !== "HAPUS") {
        alert("Tindakan penghapusan dibatalkan demi keamanan.");
        return;
    }

    try {
        // Ini adalah eksekusi ke database untuk membersihkan seluruh isinya
        await db.ref(node).set(null);
        
        // Alert sukses akan muncul SEKARANG karena bug di kode sebelumnya sudah dihilangkan
        alert(`SUKSES! Seluruh data pada database [${node}] telah dihapus secara permanen dari server.`);
    } catch (err) {
        alert(`Gagal menghapus [${node}]. Periksa koneksi internet.`);
        console.error(err);
    }
}

// ==========================================================================
// 6. LOGIKA KEUANGAN, PROFIT BERSIH & MENU TERLARIS
// ==========================================================================
// 1. Fungsi Parser Tanggal yang Lebih Kuat (Mendukung DD/MM/YYYY atau ISO String)
function parseDateOwner(dateStr) {
    if (!dateStr) return new Date(0); // Jika kosong, set ke tanggal paling lama
    let str = String(dateStr).trim();
    
    // Jika format DD/MM/YYYY HH:MM
    if (str.includes('/')) {
        const parts = str.split(' ');
        const dateParts = parts[0].split('/');
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
    }
    // Jika format ISO standar
    return new Date(str);
}

// 2. Fungsi Filter yang Diperbarui
function setOwnerFinanceFilter(type) {
    ownerFinanceFilter = type;
    document.querySelectorAll('.flt-btn').forEach(b => { 
        b.className = "flt-btn px-3 py-2 text-xs font-bold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 transition"; 
    });
    
    const activeBtn = document.getElementById(`btn-flt-${type}`);
    if(activeBtn) activeBtn.className = "flt-btn px-3 py-2 text-xs font-bold rounded-xl border border-emerald-600 bg-emerald-600 text-white transition shadow-sm";
    
    const dateInputs = document.getElementById('kustom-date-inputs');
    if(dateInputs) dateInputs.classList.toggle('hidden', type !== 'kustom');
    
    // PENTING: Panggil renderKeuangan() setelah filter berubah
    renderKeuangan(); 
}

// 3. Logika Penyaringan Data
function getFilteredTransactions() {
    const today = new Date(); 
    const curDate = today.getDate(); 
    const curMonth = today.getMonth(); 
    const curYear = today.getFullYear();
    
    // Debug: Cek apakah data masuk ke filter
    console.log("Jumlah data sebelum filter:", globalTransactions.length);

    return globalTransactions.filter(t => {
        if(!t.date) return false;
        const tDate = parseDateOwner(t.date); 
        
        // Cek validitas tanggal
        if (isNaN(tDate.getTime())) return false; 

        if (ownerFinanceFilter === 'hari') {
            return tDate.getDate() === curDate && tDate.getMonth() === curMonth && tDate.getFullYear() === curYear;
        }
        if (ownerFinanceFilter === 'bulan') {
            return tDate.getMonth() === curMonth && tDate.getFullYear() === curYear;
        }
        if (ownerFinanceFilter === 'kustom') {
            const st = document.getElementById('flt-start').value; 
            const ed = document.getElementById('flt-end').value;
            if(!st || !ed) return true;
            const start = new Date(st); start.setHours(0,0,0,0); 
            const end = new Date(ed); end.setHours(23,59,59,999);
            return tDate >= start && tDate <= end;
        }
        return true; // Untuk filter 'semua'
    });
}

function renderKeuangan() {
    const listPemasukan = document.getElementById('list-pemasukan');
    const listPengeluaran = document.getElementById('list-pengeluaran');
    if(!listPemasukan || !listPengeluaran) return;

    let htmlPemasukan = ''; 
    let htmlPengeluaran = ''; 
    
    let totalNetto = 0; 
    let totalDiskon = 0; 
    let totalHppAll = 0;
    let totalPengeluaran = 0; 
    let totalCash = 0; let totalQris = 0; let totalDebit = 0;
    
    let productSalesCounter = {};
    const filteredData = getFilteredTransactions();

    filteredData.forEach(t => {
        let netto = parseInt(t.total) || 0; 
        let diskon = parseInt(t.discount) || 0;
        let method = String(t.method || '').trim().toUpperCase();
        
        totalNetto += netto;
        totalDiskon += diskon;
        
        if (method === 'TUNAI' || method === 'CASH') totalCash += netto;
        else if (method === 'QRIS') totalQris += netto;
        else if (method === 'DEBIT' || method === 'TRANSFER') totalDebit += netto;
        else totalCash += netto; 

        let itemsArray = Array.isArray(t.items) ? t.items : [];
        let itemsListHtml = itemsArray.map(i => {
            const matchProd = globalProducts.find(p => String(p.id) === String(i.id));
            const costOfItem = matchProd ? (parseInt(matchProd.cost) || 0) : 0;
            totalHppAll += (costOfItem * i.qty);

            if(!productSalesCounter[i.name]) productSalesCounter[i.name] = 0;
            productSalesCounter[i.name] += i.qty;

            return `<span class="bg-gray-50 border border-gray-200 px-2 py-1 rounded-md text-[10px] font-bold text-gray-600 inline-block mr-1.5 mb-1.5 shadow-sm">${i.qty}x ${i.name}</span>`;
        }).join('');
        
        htmlPemasukan += `
            <div class="bg-white p-4 rounded-2xl shadow-sm border border-emerald-100 flex flex-col gap-3 hover:shadow-md transition">
                <div class="flex justify-between items-start border-b border-gray-50 pb-3">
                    <div class="flex gap-3">
                        <div class="w-10 h-10 rounded-xl bg-gray-50 text-emerald-600 flex items-center justify-center shrink-0 border border-gray-100">
                            <i class="fa-solid fa-arrow-trend-up"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-800 text-sm capitalize">Transaksi Masuk <span class="text-[10px] text-gray-400 font-normal">(${t.cashier || 'Umum'})</span></h4>
                            <p class="text-[10px] text-gray-400 mt-0.5">${t.date}</p>
                        </div>
                    </div>
                    <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-emerald-100">${t.method}</span>
                </div>
                <div class="flex-1 w-full">${itemsListHtml}</div>
                <div class="flex justify-between items-end pt-1">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Masuk</span>
                    <h4 class="font-black text-emerald-700 text-lg md:text-xl">+ Rp ${netto.toLocaleString('id-ID')}</h4>
                </div>
            </div>`;
    });

    const filteredExpenses = globalExpenses.filter(e => {
        if(!e.date) return false;
        const eDate = parseDateOwner(e.date);
        const today = new Date();
        if (ownerFinanceFilter === 'hari') return eDate.getDate() === today.getDate() && eDate.getMonth() === today.getMonth() && eDate.getFullYear() === today.getFullYear();
        if (ownerFinanceFilter === 'bulan') return eDate.getMonth() === today.getMonth() && eDate.getFullYear() === today.getFullYear();
        if (ownerFinanceFilter === 'kustom') {
            const st = document.getElementById('flt-start').value; const ed = document.getElementById('flt-end').value;
            if(!st || !ed) return true;
            const start = new Date(st); start.setHours(0,0,0,0); const end = new Date(ed); end.setHours(23,59,59,999);
            return eDate >= start && eDate <= end;
        }
        return true;
    });

    filteredExpenses.forEach(e => {
        let amt = parseInt(e.amount) || 0;
        totalPengeluaran += amt;
        totalCash -= amt; 

        htmlPengeluaran += `
            <div class="bg-orange-50/30 p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col gap-3 transition">
                <div class="flex justify-between items-start">
                    <div class="flex gap-3">
                        <div class="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center shrink-0 border border-orange-200">
                            <i class="fa-solid fa-money-bill-transfer"></i>
                        </div>
                        <div>
                            <h4 class="font-bold text-gray-800 text-sm capitalize">Pengeluaran <span class="text-[10px] text-gray-400 font-normal">(${e.cashier || 'Umum'})</span></h4>
                            <p class="text-[10px] text-gray-500 mt-0.5">${e.date}</p>
                        </div>
                    </div>
                </div>
                <div class="flex-1 w-full"><span class="text-sm font-bold text-gray-600">${e.description}</span></div>
                <div class="flex justify-between items-end pt-1 border-t border-orange-100/50 mt-1">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Uang Keluar</span>
                    <h4 class="font-black text-orange-600 text-lg md:text-xl">- Rp ${amt.toLocaleString('id-ID')}</h4>
                </div>
            </div>`;
    });

    if(htmlPemasukan !== '') listPemasukan.innerHTML = htmlPemasukan;
    else listPemasukan.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-gray-100 rounded-2xl shadow-sm">Belum ada transaksi masuk pada filter ini.</div>`;

    if(htmlPengeluaran !== '') listPengeluaran.innerHTML = htmlPengeluaran;
    else listPengeluaran.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-gray-100 rounded-2xl shadow-sm">Belum ada pengeluaran pada filter ini.</div>`;

    let finalNettoOmset = totalNetto;
    let finalGrossOmset = totalNetto + totalDiskon;
    let totalProfitBersih = finalNettoOmset - totalHppAll - totalPengeluaran;

    const safeUpdateText = (id, txt) => { const el = document.getElementById(id); if(el) el.innerText = txt; };

    safeUpdateText('owner-total-gross', `Rp ${finalGrossOmset.toLocaleString('id-ID')}`);
    safeUpdateText('owner-total-diskon', `Rp ${totalDiskon.toLocaleString('id-ID')}`);
    safeUpdateText('owner-total-omset', `Rp ${finalNettoOmset.toLocaleString('id-ID')}`);
    safeUpdateText('owner-total-expense', `Rp ${totalPengeluaran.toLocaleString('id-ID')}`);
    safeUpdateText('owner-total-profit', `Rp ${totalProfitBersih.toLocaleString('id-ID')}`);
    
    safeUpdateText('rep-cash-txt', `Rp ${totalCash.toLocaleString('id-ID')}`);
    safeUpdateText('rep-qris-txt', `Rp ${totalQris.toLocaleString('id-ID')}`);
    safeUpdateText('rep-debit-txt', `Rp ${totalDebit.toLocaleString('id-ID')}`);

    updateFinanceChart(filteredData);
    renderTopProductsList(productSalesCounter);
}

function updateFinanceChart(filteredData) {
    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    const sortedData = [...filteredData].sort((a, b) => parseDateOwner(a.date) - parseDateOwner(b.date));
    const aggregatedData = {};

    sortedData.forEach(t => {
        let label = t.date.split(' ')[0];
        if (!aggregatedData[label]) aggregatedData[label] = { omset: 0, diskon: 0, pengeluaran: 0 };
        aggregatedData[label].omset += (parseInt(t.total) || 0);
        aggregatedData[label].diskon += (parseInt(t.discount) || 0);
    });

    globalExpenses.forEach(e => {
        let label = e.date.split(' ')[0];
        if (!aggregatedData[label]) aggregatedData[label] = { omset: 0, diskon: 0, pengeluaran: 0 };
        aggregatedData[label].pengeluaran += (parseInt(e.amount) || 0);
    });

    if (window.financeChartInstance) window.financeChartInstance.destroy();

    window.financeChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar', 
        data: {
            labels: Object.keys(aggregatedData),
            datasets: [
                {
                    label: 'Omset Bersih',
                    data: Object.values(aggregatedData).map(d => d.omset),
                    backgroundColor: '#059669',
                    borderRadius: 4
                },
                {
                    label: 'Diskon',
                    data: Object.values(aggregatedData).map(d => d.diskon),
                    backgroundColor: '#f59e0b',
                    borderRadius: 4
                },
                {
                    label: 'Pengeluaran',
                    data: Object.values(aggregatedData).map(d => d.pengeluaran),
                    backgroundColor: '#ef4444',
                    borderRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // BAGIAN INI YANG DIUBAH: stacked: false membuat batang jadi bersebelahan
            scales: {
                x: { stacked: false, grid: { display: false } },
                y: { stacked: false, beginAtZero: true, grid: { borderDash: [4, 4] } }
            },
            plugins: {
                legend: { position: 'top' }
            }
        }
    });
}

function renderTopProductsList(salesCounter) {
    const container = document.getElementById('top-products-list');
    if(!container) return;

    let sortedList = Object.keys(salesCounter).map(name => {
        return { name: name, qty: salesCounter[name] };
    }).sort((a, b) => b.qty - a.qty).slice(0, 5); 

    if(sortedList.length === 0) {
        container.innerHTML = `<div class="text-center text-xs text-gray-400 py-10">Belum ada item terjual.</div>`;
        return;
    }

    let maxQty = sortedList[0].qty || 1; 
    let html = '';

    sortedList.forEach((item, index) => {
        let percentageWidth = (item.qty / maxQty) * 100;
        let rankColor = index === 0 ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600';

        html += `
            <div class="space-y-1.5">
                <div class="flex justify-between items-center text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="w-5 h-5 rounded-md text-[10px] font-black flex items-center justify-center shrink-0 ${rankColor}">${index + 1}</span>
                        <span class="font-bold text-gray-700 truncate">${item.name}</span>
                    </div>
                    <span class="font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md shrink-0 border border-emerald-100">${item.qty} Pcs</span>
                </div>
                <div class="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div class="bg-gradient-to-r from-emerald-500 to-teal-500 h-full transition-all duration-500" style="width: ${percentageWidth}%"></div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

// ==========================================================================
// 7. MONITOR LIVE SHIFT KASIR 
// ==========================================================================
function renderLiveMonitorShift() {
    const container = document.getElementById('live-cashier-container');
    if(!container) return;

    const todayStr = new Date().toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric' });

    let activeWorkers = globalAttendanceData.filter(a => {
        const isWorking = a.status === 'Sedang Bekerja';
        const isToday = a.loginTime && a.loginTime.startsWith(todayStr);
        return isWorking && isToday;
    });

    if(activeWorkers.length === 0) {
        container.innerHTML = `
            <div class="col-span-full p-4 bg-gray-50 border border-gray-100 rounded-xl flex items-center justify-center text-xs text-gray-400 font-medium">
                <i class="fa-solid fa-lock mr-2 text-gray-300"></i> Laci Kasir Terkunci (Semua Shift Tutup Hari Ini)
            </div>`;
        return;
    }

    let html = '';
    activeWorkers.forEach(w => {
        let totalCashInHand = 0;

        globalTransactions.forEach(t => {
            if(t.date && t.date.startsWith(todayStr) && String(t.cashier).toLowerCase().trim() === String(w.cashierName).toLowerCase().trim()) {
                if(String(t.method).toLowerCase() === 'tunai' || String(t.method).toLowerCase() === 'cash') {
                    totalCashInHand += (parseInt(t.total) || 0);
                }
            }
        });

        html += `
            <div class="bg-emerald-50/40 border border-emerald-100 p-3.5 rounded-2xl flex flex-col justify-between shadow-xs">
                <div class="flex items-center justify-between border-b border-emerald-100/50 pb-2 mb-2">
                    <div class="min-w-0">
                        <h4 class="font-bold text-sm text-gray-800 capitalize truncate">${w.cashierName}</h4>
                        <p class="text-[10px] text-gray-400 mt-0.5">Shift Sejak: ${w.loginTime.split(' ')[1] || w.loginTime}</p>
                    </div>
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse border border-white shadow-sm shrink-0"></span>
                </div>
                <div class="flex justify-between items-end">
                    <span class="text-[9px] text-gray-400 font-bold uppercase tracking-wide">Uang Fisik Sementara</span>
                    <span class="text-xs font-black text-emerald-800">Rp ${totalCashInHand.toLocaleString('id-ID')}</span>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

// ==========================================================================
// 8. CRUD MASTER PRODUK & HPP 
// ==========================================================================
const IMGBB_API_KEY = "74a8a5c720111b4162e8e2d237aee552";

function previewSelectedImage(event) {
    const file = event.target.files[0];
    const preview = document.getElementById('own-prod-image-preview');
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            preview.innerHTML = `<img src="${e.target.result}" class="w-full h-full object-cover">`;
        }
        reader.readAsDataURL(file);
    } else {
        preview.innerHTML = `<i class="fa-solid fa-image text-gray-400"></i>`;
    }
}

async function uploadImageToAPI(file) {
    const formData = new FormData();
    formData.append("image", file);
    try {
        const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });
        const data = await response.json();
        if(data.success) return data.data.url;
        else throw new Error("API Menolak Upload");
    } catch (error) {
        console.error("Gagal upload gambar:", error);
        return null;
    }
}

async function saveProductOwner(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-owner-submit-prod');
    const originalText = btn.innerHTML;
    
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Memproses...`;

    let imageUrl = document.getElementById('own-prod-image-url').value; 
    const imageFile = document.getElementById('own-prod-image-file').files[0]; 

    if (imageFile) {
        btn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up animate-bounce mr-1"></i> Mengupload Foto...`;
        const uploadedUrl = await uploadImageToAPI(imageFile);
        
        if (uploadedUrl) imageUrl = uploadedUrl; 
        else {
            alert("Gagal mengupload foto menu.");
            btn.disabled = false;
            btn.innerHTML = originalText;
            return; 
        }
    }

    const id = document.getElementById('own-prod-id').value || String(Date.now());
    const payload = {
        id: id,
        name: document.getElementById('own-prod-name').value.trim(),
        cost: parseInt(document.getElementById('own-prod-cost').value) || 0,
        price: parseInt(document.getElementById('own-prod-price').value) || 0,
        category: document.getElementById('own-prod-category').value,
        stock: parseInt(document.getElementById('own-prod-stock').value) || 0,
        image: imageUrl || ''
    };

    try {
        await db.ref('products/' + id).set(payload);
        alert("Menu berhasil diperbarui!");
        resetProductFormOwner();
    } catch (err) {
        console.error(err);
        alert("Gagal mengamankan produk.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function renderProductsOwner() {
    const container = document.getElementById('owner-product-grid');
    if(!container) return;

    if(globalProducts.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center text-xs text-gray-400 py-10">Katalog menu kosong.</div>`;
        return;
    }

    let html = '';
    globalProducts.forEach(p => {
        let margin = (parseInt(p.price) || 0) - (parseInt(p.cost) || 0);
        let lowStockStyle = (parseInt(p.stock) || 0) <= 3 ? 'text-red-500 font-black bg-red-50' : 'text-gray-500 bg-gray-50';

        html += `
            <div class="bg-white border border-gray-100 p-3 rounded-2xl flex gap-3 items-center hover:shadow-sm transition">
                <img src="${p.image || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400'}" class="w-14 h-14 object-cover rounded-xl border border-gray-100 shrink-0 shadow-inner">
                <div class="flex-grow min-w-0">
                    <h4 class="font-bold text-gray-800 text-sm truncate">${p.name}</h4>
                    <div class="flex flex-wrap items-center gap-1.5 mt-1 text-[10px]">
                        <span class="font-bold text-gray-400">Modal: Rp ${(p.cost || 0).toLocaleString('id-ID')}</span>
                        <span class="font-black text-emerald-600">Jual: Rp ${(p.price || 0).toLocaleString('id-ID')}</span>
                    </div>
                    <div class="flex items-center justify-between mt-1 pt-1 border-t border-dashed border-gray-50">
                        <span class="text-[9px] px-1.5 py-0.5 rounded-md font-bold ${lowStockStyle}">Stok: ${p.stock || 0}</span>
                        <span class="text-[9px] font-black text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded-md">Margin: +Rp ${margin.toLocaleString('id-ID')}</span>
                    </div>
                </div>
                <div class="flex flex-col gap-1 shrink-0">
                    <button onclick="editProductOwner('${p.id}')" class="w-10 bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center"><i class="fa-solid fa-pen"></i></button>
                    <button onclick="deleteProductOwner('${p.id}')" class="w-10 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white py-1 rounded-lg text-[10px] font-bold transition flex items-center justify-center"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function editProductOwner(id) {
    const p = globalProducts.find(item => String(item.id) === String(id));
    if(!p) return;

    document.getElementById('own-prod-id').value = p.id;
    document.getElementById('own-prod-name').value = p.name;
    document.getElementById('own-prod-cost').value = p.cost || 0;
    document.getElementById('own-prod-price').value = p.price || 0;
    document.getElementById('own-prod-category').value = p.category || 'Makanan';
    document.getElementById('own-prod-stock').value = p.stock || 0;
    
    document.getElementById('own-prod-image-url').value = p.image || ''; 
    document.getElementById('own-prod-image-file').value = ""; 
    
    const preview = document.getElementById('own-prod-image-preview');
    if(p.image) preview.innerHTML = `<img src="${p.image}" class="w-full h-full object-cover">`;
    else preview.innerHTML = `<i class="fa-solid fa-image text-gray-400"></i>`;

    document.getElementById('btn-owner-submit-prod').innerText = "Perbarui Menu";
    document.getElementById('btn-owner-cancel-prod').classList.remove('hidden');
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteProductOwner(id) {
    if(!confirm("Hapus produk ini secara permanen?")) return;
    try {
        await db.ref('products/' + id).set(null); 
    } catch (e) { 
        alert("Gagal menghapus produk dari Firebase."); 
        console.error(e);
    }
}

function resetProductFormOwner() {
    document.getElementById('owner-product-form').reset();
    document.getElementById('own-prod-id').value = '';
    document.getElementById('own-prod-image-url').value = ''; 
    document.getElementById('own-prod-image-file').value = ''; 
    const preview = document.getElementById('own-prod-image-preview');
    if(preview) preview.innerHTML = `<i class="fa-solid fa-image text-gray-400"></i>`;
    document.getElementById('btn-owner-submit-prod').innerText = "Simpan Item";
    document.getElementById('btn-owner-cancel-prod').classList.add('hidden');
}

// ==========================================================================
// 9. MANAJEMEN PIN KASIR (PENGATURAN AKSES)
// ==========================================================================
async function updateCashierPin(e) {
    e.preventDefault();
    const nameInput = document.getElementById('config-cashier-input').value.trim().toLowerCase();
    const pinInput = document.getElementById('config-pin-input').value;
    const btn = document.getElementById('btn-save-pin');
    
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;
    
    try {
        await db.ref('cashier_pins/' + nameInput).set(pinInput);
        alert(`Akses untuk kasir ${nameInput.toUpperCase()} berhasil disimpan!`);
        e.target.reset();
    } catch (err) { 
        alert("Gagal menyimpan akses."); 
    } finally {
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Akses`;
    }
}

async function deleteCashierPin(name) {
    if(confirm(`Hapus akses login untuk akun kasir: ${name.toUpperCase()}?`)) {
        await db.ref('cashier_pins/' + name).set(null); 
    }
}

function editCashierPin(name, pin) {
    document.getElementById('config-cashier-input').value = name;
    document.getElementById('config-pin-input').value = pin;
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderConfiguredPins(snapshot) {
    const listContainer = document.getElementById('pin-configuration-list');
    if(!listContainer) return;
    listContainer.innerHTML = "";
    
    if(snapshot.exists()) {
        snapshot.forEach(child => {
            listContainer.innerHTML += `
                <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-emerald-300 transition-colors">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                            <i class="fa-solid fa-user-shield"></i>
                        </div>
                        <div class="min-w-0">
                            <h4 class="font-bold text-gray-800 text-sm capitalize truncate">${child.key}</h4>
                            <p class="text-[10px] text-gray-500 font-mono mt-0.5">PIN: <span class="font-black tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 rounded">${child.val()}</span></p>
                        </div>
                    </div>
                    <div class="flex gap-2 shrink-0">
                        <button onclick="editCashierPin('${child.key}', '${child.val()}')" class="w-8 h-8 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition flex items-center justify-center shrink-0"><i class="fa-solid fa-pen text-xs"></i></button>
                        <button onclick="deleteCashierPin('${child.key}')" class="w-8 h-8 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center shrink-0"><i class="fa-solid fa-trash-can text-xs"></i></button>
                    </div>
                </div>`;
        });
    } else {
        listContainer.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-gray-100 rounded-2xl shadow-sm">Belum ada akun kasir terdaftar.</div>`;
    }
}

// ==========================================================================
// 10. ABSENSI (LOG & REKAP)
// ==========================================================================
function renderLogAbsensi() {
    const listContainer = document.getElementById('list-absensi');
    if (!listContainer) return;
    let html = ''; 

    if (globalAttendanceData.length > 0) {
        globalAttendanceData.forEach(a => {
            let statusBadge = a.status === 'Sedang Bekerja' 
                ? `<span class="bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-emerald-100 shadow-sm"><i class="fa-solid fa-circle-play mr-1 animate-pulse"></i>Aktif</span>`
                : `<span class="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200"><i class="fa-solid fa-check mr-1"></i>Selesai</span>`;
            
            const gpsButton = (a.loginLocation && a.loginLocation !== '-' && !a.loginLocation.includes('Gagal')) 
                ? `<a href="${a.loginLocation}" target="_blank" class="w-full bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors border border-blue-100 py-2.5 rounded-xl text-[11px] font-bold flex justify-center items-center gap-2 mt-3 shadow-sm">
                    <i class="fa-solid fa-map-location-dot"></i> Buka Google Maps
                   </a>`
                : `<div class="w-full bg-red-50 text-red-500 border border-red-100 py-2.5 rounded-xl text-[11px] font-bold flex justify-center items-center mt-3 shadow-sm">
                    <i class="fa-solid fa-circle-xmark mr-2"></i> GPS Lemah / Tidak Aktif
                   </div>`;

            html += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <div class="flex justify-between items-start border-b border-gray-50 pb-3 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-gray-50 border border-gray-100 text-gray-400 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-user-clock"></i>
                            </div>
                            <div class="min-w-0">
                                <h4 class="font-bold text-gray-800 capitalize text-sm truncate">${a.cashierName}</h4>
                                <p class="text-[9px] text-gray-400 font-mono mt-0.5">${a.id}</p>
                            </div>
                        </div>
                        ${statusBadge}
                    </div>
                    
                    <div class="grid grid-cols-2 gap-3">
                        <div class="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-center">
                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Jam Masuk</p>
                            <p class="text-xs font-bold text-gray-700">${a.loginTime}</p>
                        </div>
                        <div class="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-center">
                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Jam Keluar</p>
                            <p class="text-xs font-bold text-gray-700">${a.logoutTime || '-'}</p>
                        </div>
                    </div>
                    ${gpsButton}
                </div>`;
        });
        listContainer.innerHTML = html;
    } else { 
        listContainer.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-gray-100 rounded-2xl shadow-sm col-span-full">Belum ada log kehadiran yang tercatat.</div>`; 
    }
}

function renderRekapAbsensi() {
    const container = document.getElementById('list-rekapabsensi');
    const monthInput = document.getElementById('filter-bulan-rekap');
    if (!container || !monthInput || !monthInput.value) return;

    const [selYear, selMonth] = monthInput.value.split('-');
    const targetStr = `${selMonth}/${selYear}`;
    const cashierData = {};

    globalAttendanceData.forEach(a => {
        if (a.loginTime && a.loginTime.includes(targetStr)) {
            const name = String(a.cashierName || 'Kasir').toLowerCase().trim();
            const day = parseInt(a.loginTime.split('/')[0], 10);
            
            if (!cashierData[name]) cashierData[name] = new Set();
            if (!isNaN(day)) cashierData[name].add(day);
        }
    });

    const keys = Object.keys(cashierData);
    if (keys.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-gray-100 rounded-2xl shadow-sm col-span-full">Belum ada rekap kehadiran bulan ini.</div>`;
        return;
    }

    let html = '';
    keys.forEach(name => {
        const workedDays = cashierData[name];
        const totalHadir = workedDays.size;

        let w1 = 0, w2 = 0, w3 = 0, w4 = 0;
        workedDays.forEach(d => {
            if (d >= 1 && d <= 7) w1++;
            else if (d >= 8 && d <= 14) w2++;
            else if (d >= 15 && d <= 21) w3++;
            else if (d >= 22) w4++; 
        });

        html += `
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition">
                <div class="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                    <h3 class="font-bold text-gray-800 capitalize text-sm flex items-center gap-2">
                        <i class="fa-solid fa-user-tag text-emerald-500"></i> ${name}
                    </h3>
                    <span class="bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-emerald-100">Total: ${totalHadir} Hari</span>
                </div>
                
                <div class="space-y-2">
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 1 <span class="text-[9px] text-gray-400 normal-case ml-1">(1-7)</span></span>
                        <span class="text-sm font-black ${w1 > 0 ? 'text-emerald-600' : 'text-gray-300'}">${w1} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 2 <span class="text-[9px] text-gray-400 normal-case ml-1">(8-14)</span></span>
                        <span class="text-sm font-black ${w2 > 0 ? 'text-emerald-600' : 'text-gray-300'}">${w2} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 3 <span class="text-[9px] text-gray-400 normal-case ml-1">(15-21)</span></span>
                        <span class="text-sm font-black ${w3 > 0 ? 'text-emerald-600' : 'text-gray-300'}">${w3} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 4 <span class="text-[9px] text-gray-400 normal-case ml-1">(22+)</span></span>
                        <span class="text-sm font-black ${w4 > 0 ? 'text-emerald-600' : 'text-gray-300'}">${w4} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

// ==========================================================================
// 11. LOG VOID / ANTI CHEAT
// ==========================================================================
function renderVoidLogs() {
    const container = document.getElementById('list-void-logs');
    if(!container) return;

    if(globalVoidLogs.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-400 text-xs py-12 bg-white border border-gray-100 rounded-2xl shadow-sm">Tidak ada riwayat aktivitas void / kecurangan terdeteksi. Aman.</div>`;
        return;
    }

    let html = '';
    globalVoidLogs.forEach(v => {
        html += `
            <div class="bg-white p-4 rounded-xl border border-red-100 shadow-xs flex justify-between items-center">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 bg-red-50 text-red-500 rounded-full flex items-center justify-center shrink-0">
                        <i class="fa-solid fa-ban text-sm"></i>
                    </div>
                    <div>
                        <h5 class="font-bold text-gray-800 text-xs sm:text-sm capitalize">${v.action || 'Pembatalan Item'}</h5>
                        <p class="text-[10px] text-gray-400 mt-0.5">Waktu: ${v.date} | Oleh: <b class="text-gray-600">${v.cashier || 'Kasir'}</b></p>
                        <p class="text-[11px] text-red-600 font-bold mt-1 bg-red-50/50 px-2 py-0.5 rounded border border-red-100/50 inline-block">${v.details || '-'}</p>
                    </div>
                </div>
                <div class="text-right shrink-0">
                    <span class="text-xs font-black text-gray-400 font-mono">#${v.trxId || '-'}</span>
                </div>
            </div>`;
    });
    container.innerHTML = html;
}

function switchListTab(tab) {
    const btnIn = document.getElementById('btn-tab-pemasukan');
    const btnOut = document.getElementById('btn-tab-pengeluaran');
    const listIn = document.getElementById('list-pemasukan');
    const listOut = document.getElementById('list-pengeluaran');

    if(tab === 'pemasukan') {
        btnIn.className = "px-3 py-1.5 text-[10px] font-bold rounded-md bg-white text-emerald-600 shadow-sm transition";
        btnOut.className = "px-3 py-1.5 text-[10px] font-bold rounded-md text-gray-400 hover:text-orange-500 transition";
        listIn.classList.remove('hidden');
        listOut.classList.add('hidden');
    } else {
        btnOut.className = "px-3 py-1.5 text-[10px] font-bold rounded-md bg-white text-orange-600 shadow-sm transition";
        btnIn.className = "px-3 py-1.5 text-[10px] font-bold rounded-md text-gray-400 hover:text-emerald-500 transition";
        listOut.classList.remove('hidden');
        listIn.classList.add('hidden');
    }
}