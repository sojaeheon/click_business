기능,도메인,페이지,사용자,Method,URL,param,응답 데이터,추가 설명
,,,,,,,,
,,,,,,,,
로그인 관련,,,,,,,,
구글 로그인 요청,Auth,로그인,유저,GET,/api/v1/auth/google/login,-,구글 인증 페이지 리다이렉트 URL,OAuth 인증 페이지 연결
구글 로그인 콜백 후 토큰 발급,Login,로그인,유저,GET,/api/v1/auth/callback,{Authorization code} (Body),"accessToken, refreshToken",JWT 발급
토큰 재발급,Login,로그인,유저,POST,/api/v1/auth/refresh,refresh,accessToken,Cookie(refresh_token) 검증 + DB 유효성 확인 후 200 JSON {access} (access는 FE 메모리 저장)
로그아웃,Login,"네비바, 로그인",유저,POST,/api/v1/auth/logout,-,-,DB에서 refresh 폐기/삭제 + refresh_token 쿠키 만료(Set-Cookie Max-Age=0)
기업 산업군 설정,Company,로그인,유저,POST,/api/v1/companies,"company_id, industry_type","company_id, user_id, company_name, industry_type, …",기업 산업군 선택 [신규 유저 필수 절차]
기업 이름 설정,Company,로그인,유저,POST,/api/v1/companies,"company_id, company_name","company_id, user_id, company_name, industry_type, …",기업 이름 설정 [신규 유저 필수 절차]
,,,,,,,,
환경설정 관련,,,,,,,,
내 프로필 조회,Profile,환경설정,유저,GET,/api/v1/users?user_id={user_id},user_id,"user_id, nickname, is_guest, created_at, updated_at",200 프로필 + 프로필 완료 여부 / 실패 401
유저 닉네임 수정,Profile,환경설정,유저,PATCH,/api/v1/users/{user_id},nickname,"user_id, nickname, is_guest, updated_at",인증 필요 / 부분 수정(PATCH) / 닉네임 중복 시 409(또는 400)
기업 이름 수정,Profile,환경설정,유저,PATCH,/api/v1/companies/{company_id},company_name,"company_id, user_id, company_name, updated_at",인증 필요 / 부분 수정(PATCH) / 닉네임 중복 시 409(또는 400)
유저 닉네임 중복 확인,Profile,환경설정,유저,GET,/api/v1/users/check-nickname,nickname,닉네임 중복 여부 boolean 타입,200 {available: true/false}
기업 이름 중복 확인,Profile,환경설정,유저,GET,/api/v1/companies/check-nickname,company_name,기업 이름 중복 여부 boolean 타입,200 {available: true/false}
회원 탈퇴,Profile,환경설정,유저,DELETE,/api/v1/users/{user_id},-,-,인증 필요 / 204 or 200 / refresh 폐기 + 쿠키 만료 / CASACADE로 관련 데이터 모두 삭제
,,,,,,,,
메인 페이지 관련,,,,,,,,
오버레이 렌더링,Main,메인페이지,유저,GET,/api/v1/main/overlay,company_id,"{company_id, industry_type, cash, total_asset}, {unread_notification}",기업 정보 요약 및 미확인 알림 조회
작업장 요약 정보,Main,메인페이지,유저,GET,/api/v1/workstations/preview,workstation_id,"{workstation_id, is_active}, {workstation_inventory_id, item_id, quantity, slot_type}",원문 + AI 정보 or 404
랭킹 요약 정보,Main,메인페이지,유저,GET,/api/v1/ranking/preview,company_id,-,
,,,,,,,,
마켓 관련,,,,,,,,
실시간 호가창 렌더링,Market,마켓페이지,유저,GET,/api/v1/market/orderbooks,item_id,호출 시점(틱)의 미체결 주문 데이터 전부,
지정가 주문 신청,Market,마켓페이지,유저,POST,/api/v1/market/orders,"{company_id, item_id, type, price, quantity} (body)","order_id, price, quantity, created_at",
주문 취소,Market,마켓페이지,유저,DELETE,/api/v1/market/orders/{order_id},company_id,-,204 or 200
체결 결과 수령,Market,마켓페이지,유저,POST,/api/v1/market/orders/{trade_history_id},-,"trade_history_id, order_type, execution_quantity, is_collected",
,,,,,,,,
창고 관련,,,,,,,,
창고 슬롯 조회,Warehouse,창고,유저,GET,/api/v1/storage/warehouses,company_id,"list<{slot_index, item_id, quantity, max_slot}, {…>",기업의 창고 최대 슬롯수와 현재 창고에 저장된 모든 아이템과 슬롯 번호를 응답
창고 슬롯 확장,Warehouse,창고,유저,POST,/api/v1/storage/warehouses,company_id,max_slot,창고 최대 슬롯수를 입력받은 칸만큼 증가
창고에 아이템 저장,Warehouse,창고,유저,POST,/api/v1/storage/warehouses,company_id,"slot_index, item_id, quantity",창고에 새로운 아이템을 빈 슬롯에 저장
창고에서 아이템 삭제,Warehouse,창고,유저,DELETE,/api/v1/storage/warehouses/{warehouse_id},-,-,204 or 200
아이템 슬롯 위치 변경,Warehouse,창고,유저,PATCH,/api/v1/storage/warehouses/slots,"warehouse_id, from_idx, to_idx","warehouse_id, item_id, slot_index",아이템을 원하는 슬롯번호로 변경
,,,,,,,,
인벤토리 관련,,,,,,,,
인벤토리 슬롯 조회,Inventory,인벤토리,유저,GET,/api/v1/storage/inventories,company_id,"list<{slot_index, item_id, serial_code, level, is_equipped max_slot}, {…>",기업의 인벤토리 최대 슬롯수와 현재 인벤토리에 저장된 모든 아이템과 슬롯 번호를 응답
인벤토리 슬롯 확장,Inventory,인벤토리,유저,POST,/api/v1/storage/inventories,company_id,max_slot,창고 최대 슬롯수를 입력받은 칸만큼 증가
인벤토리에 아이템 저장,Inventory,인벤토리,유저,POST,/api/v1/storage/inventories,company_id,"slot_index, item_id, serial_code, level",인벤토리에 새로운 아이템을 빈 슬롯에 저장
인벤토리에서 아이템 삭제,Inventory,인벤토리,유저,DELETE,/api/v1/storage/inventories/{inventory_id},-,-,204 or 200
아이템 슬롯 위치 변경,Inventory,인벤토리,유저,PATCH,/api/v1/storage/inventories/slots,"inventory_id, from_idx, to_idx","inventory_id, item_id, slot_index",아이템을 원하는 슬롯번호로 변경
,,,,,,,,
작업장 관련,,,,,,,,
작업장 상태 조회,Workstation,작업장,유저,GET,/api/v1/workstations,workstation_id,"{workstation_id, equipment_inventory_id, last_tick_time, is_active} {workstation_inventory_id, slot_type, quantity}","작업장 가동 여부, input/output 개수, 장착한 장비 데이터 응답"
완성된 상품 수령,Workstation,작업장,유저,POST,/api/v1/workstation_inventories,"workstation_inventory_id, slot_type, quantity","workstation_inventory_id, slot_type, quantity","현재 작업장의 output 수량을 0으로 만들고, 창고에 해당 아이템 수량 만큼 저장하는 api 리다이렉트"
작업장 작업 시작,Workstation,작업장,유저,POST,/api/v1/workstation_inventories,"workstation_inventory_id, slot_type, quantity","workstation_inventory_id, slot_type, quantity","작업장의 input 수량을 프론트에서 입력받은 양으로 만들고, 작업장 is_active를 true로 변경해 가동"
,,,,,,,,
기업 프로필 관련,,,,,,,,
기업 상세 정보 조회,Company,기업 프로필,유저,GET,api/v1/companies,company_id,"company_id, company_name, industry_type, cash, total_asset, inventory_remaining_slot, warehouse_remaining_slot",기업의 상세 정보를 조회
,,,,,,,,
알림 관련,,,,,,,,
알림 전체 조회,Alert,알림,유저,GET,api/v1/alerts,company_id,"alert_id, content, created_at",기업의 알림 전체를 조회
알림 단건 삭제,Alert,알림,유저,DELETE,api/v1/alerts,alert_id,-,204 or 200
알림 생성,Alert,알림,관리자,POST,api/v1/alerts,company_id,"alert_id, content, create_at",해당 기업의 새로운 알림 생성

기능,Method,URL,param,도메인,사용자,응답 데이터,추가 설명,페이지
로그인 관련,,,,,,,,
창고에 아이템 저장,POST,/api/v1/storage/warehouses,company_id,Warehouse,유저,"slot_index, item_id, quantity",창고에 새로운 아이템을 빈 슬롯에 저장,창고
토큰 재발급,POST,/api/v1/auth/refresh,refresh,Login,유저,accessToken,Cookie(refresh_token) 검증 + DB 유효성 확인 후 200 JSON {access} (access는 FE 메모리 저장),로그인
실시간 호가창 렌더링,GET,/api/v1/market/orderbooks,item_id,Market,유저,호출 시점(틱)의 미체결 주문 데이터 전부,,마켓페이지
작업장 요약 정보,GET,/api/v1/workstations/preview,workstation_id,Main,유저,"{workstation_id, is_active}, {workstation_inventory_id, item_id, quantity, slot_type}",원문 + AI 정보 or 404,메인페이지
마켓 관련,,,,,,,,
기업 이름 설정,POST,/api/v1/companies,"company_id, company_name",Company,유저,"company_id, user_id, company_name, industry_type, …",기업 이름 설정 [신규 유저 필수 절차],로그인
유저 닉네임 수정,PATCH,/api/v1/users/{user_id},nickname,Profile,유저,"user_id, nickname, is_guest, updated_at",인증 필요 / 부분 수정(PATCH) / 닉네임 중복 시 409(또는 400),환경설정
구글 로그인 요청,GET,/api/v1/auth/google/login,-,Auth,유저,구글 인증 페이지 리다이렉트 URL,OAuth 인증 페이지 연결,로그인
메인 페이지 관련,,,,,,,,
,,,,,,,,
오버레이 렌더링,GET,/api/v1/main/overlay,company_id,Main,유저,"{company_id, industry_type, cash, total_asset}, {unread_notification}",기업 정보 요약 및 미확인 알림 조회,메인페이지
유저 닉네임 중복 확인,GET,/api/v1/users/check-nickname,nickname,Profile,유저,닉네임 중복 여부 boolean 타입,200 {available: true/false},환경설정
,,,,,,,,
구글 로그인 콜백 후 토큰 발급,GET,/api/v1/auth/callback,{Authorization code} (Body),Login,유저,"accessToken, refreshToken",JWT 발급,로그인
체결 결과 수령,POST,/api/v1/market/orders/{trade_history_id},-,Market,유저,"trade_history_id, order_type, execution_quantity, is_collected",,마켓페이지
,,,,,,,,
주문 취소,DELETE,/api/v1/market/orders/{order_id},company_id,Market,유저,-,204 or 200,마켓페이지
지정가 주문 신청,POST,/api/v1/market/orders,"{company_id, item_id, type, price, quantity} (body)",Market,유저,"order_id, price, quantity, created_at",,마켓페이지
환경설정 관련,,,,,,,,
회원 탈퇴,DELETE,/api/v1/users/{user_id},-,Profile,유저,-,인증 필요 / 204 or 200 / refresh 폐기 + 쿠키 만료 / CASACADE로 관련 데이터 모두 삭제,환경설정
,,,,,,,,
내 프로필 조회,GET,/api/v1/users?user_id={user_id},user_id,Profile,유저,"user_id, nickname, is_guest, created_at, updated_at",200 프로필 + 프로필 완료 여부 / 실패 401,환경설정
창고 슬롯 조회,GET,/api/v1/storage/warehouses,company_id,Warehouse,유저,"list<{slot_index, item_id, quantity, max_slot}, {…>",기업의 창고 최대 슬롯수와 현재 창고에 저장된 모든 아이템과 슬롯 번호를 응답,창고
,,,,,,,,
창고 관련,,,,,,,,
로그아웃,POST,/api/v1/auth/logout,-,Login,유저,-,DB에서 refresh 폐기/삭제 + refresh_token 쿠키 만료(Set-Cookie Max-Age=0),"네비바, 로그인"
기업 산업군 설정,POST,/api/v1/companies,"company_id, industry_type",Company,유저,"company_id, user_id, company_name, industry_type, …",기업 산업군 선택 [신규 유저 필수 절차],로그인
기업 이름 수정,PATCH,/api/v1/companies/{company_id},company_name,Profile,유저,"company_id, user_id, company_name, updated_at",인증 필요 / 부분 수정(PATCH) / 닉네임 중복 시 409(또는 400),환경설정
기업 이름 중복 확인,GET,/api/v1/companies/check-nickname,company_name,Profile,유저,기업 이름 중복 여부 boolean 타입,200 {available: true/false},환경설정
랭킹 요약 정보,GET,/api/v1/ranking/preview,company_id,Main,유저,-,,메인페이지
창고에서 아이템 삭제,DELETE,/api/v1/storage/warehouses/{warehouse_id},-,Warehouse,유저,-,204 or 200,창고
아이템 슬롯 위치 변경,PATCH,/api/v1/storage/warehouses/slots,"warehouse_id, from_idx, to_idx",Warehouse,유저,"warehouse_id, item_id, slot_index",아이템을 원하는 슬롯번호로 변경,창고
,,,,,,,,
인벤토리 관련,,,,,,,,
인벤토리 슬롯 조회,GET,/api/v1/storage/inventories,company_id,Inventory,유저,"list<{slot_index, item_id, serial_code, level, is_equipped max_slot}, {…>",기업의 인벤토리 최대 슬롯수와 현재 인벤토리에 저장된 모든 아이템과 슬롯 번호를 응답,인벤토리
인벤토리에 아이템 저장,POST,/api/v1/storage/inventories,company_id,Inventory,유저,"slot_index, item_id, serial_code, level",인벤토리에 새로운 아이템을 빈 슬롯에 저장,인벤토리
인벤토리에서 아이템 삭제,DELETE,/api/v1/storage/inventories/{inventory_id},-,Inventory,유저,-,204 or 200,인벤토리
아이템 슬롯 위치 변경,PATCH,/api/v1/storage/inventories/slots,"inventory_id, from_idx, to_idx",Inventory,유저,"inventory_id, item_id, slot_index",아이템을 원하는 슬롯번호로 변경,인벤토리
,,,,,,,,
작업장 관련,,,,,,,,
작업장 상태 조회,GET,/api/v1/workstations,workstation_id,Workstation,유저,"{workstation_id, equipment_inventory_id, last_tick_time, is_active} {workstation_inventory_id, slot_type, quantity}","작업장 가동 여부, input/output 개수, 장착한 장비 데이터 응답",작업장
완성된 상품 수령,POST,/api/v1/workstation_inventories,"workstation_inventory_id, slot_type, quantity",Workstation,유저,"workstation_inventory_id, slot_type, quantity","현재 작업장의 output 수량을 0으로 만들고, 창고에 해당 아이템 수량 만큼 저장하는 api 리다이렉트",작업장
작업장 작업 시작,POST,/api/v1/workstation_inventories,"workstation_inventory_id, slot_type, quantity",Workstation,유저,"workstation_inventory_id, slot_type, quantity","작업장의 input 수량을 프론트에서 입력받은 양으로 만들고, 작업장 is_active를 true로 변경해 가동",작업장
기업 프로필 관련,,,,,,,,
,,,,,,,,
기업 상세 정보 조회,GET,api/v1/companies,company_id,Company,유저,"company_id, company_name, industry_type, cash, total_asset, inventory_remaining_slot, warehouse_remaining_slot",기업의 상세 정보를 조회,기업 프로필
알림 관련,,,,,,,,
,,,,,,,,
창고 슬롯 확장,POST,/api/v1/storage/warehouses,company_id,Warehouse,유저,max_slot,창고 최대 슬롯수를 입력받은 칸만큼 증가,창고
인벤토리 슬롯 확장,POST,/api/v1/storage/inventories,company_id,Inventory,유저,max_slot,창고 최대 슬롯수를 입력받은 칸만큼 증가,인벤토리
알림 전체 조회,GET,api/v1/alerts,company_id,Alert,유저,"alert_id, content, created_at",기업의 알림 전체를 조회,알림
알림 단건 삭제,DELETE,api/v1/alerts,alert_id,Alert,유저,-,204 or 200,알림
,,,,,,,,
알림 생성,POST,api/v1/alerts,company_id,Alert,관리자,"alert_id, content, create_at",해당 기업의 새로운 알림 생성,알림


-------------------------------------------------------------------------------------------------

# 4. API 명세서

[엔드포인트 (2)](%EC%97%94%EB%93%9C%ED%8F%AC%EC%9D%B8%ED%8A%B8%20(2)%2031483b01ae2181fa8fbae3c7a5253e77.csv)

### 1. ERD 수정 및 보완 (제안 1번 반영)

마켓 주문 체결 후 유저가 직접 버튼을 눌러 자산을 가져가는 **'수동 수령'** 로직을 확립하기 위해 아래 컬럼을 추가합니다.

- **`market_order` 테이블**:
    - **`is_collected` (boolean)**: 해당 주문이 체결된 후 유저가 물품이나 금액을 수령했는지 여부를 기록합니다.
- **`trade_history` 테이블**:
    - **`is_buyer_collected` (boolean)**: 매수자가 체결된 아이템을 수령했는지 확인합니다.
    - **`is_seller_collected` (boolean)**: 매도자가 판매 대금을 수령했는지 확인합니다.

---

### 2. 도메인별 상세 API 명세서 (API 수정 제안 전원 반영)

모든 API는 `companyId`, `storageType`, `workerId` 등 식별 파라미터를 상세화하여 설계되었습니다.

### ① 인증 및 기업 설정 (Auth & Company)

| **기능 설명** | **HTTP** | **URL** | **필요 파라미터** | **응답 데이터** |
| --- | --- | --- | --- | --- |
| **OAuth 인증 요청** | `GET` | `/api/v1/auth/google` | 없음 | `redirectUrl` |
| **토큰 발급** | `POST` | `/api/v1/auth/callback` | `{ "code": "string" }` | `{ "accessToken": "string", "isNewUser": boolean }` |
| **닉네임 중복 체크** | `GET` | `/api/v1/companies/check-nickname` | `?nickname=string` | `{ "isAvailable": boolean }` |
| **기업 초기 설정** | `POST` | `/api/v1/companies/setup` | `{ "nickname": "string", "industryType": "string", "role": "string" }` | `{ "companyId": Long, "status": "ACTIVE" }` |

### ② 메인 페이지 (Main Page)

| **기능 설명** | **HTTP** | **URL** | **필요 파라미터** | **응답 데이터** |
| --- | --- | --- | --- | --- |
| **상단바 자산 요약** | `GET` | `/api/v1/main/overlay` | `?companyId=Long` | `{ "cash": int, "totalAssets": int, "notiCount": int }` |
| **모달 활성화 상태** | `GET` | `/api/v1/main/contents` | 없음 | `List<{ "id": int, "name": "string", "isActive": boolean }>` |

### ③ 마켓 (Market)

| **기능 설명** | **HTTP** | **URL** | **필요 파라미터** | **응답 데이터** |
| --- | --- | --- | --- | --- |
| **실시간 호가창** | `GET` | `/api/v1/market/orderbook` | `?itemId=Long` | `{ "bids": [...], "asks": [...], "lastPrice": int }` |
| **지정가 주문 신청** | `POST` | `/api/v1/market/orders` | `{ "companyId": Long, "itemId": Long, "type": "BUY/SELL", "price": int, "qty": int }` | `{ "orderId": Long, "status": "PENDING" }` |
| **체결 결과 수령** | `POST` | `/api/v1/market/orders/{id}/collect` | `{ "companyId": Long }` (Path: `orderId`) | `{ "receivedQty": int, "receivedCash": int }` |
| **예약 주문 취소** | `DELETE` | `/api/v1/market/orders/{id}` | `?companyId=Long` (Path: `orderId`) | `{ "canceledQty": int, "refundAmount": int }` |

### ④ 저장소 및 슬롯 관리 (Storage & Slot)

| **기능 설명** | **HTTP** | **URL** | **필요 파라미터** | **응답 데이터** |
| --- | --- | --- | --- | --- |
| **창고 목록 조회** | `GET` | `/api/v1/storages/warehouses` | `?companyId=Long` | `List<{ "slotIdx": int, "itemId": Long, "qty": int }>` |
| **인벤토리 조회** | `GET` | `/api/v1/storages/inventories` | `?companyId=Long&isEquipped=bool` | `List<{ "slotIdx": int, "itemId": Long, "level": int }>` |
| **슬롯 위치 변경** | `PATCH` | `/api/v1/storages/slots` | `{ "companyId": Long, "storageType": "WAREHOUSE/INVENTORY", "fromIdx": int, "toIdx": int }` | `{ "success": boolean }` |

### ⑤ 작업장 (Workstation)

| **기능 설명** | **HTTP** | **URL** | **필요 파라미터** | **응답 데이터** |
| --- | --- | --- | --- | --- |
| **작업장 상태 조회** | `GET` | `/api/v1/workstations` | `?companyId=Long` | `{ "status": "string", "progress": int }` |
| **생산 시작 버튼** | `POST` | `/api/v1/workstations/start` | `{ "companyId": Long, "recipeId": Long, "quantity": int, "workerId": Long }` | `{ "endTime": "string", "status": "WORKING" }` |
| **결과물 수령 버튼** | `POST` | `/api/v1/workstations/collect` | `{ "companyId": Long }` | `{ "itemId": Long, "producedQty": int }` |

### ⑥ 시스템 (Bank, News, Noti, Ranking)

| **기능 설명** | **HTTP** | **URL** | **필요 파라미터** | **응답 데이터** |
| --- | --- | --- | --- | --- |
| **은행 정보 조회** | `GET` | `/api/v1/bank/summary` | `?companyId=Long` | `{ "cash": int, "loanAmount": int, "interestRate": float }` |
| **대출 실행/상환** | `POST` | `/api/v1/bank/loans` | `{ "companyId": Long, "type": "BORROW/REPAY", "amount": int }` | `{ "remainingLoan": int, "updatedCash": int }` |
| **알림 확인(읽음)** | `PATCH` | `/api/v1/notifications/{id}` | `notiId` (Path) | `{ "success": boolean, "unreadCount": int }` |
| **경제 뉴스 목록** | `GET` | `/api/v1/news` | `?limit=int` | `List<{ "id": Long, "title": "string", "content": "text" }>` |
| **명예의 전당** | `GET` | `/api/v1/rankings` | `?limit=int` | `List<{ "rank": int, "nickname": "string", "totalAssets": int }>` |

---

### 🏛️ 설계 핵심 요약

1. **수동 수령 무결성**: 마켓 및 작업장 수령 시 DB의 `is_collected` 또는 상태 값을 확인하여 중복 수령을 원천 차단합니다.
2. **슬롯 관리 유연성**: `storageType` 파라미터를 통해 하나의 API로 창고와 인벤토리 테이블을 구분하여 처리합니다.
3. **생산 효율 반영**: `workerId`를 통해 투입된 인부(장비)의 가중치를 계산에 포함합니다.