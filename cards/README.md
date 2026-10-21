# 타로 리딩 판독기 · 카드 일러스트 작업 안내 (ChatGPT 담당)

## 역할 분담
- **ChatGPT**: 타로카드 78장 일러스트 제작
- **Claude**: 사이트 코드, 게시판·운영자 기능, 보안 설정, 글꼴, 이미지 자동 변환, 배포
- **연이**: ChatGPT가 만든 그림을 확인하고 GitHub `cards` 폴더에 올리기, Vercel 환경변수 설정

일러스트가 없는 카드는 사이트가 자동으로 기본 도안(기하학 SVG)을 보여줘요. 그래서 그림은 몇 장씩 나눠 올려도 돼요.

## ChatGPT에 붙여넣을 요청문
```
타로 리딩 판독기 사이트에 넣을 타로카드 일러스트를 만들어 줘.
- 세로 2:3 비율(1024x1536), 카드 한 장만 꽉 차게. 테두리 여백 없이.
- 그림 안에 글자·숫자·카드 이름·로고·서명은 넣지 마. 카드 이름은 사이트가 따로 표시해.
- 특정 타로 덱(라이더-웨이트 등)이나 특정 작가·애니메이션 화풍을 따라 하지 말고, 새로운 그림으로 그려 줘.
- 실존 인물이나 유명 캐릭터를 닮게 그리지 마.
- 78장이 한 세트로 보이도록 같은 화풍과 색감을 유지해 줘: [원하는 분위기 예: 밤하늘 남보라 바탕, 금색 선, 부드러운 수채화 느낌]
- 위아래 끝부분은 살짝 잘릴 수 있으니 중요한 요소는 가운데에 둬.
- 역방향 카드는 사이트가 그림을 180도 돌려서 보여주니 정방향만 만들어 줘.
- 파일 이름은 아래 목록의 영문 이름으로 저장해 줘. 예: major-00.png
이번에 만들 카드: [예: major-00 ~ major-05]
```

## 파일 이름 규칙
- 영문 이름(`major-00.png`)이나 카드 이름(`바보.png`, `컵 에이스.png`) 둘 다 돼요.
- PNG, JPG, WebP 모두 돼요.
- 올리면 GitHub가 자동으로 480x720 WebP로 줄이고 목록(`cards/manifest.json`)을 갱신해요.
- 이름을 알아볼 수 없는 파일은 건너뛰고 그대로 남아요.

## 올리는 방법
1. https://github.com/jvix356/tarot-check/upload/main/cards 접속
2. 그림 파일들을 끌어다 놓고 **Commit changes** 누르기
3. 1~2분 뒤 Actions 탭에서 "Card illustrations"가 초록색이 되면 끝. Vercel이 새로 배포하면 사이트에 보여요.

## 저작권 확인
- 올리기 전에 기존 덱이나 캐릭터를 닮지 않았는지 한 번 봐 주세요.
- ChatGPT로 만든 그림의 이용 조건은 OpenAI 이용약관을 따라요.
- 사이트 안내문에는 "카드 그림은 이 사이트용으로 새로 만든 도안·일러스트"라고 적혀 있어요.

## 카드 78장 파일 이름
- major-00 = 바보
- major-01 = 마법사
- major-02 = 여사제
- major-03 = 여황제
- major-04 = 황제
- major-05 = 교황
- major-06 = 연인
- major-07 = 전차
- major-08 = 힘
- major-09 = 은둔자
- major-10 = 운명의 수레바퀴
- major-11 = 정의
- major-12 = 매달린 사람
- major-13 = 죽음
- major-14 = 절제
- major-15 = 악마
- major-16 = 탑
- major-17 = 별
- major-18 = 달
- major-19 = 태양
- major-20 = 심판
- major-21 = 세계
- wands-01 = 완드 에이스
- wands-02 = 완드 2
- wands-03 = 완드 3
- wands-04 = 완드 4
- wands-05 = 완드 5
- wands-06 = 완드 6
- wands-07 = 완드 7
- wands-08 = 완드 8
- wands-09 = 완드 9
- wands-10 = 완드 10
- wands-11 = 완드 페이지
- wands-12 = 완드 나이트
- wands-13 = 완드 퀸
- wands-14 = 완드 킹
- cups-01 = 컵 에이스
- cups-02 = 컵 2
- cups-03 = 컵 3
- cups-04 = 컵 4
- cups-05 = 컵 5
- cups-06 = 컵 6
- cups-07 = 컵 7
- cups-08 = 컵 8
- cups-09 = 컵 9
- cups-10 = 컵 10
- cups-11 = 컵 페이지
- cups-12 = 컵 나이트
- cups-13 = 컵 퀸
- cups-14 = 컵 킹
- swords-01 = 소드 에이스
- swords-02 = 소드 2
- swords-03 = 소드 3
- swords-04 = 소드 4
- swords-05 = 소드 5
- swords-06 = 소드 6
- swords-07 = 소드 7
- swords-08 = 소드 8
- swords-09 = 소드 9
- swords-10 = 소드 10
- swords-11 = 소드 페이지
- swords-12 = 소드 나이트
- swords-13 = 소드 퀸
- swords-14 = 소드 킹
- pentacles-01 = 펜타클 에이스
- pentacles-02 = 펜타클 2
- pentacles-03 = 펜타클 3
- pentacles-04 = 펜타클 4
- pentacles-05 = 펜타클 5
- pentacles-06 = 펜타클 6
- pentacles-07 = 펜타클 7
- pentacles-08 = 펜타클 8
- pentacles-09 = 펜타클 9
- pentacles-10 = 펜타클 10
- pentacles-11 = 펜타클 페이지
- pentacles-12 = 펜타클 나이트
- pentacles-13 = 펜타클 퀸
- pentacles-14 = 펜타클 킹
