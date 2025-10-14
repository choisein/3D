// SecureBank - 인증 기반 접근 제어 JavaScript

// 전역 변수
let isLoading = false;
let isLoggedIn = false; // 로그인 상태 추적
let currentUser = null; // 현재 로그인한 사용자 정보

// 테스트용 사용자 데이터 (실제로는 서버에서 관리)
const testUsers = [
    { id: 'admin', password: 'admin123', name: '관리자' },
    { id: 'user01', password: 'user123', name: '홍길동' }
];

// DOM 로드 완료 후 실행
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

// 앱 초기화
function initializeApp() {
    setupEventListeners();
    checkLoginStatus(); // 페이지 로드 시 로그인 상태 확인
    console.log('SecureBank 시스템이 로드되었습니다.');
    console.log('테스트 계정: admin / admin123');
}

// 로그인 상태 확인 (페이지 새로고침 시 세션 유지)
function checkLoginStatus() {
    const savedUser = sessionStorage.getItem('currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        isLoggedIn = true;
        updateUIForLoggedInUser();
    }
}

// 로그인된 사용자를 위한 UI 업데이트
function updateUIForLoggedInUser() {
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons && currentUser) {
        authButtons.innerHTML = `
            <span style="margin-right: 16px; color: var(--text-primary);">
                ${currentUser.name}님
            </span>
            <button class="btn btn-outline" onclick="handleLogout()">로그아웃</button>
        `;
    }
}

// 로그아웃 처리
function handleLogout() {
    isLoggedIn = false;
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    
    // UI 초기화
    const authButtons = document.querySelector('.auth-buttons');
    if (authButtons) {
        authButtons.innerHTML = `
            <button class="btn btn-outline" onclick="openModal('loginModal')">로그인</button>
            <button class="btn btn-primary" onclick="openModal('signupModal')">회원가입</button>
        `;
    }
    
    showNotification('로그아웃되었습니다.', 'success');
}

// 이벤트 리스너 설정
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
        if (window.scrollY > 0) {
            header.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.1)';
        } else {
            header.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
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
            const password = document.getElementById('signupPassword').value;
            const confirmPassword = e.target.value;
            
            if (confirmPassword && password !== confirmPassword) {
                e.target.style.borderColor = 'var(--error-color)';
            } else {
                e.target.style.borderColor = 'var(--border-color)';
            }
        }
    });
}

// 모달 관리 함수들
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // 첫 번째 입력 필드에 포커스
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
        
        // 폼 초기화
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
}

function switchModal(fromModalId, toModalId) {
    closeModal(fromModalId);
    setTimeout(() => openModal(toModalId), 150);
}

// 로그인 처리
async function handleLogin(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const form = event.target;
    const formData = new FormData(form);
    const loginId = formData.get('loginId').trim();
    const password = formData.get('password');
    
    // 폼 검증
    if (!validateLoginForm(loginId, password)) {
        return;
    }
    
    // 로딩 상태 시작
    setLoadingState(form, true);
    
    try {
        // 로그인 API 호출 시뮬레이션
        const result = await simulateLogin(loginId, password);
        
        if (result.success) {
            // 로그인 상태 업데이트
            isLoggedIn = true;
            currentUser = result.user;
            
            // 세션 스토리지에 사용자 정보 저장 (페이지 새로고침 시 유지)
            sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showNotification('로그인이 완료되었습니다!', 'success');
            closeModal('loginModal');
            
            // UI 업데이트
            updateUIForLoggedInUser();
        }
    } catch (error) {
        showNotification(error.message, 'error');
        showFieldError(form, 'loginPassword', error.message);
    } finally {
        setLoadingState(form, false);
    }
}

// 회원가입 처리
async function handleSignup(event) {
    event.preventDefault();
    
    if (isLoading) return;
    
    const form = event.target;
    const formData = new FormData(form);
    
    // 폼 검증
    if (!validateSignupForm(form, formData)) {
        return;
    }
    
    // 로딩 상태 시작
    setLoadingState(form, true);
    
    try {
        // 회원가입 API 호출 시뮬레이션
        const result = await simulateSignup(formData);
        
        if (result.success) {
            showNotification('회원가입이 완료되었습니다!', 'success');
            closeModal('signupModal');
            
            setTimeout(() => {
                openModal('loginModal');
                showNotification('로그인해주세요.', 'success');
            }, 1000);
        }
    } catch (error) {
        showNotification(error.message, 'error');
    } finally {
        setLoadingState(form, false);
    }
}

// 로그인 폼 검증
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
    const signupId = formData.get('signupId').trim();
    const password = formData.get('password');
    const confirmPassword = form.querySelector('#confirmPassword').value;
    const name = formData.get('name').trim();
    const phone = formData.get('phone').trim();
    const email = formData.get('email').trim();
    const agreeTerms = formData.get('agreeTerms');
    
    let isValid = true;
    
    // 아이디 검증
    if (!signupId) {
        showFieldError(form, 'signupId', '아이디를 입력해주세요.');
        isValid = false;
    } else if (!isValidUserId(signupId)) {
        showFieldError(form, 'signupId', '4-20자의 영문, 숫자만 사용 가능합니다.');
        isValid = false;
    }
    
    // 비밀번호 검증
    if (!password) {
        showFieldError(form, 'signupPassword', '비밀번호를 입력해주세요.');
        isValid = false;
    } else if (!isValidPassword(password)) {
        showFieldError(form, 'signupPassword', '8자 이상, 영문+숫자+특수문자를 포함해주세요.');
        isValid = false;
    }
    
    // 비밀번호 확인
    if (password !== confirmPassword) {
        showFieldError(form, 'confirmPassword', '비밀번호가 일치하지 않습니다.');
        isValid = false;
    }
    
    // 이름 검증
    if (!name) {
        showFieldError(form, 'name', '이름을 입력해주세요.');
        isValid = false;
    } else if (!isValidName(name)) {
        showFieldError(form, 'name', '올바른 이름을 입력해주세요.');
        isValid = false;
    }
    
    // 휴대폰 번호 검증
    if (!phone) {
        showFieldError(form, 'phone', '휴대폰 번호를 입력해주세요.');
        isValid = false;
    } else if (!isValidPhone(phone)) {
        showFieldError(form, 'phone', '올바른 휴대폰 번호를 입력해주세요.');
        isValid = false;
    }
    
    // 이메일 검증
    if (!email) {
        showFieldError(form, 'email', '이메일을 입력해주세요.');
        isValid = false;
    } else if (!isValidEmail(email)) {
        showFieldError(form, 'email', '올바른 이메일 형식을 입력해주세요.');
        isValid = false;
    }
    
    // 약관 동의 검증
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

// API 시뮬레이션 함수들
function simulateLogin(loginId, password) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const user = testUsers.find(u => u.id === loginId && u.password === password);
            
            if (user) {
                resolve({
                    success: true,
                    user: { id: user.id, name: user.name }
                });
            } else {
                reject({
                    message: '아이디 또는 비밀번호가 올바르지 않습니다.'
                });
            }
        }, 1500); // 1.5초 로딩 시뮬레이션
    });
}

function simulateSignup(formData) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const signupId = formData.get('signupId');
            
            // 아이디 중복 확인
            const existingUser = testUsers.find(u => u.id === signupId);
            if (existingUser) {
                reject({
                    message: '이미 사용중인 아이디입니다.'
                });
                return;
            }
            
            // 새 사용자 추가 (실제로는 서버에서 처리)
            const newUser = {
                id: signupId,
                password: formData.get('password'),
                name: formData.get('name'),
                phone: formData.get('phone'),
                email: formData.get('email')
            };
            
            testUsers.push(newUser);
            
            resolve({
                success: true,
                message: '회원가입이 완료되었습니다.'
            });
        }, 2000); // 2초 로딩 시뮬레이션
    });
}

// UI 헬퍼 함수들
function setLoadingState(form, loading) {
    isLoading = loading;
    const submitBtn = form.querySelector('button[type="submit"]');
    
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
        
        // 3초 후 에러 스타일 제거
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
    
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    // 5초 후 알림 숨기기
    setTimeout(() => {
        notification.classList.remove('show');
    }, 5000);
}

// 기타 기능들
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

// 보안 페이지 표시 - 로그인 확인 추가
function showSecurityPage(event) {
    if (event) event.preventDefault();
    
    // 로그인 상태 확인
    if (!isLoggedIn) {
        showNotification('보안 페이지는 로그인 후 이용하실 수 있습니다.', 'warning');
        // 로그인 모달 표시
        setTimeout(() => {
            openModal('loginModal');
        }, 500);
        return; // 미인증 사용자는 여기서 종료
    }
    
    // 로그인된 경우에만 보안 페이지 표시
    const securityPage = document.getElementById('securityPage');
    securityPage.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // 보안 데이터 로드
    loadSecurityData();
    
    // 실시간 업데이트 시작
    startSecurityMonitoring();
}

function hideSecurityPage() {
    const securityPage = document.getElementById('securityPage');
    securityPage.classList.remove('active');
    document.body.style.overflow = 'auto';
    
    // 모니터링 중지
    stopSecurityMonitoring();
}

// ============================================
// 보안 데이터 로드 (백엔드 API 연동 부분)
// ============================================

// 보안 데이터 로드 함수 - 백엔드 API와 연동할 부분
async function loadSecurityData() {
    try {
        // TODO: 실제 백엔드 API 호출로 대체해야 합니다
        // 예시:
        // const response = await fetch('/api/security/threats', {
        //     method: 'GET',
        //     headers: {
        //         'Authorization': `Bearer ${currentUser.token}`,
        //         'Content-Type': 'application/json'
        //     }
        // });
        // 
        // if (!response.ok) {
        //     throw new Error('보안 데이터 로드 실패');
        // }
        // 
        // const data = await response.json();
        // updateSecurityDashboard(data);
        
        // 현재는 시뮬레이션 데이터 표시
        console.log('보안 데이터 로드 완료 (시뮬레이션)');
        console.log('현재 로그인 사용자:', currentUser);
        
        // 백엔드에서 받아올 데이터 형식 예시
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
                // ... 더 많은 공격 데이터
            ]
        };
        
        updateSecurityDashboard(mockData);
        
    } catch (error) {
        console.error('보안 데이터 로드 실패:', error);
        showNotification('보안 데이터를 불러오는데 실패했습니다.', 'error');
    }
}

// 보안 대시보드 업데이트 함수
function updateSecurityDashboard(data) {
    // 백엔드에서 받아온 데이터로 대시보드 업데이트
    const attackCount = document.getElementById('attackCount');
    const blockedIPs = document.getElementById('blockedIPs');
    const suspiciousCount = document.getElementById('suspiciousCount');
    
    if (attackCount) attackCount.textContent = data.attackCount;
    if (blockedIPs) blockedIPs.textContent = data.blockedIPs;
    if (suspiciousCount) suspiciousCount.textContent = data.suspiciousCount;
    
    // TODO: 추가로 최근 공격 목록, 차단된 IP 목록 등을 업데이트
    // if (data.recentAttacks) {
    //     updateRecentAttacksList(data.recentAttacks);
    // }
}

// 실시간 보안 모니터링
let monitoringInterval;

function startSecurityMonitoring() {
    // 3초마다 데이터 업데이트
    // 실제 프로젝트에서는 WebSocket이나 Server-Sent Events 사용 권장
    monitoringInterval = setInterval(() => {
        // TODO: 실제로는 백엔드 API를 주기적으로 호출
        // loadSecurityData();
        
        // 현재는 시뮬레이션으로 랜덤 업데이트
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
    }
}

// 개발자 도구에서 사용할 수 있는 전역 함수들
window.SecureBank = {
    openModal,
    closeModal,
    showNotification,
    testUsers,
    isLoggedIn: () => isLoggedIn,
    currentUser: () => currentUser,
    logout: handleLogout
};

console.log("SecureBank 시스템이 로드되었습니다.");

// 로그인 처리
async function handleLogin(event) {
  event.preventDefault();
  const id = document.getElementById("loginId").value.trim();
  const pw = document.getElementById("loginPassword").value.trim();

  if (!id || !pw) {
    alert("아이디와 비밀번호를 입력하세요.");
    return;
  }

  try {
    const res = await fetch("backend/login.php", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `loginId=${encodeURIComponent(id)}&password=${encodeURIComponent(pw)}`
});
const data = await res.json();
alert(data.message);
if (data.success) closeModal('loginModal');

  } catch (err) {
    alert("서버 오류가 발생했습니다.");
    console.error(err);
  }
}

// 회원가입 처리
async function handleSignup(event) {
  event.preventDefault();
  const id = document.getElementById("signupId").value.trim();
  const pw = document.getElementById("signupPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();

  if (!id || !pw) {
    alert("아이디와 비밀번호를 입력하세요.");
    return;
  }
  if (pw !== confirm) {
    alert("비밀번호가 일치하지 않습니다.");
    return;
  }

  try {
   const res = await fetch("backend/login.php", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `loginId=${encodeURIComponent(id)}&password=${encodeURIComponent(pw)}`
    });

    const data = await res.json();
    alert(data.message);
    if (data.success) switchModal("signupModal", "loginModal");
  } catch (err) {
    alert("서버 오류가 발생했습니다.");
    console.error(err);
  }
}

// 알림 표시
function showNotification(msg) {
  const n = document.getElementById('notification');
  n.innerText = msg;
  n.classList.add('show');
  setTimeout(() => n.classList.remove('show'), 3000);
}
