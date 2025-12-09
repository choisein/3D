// SecureBank - 길게 누르기 기반 캡차 + 보안 알림 시스템

// ============================================
// 전역 변수
// ============================================
// let isLoading = false;
let isLoggedIn = false;
let currentUser = null;

const LOGIN_API = 'login.php';
const SIGNUP_API = 'signup.php';
const LOGOUT_API = 'logout.php';

// 캡차 시스템 변수 (길게 누르기 기반)
let captchaVerified = false;
let captchaPressStart = null;    // 버튼 누르기 시작 시각
let captchaHoldDuration = 0;     // 마지막 누른 시간(ms)
let captchaAttemptCount = 0;     // 캡차 검증 시도 횟수
let captchaRenderInterval = null; // 필요시 효과용 인터벌

let mouseMovements = [];
let isTrackingMouse = false;
let securityAlerts = [];

// ============================================
// DOM 로드 완료 후 실행
// ============================================
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
    loadSecurityAlerts();
});

function initializeApp() {
    setupEventListeners();
    checkLoginStatus();
    console.log('🚀 SecureBank 시스템 로드 완료');
}

function checkLoginStatus() {
    const savedUser = sessionStorage.getItem('currentUser');

    // 값이 없거나, 잘못된 문자열이면 무시하고 정리
    if (!savedUser || savedUser === 'undefined' || savedUser === 'null') {
        sessionStorage.removeItem('currentUser');
        isLoggedIn = false;
        currentUser = null;
        return;
    }

    try {
        const parsed = JSON.parse(savedUser);
        if (parsed && typeof parsed === 'object') {
            currentUser = parsed;
            isLoggedIn = true;
            updateUIForLoggedInUser();
        } else {
            sessionStorage.removeItem('currentUser');
            isLoggedIn = false;
            currentUser = null;
        }
    } catch (e) {
        console.error('⚠️ currentUser 세션 파싱 오류:', e, savedUser);
        sessionStorage.removeItem('currentUser');
        isLoggedIn = false;
        currentUser = null;
    }
}

function updateUIForLoggedInUser() {
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons && currentUser) {
        authButtons.innerHTML = `
            <span style="margin-right: 16px; color: var(--text-primary);">${currentUser.name}님</span>
            <button class="btn btn-outline" onclick="handleLogout()">로그아웃</button>
        `;
    }
}

function handleLogout() {
    isLoggedIn = false;
    currentUser = null;
    sessionStorage.removeItem('currentUser');

    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons) {
        authButtons.innerHTML = `
            <button class="btn btn-outline" onclick="openModal('loginModal')">로그인</button>
            <button class="btn btn-primary" onclick="openModal('signupModal')">회원가입</button>
        `;
    }

    fetch(LOGOUT_API, { method: 'POST' }).catch(() => { });
    showNotification('로그아웃되었습니다.', 'success');
}

// ============================================
// 이벤트 리스너 설정
// ============================================
function setupEventListeners() {
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            closeAllModals();
            closeSecurityPanel();
        }
    });

    window.addEventListener('scroll', function () {
        const header = document.querySelector('.header');
        if (header) {
            if (window.scrollY > 0) {
                header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            } else {
                header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }
        }
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    document.addEventListener('input', function (e) {
        if (e.target.name === 'phone') {
            let value = e.target.value.replace(/\D/g, '');
            if (value.length >= 3 && value.length <= 7) {
                value = value.replace(/(\d{3})(\d{1,4})/, '$1-$2');
            } else if (value.length >= 8) {
                value = value.replace(/(\d{3})(\d{4})(\d{1,4})/, '$1-$2-$3');
            }
            e.target.value = value;
        }
    });

    document.addEventListener('input', function (e) {
        if (e.target.id === 'confirmPassword') {
            const password = document.getElementById('signupPassword');
            if (password) {
                const confirmPassword = e.target.value;
                if (confirmPassword && password.value !== confirmPassword) {
                    e.target.style.borderColor = 'var(--error-color)';
                } else {
                    e.target.style.borderColor = 'var(--border-color)';
                }
            }
        }
    });
}

// ============================================
// 모달 관리
// ============================================
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';

        const firstInput = modal.querySelector('input');
        if (firstInput) {
            setTimeout(() => firstInput.focus(), 100);
        }
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = 'auto';

        if (modalId === 'loginModal') {
            hideCaptcha();
            stopMouseTracking();
        }

        const form = modal.querySelector('form');
        if (form) {
            form.reset();
            clearFormErrors(form);
        }
    }
}

function closeAllModals() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.classList.remove('active');
    });
    document.body.style.overflow = 'auto';
    hideCaptcha();
    stopMouseTracking();
}

function switchModal(fromModalId, toModalId) {
    closeModal(fromModalId);
    setTimeout(() => openModal(toModalId), 150);
}

// ============================================
// 🔥 길게 누르기 기반 캡차 시스템
// ============================================

// 캡차 초기화
function initCaptcha() {
    captchaVerified = false;
    captchaPressStart = null;
    captchaHoldDuration = 0;
    captchaAttemptCount = 0;

    const btn = document.getElementById('dynamicCaptchaBtn');
    const status = document.getElementById('captchaStatus');

    if (btn) {
        btn.className = 'captcha-button';
        btn.textContent = 'CHECK';
        btn.disabled = false;
    }

    if (status) {
        status.innerHTML = '';
        status.style.color = '#111827';
    }

    console.log('🔄 캡차 초기화 완료');
}

// 캡차 표시
function showCaptcha() {
    const container = document.getElementById('captchaContainer');
    if (container) {
        container.style.display = 'block';
        initCaptcha();
        setupDynamicCaptcha();
        startMouseTracking();
        console.log('🔒 캡차 표시됨');
    }
}

// 캡차 숨기기
function hideCaptcha() {
    const container = document.getElementById('captchaContainer');
    if (container) {
        container.style.display = 'none';
    }

    stopDynamicRendering();
    stopMouseTracking();

    captchaVerified = false;
    captchaPressStart = null;
    captchaHoldDuration = 0;
    captchaAttemptCount = 0;
    mouseMovements = [];

    console.log('👁️ 캡차 숨김');
}

// 길게 누르기 기반 동작 설정
function setupDynamicCaptcha() {
    const wrapper = document.querySelector('.captcha-button-wrapper');
    if (!wrapper) {
        console.error('캡차 버튼 wrapper를 찾을 수 없습니다');
        return;
    }

    // 상태 초기화(세션 시작 시)
    captchaVerified = false;
    captchaPressStart = null;
    captchaHoldDuration = 0;
    captchaAttemptCount = 0;

    stopDynamicRendering();

    // 버튼 한 번만 만들고 재사용
    let btn = document.getElementById('dynamicCaptchaBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'dynamicCaptchaBtn';
        wrapper.appendChild(btn);
    }

    // 기존 리스너 제거를 위해 clone
    const newBtn = btn.cloneNode(false);
    btn.parentNode.replaceChild(newBtn, btn);
    btn = newBtn;

    btn.className = 'captcha-button';
    btn.textContent = 'CHECK';
    btn.type = 'button';
    btn.disabled = false;

    const status = document.getElementById('captchaStatus');
    if (status) {
        status.innerHTML = '버튼을 일정 시간 눌러주세요';
        status.style.color = '#111827';
    }

    // ⏱ 누르기 시작
    const onPressStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        captchaPressStart = performance.now();
        if (status) {
            status.innerHTML = '누르고 있는 중입니다';
            status.style.color = '#111827';
        }
        console.log('⏱ 누르기 시작');
    };

    // ⏱ 누르기 종료 → 시간 계산 후 검증
    const onPressEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (captchaPressStart === null) return;

        const now = performance.now();
        captchaHoldDuration = now - captchaPressStart; // ms
        captchaPressStart = null;

        console.log('⏱ 누른 시간(ms):', captchaHoldDuration);
        verifyCaptchaByHoldDuration();
    };

    // 마우스 & 터치 이벤트 연결
    btn.addEventListener('mousedown', onPressStart);
    btn.addEventListener('touchstart', onPressStart);

    btn.addEventListener('mouseup', onPressEnd);
    btn.addEventListener('mouseleave', onPressEnd);
    btn.addEventListener('touchend', onPressEnd);
    btn.addEventListener('touchcancel', onPressEnd);
}

// 동적 렌더링 중지(현재는 인터벌만 정리)
function stopDynamicRendering() {
    if (captchaRenderInterval) {
        clearInterval(captchaRenderInterval);
        captchaRenderInterval = null;
        console.log('⏹️ 동적 렌더링 중지');
    }
}

// 길게 누른 시간으로 캡차 검증
function verifyCaptchaByHoldDuration() {
    const status = document.getElementById('captchaStatus');

    captchaAttemptCount += 1;

    console.log('=== 캡차 검증 시작 (길게 누르기) ===');
    console.log('홀드 시간(ms):', captchaHoldDuration, '시도횟수:', captchaAttemptCount);

    // ✅ 통과 기준(원하는 대로 조정 가능)
    const MIN_HOLD_MS = 55;   // 0.8초 이상
    const MAX_HOLD_MS = 2500;  // 2.5초 이하

    let suspicionScore = 0;
    let reasons = [];

    if (!captchaHoldDuration || captchaHoldDuration <= 0) {
        suspicionScore = 50;
        reasons.push('버튼을 누르지 않음');
    } else if (captchaHoldDuration < MIN_HOLD_MS) {
        suspicionScore = 80;
        reasons.push('너무 짧게 눌림');
    } else if (captchaHoldDuration > MAX_HOLD_MS) {
        suspicionScore = 40;
        reasons.push('너무 오래 눌림');
    } else {
        console.log('✅ 정상 홀드 시간 (사람)');
    }

    // 마우스 움직임 분석 유지 (원하면 제거 가능)
    const mouseAnalysis = analyzeMouseMovement();
    if (mouseAnalysis.isBot) {
        suspicionScore += mouseAnalysis.score;
        reasons.push(mouseAnalysis.reason);
    }

    console.log('최종 의심 점수:', suspicionScore);
    console.log('판정 이유:', reasons);

    if (suspicionScore >= 80) {
        captchaFailed('보안 검증 실패');
    } else {
        captchaSuccess();
    }
}

// 재시도
function captchaRetry() {
    const status = document.getElementById('captchaStatus');

    if (status) {
        status.innerHTML = '⚠️ 버튼을 다시 눌러주세요';
        status.style.color = '#d97706';
    }

    setupDynamicCaptcha();
    console.log('⏱️ 캡차 재시도');
}

// 캡차 성공
function captchaSuccess() {
    captchaVerified = true;
    stopDynamicRendering();

    const btn = document.getElementById('dynamicCaptchaBtn');
    const status = document.getElementById('captchaStatus');

    if (btn) {
        btn.className = 'captcha-button verified';
        btn.textContent = '✓ 확인됨';
        btn.disabled = true;
    }

    if (status) {
        status.innerHTML = '✓ 캡차 완료 - 로그인 중...';
        status.style.color = '#10b981';
    }

    console.log(
        `✅ 캡차 검증 성공 (시도: ${captchaAttemptCount}회, 홀드: ${captchaHoldDuration.toFixed(
            0
        )}ms)`
    );

    // ✅ 1초 후 자동으로 로그인 폼 제출
    setTimeout(() => {
        const loginForm = document.getElementById('loginForm');
        if (loginForm) {
            loginForm.dispatchEvent(
                new Event('submit', {
                    cancelable: true,
                    bubbles: true
                })
            );
        }
    }, 1000);
}

// 캡차 실패
function captchaFailed(reason = '봇으로 판정') {
    captchaVerified = false;
    stopDynamicRendering();
    stopMouseTracking();

    const btn = document.getElementById('dynamicCaptchaBtn');
    const status = document.getElementById('captchaStatus');

    if (btn) {
        btn.className = 'captcha-button failed';
        btn.textContent = '✗ 실패';
        btn.disabled = true;
    }

    if (status) {
        status.innerHTML = '✗ 인증에 실패했습니다';
        status.style.color = '#ef4444';
    }

    console.log(
        `❌ 캡차 검증 실패: ${reason} / 시도: ${captchaAttemptCount}회 / 홀드: ${captchaHoldDuration.toFixed(
            0
        )}ms / 마우스: ${mouseMovements.length}포인트`
    );

    addSecurityAlert({
        type: 'critical',
        title: '의심스러운 로그인 시도',
        description: '보안 검증에 실패했습니다.',
        details: {
            판정이유: reason,
            시도횟수: `${captchaAttemptCount}회`,
            홀드시간ms: `${captchaHoldDuration.toFixed(0)}ms`,
            마우스포인트: `${mouseMovements.length}개`,
            시간: new Date().toLocaleTimeString('ko-KR')
        }
    });

    setTimeout(() => {
        showNotification('보안 검증에 실패했습니다.', 'error');

        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }, 2000);
}

// ============================================
// 🔥 보안 알림 시스템
// ============================================
function addSecurityAlert(alert) {
    const alertData = {
        id: Date.now(),
        type: alert.type || 'info',
        title: alert.title,
        description: alert.description,
        details: alert.details || {},
        timestamp: new Date().toISOString()
    };

    securityAlerts.unshift(alertData);
    if (securityAlerts.length > 50) {
        securityAlerts = securityAlerts.slice(0, 50);
    }

    localStorage.setItem('securityAlerts', JSON.stringify(securityAlerts));
    renderSecurityAlert(alertData);
    openSecurityPanel();

    console.log('🔔 보안 알림 추가:', alertData);
}

function renderSecurityAlert(alert) {
    const list = document.getElementById('securityAlertList');
    if (!list) return;

    const alertItem = document.createElement('div');
    alertItem.className = `security-alert-item ${alert.type}`;
    alertItem.dataset.id = alert.id;

    const time = new Date(alert.timestamp);
    const timeStr = `${time.getHours()}:${String(time.getMinutes()).padStart(2, '0')}`;

    let detailsHTML = '';
    if (alert.details && Object.keys(alert.details).length > 0) {
        detailsHTML = '<div class="alert-item-details">';
        for (const [key, value] of Object.entries(alert.details)) {
            detailsHTML += `
                <div class="alert-detail-badge">
                    ${key}: <strong>${value}</strong>
                </div>
            `;
        }
        detailsHTML += '</div>';
    }

    alertItem.innerHTML = `
        <div class="alert-item-header">
            <div class="alert-item-title">${alert.title}</div>
            <div class="alert-item-time">${timeStr}</div>
        </div>
        <div class="alert-item-description">${alert.description}</div>
        ${detailsHTML}
    `;

    list.insertBefore(alertItem, list.firstChild);
}

function loadSecurityAlerts() {
    const stored = localStorage.getItem('securityAlerts');
    if (stored) {
        securityAlerts = JSON.parse(stored);
        const recentAlerts = securityAlerts.slice(0, 10);
        recentAlerts.reverse().forEach(alert => {
            renderSecurityAlert(alert);
        });
        console.log(`📋 ${securityAlerts.length}개의 보안 알림 로드됨`);
    }
}

function openSecurityPanel() {
    const panel = document.getElementById('securityAlertPanel');
    if (panel) {
        panel.classList.add('active');
        console.log('🔔 보안 알림 패널 열림');
    }
}

function closeSecurityPanel() {
    const panel = document.getElementById('securityAlertPanel');
    if (panel) {
        panel.classList.remove('active');
        console.log('🔔 보안 알림 패널 닫힘');
    }
}

// ============================================
// 로그인 처리
// ============================================
async function handleLogin(event) {
    event.preventDefault();

    const form = event.target;
    const id = document.getElementById('loginId').value.trim();
    const pw = document.getElementById('loginPassword').value.trim();

    if (!id || !pw) {
        showNotification('아이디와 비밀번호를 입력하세요.', 'error');
        return;
    }

    // 캡차가 떠 있는데 아직 인증 안 했으면 막기
    const captchaContainer = document.getElementById('captchaContainer');
    if (
        captchaContainer &&
        captchaContainer.style.display === 'block' &&
        !captchaVerified
    ) {
        showNotification('캡차를 먼저 완료해주세요.', 'warning');
        return;
    }

    setLoadingState(form, true);

    try {
        const formData = new FormData();
        formData.append('loginId', id);
        formData.append('password', pw);
        formData.append('captchaVerified', captchaVerified ? 'true' : 'false');

        const res = await fetch(LOGIN_API, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error('🔴 서버 오류 응답:', res.status, errorText);
            showNotification(
                '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
                'error'
            );
            return;
        }

        const raw = await res.text();
        console.log('🔍 로그인 raw 응답:', raw);

        let data;
        try {
            data = JSON.parse(raw);
        } catch (e) {
            console.error('JSON 파싱 오류:', e, raw);
            showNotification('서버 응답 형식에 문제가 있습니다.', 'error');
            return;
        }

        // Case 1: 추가 인증(캡차) 필요
        if (data.needCaptcha) {
            showNotification(data.message || '추가 인증이 필요합니다.', 'warning');
            showCaptcha();

            addSecurityAlert({
                type: 'warning',
                title: '의심스러운 활동 감지',
                description: data.message || '추가 인증 필요',
                details: {
                    위험점수: (data.riskScore ?? '?') + '점',
                    이유: data.reasons ? data.reasons.join(', ') : '-',
                    시간: new Date().toLocaleTimeString('ko-KR')
                }
            });

            return;
        }

        // Case 2: 보안 정책으로 차단
        if (data.blocked) {
            showNotification(
                data.message || '보안 정책에 의해 차단되었습니다.',
                'error'
            );

            addSecurityAlert({
                type: 'danger',
                title: '보안 정책 위반',
                description: data.message || '보안 정책 위반',
                details: {
                    위험점수: (data.riskScore ?? '?') + '점',
                    이유: data.reasons ? data.reasons.join(', ') : '-',
                    시간: new Date().toLocaleTimeString('ko-KR')
                }
            });

            setTimeout(() => {
                closeModal('loginModal');
            }, 2000);

            return;
        }

        // Case 3: 로그인 실패
        if (!data.success) {
            showNotification(
                data.message || '아이디 또는 비밀번호가 일치하지 않습니다.',
                'error'
            );

            captchaVerified = false;
            hideCaptcha();

            addSecurityAlert({
                type: 'warning',
                title: '로그인 실패',
                description: '잘못된 계정 정보',
                details: {
                    시도ID: id,
                    위험점수: (data.riskScore ?? '?') + '점',
                    시간: new Date().toLocaleTimeString('ko-KR')
                }
            });

            return;
        }

        // Case 4: 로그인 성공
        currentUser = {
            id: data.id,
            name: data.name,
            usernum: data.usernum,
            location: data.location || 'Unknown',
            riskScore: data.riskScore
        };

        isLoggedIn = true;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        updateUIForLoggedInUser();

        addSecurityAlert({
            type: 'success',
            title: '로그인 성공',
            description: '정상적으로 로그인되었습니다.',
            details: {
                계정: currentUser.id,
                위치: currentUser.location,
                위험점수: (data.riskScore ?? '?') + '점',
                시간: new Date().toLocaleTimeString('ko-KR')
            }
        });

        showNotification(`${currentUser.name}님 환영합니다!`, 'success');
        closeModal('loginModal');

        // 캡차 완전 리셋
        captchaVerified = false;
        hideCaptcha();
    } catch (error) {
        console.error('로그인 오류:', error);
        showNotification('로그인 처리 중 오류가 발생했습니다.', 'error');
    } finally {
        setLoadingState(form, false);
    }
}

// ============================================
// 회원가입 처리
// ============================================
async function handleSignup(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);

    const id = formData.get('signupId');
    const password = formData.get('password');
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (!id || !password || !confirmPassword) {
        showNotification('모든 필드를 입력해주세요.', 'error');
        return;
    }

    if (password !== confirmPassword) {
        showNotification('비밀번호가 일치하지 않습니다.', 'error');
        return;
    }

    setLoadingState(form, true);

    try {
        const res = await fetch(SIGNUP_API, {
            method: 'POST',
            body: formData
        });

        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await res.text();
            console.error('서버 응답:', text);
            throw new Error('서버가 JSON을 반환하지 않았습니다.');
        }

        const data = await res.json();

        if (!data.success) {
            showNotification(data.message || '회원가입에 실패했습니다.', 'error');
            return;
        }

        showNotification('회원가입이 완료되었습니다. 로그인해주세요.', 'success');
        closeModal('signupModal');

        setTimeout(() => {
            openModal('loginModal');
        }, 500);
    } catch (err) {
        console.error('회원가입 오류:', err);
        showNotification('서버 오류가 발생했습니다.', 'error');
    } finally {
        setLoadingState(form, false);
    }
}

// ============================================
// UI 헬퍼 함수들
// ============================================
function clearFormErrors(form) {
    const fields = form.querySelectorAll('input');
    fields.forEach(field => {
        field.style.borderColor = 'var(--border-color)';
        field.style.animation = '';
    });
}

function setLoadingState(form, loading) {
    const submitBtn = form.querySelector('button[type="submit"]');
    if (!submitBtn) return;

    if (loading) {
        submitBtn.disabled = true;
        submitBtn.dataset.originalText = submitBtn.textContent;
        submitBtn.textContent = '처리중...';
        submitBtn.style.opacity = '0.7';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || '확인';
        submitBtn.style.opacity = '1';
    }
}

function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');

    if (!notification) {
        alert(message);
        return;
    }

    notification.textContent = message;
    notification.className = `notification ${type} show`;

    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// ============================================
// 기타 기능
// ============================================
function showFindAccount() {
    closeModal('loginModal');
    showNotification('아이디/비밀번호 찾기 기능은 준비중입니다.', 'warning');
}

function showTerms() {
    showNotification('이용약관을 확인하는 페이지로 이동합니다.', 'success');
}

function showProductDetail(productType) {
    const productNames = {
        savings: '자유적금',
        loan: '주택담보대출',
        card: '체크카드'
    };

    const productName = productNames[productType] || '상품';
    showNotification(`${productName} 상세 페이지로 이동합니다.`, 'success');
}

// 보안 페이지
let monitoringInterval;

function showSecurityPage(event) {
    if (event) event.preventDefault();

    if (!isLoggedIn) {
        showNotification('보안 페이지는 로그인 후 이용하실 수 있습니다.', 'warning');
        setTimeout(() => {
            openModal('loginModal');
        }, 500);
        return;
    }

    const securityPage = document.getElementById('securityPage');
    if (securityPage) {
        securityPage.classList.add('active');
        document.body.style.overflow = 'hidden';

        loadSecurityData();
        startSecurityMonitoring();
    }
}

function hideSecurityPage() {
    const securityPage = document.getElementById('securityPage');
    if (securityPage) {
        securityPage.classList.remove('active');
        document.body.style.overflow = 'auto';

        stopSecurityMonitoring();
    }
}

async function loadSecurityData() {
    try {
        console.log('보안 데이터 로드 완료');
        console.log('현재 로그인 사용자:', currentUser);

        const mockData = {
            attackCount: 247,
            blockedIPs: 38,
            defenseRate: 99.8,
            suspiciousCount: 15
        };

        updateSecurityDashboard(mockData);
    } catch (error) {
        console.error('보안 데이터 로드 실패:', error);
        showNotification('보안 데이터를 불러오는데 실패했습니다.', 'error');
    }
}

function updateSecurityDashboard(data) {
    const attackCount = document.getElementById('attackCount');
    const blockedIPs = document.getElementById('blockedIPs');
    const suspiciousCount = document.getElementById('suspiciousCount');

    if (attackCount) attackCount.textContent = data.attackCount;
    if (blockedIPs) blockedIPs.textContent = data.blockedIPs;
    if (suspiciousCount) suspiciousCount.textContent = data.suspiciousCount;
}

function startSecurityMonitoring() {
    monitoringInterval = setInterval(() => {
        const attackCount = document.getElementById('attackCount');
        const blockedIPs = document.getElementById('blockedIPs');
        const suspiciousCount = document.getElementById('suspiciousCount');

        if (attackCount) {
            const currentCount = parseInt(attackCount.textContent);
            const randomIncrease = Math.floor(Math.random() * 3);
            attackCount.textContent = currentCount + randomIncrease;
        }

        if (blockedIPs && Math.random() > 0.7) {
            const currentBlocked = parseInt(blockedIPs.textContent);
            blockedIPs.textContent = currentBlocked + 1;
        }

        if (suspiciousCount) {
            const currentSuspicious = parseInt(suspiciousCount.textContent);
            suspiciousCount.textContent = Math.max(
                0,
                currentSuspicious + (Math.random() > 0.5 ? 1 : -1)
            );
        }
    }, 3000);
}

function stopSecurityMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
}

// ============================================
// 🔥 마우스 궤적 추적 시스템
// ============================================
function startMouseTracking() {
    mouseMovements = [];
    isTrackingMouse = true;

    const captchaContainer = document.getElementById('captchaContainer');
    if (!captchaContainer) return;

    const trackMouse = (e) => {
        if (!isTrackingMouse) return;

        const rect = captchaContainer.getBoundingClientRect();
        mouseMovements.push({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            timestamp: Date.now()
        });

        if (mouseMovements.length > 100) {
            mouseMovements.shift();
        }
    };

    captchaContainer.addEventListener('mousemove', trackMouse);
    captchaContainer._mouseTracker = trackMouse;

    console.log('🖱️ 마우스 추적 시작');
}

function stopMouseTracking() {
    isTrackingMouse = false;

    const captchaContainer = document.getElementById('captchaContainer');
    if (captchaContainer && captchaContainer._mouseTracker) {
        captchaContainer.removeEventListener('mousemove', captchaContainer._mouseTracker);
        delete captchaContainer._mouseTracker;
    }

    console.log('🖱️ 마우스 추적 중지');
}

function analyzeMouseMovement() {
    if (mouseMovements.length < 5) {
        return {
            isBot: false,
            score: 0,
            reason: '마우스 데이터 부족'
        };
    }

    // 직선성 검사
    let totalDistance = 0;
    let directDistance = 0;

    for (let i = 1; i < mouseMovements.length; i++) {
        const dx = mouseMovements[i].x - mouseMovements[i - 1].x;
        const dy = mouseMovements[i].y - mouseMovements[i - 1].y;
        totalDistance += Math.sqrt(dx * dx + dy * dy);
    }

    if (mouseMovements.length > 1) {
        const first = mouseMovements[0];
        const last = mouseMovements[mouseMovements.length - 1];
        const dx = last.x - first.x;
        const dy = last.y - first.y;
        directDistance = Math.sqrt(dx * dx + dy * dy);
    }

    const linearity = totalDistance > 0 ? directDistance / totalDistance : 0;

    // 속도 분석
    const speeds = [];
    for (let i = 1; i < mouseMovements.length; i++) {
        const dx = mouseMovements[i].x - mouseMovements[i - 1].x;
        const dy = mouseMovements[i].y - mouseMovements[i - 1].y;
        const dt = mouseMovements[i].timestamp - mouseMovements[i - 1].timestamp;
        if (dt > 0) {
            const distance = Math.sqrt(dx * dx + dy * dy);
            speeds.push(distance / dt);
        }
    }

    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length;
    const variance =
        speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) /
        speeds.length;
    const stdDev = Math.sqrt(variance);

    let suspicionScore = 0;
    let reasons = [];

    if (linearity > 0.9) {
        suspicionScore += 30;
        reasons.push('직선 이동 패턴');
    }

    if (stdDev < 0.1 && avgSpeed > 0) {
        suspicionScore += 30;
        reasons.push('일정한 속도');
    }

    console.log('🖱️ 마우스 분석:', {
        직선성: linearity.toFixed(3),
        평균속도: avgSpeed.toFixed(3),
        속도편차: stdDev.toFixed(3),
        의심점수: suspicionScore
    });

    return {
        isBot: suspicionScore >= 50,
        score: suspicionScore,
        reason: reasons.join(', ') || '정상 패턴'
    };
}

// ============================================
// 전역 바인딩 & 로드 로그
// ============================================
console.log('✅ SecureBank 시스템 로드 완료 (캡차 + 보안알림 + 마우스추적)');

// 인라인 onclick에서 사용할 함수들을 전역에 노출
window.openModal = openModal;
window.closeModal = closeModal;
window.switchModal = switchModal;

window.handleLogin = handleLogin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;

window.showSecurityPage = showSecurityPage;
window.hideSecurityPage = hideSecurityPage;
window.closeSecurityPanel = closeSecurityPanel;
window.showFindAccount = showFindAccount;
window.showTerms = showTerms;
window.showProductDetail = showProductDetail;
