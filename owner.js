// Konfigurasi Firebase Linkneomeal
const firebaseConfig = {
    apiKey: "AIzaSyCAvkrPfkMs4TKofAwBPIPAmSVXnAAYF2s",
    authDomain: "linkneomeal-001.firebaseapp.com",
    projectId: "linkneomeal-001",
    storageBucket: "linkneomeal-001.firebasestorage.app",
    messagingSenderId: "518165236588",
    appId: "1:518165236588:web:0606d3da403339fd620149",
    databaseURL :"https://linkneomeal-001-default-rtdb.firebaseio.com"
};
  
firebase.initializeApp(firebaseConfig);
const db = firebase.database(); 

let globalAttendanceData = [];
let globalTransactions = []; 
let ownerFinanceFilter = 'semua'; 

document.addEventListener("DOMContentLoaded", () => {
    fetchTransactions();
    fetchConfiguredPins();
    fetchAttendance();

    const monthInput = document.getElementById('filter-bulan-rekap');
    if(monthInput) {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        monthInput.value = `${yyyy}-${mm}`;
        monthInput.addEventListener('change', renderRekapAbsensi);
    }
});

// -------------------------------------------------------------
// FUNGSI NAVIGASI APLIKASI
// -------------------------------------------------------------
function switchTab(tabId) {
    document.getElementById('panel-keuangan').classList.add('hidden');
    document.getElementById('panel-pengaturan').classList.add('hidden');
    document.getElementById('panel-absensi').classList.add('hidden');
    document.getElementById('panel-rekapabsensi').classList.add('hidden');
    
    const desktopInactive = "w-full text-left px-4 py-3.5 rounded-xl font-bold text-gray-500 hover:text-sage-700 hover:bg-sage-50 transition flex items-center gap-3";
    const desktopActive = "w-full text-left px-4 py-3.5 rounded-xl font-bold text-sage-700 bg-sage-100 transition flex items-center gap-3";
    document.getElementById('tab-desktop-keuangan').className = desktopInactive;
    document.getElementById('tab-desktop-pengaturan').className = desktopInactive;
    document.getElementById('tab-desktop-absensi').className = desktopInactive;
    document.getElementById('tab-desktop-rekapabsensi').className = desktopInactive;

    const mobileInactive = "flex-1 flex flex-col items-center justify-center py-1.5 text-gray-400 hover:text-sage-600 transition";
    const mobileActive = "flex-1 flex flex-col items-center justify-center py-1.5 text-sage-700 font-bold transition";
    document.getElementById('tab-mobile-keuangan').className = mobileInactive;
    document.getElementById('tab-mobile-pengaturan').className = mobileInactive;
    document.getElementById('tab-mobile-absensi').className = mobileInactive;
    document.getElementById('tab-mobile-rekapabsensi').className = mobileInactive;

    document.getElementById(`panel-${tabId}`).classList.remove('hidden');
    document.getElementById(`tab-desktop-${tabId}`).className = desktopActive;
    document.getElementById(`tab-mobile-${tabId}`).className = mobileActive;
}

// -------------------------------------------------------------
// OPERASI PENGATURAN KASIR (CRUD PIN)
// -------------------------------------------------------------
async function updateCashierPin(e) {
    e.preventDefault();
    const rawAccount = document.getElementById('config-cashier-input').value;
    const cashierAccount = rawAccount.trim().toLowerCase();
    const pinNumber = document.getElementById('config-pin-input').value;

    if(!cashierAccount || pinNumber.length !== 4) return alert('Username wajib diisi dan PIN harus 4 angka!');

    const btn = document.getElementById('btn-save-pin');
    btn.disabled = true; 
    btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Menyimpan...`;

    db.ref(`cashier_pins/${cashierAccount}`).set(pinNumber)
    .then(() => {
        document.getElementById('config-pin-input').value = "";
        document.getElementById('config-cashier-input').value = "";
        btn.disabled = false; 
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Data`;
    })
    .catch(err => {
        console.error(err); alert('Jaringan terputus.');
        btn.disabled = false; 
        btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan Data`;
    });
}

function editCashierPin(account, currentPin) {
    document.getElementById('config-cashier-input').value = account;
    document.getElementById('config-pin-input').value = currentPin;
    document.getElementById('btn-save-pin').innerHTML = `<i class="fa-solid fa-pen-to-square"></i> Perbarui Data`;
    document.getElementById('config-pin-input').focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function deleteCashierPin(account) {
    const isConfirm = confirm(`Hapus permanen akses untuk kasir: ${account.toUpperCase()}?\nMereka tidak akan bisa login lagi.`);
    if (!isConfirm) return;
    try { await db.ref(`cashier_pins/${account}`).remove(); } 
    catch (err) { console.error(err); alert('Gagal menghapus data kasir.'); }
}

function fetchConfiguredPins() {
    db.ref('cashier_pins').on('value', (snapshot) => {
        const listContainer = document.getElementById('pin-configuration-list');
        if(!listContainer) return;
        listContainer.innerHTML = "";
        
        if(snapshot.exists()) {
            snapshot.forEach(child => {
                listContainer.innerHTML += `
                    <div class="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center hover:border-sage-300 transition-colors">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-sage-50 text-sage-600 flex items-center justify-center">
                                <i class="fa-solid fa-user-shield"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 text-sm capitalize">${child.key}</h4>
                                <p class="text-[10px] text-gray-500 font-mono mt-0.5">PIN Akses: <span class="font-black tracking-widest text-sage-600 bg-sage-50 px-1.5 py-0.5 rounded">${child.val()}</span></p>
                            </div>
                        </div>
                        <div class="flex gap-2 shrink-0">
                            <button onclick="editCashierPin('${child.key}', '${child.val()}')" class="w-9 h-9 rounded-lg bg-blue-50 text-blue-500 hover:bg-blue-500 hover:text-white transition flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-pen text-sm"></i>
                            </button>
                            <button onclick="deleteCashierPin('${child.key}')" class="w-9 h-9 rounded-lg bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-trash-can text-sm"></i>
                            </button>
                        </div>
                    </div>`;
            });
        } else {
            listContainer.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-sage-100 rounded-2xl shadow-sm">Belum ada akun terdaftar.</div>`;
        }
    });
}

// -------------------------------------------------------------
// ANALITIK & FILTER KEUANGAN OWNER
// -------------------------------------------------------------
function parseDateOwner(dateStr) {
    if (!dateStr) return new Date();
    let str = String(dateStr).trim();
    if (str.includes('/')) {
        const parts = str.split(' ');
        const dateParts = parts[0].split('/');
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]);
    }
    return new Date(str);
}

function setOwnerFinanceFilter(type) {
    ownerFinanceFilter = type;
    
    document.querySelectorAll('.flt-btn').forEach(b => { 
        b.className = "flt-btn px-3 py-1.5 text-xs font-bold rounded-lg border border-sage-200 bg-white text-gray-600 transition"; 
    });
    document.getElementById(`btn-flt-${type}`).className = "flt-btn px-3 py-1.5 text-xs font-bold rounded-lg border border-sage-200 bg-sage-600 text-white transition shadow-sm";
    
    document.getElementById('kustom-date-inputs').classList.toggle('hidden', type !== 'kustom');
    
    renderKeuangan(); 
}

function getFilteredTransactions() {
    const today = new Date(); 
    const curDate = today.getDate(); 
    const curMonth = today.getMonth(); 
    const curYear = today.getFullYear();
    
    return globalTransactions.filter(t => {
        if(!t.date) return false;
        const tDate = parseDateOwner(t.date); 
        
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
        return true; // Default 'semua'
    });
}

function fetchTransactions() {
    db.ref('transactions').on('value', (snapshot) => {
        globalTransactions = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => { globalTransactions.push(child.val()); });
            globalTransactions.reverse(); 
        }
        renderKeuangan();
    });
}

function renderKeuangan() {
    const listContainer = document.getElementById('list-keuangan');
    let html = ''; 
    let totalNetto = 0; let totalDiskon = 0;
    let totalCash = 0; let totalQris = 0; let totalDebit = 0;
    
    const filteredData = getFilteredTransactions();

    if (filteredData.length > 0) {
        filteredData.forEach(t => {
            let netto = parseInt(t.total) || 0;
            let diskon = parseInt(t.discount) || 0;
            let method = String(t.method || '').trim();
            
            totalNetto += netto;
            totalDiskon += diskon;
            
            if (method === 'Tunai') totalCash += netto;
            else if (method === 'QRIS') totalQris += netto;
            else if (method === 'Debit') totalDebit += netto;
            else totalCash += netto; 
            
            let itemsList = (Array.isArray(t.items) ? t.items : []).map(i => `<span class="bg-gray-50 border border-gray-100 px-2 py-1 rounded-md text-[10px] font-bold text-gray-600 inline-block mr-1.5 mb-1.5">${i.qty}x ${i.name}</span>`).join('');
            
            html += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-sage-100 flex flex-col gap-3">
                    <div class="flex justify-between items-start border-b border-gray-50 pb-3">
                        <div class="flex gap-3">
                            <div class="w-10 h-10 rounded-xl bg-gray-50 text-gray-400 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-receipt"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 text-sm capitalize">${t.cashier || 'Umum'}</h4>
                                <p class="text-[10px] text-gray-400 mt-0.5"><i class="fa-regular fa-clock mr-1"></i>${t.date}</p>
                            </div>
                        </div>
                        <span class="bg-sage-50 text-sage-600 px-2.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-sage-100">${t.method}</span>
                    </div>
                    <div class="flex-1 w-full">${itemsList}</div>
                    <div class="flex justify-between items-end pt-1">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Total Nominal</span>
                        <h4 class="font-black text-sage-700 text-lg">Rp ${netto.toLocaleString('id-ID')}</h4>
                    </div>
                </div>`;
        });
        listContainer.innerHTML = html;
    } else { 
        listContainer.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-sage-100 rounded-2xl shadow-sm">Belum ada riwayat transaksi pada filter ini.</div>`; 
    }

    // Update Angka di Kartu Atas
    document.getElementById('owner-total-omset').innerText = `Rp ${totalNetto.toLocaleString('id-ID')}`;
    document.getElementById('owner-total-trx').innerText = `${filteredData.length} Nota`;
    document.getElementById('owner-total-diskon').innerText = `Rp ${totalDiskon.toLocaleString('id-ID')}`;
    document.getElementById('rep-cash-txt').innerText = `Rp ${totalCash.toLocaleString('id-ID')}`;
    document.getElementById('rep-qris-txt').innerText = `Rp ${totalQris.toLocaleString('id-ID')}`;
    document.getElementById('rep-debit-txt').innerText = `Rp ${totalDebit.toLocaleString('id-ID')}`;

    // Update Grafik Visual
    updateFinanceChart(filteredData);
}

// -------------------------------------------------------------
// LOGIKA GRAFIK KEUANGAN (CHART.JS) - VERSI BAR CHART
// -------------------------------------------------------------
function updateFinanceChart(filteredData) {
    const ctx = document.getElementById('financeChart');
    if (!ctx) return;

    // Balik urutan agar di grafik terbaca dari kiri (terlama) ke kanan (terbaru)
    const chartData = [...filteredData].reverse();
    const aggregatedData = {};

    chartData.forEach(t => {
        let label = "";
        if (ownerFinanceFilter === 'hari') {
            // Jika hari ini, kelompokkan pendapatan per jam (contoh: 08:00, 09:00)
            const timePart = t.date.split(' ')[1];
            if (timePart) {
                label = timePart.split(':')[0] + ':00';
            } else {
                label = t.date;
            }
        } else {
            // Jika bulan/semua/kustom, kelompokkan per tanggal (contoh: 19/06/2026)
            label = t.date.split(' ')[0];
        }
        
        if (!aggregatedData[label]) aggregatedData[label] = 0;
        aggregatedData[label] += (parseInt(t.total) || 0);
    });

    const labels = Object.keys(aggregatedData);
    const dataValues = Object.values(aggregatedData);

    // Hancurkan grafik lama sebelum menimpa dengan yang baru
    if (window.financeChartInstance) {
        window.financeChartInstance.destroy();
    }

    window.financeChartInstance = new Chart(ctx.getContext('2d'), {
        type: 'bar', // KUNCI: Ubah tipe menjadi batang (bar)
        data: {
            labels: labels,
            datasets: [{
                label: 'Omset Bersih',
                data: dataValues,
                backgroundColor: '#708238', // Warna solid sage
                hoverBackgroundColor: '#8ba352', // Warna sedikit lebih terang saat disentuh/hover
                borderRadius: 6, // Sudut batang agak membulat atas bawah
                borderSkipped: false,
                barPercentage: 0.6 // Lebar batang (0.6 berarti tidak terlalu gemuk)
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(0,0,0,0.8)',
                    titleFont: { size: 11 },
                    bodyFont: { size: 13, weight: 'bold' },
                    callbacks: {
                        label: function(context) {
                            return 'Rp ' + context.parsed.y.toLocaleString('id-ID');
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { font: { size: 10 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { borderDash: [4, 4], color: '#e3eae2' },
                    ticks: {
                        font: { size: 10 },
                        callback: function(value) {
                            if (value >= 1000000) return 'Rp' + (value / 1000000) + 'M';
                            if (value >= 1000) return 'Rp' + (value / 1000) + 'K';
                            return 'Rp' + value;
                        }
                    }
                }
            }
        }
    });
}

// -------------------------------------------------------------
// FITUR EXPORT EXCEL & SMART DELETE TRANSAKSI
// -------------------------------------------------------------
function exportExcelOwner() {
    const data = getFilteredTransactions(); 
    if(data.length === 0) return alert('Tidak ada data pada periode ini untuk diexport.');
    
    const rows = data.map(t => ({
        "ID Transaksi": t.id, 
        "Waktu": t.date, 
        "Nama Pelanggan": t.customer, 
        "No WA": t.phone || '-', 
        "Metode Bayar": t.method,
        "Rincian Item": (Array.isArray(t.items) ? t.items : []).map(i => `${i.name} (${i.qty}x)`).join(', '), 
        "Diskon (Rp)": parseInt(t.discount) || 0, 
        "Omset Bersih (Rp)": parseInt(t.total) || 0,
        "Kasir Penanggungjawab": t.cashier
    }));
    
    const ws = XLSX.utils.json_to_sheet(rows); 
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Laporan Penjualan"); 
    
    let filename = `Laporan_Penjualan_${ownerFinanceFilter.toUpperCase()}.xlsx`;
    XLSX.writeFile(wb, filename);
}

async function deleteAllTransactions() {
    const konfirmasi = confirm("APAKAH ANDA YAKIN INGIN MENGHAPUS SEMUA DATA TRANSAKSI?\n\nTenang saja, Sistem akan otomatis mengekstrak dan menyelamatkan nama Member/Pelanggan ke buku kontak sebelum nota dihapus.");
    if(!konfirmasi) return;

    try {
        let savedCustomers = {};
        globalTransactions.forEach(t => {
            let name = String(t.customer || '').trim();
            let phone = String(t.phone || '').trim();
            
            if(name && name.toLowerCase() !== 'umum' && name.toLowerCase() !== 'baru') {
                let safeKey = name.replace(/[.#$[\]]/g, '').trim();
                savedCustomers[safeKey] = {
                    name: name,
                    phone: phone || '-'
                };
            }
        });

        if(Object.keys(savedCustomers).length > 0) {
            await db.ref('customers').update(savedCustomers);
            console.log("Data member berhasil diselamatkan.");
        }

        await db.ref('transactions').remove();
        alert("Pembersihan Selesai! Semua riwayat transaksi berhasil dihapus, dan kontak pelanggan tetap aman.");

    } catch (e) {
        console.error(e);
        alert("Terjadi kesalahan saat proses pembersihan data.");
    }
}

// -------------------------------------------------------------
// PENGAMBILAN DATA ABSENSI
// -------------------------------------------------------------
function fetchAttendance() {
    db.ref('attendance').on('value', (snapshot) => {
        globalAttendanceData = [];
        if (snapshot.exists()) {
            snapshot.forEach(child => { globalAttendanceData.push(child.val()); });
            globalAttendanceData.reverse(); 
        }
        renderLogAbsensi();
        renderRekapAbsensi();
    });
}

// -------------------------------------------------------------
// HALAMAN: LOG ABSENSI MENTAH (RIWAYAT MUTASI)
// -------------------------------------------------------------
function renderLogAbsensi() {
    const listContainer = document.getElementById('list-absensi');
    if (!listContainer) return;
    let html = ''; 

    if (globalAttendanceData.length > 0) {
        globalAttendanceData.forEach(a => {
            let statusBadge = a.status === 'Sedang Bekerja' 
                ? `<span class="bg-sage-50 text-sage-600 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-sage-100"><i class="fa-solid fa-circle-play mr-1 animate-pulse"></i>Aktif</span>`
                : `<span class="bg-gray-100 text-gray-500 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-gray-200"><i class="fa-solid fa-check mr-1"></i>Selesai</span>`;
            
            // LOGIKA LINK GPS
            // Jika ada data lokasi, tampilkan tombolnya. Jika '-', berarti lokasi gagal didapat.
            const gpsButton = (a.loginLocation && a.loginLocation !== '-') 
                ? `<a href="${a.loginLocation}" target="_blank" class="w-full bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-colors border border-blue-100 py-2.5 rounded-xl text-[11px] font-bold flex justify-center items-center gap-2 mt-3">
                    <i class="fa-solid fa-map-location-dot"></i> Lihat Titik Lokasi Login
                   </a>`
                : `<div class="w-full bg-red-50 text-red-500 border border-red-100 py-2.5 rounded-xl text-[11px] font-bold flex justify-center items-center mt-3">
                    <i class="fa-solid fa-circle-xmark mr-2"></i> Lokasi tidak ditemukan
                   </div>`;

            html += `
                <div class="bg-white p-4 rounded-2xl shadow-sm border border-sage-100">
                    <div class="flex justify-between items-start border-b border-gray-50 pb-3 mb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-full bg-gray-50 text-gray-400 flex items-center justify-center">
                                <i class="fa-solid fa-user-clock"></i>
                            </div>
                            <div>
                                <h4 class="font-bold text-gray-800 capitalize text-sm">${a.cashierName}</h4>
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
        listContainer.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-sage-100 rounded-2xl shadow-sm">Belum ada log kehadiran yang tercatat.</div>`; 
    }
}

// -------------------------------------------------------------
// HALAMAN: REKAP ABSENSI (PER MINGGU)
// -------------------------------------------------------------
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
        container.innerHTML = `<div class="text-center text-gray-400 text-xs py-8 bg-white border border-sage-100 rounded-2xl shadow-sm col-span-full">Belum ada data rekapitulasi untuk bulan yang dipilih.</div>`;
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
            <div class="bg-white p-5 rounded-2xl shadow-sm border border-sage-100 flex flex-col">
                <div class="flex justify-between items-center mb-4 border-b border-gray-50 pb-3">
                    <h3 class="font-bold text-gray-800 capitalize text-sm flex items-center gap-2">
                        <i class="fa-solid fa-user-tag text-sage-400"></i> ${name}
                    </h3>
                    <span class="bg-sage-50 text-sage-600 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-sage-100">Total: ${totalHadir} Hari</span>
                </div>
                
                <div class="space-y-2">
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 1 <span class="text-[9px] text-gray-400 normal-case ml-1">(Tgl 1-7)</span></span>
                        <span class="text-sm font-black ${w1 > 0 ? 'text-sage-600' : 'text-gray-300'}">${w1} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 2 <span class="text-[9px] text-gray-400 normal-case ml-1">(Tgl 8-14)</span></span>
                        <span class="text-sm font-black ${w2 > 0 ? 'text-sage-600' : 'text-gray-300'}">${w2} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 3 <span class="text-[9px] text-gray-400 normal-case ml-1">(Tgl 15-21)</span></span>
                        <span class="text-sm font-black ${w3 > 0 ? 'text-sage-600' : 'text-gray-300'}">${w3} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                    <div class="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-100">
                        <span class="text-[10px] font-bold text-gray-500 uppercase">Minggu 4 <span class="text-[9px] text-gray-400 normal-case ml-1">(Tgl 22+)</span></span>
                        <span class="text-sm font-black ${w4 > 0 ? 'text-sage-600' : 'text-gray-300'}">${w4} <span class="text-[10px] font-bold">Hari</span></span>
                    </div>
                </div>
            </div>`;
    });

    container.innerHTML = html;
}