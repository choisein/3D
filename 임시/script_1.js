/* ========================================
   관리자 대시보드 JavaScript
   SecureBank - Credential Stuffing Detection System
   ======================================== */

// ========================================
// 전역 변수
// ========================================
let attackChart = null;
let currentFilter = 'all';
let updateInterval = null;

const API = {
    stats: 'status.php',
    loginLogs: 'login-logs.php',
    attackDistribution: 'attack-distribution.php'
};

// ========================================
// 초기화
// ========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('⚡ 관리자 대시보드 초기화');

    loadStatsData();
    loadLoginLogs();
    loadAttackDistribution();
    setupEventListeners();
    startAutoUpdate();
});

// ========================================
// 1. 통계 데이터 로드
// ========================================
async function loadStatsData() {
    try {
        const res = await fetch(API.stats);
        const data = await res.json();

        updateStatsUI(data);

        console.log("📌 통계 데이터:", data);
    } catch (e) {
        console.error("❌ 통계 데이터 로드 실패", e);
    }
}

function updateStatsUI(data) {
    document.getElementById('totalLoginAttempts').textContent =
        Number(data.totalLoginAttempts).toLocaleString();

    document.getElementById('detectedAttacks').textContent =
        Number(data.detectedAttacks).toLocaleString();

    document.getElementById('secondaryDefenseCount').textContent =
        Number(data.secondaryDefenseCount).toLocaleString();
}

// ========================================
// 2. 로그인 로그 로드
// ========================================
async function loadLoginLogs(page = 1, filter = currentFilter) {
    try {
        const res = await fetch(`${API.loginLogs}?page=${page}&filter=${filter}`);
        const data = await res.json();

        renderLoginLogsTable(data.logs);

        console.log("📌 로그인 로그:", data);
    } catch (e) {
        console.error("❌ 로그인 로그 로드 실패", e);
    }
}

function renderLoginLogsTable(logs) {
    const tbody = document.getElementById('loginLogsBody');
    tbody.innerHTML = '';

    if (!logs || logs.length === 0) {
        tbody.innerHTML = `
            <tr><td colspan="8" style="text-align:center; padding:20px;">
                표시할 로그가 없습니다.
            </td></tr>
        `;
        return;
    }

    logs.forEach(log => {
        const tr = document.createElement('tr');

        // 위험도 색상
        if (log.riskScore >= 70) tr.classList.add('risk-high');
        else if (log.riskScore >= 40) tr.classList.add('risk-medium');
        else tr.classList.add('risk-low');

        tr.innerHTML = `
            <td>${log.time}</td>
            <td>${escapeHtml(log.userId)}</td>
            <td>${escapeHtml(log.ip)}</td>
            <td class="truncate">${escapeHtml(log.userAgent)}</td>
            <td class="truncate">${escapeHtml(log.referer)}</td>
            <td>${escapeHtml(log.language)}</td>
            <td><span class="risk-badge">${log.riskScore}</span></td>
            <td><span class="status-badge">${log.status}</span></td>
        `;

        tbody.appendChild(tr);
    });
}

// ========================================
// 3. 공격 분포 차트
// ========================================
async function loadAttackDistribution() {
    try {
        const res = await fetch(API.attackDistribution);
        const data = await res.json();

        renderAttackChart(data);

        console.log("📌 공격 분포:", data);
    } catch (e) {
        console.error("❌ 공격 분포 로드 실패", e);
    }
}

function renderAttackChart(data) {
    const ctx = document.getElementById('attackDistributionChart');

    if (attackChart) attackChart.destroy();

    attackChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['IP 패턴', 'User-Agent 이상', 'Referer 불일치', '언어 이상'],
            datasets: [{
                data: [
                    data.ipDistribution,
                    data.userAgentAnomaly,
                    data.refererMismatch,
                    data.languageAnomaly
                ],
                backgroundColor: ['#ef4444','#f59e0b','#3b82f6','#8b5cf6'],
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { position: 'bottom' } }
        }
    });
}

// ========================================
// 이벤트 리스너
// ========================================
function setupEventListeners() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            currentFilter = btn.dataset.filter;
            loadLoginLogs(1, currentFilter);
        });
    });
}

// ========================================
// 실시간 자동 업데이트 (30초)
// ========================================
function startAutoUpdate() {
    updateInterval = setInterval(() => {
        loadStatsData();
        loadLoginLogs();
        loadAttackDistribution();
        updateLastUpdateTime();
    }, 30000);
}

function updateLastUpdateTime() {
    const el = document.getElementById('lastUpdateTime');
    if (!el) return;

    el.textContent = new Date().toLocaleString('ko-KR');
}

// ========================================
// 유틸
// ========================================
function escapeHtml(text) {
    if (text === null || text === undefined) return "";

    // 숫자면 문자열로 변환
    if (typeof text !== "string") {
        text = text.toString();
    }

    const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return text.replace(/[&<>"']/g, m => map[m]);
}

console.log("✅ 랜덤 없는 script_1.js 로드 완료");
