// ============================================================
// 프레디의 피자가게 - CCTV 시스템 (엔트리 코드 기준)
// ============================================================
// 오브젝트 구성:
//   - CCTV_화면       : 현재 카메라 화면을 보여주는 배경 오브젝트
//   - 카메라_패널     : 하단 카메라 선택 버튼 UI
//   - 애니마트로닉스  : 프레디, 보니, 치카, 폭시 오브젝트 각각
//   - 전력_표시       : 현재 남은 전력 텍스트
//   - 경보음          : 소리 오브젝트
// ============================================================

// ─────────────────────────────────────────
// [전역 변수 선언] - 엔트리의 '변수' 탭에서 생성
// ─────────────────────────────────────────
/*
  변수 목록:
    currentCam      (숫자, 초기값: 1)   현재 보고 있는 카메라 번호 (1~7)
    cameraOpen      (불리언, 초기값: false) CCTV 패널 열림 여부
    power           (숫자, 초기값: 100) 남은 전력 (%)
    powerDrain      (숫자, 초기값: 1)   초당 전력 소모량
    hour            (숫자, 초기값: 0)   현재 시각 (0~6 → 12AM~6AM)
    gameOver        (불리언, 초기값: false)
    fredyPos        (숫자, 초기값: 1)   프레디 위치 (카메라 번호)
    bonniePos       (숫자, 초기값: 2)   보니 위치
    chicaPos        (숫자, 초기값: 3)   치카 위치
    foxyPos         (숫자, 초기값: 7)   폭시 위치 (7 = 해적만)
    foxyRunning     (불리언, 초기값: false) 폭시 달리기 상태
    leftDoorClosed  (불리언, 초기값: false)
    rightDoorClosed (불리언, 초기값: false)
    leftLightOn     (불리언, 초기값: false)
    rightLightOn    (불리언, 초기값: false)
*/

// ─────────────────────────────────────────
// [카메라 위치 맵]
// 카메라 번호 → 장소 이름
//   1: 무대 (프레디, 보니, 치카 시작 위치)
//   2: 행사 홀
//   3: 복도 A (왼쪽)
//   4: 복도 B (오른쪽)
//   5: 백스테이지
//   6: 주방
//   7: 해적만 (폭시 시작 위치)
// ─────────────────────────────────────────

// =============================================
// 오브젝트: CCTV_화면
// =============================================
Entry.CCTV화면 = {

  // 시작하기 클릭 시 실행
  whenStart: function () {
    // 화면 숨기기 (CCTV 닫힌 상태)
    this.hide();

    // CCTV 열림 감지 루프
    Entry.engine.whenCondition(
      function () { return Entry.변수.cameraOpen === true; },
      function () {
        Entry.CCTV화면.show();
        Entry.CCTV화면.updateScreen();
      }
    );

    Entry.engine.whenCondition(
      function () { return Entry.변수.cameraOpen === false; },
      function () {
        Entry.CCTV화면.hide();
      }
    );
  },

  // 현재 카메라에 맞는 배경 모양으로 변경
  updateScreen: function () {
    const cam = Entry.변수.currentCam;
    // 모양 이름 = "cam1", "cam2", ... "cam7"
    this.setShape("cam" + cam);
  }
};

// =============================================
// 오브젝트: 카메라_패널 (하단 UI)
// =============================================
Entry.카메라패널 = {

  whenStart: function () {
    this.hide(); // 처음에는 숨김

    // 마우스 클릭으로 CCTV 토글
    this.onClick(function () {
      Entry.변수.cameraOpen = !Entry.변수.cameraOpen;
      if (Entry.변수.cameraOpen) {
        // CCTV 열 때 전력 소모 증가
        Entry.변수.powerDrain = 2;
        Entry.카메라패널.show();
      } else {
        Entry.변수.powerDrain = 1;
        Entry.카메라패널.hide();
      }
    });
  },

  // 카메라 번호 버튼 클릭 시 호출
  selectCamera: function (num) {
    if (Entry.변수.cameraOpen && !Entry.변수.gameOver) {
      Entry.변수.currentCam = num;
      Entry.CCTV화면.updateScreen();
    }
  }
};

// =============================================
// 오브젝트: 시계 / 시간 관리
// =============================================
Entry.시계 = {

  whenStart: function () {
    Entry.변수.hour = 0;

    // 매 89초마다 1시간 경과 (실제 FNAF 기준 약 89초 = 1게임시간)
    Entry.engine.repeat(function () {
      if (!Entry.변수.gameOver) {
        Entry.엔진.wait(89); // 엔트리: '~초 기다리기'
        Entry.변수.hour += 1;
        Entry.시계.updateDisplay();

        if (Entry.변수.hour >= 6) {
          Entry.시계.gameWin();
        }
      }
    });
  },

  updateDisplay: function () {
    const labels = ["12 AM", "1 AM", "2 AM", "3 AM", "4 AM", "5 AM", "6 AM"];
    // 텍스트 오브젝트 '시간_표시'의 내용 변경
    Entry.시간표시.setText(labels[Entry.변수.hour] || "6 AM");
  },

  gameWin: function () {
    // 6AM 도달 = 생존 성공
    Entry.엔진.stopAll();
    Entry.씬.changeScene("승리_화면");
  }
};

// =============================================
// 오브젝트: 전력 관리
// =============================================
Entry.전력관리 = {

  whenStart: function () {
    Entry.변수.power = 100;

    Entry.engine.forever(function () {
      if (!Entry.변수.gameOver && Entry.변수.power > 0) {
        Entry.엔진.wait(1); // 1초마다
        Entry.변수.power -= Entry.변수.powerDrain;

        // 전력 표시 업데이트
        Entry.전력표시.setText("Power left: " + Math.max(0, Entry.변수.power) + "%");

        if (Entry.변수.power <= 0) {
          Entry.전력관리.powerOut();
        }
      }
    });
  },

  // 전력 소진 이벤트
  powerOut: function () {
    Entry.변수.gameOver = true;
    Entry.변수.power = 0;
    // 모든 불 끄기
    Entry.변수.leftLightOn = false;
    Entry.변수.rightLightOn = false;
    // 화면 어둡게
    Entry.씬.changeScene("정전_화면");
    // 20초 후 프레디 점프스케어
    Entry.엔진.wait(20);
    Entry.애니마트로닉스.프레디.jumpScare();
  }
};

// =============================================
// 오브젝트: 문 / 조명 제어 패널
// =============================================
Entry.문패널 = {

  whenStart: function () {
    Entry.변수.leftDoorClosed  = false;
    Entry.변수.rightDoorClosed = false;
    Entry.변수.leftLightOn     = false;
    Entry.변수.rightLightOn    = false;
  },

  // 왼쪽 문 버튼
  toggleLeftDoor: function () {
    if (Entry.변수.gameOver) return;
    Entry.변수.leftDoorClosed = !Entry.변수.leftDoorClosed;
    // 문 오브젝트 모양 변경
    Entry.왼쪽문.setShape(Entry.변수.leftDoorClosed ? "door_closed" : "door_open");
    // 문 닫으면 전력 추가 소모
    Entry.변수.powerDrain += Entry.변수.leftDoorClosed ? 1 : -1;
  },

  // 오른쪽 문 버튼
  toggleRightDoor: function () {
    if (Entry.변수.gameOver) return;
    Entry.변수.rightDoorClosed = !Entry.변수.rightDoorClosed;
    Entry.오른쪽문.setShape(Entry.변수.rightDoorClosed ? "door_closed" : "door_open");
    Entry.변수.powerDrain += Entry.변수.rightDoorClosed ? 1 : -1;
  },

  // 왼쪽 조명 버튼 (누르는 동안만 켜짐)
  holdLeftLight: function () {
    if (Entry.변수.gameOver) return;
    Entry.변수.leftLightOn = true;
    Entry.변수.powerDrain += 1;
    Entry.왼쪽조명.show();
    // 복도에 애니마트로닉스 있는지 확인
    Entry.문패널.checkHallway("left");
  },

  releaseLeftLight: function () {
    Entry.변수.leftLightOn = false;
    Entry.변수.powerDrain -= 1;
    Entry.왼쪽조명.hide();
  },

  holdRightLight: function () {
    if (Entry.변수.gameOver) return;
    Entry.변수.rightLightOn = true;
    Entry.변수.powerDrain += 1;
    Entry.오른쪽조명.show();
    Entry.문패널.checkHallway("right");
  },

  releaseRightLight: function () {
    Entry.변수.rightLightOn = false;
    Entry.변수.powerDrain -= 1;
    Entry.오른쪽조명.hide();
  },

  // 복도 확인: 애니마트로닉스가 문 앞에 있으면 표시
  checkHallway: function (side) {
    if (side === "left") {
      // 보니는 왼쪽 복도(3)에서 대기 후 진입
      if (Entry.변수.bonniePos === 0) { // 0 = 문 앞
        Entry.왼쪽복도경보.show();
      }
    } else {
      // 치카는 오른쪽 복도(4)에서 대기 후 진입
      if (Entry.변수.chicaPos === 0) {
        Entry.오른쪽복도경보.show();
      }
    }
  }
};

// =============================================
// 오브젝트: 애니마트로닉스 AI
// =============================================

// ── 프레디 ──────────────────────────────────
Entry.애니마트로닉스 = {};

Entry.애니마트로닉스.프레디 = {
  // 이동 경로: 1(무대) → 2(행사홀) → 6(주방) → 4(오른복도) → 0(문앞) → 공격
  movePath: [1, 2, 6, 4, 0],
  pathIndex: 0,

  whenStart: function () {
    Entry.변수.fredyPos = 1;
    this.pathIndex = 0;
    this.aiLoop();
  },

  aiLoop: function () {
    Entry.engine.forever(function () {
      if (Entry.변수.gameOver) return;

      // 난이도: 시간이 지날수록 이동 빨라짐 (최소 5초)
      const delay = Math.max(5, 20 - Entry.변수.hour * 2);
      Entry.엔진.wait(delay);

      // 랜덤 이동 여부 결정 (AI 레벨에 따라)
      const aiLevel = Math.min(20, Entry.변수.hour * 3);
      if (Entry.랜덤(1, 20) <= aiLevel) {
        Entry.애니마트로닉스.프레디.move();
      }
    });
  },

  move: function () {
    const self = Entry.애니마트로닉스.프레디;
    if (self.pathIndex < self.movePath.length - 1) {
      self.pathIndex++;
      Entry.변수.fredyPos = self.movePath[self.pathIndex];
    } else {
      // 문 앞 도달 → 공격 시도
      self.tryAttack();
    }
  },

  tryAttack: function () {
    // 오른쪽 문이 열려 있으면 공격
    if (!Entry.변수.rightDoorClosed) {
      this.jumpScare();
    } else {
      // 문이 닫혀 있으면 후퇴
      this.pathIndex = 0;
      Entry.변수.fredyPos = 1;
    }
  },

  jumpScare: function () {
    Entry.변수.gameOver = true;
    Entry.소리.play("jumpscare_freddy");
    Entry.점프스케어화면.show();
    Entry.엔진.wait(3);
    Entry.씬.changeScene("게임오버_화면");
  }
};

// ── 보니 ──────────────────────────────────
Entry.애니마트로닉스.보니 = {
  // 이동 경로: 1(무대) → 2(행사홀) → 3(왼복도) → 0(문앞) → 공격
  movePath: [1, 2, 3, 0],
  pathIndex: 0,

  whenStart: function () {
    Entry.변수.bonniePos = 1;
    this.pathIndex = 0;
    this.aiLoop();
  },

  aiLoop: function () {
    Entry.engine.forever(function () {
      if (Entry.변수.gameOver) return;

      const delay = Math.max(3, 15 - Entry.변수.hour * 2);
      Entry.엔진.wait(delay);

      const aiLevel = Math.min(20, Entry.변수.hour * 4 + 2);
      if (Entry.랜덤(1, 20) <= aiLevel) {
        Entry.애니마트로닉스.보니.move();
      }
    });
  },

  move: function () {
    const self = Entry.애니마트로닉스.보니;
    if (self.pathIndex < self.movePath.length - 1) {
      self.pathIndex++;
      Entry.변수.bonniePos = self.movePath[self.pathIndex];
    } else {
      self.tryAttack();
    }
  },

  tryAttack: function () {
    if (!Entry.변수.leftDoorClosed) {
      Entry.변수.gameOver = true;
      Entry.소리.play("jumpscare_bonnie");
      Entry.점프스케어화면.show();
      Entry.엔진.wait(3);
      Entry.씬.changeScene("게임오버_화면");
    } else {
      // 문 닫혀 있으면 후퇴
      this.pathIndex = 0;
      Entry.변수.bonniePos = 1;
    }
  }
};

// ── 치카 ──────────────────────────────────
Entry.애니마트로닉스.치카 = {
  // 이동 경로: 1(무대) → 2(행사홀) → 6(주방) → 4(오른복도) → 0(문앞)
  movePath: [1, 2, 6, 4, 0],
  pathIndex: 0,

  whenStart: function () {
    Entry.변수.chicaPos = 1;
    this.pathIndex = 0;
    this.aiLoop();
  },

  aiLoop: function () {
    Entry.engine.forever(function () {
      if (Entry.변수.gameOver) return;

      const delay = Math.max(4, 18 - Entry.변수.hour * 2);
      Entry.엔진.wait(delay);

      const aiLevel = Math.min(20, Entry.변수.hour * 3 + 1);
      if (Entry.랜덤(1, 20) <= aiLevel) {
        Entry.애니마트로닉스.치카.move();
      }
    });
  },

  move: function () {
    const self = Entry.애니마트로닉스.치카;
    if (self.pathIndex < self.movePath.length - 1) {
      self.pathIndex++;
      Entry.변수.chicaPos = self.movePath[self.pathIndex];
    } else {
      self.tryAttack();
    }
  },

  tryAttack: function () {
    if (!Entry.변수.rightDoorClosed) {
      Entry.변수.gameOver = true;
      Entry.소리.play("jumpscare_chica");
      Entry.점프스케어화면.show();
      Entry.엔진.wait(3);
      Entry.씬.changeScene("게임오버_화면");
    } else {
      this.pathIndex = 0;
      Entry.변수.chicaPos = 1;
    }
  }
};

// ── 폭시 ──────────────────────────────────
Entry.애니마트로닉스.폭시 = {
  // 폭시는 해적만(cam7)에서 특수 행동
  // CCTV로 자주 안 보면 달려옴
  runTimer: 0,        // CCTV를 안 본 누적 시간
  checkInterval: 5,   // 5초마다 체크

  whenStart: function () {
    Entry.변수.foxyPos = 7;
    Entry.변수.foxyRunning = false;
    this.watchLoop();
  },

  watchLoop: function () {
    Entry.engine.forever(function () {
      if (Entry.변수.gameOver) return;
      Entry.엔진.wait(Entry.애니마트로닉스.폭시.checkInterval);

      // cam7을 보고 있으면 타이머 초기화
      if (Entry.변수.cameraOpen && Entry.변수.currentCam === 7) {
        Entry.애니마트로닉스.폭시.runTimer = 0;
      } else {
        Entry.애니마트로닉스.폭시.runTimer += Entry.애니마트로닉스.폭시.checkInterval;
      }

      // 20초 이상 안 보면 달리기 시작
      if (Entry.애니마트로닉스.폭시.runTimer >= 20 && !Entry.변수.foxyRunning) {
        Entry.애니마트로닉스.폭시.startRun();
      }
    });
  },

  startRun: function () {
    Entry.변수.foxyRunning = true;
    Entry.소리.play("foxy_running");
    // 5초 후 문에 도달
    Entry.엔진.wait(5);
    Entry.애니마트로닉스.폭시.reachDoor();
  },

  reachDoor: function () {
    // 폭시는 왼쪽 문으로 옴
    if (!Entry.변수.leftDoorClosed) {
      Entry.변수.gameOver = true;
      Entry.소리.play("jumpscare_foxy");
      Entry.점프스케어화면.show();
      Entry.엔진.wait(3);
      Entry.씬.changeScene("게임오버_화면");
    } else {
      // 문 닫혀 있으면 전력 소모 후 돌아감
      Entry.변수.power -= 5; // 문 두드리기
      Entry.소리.play("foxy_knock");
      Entry.변수.foxyRunning = false;
      Entry.애니마트로닉스.폭시.runTimer = 0;
      Entry.변수.foxyPos = 7;
    }
  }
};

// =============================================
// 오브젝트: CCTV 화면에 애니마트로닉스 표시
// =============================================
Entry.CCTV위치표시 = {

  whenStart: function () {
    // 카메라가 열려 있고 현재 카메라에 캐릭터가 있으면 해당 스프라이트 표시
    Entry.engine.forever(function () {
      if (!Entry.변수.cameraOpen) return;

      const cam = Entry.변수.currentCam;

      // 각 캐릭터 카메라 위치에 따라 스프라이트 표시/숨김
      Entry.CCTV위치표시.showIfOnCam(Entry.프레디스프라이트,  Entry.변수.fredyPos,  cam);
      Entry.CCTV위치표시.showIfOnCam(Entry.보니스프라이트,   Entry.변수.bonniePos, cam);
      Entry.CCTV위치표시.showIfOnCam(Entry.치카스프라이트,   Entry.변수.chicaPos,  cam);
      Entry.CCTV위치표시.showIfOnCam(Entry.폭시스프라이트,   Entry.변수.foxyPos,   cam);
    });
  },

  showIfOnCam: function (sprite, charPos, currentCam) {
    if (charPos === currentCam) {
      sprite.show();
    } else {
      sprite.hide();
    }
  }
};

// =============================================
// 오브젝트: 배경음악 / 효과음 관리
// =============================================
Entry.소리관리 = {

  whenStart: function () {
    // 배경 정적음 (카메라 노이즈)
    Entry.engine.forever(function () {
      if (Entry.변수.cameraOpen) {
        Entry.소리.play("camera_static");
      }
    });
  }
};

// =============================================
// ── 엔트리 블록 코드 대응 의사코드 (참고용) ──
// =============================================
/*
[시작하기 클릭했을 때]
  변수 power ← 100
  변수 hour ← 0
  변수 gameOver ← 거짓
  변수 currentCam ← 1
  변수 cameraOpen ← 거짓

  [계속 반복하기]
    만약 gameOver = 거짓 이라면
      1초 기다리기
      power ← power - powerDrain
      만약 power ≤ 0 이라면
        gameOver ← 참
        [정전 처리]

[마우스를 클릭했을 때] (카메라_패널 오브젝트)
  만약 cameraOpen = 거짓 이라면
    cameraOpen ← 참
    모양을 'panel_open'으로 바꾸기
  아니면
    cameraOpen ← 거짓
    모양을 'panel_closed'으로 바꾸기

[카메라 1 버튼 클릭했을 때]
  currentCam ← 1
  CCTV_화면 모양을 'cam1'으로 바꾸기

[카메라 2 버튼 클릭했을 때]
  currentCam ← 2
  CCTV_화면 모양을 'cam2'으로 바꾸기

... (cam3~cam7 동일)

[보니 AI - 계속 반복하기]
  만약 gameOver = 거짓 이라면
    (15 - hour×2) 초 기다리기
    만약 무작위수(1~20) ≤ (hour×4+2) 이라면
      만약 bonniePos < 3 이라면
        bonniePos ← bonniePos + 1
      아니면
        만약 leftDoorClosed = 거짓 이라면
          gameOver ← 참
          점프스케어 실행
        아니면
          bonniePos ← 1

[폭시 AI - 계속 반복하기]
  만약 gameOver = 거짓 이라면
    5초 기다리기
    만약 cameraOpen = 참 그리고 currentCam = 7 이라면
      runTimer ← 0
    아니면
      runTimer ← runTimer + 5
    만약 runTimer ≥ 20 그리고 foxyRunning = 거짓 이라면
      foxyRunning ← 참
      '폭시 달리기' 소리 재생
      5초 기다리기
      만약 leftDoorClosed = 거짓 이라면
        gameOver ← 참
        점프스케어 실행
      아니면
        power ← power - 5
        foxyRunning ← 거짓
        runTimer ← 0
*/
