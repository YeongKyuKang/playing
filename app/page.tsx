'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGame } from '@/hooks/useGame';
import DrawingCanvas from '@/components/DrawingCanvas';
import GameChat from '@/components/GameChat';

const WORDS = ['사과', '바나나', '컴퓨터', '비행기', '자동차', '학교', '코끼리', '피아노', '축구', '고양이', '강아지', '해바라기'];

export default function Home() {
  const [name, setName] = useState('');
  // 💡 방 ID는 고정해두고 씁니다 (하나의 방만 사용)
  const [roomId] = useState('e3975764-a744-48f0-b690-349c40333276'); 
  const [playerId, setPlayerId] = useState<string | null>(null);

  const { room, players, timeLeft, hint, currentScore, isMyTurn, currentPlayer } = useGame(roomId, playerId || '');

  // 1. 입장하기 (방이 없으면 자동으로 만들고 입장)
  const joinGame = async () => {
    if (!name) return alert("이름을 입력하세요!");

    try {
      // (1) 방이 존재하는지 확인 (에러 없이 확인하기 위해 maybeSingle 사용)
      const { data: existingRoom } = await supabase
        .from('rooms')
        .select('id')
        .eq('id', roomId)
        .maybeSingle();

      // (2) 방이 없으면 새로 생성 (필수값 'code' 포함!)
      if (!existingRoom) {
        const { error: createError } = await supabase.from('rooms').insert({
          id: roomId,
          code: 'ROOM_01', // 👈 DB 제약조건 때문에 꼭 필요함
          status: 'WAITING',
          current_turn_order: 0,
        });
        
        if (createError) {
          console.error("방 생성 실패:", createError);
          // 이미 방이 있을 수도 있으므로 치명적이지 않으면 진행
        }
      }

      // (3) 현재 플레이어 수 확인 (내 순서 정하기 위해)
      const { count } = await supabase
        .from('players')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', roomId);

      // (4) 플레이어 데이터 넣기
      const { data, error } = await supabase.from('players').insert({
        room_id: roomId, 
        name, 
        gender: 'U', 
        turn_order: (count || 0) + 1, 
        score: 0
      }).select().single();

      if (error) {
        throw error;
      }

      setPlayerId(data.id);

    } catch (err) {
      console.error(err);
      alert("입장 중 오류가 발생했습니다. (콘솔 확인)");
    }
  };

  // 2. 게임 시작
  const startGame = async () => {
    const startWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    await supabase.from('rooms').update({
      status: 'PLAYING',
      current_turn_order: 1,
      current_word: startWord,
      round_start_at: new Date().toISOString()
    }).eq('id', roomId);
  };

  // 3. 다음 단어 (수동 패스용)
  const nextWord = async () => {
    const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    await supabase.from('rooms').update({
      current_word: newWord,
      round_start_at: new Date().toISOString()
    }).eq('id', roomId);
  };

  // --- 화면 렌더링 ---

  // [화면 1] 로그인(입장) 화면
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

  // [화면 2] 게임 종료 화면 (모든 턴이 끝났을 때)
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

  // [화면 3] 메인 게임 화면
  return (
    <main className="flex min-h-screen flex-col items-center py-6 bg-slate-50 text-gray-900">
      {/* 상단 정보바 */}
      <div className="w-full max-w-md bg-white p-3 rounded-xl shadow mb-4 flex justify-between items-center text-sm">
        <div>순서: <span className="font-bold text-lg">{room?.current_turn_order || 1} / {players.length}</span></div>
        <div className={`font-black text-xl ${timeLeft < 30 ? 'text-red-500' : 'text-blue-500'}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
        <div className="text-green-600 font-bold text-lg">내 점수: {players.find(p => p.id === playerId)?.score || 0}점</div>
      </div>

      {/* 제시어 / 힌트 영역 */}
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

      {/* 캔버스 (그림판) */}
      <DrawingCanvas roomId={roomId} isDrawer={isMyTurn} />
      
      {/* 채팅창 */}
      <GameChat 
        roomId={roomId} playerId={playerId} isDrawer={isMyTurn} 
        currentWord={room?.current_word} currentScore={currentScore} 
      />

      {/* 대기 중 모달 */}
      {room?.status === 'WAITING' && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-2xl text-center shadow-2xl max-w-sm w-full">
            <h2 className="text-2xl font-bold mb-2 text-gray-900">게임 대기 중</h2>
            <p className="text-gray-500 mb-6 text-lg">현재 접속 인원: <span className="text-blue-600 font-bold">{players.length}명</span></p>
            <div className="space-y-3">
              <button onClick={startGame} className="w-full bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-lg hover:bg-green-600 shadow-md transition">
                게임 시작!
              </button>
              <p className="text-xs text-gray-400">모두가 들어오면 시작 버튼을 눌러주세요.</p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}