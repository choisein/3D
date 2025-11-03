/* ========================================
   관리자 대시보드 JavaScript
   SecureBank - Credential Stuffing Detection System
   
   주요 기능:
   1. 백엔드 API 연동 (프로토타입은 시뮬레이션)
   2. 통계 데이터 렌더링
   3. 로그인 기록 테이블 렌더링
   4. Chart.js를 이용한 원 그래프 생성
   5. 실시간 데이터 업데이트
   6. 필터링 및 검색 기능
   ======================================== */

// ========================================
// 전역 변수 및 설정
// ========================================

// Chart.js 인스턴스 저장 (차트 업데이트용)
let attackChart = null;

// 현재 필터 상태
let currentFilter = 'all'; // 'all', 'suspicious', 'blocked'

// 자동 업데이트 인터벌 (30초마다)
let updateInterval = null;

// API 엔드포인트 (실제 백엔드 구축 시 수정)
const API_ENDPOINTS = {
    // 통계 데이터 API
    stats: '/api/admin/stats',
    
    // 로그인 기록 API (페이지네이션 지원)
    loginLogs: '/api/admin/login-logs',
    
    // 공격 탐지 분포 API
    attackDistribution: '/api/admin/attack-distribution'
};

// ========================================
// DOM 로드 완료 후 초기화
// ========================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('관리자 대시보드 초기화 시작...');
    
    // 1. 통계 데이터 로드
    loadStatsData();
    
    // 2. 로그인 기록 로드
    loadLoginLogs();
    
    // 3. 공격 분포 차트 생성
    createAttackChart();
    
    // 4. 이벤트 리스너 설정
    setupEventListeners();
    
    // 5. 실시간 업데이트 시작 (30초마다)
    startAutoUpdate();
    
    console.log('관리자 대시보드 초기화 완료');
});

// ========================================
// 1. 통계 데이터 로드 및 렌더링
// 백엔드 API: GET /api/admin/stats
// 응답 형식:
// {
//     "totalLoginAttempts": 1247,
//     "detectedAttacks": 247,
//     "secondaryDefenseCount": 89,
//     "percentageChanges": {
//         "totalLoginAttempts": 12,
//         "detectedAttacks": 8,
//         "secondaryDefenseCount": 5
//     }
// }
// ========================================
async function loadStatsData() {
    try {
        // TODO: 실제 백엔드 API 호출로 교체
        // const response = await fetch(API_ENDPOINTS.stats);
        // const data = await response.json();
        
        // ===== 프로토타입: 시뮬레이션 데이터 =====
        const data = simulateStatsData();
        
        // DOM 업데이트
        updateStatsUI(data);
        
        console.log('통계 데이터 로드 완료:', data);
    } catch (error) {
        console.error('통계 데이터 로드 실패:', error);
        showErrorNotification('통계 데이터를 불러올 수 없습니다.');
    }
}

// 통계 데이터 시뮬레이션 (실제로는 백엔드에서 가져옴)
function simulateStatsData() {
    return {
        totalLoginAttempts: Math.floor(Math.random() * 500) + 1000,
        detectedAttacks: Math.floor(Math.random() * 100) + 200,
        secondaryDefenseCount: Math.floor(Math.random() * 50) + 50,
        percentageChanges: {
            totalLoginAttempts: (Math.random() * 20 - 5).toFixed(1),
            detectedAttacks: (Math.random() * 15 - 2).toFixed(1),
            secondaryDefenseCount: (Math.random() * 10).toFixed(1)
        }
    };
}

// 통계 UI 업데이트
function updateStatsUI(data) {
    // 1. 총 로그인 시도 횟수
    document.getElementById('totalLoginAttempts').textContent = 
        data.totalLoginAttempts.toLocaleString();
    
    // 2. 탐지된 공격 수
    document.getElementById('detectedAttacks').textContent = 
        data.detectedAttacks.toLocaleString();
    
    // 3. 2차 방어 시행 횟수
    document.getElementById('secondaryDefenseCount').textContent = 
        data.secondaryDefenseCount.toLocaleString();
    
    // 변화율 업데이트 (선택 사항)
    updatePercentageChanges(data.percentageChanges);
}

// 변화율 업데이트
function updatePercentageChanges(changes) {
    const changeElements = document.querySelectorAll('.stat-change');
    
    if (changeElements.length >= 3) {
        // 총 로그인 시도 변화율
        updateChangeElement(changeElements[0], changes.totalLoginAttempts);
        
        // 탐지된 공격 변화율
        updateChangeElement(changeElements[1], changes.detectedAttacks);
        
        // 2차 방어 변화율
        updateChangeElement(changeElements[2], changes.secondaryDefenseCount);
    }
}

function updateChangeElement(element, value) {
    const isPositive = value > 0;
    const arrow = isPositive ? '↑' : '↓';
    
    element.textContent = `${arrow} ${Math.abs(value)}% (지난 시간 대비)`;
    
    // 클래스 업데이트
    element.classList.remove('positive', 'negative');
    if (isPositive) {
        element.classList.add('positive');
    } else if (value < 0) {
        element.classList.add('negative');
    }
}

// ========================================
// 2. 로그인 기록 로드 및 렌더링
// 백엔드 API: GET /api/admin/login-logs?page=1&filter=all
// 응답 형식:
// {
//     "logs": [
//         {
//             "id": 1,
//             "time": "14:32:15",
//             "userId": "user123",
//             "ip": "203.142.78.45",
//             "userAgent": "Mozilla/5.0...",
//             "referer": "https://google.com",
//             "language": "ko-KR",
//             "riskScore": 85,
//             "status": "blocked"
//         },
//         ...
//     ],
//     "totalPages": 10,
//     "currentPage": 1
// }
// ========================================
async function loadLoginLogs(page = 1, filter = 'all') {
    try {
        // TODO: 실제 백엔드 API 호출로 교체
        // const response = await fetch(`${API_ENDPOINTS.loginLogs}?page=${page}&filter=${filter}`);
        // const data = await response.json();
        
        // ===== 프로토타입: 시뮬레이션 데이터 =====
        const data = simulateLoginLogs(filter);
        
        // 테이블 렌더링
        renderLoginLogsTable(data.logs);
        
        console.log('로그인 기록 로드 완료:', data);
    } catch (error) {
        console.error('로그인 기록 로드 실패:', error);
        showErrorNotification('로그인 기록을 불러올 수 없습니다.');
    }
}

// 로그인 기록 시뮬레이션 (실제로는 백엔드에서 가져옴)
function simulateLoginLogs(filter) {
    const allLogs = [
        {
            id: 1,
            time: getCurrentTime(),
            userId: 'user' + Math.floor(Math.random() * 1000),
            ip: generateRandomIP(),
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            referer: 'https://google.com',
            language: 'ko-KR',
            riskScore: Math.floor(Math.random() * 100),
            status: Math.random() > 0.7 ? 'blocked' : (Math.random() > 0.5 ? 'suspicious' : 'normal')
        },
        {
            id: 2,
            time: getCurrentTime(-60),
            userId: 'admin',
            ip: generateRandomIP(),
            userAgent: 'Python-requests/2.28.0',
            referer: '-',
            language: 'en-US',
            riskScore: Math.floor(Math.random() * 40) + 60,
            status: 'suspicious'
        },
        {
            id: 3,
            time: getCurrentTime(-120),
            userId: 'testuser',
            ip: '127.0.0.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            referer: 'https://securebank.com',
            language: 'ko-KR',
            riskScore: Math.floor(Math.random() * 30),
            status: 'normal'
        },
        {
            id: 4,
            time: getCurrentTime(-180),
            userId: 'hacker' + Math.floor(Math.random() * 100),
            ip: generateRandomIP(),
            userAgent: 'curl/7.68.0',
            referer: '-',
            language: '-',
            riskScore: Math.floor(Math.random() * 20) + 80,
            status: 'blocked'
        },
        {
            id: 5,
            time: getCurrentTime(-240),
            userId: 'user' + Math.floor(Math.random() * 1000),
            ip: generateRandomIP(),
            userAgent: 'Mozilla/5.0 (Linux; Android 10)',
            referer: 'https://naver.com',
            language: 'ko-KR',
            riskScore: Math.floor(Math.random() * 50),
            status: 'normal'
        }
    ];
    
    // 필터링 적용
    let filteredLogs = allLogs;
    if (filter === 'suspicious') {
        filteredLogs = allLogs.filter(log => log.status === 'suspicious');
    } else if (filter === 'blocked') {
        filteredLogs = allLogs.filter(log => log.status === 'blocked');
    }
    
    return {
        logs: filteredLogs,
        totalPages: 10,
        currentPage: 1
    };
}

// 로그인 기록 테이블 렌더링
function renderLoginLogsTable(logs) {
    const tbody = document.getElementById('loginLogsBody');
    
    if (!tbody) {
        console.error('테이블 body 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 기존 내용 제거
    tbody.innerHTML = '';
    
    // 로그가 없는 경우
    if (logs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">
                    표시할 로그인 기록이 없습니다.
                </td>
            </tr>
        `;
        return;
    }
    
    // 각 로그를 행으로 추가
    logs.forEach(log => {
        const tr = document.createElement('tr');
        
        // 위험도에 따른 클래스 추가
        if (log.riskScore >= 70) {
            tr.classList.add('risk-high');
        } else if (log.riskScore >= 40) {
            tr.classList.add('risk-medium');
        } else {
            tr.classList.add('risk-low');
        }
        
        // 행 내용 생성
        tr.innerHTML = `
            <td>${log.time}</td>
            <td>${escapeHtml(log.userId)}</td>
            <td>${escapeHtml(log.ip)}</td>
            <td class="truncate" title="${escapeHtml(log.userAgent)}">${escapeHtml(log.userAgent)}</td>
            <td class="truncate" title="${escapeHtml(log.referer)}">${escapeHtml(log.referer)}</td>
            <td>${escapeHtml(log.language)}</td>
            <td>
                <span class="risk-badge ${getRiskClass(log.riskScore)}">${log.riskScore}</span>
            </td>
            <td>
                <span class="status-badge ${getStatusClass(log.status)}">${getStatusText(log.status)}</span>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

// 위험도에 따른 클래스 반환
function getRiskClass(score) {
    if (score >= 70) return 'risk-high';
    if (score >= 40) return 'risk-medium';
    return 'risk-low';
}

// 상태에 따른 클래스 반환
function getStatusClass(status) {
    if (status === 'blocked') return 'status-blocked';
    if (status === 'suspicious') return 'status-warning';
    return 'status-success';
}

// 상태 텍스트 반환
function getStatusText(status) {
    if (status === 'blocked') return '차단됨';
    if (status === 'suspicious') return '의심';
    return '정상';
}

// ========================================
// 3. 공격 분포 차트 생성 (Chart.js)
// 백엔드 API: GET /api/admin/attack-distribution
// 응답 형식:
// {
//     "ipDistribution": 45,
//     "userAgentAnomaly": 40,
//     "refererMismatch": 10,
//     "languageAnomaly": 5
// }
// ========================================
async function createAttackChart() {
    try {
        // TODO: 실제 백엔드 API 호출로 교체
        // const response = await fetch(API_ENDPOINTS.attackDistribution);
        // const data = await response.json();
        
        // ===== 프로토타입: 시뮬레이션 데이터 =====
        const data = {
            ipDistribution: 45,
            userAgentAnomaly: 40,
            refererMismatch: 10,
            languageAnomaly: 5
        };
        
        // 차트 생성
        renderAttackChart(data);
        
        console.log('공격 분포 차트 생성 완료:', data);
    } catch (error) {
        console.error('차트 생성 실패:', error);
        showErrorNotification('차트를 생성할 수 없습니다.');
    }
}

// 공격 분포 차트 렌더링
function renderAttackChart(data) {
    const ctx = document.getElementById('attackDistributionChart');
    
    if (!ctx) {
        console.error('차트 캔버스 요소를 찾을 수 없습니다.');
        return;
    }
    
    // 기존 차트가 있으면 제거
    if (attackChart) {
        attackChart.destroy();
    }
    
    // 차트 데이터 구성
    const chartData = {
        labels: [
            'IP 주소 패턴',
            'User-Agent 이상',
            'Referer 불일치',
            '언어 설정 이상'
        ],
        datasets: [{
            data: [
                data.ipDistribution,
                data.userAgentAnomaly,
                data.refererMismatch,
                data.languageAnomaly
            ],
            backgroundColor: [
                '#ef4444',  // 빨강 (IP 패턴)
                '#f59e0b',  // 주황 (User-Agent)
                '#3b82f6',  // 파랑 (Referer)
                '#8b5cf6'   // 보라 (언어)
            ],
            borderWidth: 2,
            borderColor: '#ffffff'
        }]
    };
    
    // 차트 옵션
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    font: {
                        size: 14,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    padding: 15,
                    usePointStyle: true
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleFont: {
                    size: 14,
                    family: "'Noto Sans KR', sans-serif"
                },
                bodyFont: {
                    size: 13,
                    family: "'Noto Sans KR', sans-serif"
                },
                padding: 12,
                callbacks: {
                    label: function(context) {
                        return context.label + ': ' + context.parsed + '%';
                    }
                }
            }
        }
    };
    
    // Chart.js로 도넛 차트 생성
    attackChart = new Chart(ctx, {
        type: 'doughnut',
        data: chartData,
        options: chartOptions
    });
}

// ========================================
// 4. 이벤트 리스너 설정
// ========================================
function setupEventListeners() {
    // 필터 버튼 클릭 이벤트
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // 활성 클래스 토글
            filterButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            // 필터 적용
            currentFilter = this.dataset.filter;
            loadLoginLogs(1, currentFilter);
        });
    });
    
    // 페이지네이션 버튼 (추후 구현)
    const paginationButtons = document.querySelectorAll('.pagination-btn');
    paginationButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            console.log('페이지네이션 클릭:', this.textContent);
            // TODO: 페이지네이션 로직 구현
        });
    });
}

// ========================================
// 5. 실시간 업데이트
// ========================================
function startAutoUpdate() {
    // 30초마다 데이터 자동 업데이트
    updateInterval = setInterval(() => {
        console.log('실시간 데이터 업데이트 중...');
        
        // 통계 데이터 업데이트
        loadStatsData();
        
        // 로그인 기록 업데이트
        loadLoginLogs(1, currentFilter);
        
        // 차트 데이터 업데이트
        updateChartData();
        
        // 마지막 업데이트 시간 표시
        updateLastUpdateTime();
    }, 30000); // 30초
}

// 차트 데이터 업데이트
function updateChartData() {
    if (!attackChart) return;
    
    // 시뮬레이션: 랜덤 데이터 생성
    const newData = {
        ipDistribution: Math.floor(Math.random() * 20) + 35,
        userAgentAnomaly: Math.floor(Math.random() * 20) + 30,
        refererMismatch: Math.floor(Math.random() * 10) + 5,
        languageAnomaly: Math.floor(Math.random() * 10)
    };
    
    // 합이 100이 되도록 조정
    const total = newData.ipDistribution + newData.userAgentAnomaly + 
                  newData.refererMismatch + newData.languageAnomaly;
    
    attackChart.data.datasets[0].data = [
        Math.round(newData.ipDistribution / total * 100),
        Math.round(newData.userAgentAnomaly / total * 100),
        Math.round(newData.refererMismatch / total * 100),
        Math.round(newData.languageAnomaly / total * 100)
    ];
    
    attackChart.update();
}

// 마지막 업데이트 시간 표시
function updateLastUpdateTime() {
    const timeElement = document.getElementById('lastUpdateTime');
    if (timeElement) {
        timeElement.textContent = new Date().toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }
}

// ========================================
// 유틸리티 함수
// ========================================

// 현재 시간 가져오기 (HH:MM:SS)
function getCurrentTime(offsetSeconds = 0) {
    const now = new Date(Date.now() + offsetSeconds * 1000);
    return now.toTimeString().split(' ')[0];
}

// 랜덤 IP 생성
function generateRandomIP() {
    return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.` +
           `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

// HTML 이스케이프 (XSS 방지)
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.toString().replace(/[&<>"']/g, m => map[m]);
}

// 에러 알림 표시
function showErrorNotification(message) {
    // 기존 showNotification 함수 재사용 (script.js에 정의됨)
    if (typeof showNotification === 'function') {
        showNotification(message, 'error');
    } else {
        alert(message);
    }
}

// 로그아웃 함수
function logout() {
    if (confirm('로그아웃하시겠습니까?')) {
        // 자동 업데이트 중지
        if (updateInterval) {
            clearInterval(updateInterval);
        }
        
        // TODO: 실제 로그아웃 API 호출
        // await fetch('/api/auth/logout', { method: 'POST' });
        
        // 메인 페이지로 이동
        window.location.href = 'index.html';
    }
}

// ========================================
// 백엔드 연동 가이드
// ========================================

/*
=== 백엔드 API 구현 가이드 ===

1. 통계 데이터 API
   - URL: GET /api/admin/stats
   - 응답:
     {
       "totalLoginAttempts": 1247,
       "detectedAttacks": 247,
       "secondaryDefenseCount": 89,
       "percentageChanges": {
         "totalLoginAttempts": 12,
         "detectedAttacks": 8,
         "secondaryDefenseCount": 5
       }
     }
   - 구현: Loginlog 테이블에서 COUNT(*), 위험도 기반 필터링

2. 로그인 기록 API
   - URL: GET /api/admin/login-logs?page=1&filter=all
   - 쿼리 파라미터:
     * page: 페이지 번호
     * filter: 'all', 'suspicious', 'blocked'
   - 응답:
     {
       "logs": [
         {
           "id": 1,
           "time": "14:32:15",
           "userId": "user123",
           "ip": "203.142.78.45",
           "userAgent": "Mozilla/5.0...",
           "referer": "https://google.com",
           "language": "ko-KR",
           "riskScore": 85,
           "status": "blocked"
         }
       ],
       "totalPages": 10,
       "currentPage": 1
     }
   - 구현: Loginlog 테이블 JOIN IDsave, 페이지네이션, 위험도 필터링

3. 공격 분포 API
   - URL: GET /api/admin/attack-distribution
   - 응답:
     {
       "ipDistribution": 45,
       "userAgentAnomaly": 40,
       "refererMismatch": 10,
       "languageAnomaly": 5
     }
   - 구현: 탐지 로직에서 각 기준별 탐지 건수 집계

=== PHP 예시 (login_logs API) ===

<?php
require_once 'connect.php';
header('Content-Type: application/json; charset=utf-8');

$page = $_GET['page'] ?? 1;
$filter = $_GET['filter'] ?? 'all';
$limit = 20;
$offset = ($page - 1) * $limit;

// 필터 조건
$whereClause = '';
if ($filter === 'suspicious') {
    $whereClause = 'WHERE risk_score BETWEEN 40 AND 69';
} elseif ($filter === 'blocked') {
    $whereClause = 'WHERE risk_score >= 70';
}

// 로그 조회
$stmt = $pdo->prepare("
    SELECT 
        l.lognum as id,
        TIME(l.data) as time,
        i.ID as userId,
        l.IP as ip,
        l.user_agent as userAgent,
        l.referer,
        l.language,
        l.risk_score as riskScore,
        CASE 
            WHEN l.risk_score >= 70 THEN 'blocked'
            WHEN l.risk_score >= 40 THEN 'suspicious'
            ELSE 'normal'
        END as status
    FROM Loginlog l
    JOIN IDsave i ON l.Usernum = i.Usernum
    $whereClause
    ORDER BY l.data DESC
    LIMIT ? OFFSET ?
");
$stmt->execute([$limit, $offset]);
$logs = $stmt->fetchAll();

// 총 페이지 수
$totalStmt = $pdo->query("SELECT COUNT(*) FROM Loginlog $whereClause");
$totalLogs = $totalStmt->fetchColumn();
$totalPages = ceil($totalLogs / $limit);

echo json_encode([
    'logs' => $logs,
    'totalPages' => $totalPages,
    'currentPage' => (int)$page
], JSON_UNESCAPED_UNICODE);
?>

*/

console.log('관리자 대시보드 스크립트 로드 완료');