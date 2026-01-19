'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGame } from '@/hooks/useGame';
import DrawingCanvas from '@/components/DrawingCanvas';
import GameChat from '@/components/GameChat';

// 💡 누구나 그리기 쉬운 단어 100개 (동물, 음식, 사물 위주)
const WORDS = [
  // 1. 귀여운 동물 (20개)
  '고양이', '강아지', '병아리', '돼지', '소', '오리', '호랑이', '사자', '토끼', '곰',
  '기린', '코끼리', '원숭이', '뱀', '개구리', '물고기', '상어', '고래', '펭귄', '판다',

  // 2. 맛있는 음식 (20개)
  '사과', '바나나', '포도', '수박', '딸기', '햄버거', '피자', '치킨', '아이스크림', '케이크',
  '식빵', '우유', '계란', '라면', '김밥', '떡볶이', '사탕', '초콜릿', '도넛', '옥수수',

  // 3. 우리집 물건 (20개)
  '우산', '안경', '모자', '양말', '신발', '가방', '시계', '컵', '숟가락', '젓가락',
  '칫솔', '휴지', '거울', '열쇠', '자물쇠', '책', '연필', '지우개', '가위', '종이비행기',

  // 4. 탈것 & 장소 & 자연 (20개)
  '자동차', '비행기', '자전거', '배', '기차', '버스', '집', '학교', '병원', '놀이터',
  '나무', '꽃', '해바라기', '선인장', '구름', '해', '달', '별', '눈사람', '무지개',

  // 5. 신체 & 행동 & 직업 (20개)
  '눈', '코', '입', '귀', '손', '발', '의사', '경찰', '소방관', '요리사',
  '축구공', '야구방망이', '농구공', '수영', '낚시', '마이크', '침대', '텔레비전', '컴퓨터', '스마트폰'
];

export default function Home() {
  const [name, setName] = useState('');
  // 💡 방 ID는 고정 (편의상)
  const [roomId] = useState('e3975764-a744-48f0-b690-349c40333276'); 
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [targetRounds, setTargetRounds] = useState(1); // 라운드 설정 상태

  const { room, players, timeLeft, hint, currentScore, isMyTurn, currentPlayer, currentRound } = useGame(roomId, playerId || '');

  // 1. 입장하기
  const joinGame = async () => {
    if (!name) return alert("이름을 입력하세요!");

    try {
      // (1) 방이 있는지 확인
      const { data: existingRoom } = await supabase.from('rooms').select('id').eq('id', roomId).maybeSingle();

      // (2) 방이 없으면 생성 (필수값 'code' 포함)
      if (!existingRoom) {
        await supabase.from('rooms').insert({
          id: roomId,
          code: 'ROOM_01', 
          status: 'WAITING',
          current_turn_order: 0,
          rounds_per_game: 1
        });
      }

      // (3) 플레이어 수 확인
      const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
      
      // (4) 입장
      const { data, error } = await supabase.from('players').insert({
        room_id: roomId, name, gender: 'U', turn_order: (count || 0) + 1, score: 0
      }).select().single();

      if (error) throw error;
      setPlayerId(data.id);
    } catch (err) {
      console.error(err);
      alert("입장 중 오류가 발생했습니다.");
    }
  };

  // 2. 게임 시작
  const startGame = async () => {
    const startWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    await supabase.from('rooms').update({
      status: 'PLAYING',
      current_turn_order: 1,
      current_word: startWord,
      round_start_at: new Date().toISOString(),
      rounds_per_game: targetRounds
    }).eq('id', roomId);
  };

  // 3. 단어 패스
  const nextWord = async () => {
    const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    await supabase.from('rooms').update({
      current_word: newWord,
      round_start_at: new Date().toISOString()
    }).eq('id', roomId);
  };

  // --- 화면 렌더링 ---

  // [화면 1] 로그인
  if (!playerId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-900 p-4">
        <h1 className="text-3xl font-bold mb-6">🎨 텔레파시 드로잉</h1>
        <input 
          className="border p-2 rounded mb-2 w-64 text-center text-black" 
          placeholder="닉네임 입력" 
          value={name} 
          onChange={e => setName(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && joinGame()}
        />
        <button onClick={joinGame} className="bg-blue-600 text-white px-6 py-2 rounded font-bold hover:bg-blue-700 transition">
          입장하기
        </button>
      </main>
    );
  }

  // [화면 2] 게임 종료
  if (room?.status === 'FINISHED') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 text-gray-900 p-4">
        <h1 className="text-4xl font-bold mb-8">🏆 게임 종료! 🏆</h1>
        <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-md">
          {players.sort((a, b) => b.score - a.score).map((p, i) => (
            <div key={p.id} className="flex justify-between border-b last:border-0 py-3 text-lg">
              <span className="font-bold">{i+1}등 {p.name}</span>
              <span className="text-blue-600 font-bold">{p.score}점</span>
            </div>
          ))}
        </div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 bg-gray-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-gray-700"
        >
          처음으로 돌아가기
        </button>
      </main>
    );
  }

  // [화면 3] 게임 중
  return (
    <main className="flex min-h-screen flex-col items-center py-6 bg-slate-50 text-gray-900">
      {/* 상단 정보바 */}
      <div className="w-full max-w-md bg-white p-3 rounded-xl shadow mb-4 flex justify-between items-center text-sm">
        <div className="flex flex-col">
          <span className="font-bold text-lg text-indigo-600">
            Round {currentRound || 1} / {room?.rounds_per_game || 1}
          </span>
          <span className="text-xs text-gray-500">
            (순서: {((room?.current_turn_order || 1) - 1) % players.length + 1} / {players.length})
          </span>
        </div>
        <div className={`font-black text-xl ${timeLeft < 30 ? 'text-red-500' : 'text-blue-500'}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
        <div className="text-green-600 font-bold text-lg">내 점수: {players.find(p => p.id === playerId)?.score || 0}점</div>
      </div>

      <div className="mb-4 text-center w-full max-w-md">
        {isMyTurn ? (
          <div className="bg-blue-100 text-blue-900 px-4 py-3 rounded-lg font-bold border-2 border-blue-200 flex justify-between items-center">
            <span>제시어: <span className="text-2xl text-black ml-2">{room?.current_word || "대기 중"}</span></span>
            {!room?.current_word && <button onClick={nextWord} className="text-xs bg-blue-500 text-white px-2 py-1 rounded">단어 받기</button>}
          </div>
        ) : (
          <div className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg font-bold flex justify-between items-center">
            <span>🎨 <span className="text-blue-700">{currentPlayer?.name}</span>님이 그리는 중</span>
            <span className="ml-2 text-orange-600">힌트: {hint}</span>
          </div>
        )}
      </div>

      <DrawingCanvas roomId={roomId} isDrawer={isMyTurn} />
      
      <GameChat 
        roomId={roomId} playerId={playerId} isDrawer={isMyTurn} 
        currentWord={room?.current_word} currentScore={currentScore} 
      />

      {/* 대기 중 모달 (라운드 설정 포함) */}
      {room?.status === 'WAITING' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-2 text-gray-900">게임 대기 중</h2>
            <p className="text-gray-500 mb-6 text-lg">참가자: <span className="text-blue-600 font-bold">{players.length}명</span></p>
            
            <div className="mb-6 bg-gray-50 p-4 rounded-lg">
              <label className="block text-sm font-bold text-gray-700 mb-3">🔄 몇 바퀴 돌까요?</label>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 5].map(num => (
                  <button
                    key={num}
                    onClick={() => setTargetRounds(num)}
                    className={`px-3 py-2 rounded-lg font-bold border transition ${
                      targetRounds === num 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                        : 'bg-white text-gray-500 border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {num}회
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                총 {players.length}명 × {targetRounds}회 = <span className="font-bold">{players.length * targetRounds}문제</span> 출제
              </p>
            </div>

            <button onClick={startGame} className="w-full bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-lg hover:bg-green-600 shadow-md transition">
              게임 시작 ({targetRounds}바퀴)
            </button>
          </div>
        </div>
      )}
    </main>
  );
}