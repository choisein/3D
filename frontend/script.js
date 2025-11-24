// SecureBank - 인증 기반 접근 제어 JavaScript (무조건 캡차 모드 + PHP 연동)

// ============================================
// 전역 변수
// ============================================
let isLoading = false;
let isLoggedIn = false;
let currentUser = null;

// 백엔드 API 엔드포인트 (필요하면 파일명만 바꿔서 사용)
const LOGIN_API = 'login.php';
const SIGNUP_API = 'upload.php';   // 회원가입 처리 PHP 파일명에 맞게 수정
const LOGOUT_API = 'logout.php';

// 캡차 시스템 변수
let captchaClickCount = 0;
let captchaInterval = null;
let captchaStartTime = 0;
let captchaVerified = false;
let captchaRequired = false;

// ===================================================
// ⭐ 서버 없이 테스트용 Fake DB (localStorage 사용)
// ===================================================

const FakeDB = {
    loadUsers() {
        return JSON.parse(localStorage.getItem("fake_users") || "[]");
    },
    saveUsers(users) {
        localStorage.setItem("fake_users", JSON.stringify(users));
    },
    addUser(user) {
        const users = this.loadUsers();
        users.push(user);
        this.saveUsers(users);
    },
    findUser(id, pw) {
        const users = this.loadUsers();
        return users.find(u => u.id === id && u.password === pw);
    },
    exists(id) {
        return this.loadUsers().some(u => u.id === id);
    }
};

// ============================================
// DOM 로드 완료 후 실행
// ============================================
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// ============================================
// 앱 초기화
// ============================================
function initializeApp() {
    setupEventListeners();
    checkLoginStatus();
    console.log('🚀 SecureBank 시스템이 로드되었습니다.');
    console.log('⚠️ 무조건 캡차 모드 + PHP 연동');
}

// ============================================
// 로그인 상태 확인
// ============================================
function checkLoginStatus() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isLoggedIn = true;
        updateUIForLoggedInUser();
    }
}

// ============================================
// 로그인된 사용자를 위한 UI 업데이트
// ============================================
function updateUIForLoggedInUser() {
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons && currentUser) {
        authButtons.innerHTML = `
<span style="margin-right: 16px; color: var(--text-primary);">${currentUser.name}님</span>
<button class="btn btn-outline" onclick="handleLogout()">로그아웃</button>
        `;
    }
}

// ============================================
// 로그아웃 처리
// ============================================
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
    
    // 백엔드 세션도 종료 시도 (실패해도 무시)
    fetch(LOGOUT_API, { method: 'POST' }).catch(() => {});
    
    showNotification('로그아웃되었습니다.', 'success');
}

// ============================================
// 이벤트 리스너 설정
// ============================================
function setupEventListeners() {
    // ESC 키로 모달 닫기
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });

    // 스크롤 시 헤더 그림자 효과
    window.addEventListener('scroll', function() {
        const header = document.querySelector('.header');
        if (header) {
            if (window.scrollY > 0) {
                header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
            } else {
                header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
            }
        }
    });

    // 부드러운 스크롤
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
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

    // 휴대폰 번호 자동 포맷팅
    document.addEventListener('input', function(e) {
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

    // 비밀번호 확인 실시간 검증
    document.addEventListener('input', function(e) {
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
// 모달 관리 함수들
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
        
        // 로그인 모달 닫을 때 캡차 초기화
        if (modalId === 'loginModal') {
            hideCaptcha();
            captchaRequired = false;
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
    
    // 캡차 초기화
    hideCaptcha();
    captchaRequired = false;
}

function switchModal(fromModalId, toModalId) {
    closeModal(fromModalId);
    setTimeout(() => openModal(toModalId), 150);
}

// ============================================
// 동적 캡차 시스템
// ============================================

// 캡차 초기화
function initCaptcha() {
    captchaClickCount = 0;
    captchaVerified = false;
    captchaStartTime = Date.now();
    
    const btn = document.getElementById('dynamicCaptchaBtn');
    const status = document.getElementById('captchaStatus');
    
    if (btn) {
        btn.className = 'captcha-button';
        btn.textContent = 'CHECK';
        btn.disabled = false;
        btn.style.background = 'white';
    }
    
    if (status) {
        status.innerHTML = '';
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
    console.log('👁️ 캡차 숨김');
}


// 함수 교체!!!!!!!!!!!!!!!!!!!!!                        :handleCaptchClick,setupDynamicCaptch, start,stop_DynamicRendering함수 삭제
function setupDynamicCaptcha() {
    const btn = document.getElementById('dynamicCaptchaBtn');
    if (!btn) return;
    
    let clickStartTime = 0;
    let clickEndTime = 0;
    
    // 기존 이벤트 리스너 제거 (중복 방지)
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
    
    // 1. 마우스 누르기 시작
    newBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        clickStartTime = Date.now();
    });
    
    // 2. 마우스 떼기
    newBtn.addEventListener('mouseup', (e) => {
        e.preventDefault();
        clickEndTime = Date.now();
    });
    
    // 3. 클릭 완료 - 최종 검증
    newBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        if (captchaVerified) return;
        
        const clickDuration = clickEndTime - clickStartTime;
        const reactionTime = clickStartTime - captchaStartTime;
        
        console.log(`반응 시간: ${reactionTime}ms, 클릭 지속: ${clickDuration}ms`);
        
        // 검증 1: 반응이 너무 빠름 (봇)
        if (reactionTime < 100) {
            console.log('❌ 반응 속도가 비정상적');
            captchaFailed();
            return;
        }
        
        // 검증 2: 클릭 지속 시간 (핵심!)
        if (clickDuration < 30) {
            console.log('❌ 클릭이 너무 짧음 (봇)');
            captchaFailed();
        } else if (clickDuration > 30 && clickDuration < 500) {
            console.log('✅ 정상적인 클릭 (사람)');
            captchaSuccess();
        } else {
            console.log('❌ 클릭이 너무 김 (비정상)');
            captchaFailed();
        }
    });
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
        status.innerHTML = '✓ 캡차 완료';
        status.style.color = '#10b981';
    }
    
    console.log('✅ 캡차 검증 성공 - 사람으로 판정 (클릭:', captchaClickCount + '회)');
}

// 캡차 실패
function captchaFailed() {
    captchaVerified = false;
    stopDynamicRendering();
    
    const btn = document.getElementById('dynamicCaptchaBtn');
    const status = document.getElementById('captchaStatus');
    
    if (btn) {
        btn.className = 'captcha-button failed';
        btn.textContent = '✗ 실패';
        btn.disabled = true;
    }
    
    if (status) {
        status.innerHTML = '✗ 봇으로 판정되었습니다';
        status.style.color = '#ef4444';
    }
    
    console.log('❌ 캡차 검증 실패 - 봇으로 판정 (클릭:', captchaClickCount + '회)');
    
    setTimeout(() => {
        showNotification('자동화된 접근이 감지되었습니다.', 'error');
        closeModal('loginModal');
    }, 2000);
}


// 로그인 처리 (서버 없이 테스트용)
async function handleLogin(event) {
    event.preventDefault();

    const id = document.getElementById("loginId").value.trim();
    const pw = document.getElementById("loginPassword").value.trim();

    if (!id || !pw) {
        showNotification("아이디와 비밀번호를 입력하세요.", "error");
        return;
    }

    // 캡차 검사
    if (!captchaVerified) {
        showCaptcha();
        showNotification("본인 확인을 완료해주세요.", "warning");
        return;
    }

    // FakeDB에서 유저 찾기
    const user = FakeDB.findUser(id, pw);

    if (!user) {
        showNotification("ID 또는 비밀번호가 틀렸습니다.", "error");
        captchaVerified = false;
        hideCaptcha();
        return;
    }

    // ⬇⬇⬇ 여기에서 name을 그대로 사용하도록 수정
    currentUser = {
        id: user.id,
        name: user.name     // ⬅ 닉네임(이름) 표시
    };
    isLoggedIn = true;

    sessionStorage.setItem("currentUser", JSON.stringify(currentUser));

    showNotification(`${user.name}님 환영합니다!`, "success");
    closeModal("loginModal");
    updateUIForLoggedInUser();

    // 캡차 초기화
    captchaVerified = false;
    captchaClickCount = 0;
    hideCaptcha();
}


// ===================================================
// ⭐ 서버 없는 환경에서 동작하는 회원가입
// ===================================================
async function handleSignup(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    
    const id = formData.get("signupId");
    const pw = formData.get("password");
    const name = formData.get("name");

    // 중복 체크
    if (FakeDB.exists(id)) {
        showNotification("이미 존재하는 ID입니다.", "error");
        return;
    }

    // DB에 저장
    FakeDB.addUser({
        id: id,
        password: pw,
        name: name
    });

    showNotification("회원가입 성공(시험용).", "success");
    closeModal("signupModal");

    setTimeout(() => {
        openModal("loginModal");
    }, 500);
}

// ============================================
// 폼 검증 함수들
// ============================================
function validateLoginForm(loginId, password) {
    let isValid = true;
    
    if (!loginId) {
        showNotification('아이디를 입력해주세요.', 'error');
        isValid = false;
    }
    
    if (!password) {
        showNotification('비밀번호를 입력해주세요.', 'error');
        isValid = false;
    }
    
    return isValid;
}

// 회원가입 폼 검증
function validateSignupForm(form, formData) {
    const signupId = formData.get('signupId');
    const password = formData.get('password');
    const confirmPassword = form.querySelector('#confirmPassword');
    const name = formData.get('name');
    const phone = formData.get('phone');
    const email = formData.get('email');
    const agreeTerms = formData.get('agreeTerms');
    
    if (!signupId || !password || !confirmPassword || !name || !phone || !email) {
        showNotification('모든 필드를 입력해주세요.', 'error');
        return false;
    }
    
    let isValid = true;
    
    if (!isValidUserId(String(signupId).trim())) {
        showFieldError(form, 'signupId', '4-20자의 영문, 숫자만 사용 가능합니다.');
        isValid = false;
    }
    
    if (!isValidPassword(String(password))) {
        showFieldError(form, 'signupPassword', '8자 이상, 영문+숫자+특수문자를 포함해주세요.');
        isValid = false;
    }
    
    if (String(password) !== String(confirmPassword.value)) {
        showFieldError(form, 'confirmPassword', '비밀번호가 일치하지 않습니다.');
        isValid = false;
    }
    
    if (!isValidName(String(name).trim())) {
        showFieldError(form, 'name', '올바른 이름을 입력해주세요.');
        isValid = false;
    }
    
    if (!isValidPhone(String(phone).trim())) {
        showFieldError(form, 'phone', '올바른 휴대폰 번호를 입력해주세요.');
        isValid = false;
    }
    
    if (!isValidEmail(String(email).trim())) {
        showFieldError(form, 'email', '올바른 이메일 형식을 입력해주세요.');
        isValid = false;
    }
    
    if (!agreeTerms) {
        showNotification('이용약관에 동의해주세요.', 'error');
        isValid = false;
    }
    
    return isValid;
}

// 유효성 검사 함수들
function isValidUserId(id) {
    const regex = /^[a-zA-Z0-9]{4,20}$/;
    return regex.test(id);
}

function isValidPassword(password) {
    const regex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    return regex.test(password);
}

function isValidName(name) {
    const regex = /^[가-힣a-zA-Z\s]{2,10}$/;
    return regex.test(name);
}

function isValidPhone(phone) {
    const regex = /^010-\d{4}-\d{4}$/;
    return regex.test(phone);
}

function isValidEmail(email) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
}

// ============================================
// UI 헬퍼 함수들
// ============================================
function setLoadingState(form, loading) {
    isLoading = loading;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    if (!submitBtn) return;
    
    if (!submitBtn.dataset.originalText) {
        submitBtn.dataset.originalText = submitBtn.textContent;
    }
    
    if (loading) {
        submitBtn.disabled = true;
        submitBtn.textContent = '처리중...';
        submitBtn.style.opacity = '0.7';
    } else {
        submitBtn.disabled = false;
        submitBtn.textContent = submitBtn.dataset.originalText || (form.id === 'loginForm' ? '로그인' : '회원가입');
        submitBtn.style.opacity = '1';
    }
}

function showFieldError(form, fieldName, message) {
    const field = form.querySelector(`[name="${fieldName}"]`);
    if (field) {
        field.style.borderColor = 'var(--error-color)';
        field.style.animation = 'shake 0.5s ease-in-out';
        
        setTimeout(() => {
            field.style.borderColor = 'var(--border-color)';
            field.style.animation = '';
        }, 3000);
    }
    
    showNotification(message, 'error');
}

function clearFormErrors(form) {
    const fields = form.querySelectorAll('input');
    fields.forEach(field => {
        field.style.borderColor = 'var(--border-color)';
        field.style.animation = '';
    });
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
// 기타 기능들
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
        'savings': '자유적금',
        'loan': '주택담보대출',
        'card': '체크카드'
    };
    
    const productName = productNames[productType] || '상품';
    showNotification(`${productName} 상세 페이지로 이동합니다.`, 'success');
}

// ============================================
// 보안 페이지 접근 제어 (인증 필수)
// ============================================
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

// ============================================
// 보안 데이터 로드 (시뮬레이션)
// ============================================
async function loadSecurityData() {
    try {
        console.log('보안 데이터 로드 완료 (시뮬레이션)');
        console.log('현재 로그인 사용자:', currentUser);
        
        const mockData = {
            attackCount: 247,
            blockedIPs: 38,
            defenseRate: 99.8,
            suspiciousCount: 15,
            recentAttacks: [
                {
                    type: '크리덴셜 스터핑',
                    severity: 'critical',
                    ipCount: 38,
                    attemptCount: 523,
                    targetAccounts: 127,
                    timestamp: '2024-01-15 14:32'
                }
            ]
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

// ============================================
// 실시간 보안 모니터링
// ============================================
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
            suspiciousCount.textContent = Math.max(0, currentSuspicious + (Math.random() > 0.5 ? 1 : -1));
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
// 전역 객체 (개발자 도구용)
// ============================================
window.SecureBank = {
    openModal,
    closeModal,
    showNotification,
    isLoggedIn: () => isLoggedIn,
    currentUser: () => currentUser,
    logout: handleLogout,
    captcha: {
        show: showCaptcha,
        hide: hideCaptcha,
        status: () => ({
            verified: captchaVerified,
            clickCount: captchaClickCount,
            required: captchaRequired,
            startTime: captchaStartTime
        }),
        reset: () => {
            captchaVerified = false;
            captchaClickCount = 0;
            captchaRequired = false;
            hideCaptcha();
            console.log('🔄 캡차 초기화 완료');
        },
        test: () => {
            openModal('loginModal');
            showCaptcha();
            console.log('🧪 캡차 테스트 시작');
        },
        botClick: () => {
            const btn = document.getElementById('dynamicCaptchaBtn');
            if (btn) {
                btn.click();
                console.log('🤖 봇 클릭 시뮬레이션');
            }
        }
    }
};

console.log("✅ SecureBank 시스템 로드 완료 (PHP 연동 & 캡차 활성)");
