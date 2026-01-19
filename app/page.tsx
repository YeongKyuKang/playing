'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useGame } from '@/hooks/useGame';
import DrawingCanvas from '@/components/DrawingCanvas';
import GameChat from '@/components/GameChat';

const WORDS = ['사과', '바나나', '컴퓨터', '비행기', '자동차', '학교', '코끼리', '피아노', '축구'];

export default function Home() {
  const [name, setName] = useState('');
  // 💡 roomId를 상태로 관리하되, 고정값은 제거하거나 빈 값으로 시작해도 됩니다.
  // 여기서는 편의상 고정값을 유지하되, DB에 없으면 생성하는 로직을 추가합니다.
  const [roomId] = useState('e3975764-a744-48f0-b690-349c40333276'); 
  const [playerId, setPlayerId] = useState<string | null>(null);

  const { room, players, timeLeft, hint, currentScore, isMyTurn, currentPlayer } = useGame(roomId, playerId || '');

  // 입장하기 (수정된 버전)
  const joinGame = async () => {
    if (!name) return alert("이름을 입력하세요!");

    // 1. 방이 실제로 존재하는지 먼저 확인
    const { data: existingRoom } = await supabase
      .from('rooms')
      .select('id')
      .eq('id', roomId)
      .single();

    // 2. 방이 없으면 새로 생성 (방 1개 유지)
    if (!existingRoom) {
      const { error: createError } = await supabase.from('rooms').insert({
        id: roomId, // 고정된 ID로 생성
        status: 'WAITING',
        current_turn_order: 0,
      });
      if (createError) {
        console.error(createError);
        return alert("방 생성 실패! (콘솔 확인)");
      }
    }

    // 3. 플레이어 수 확인 및 입장 처리
    const { count } = await supabase.from('players').select('*', { count: 'exact', head: true }).eq('room_id', roomId);
    
    const { data, error } = await supabase.from('players').insert({
      room_id: roomId, 
      name, 
      gender: 'U', 
      turn_order: (count || 0) + 1, 
      score: 0
    }).select().single();

    if (error) {
      console.error(error); // 에러 내용을 콘솔에 출력해서 확인
      alert("입장 에러! (콘솔을 확인해주세요)");
    } else {
      setPlayerId(data.id);
    }
  };

  // 게임 시작 (대기 상태에서 누름)
  const startGame = async () => {
    const startWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    await supabase.from('rooms').update({
      status: 'PLAYING',
      current_turn_order: 1,
      current_word: startWord,
      round_start_at: new Date().toISOString()
    }).eq('id', roomId);
  };

  // 다음 문제 출제 (단어 없을 때)
  const nextWord = async () => {
    const newWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    await supabase.from('rooms').update({
      current_word: newWord,
      round_start_at: new Date().toISOString()
    }).eq('id', roomId);
  };

  // --- 화면 렌더링 ---
  if (!playerId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-gray-100 text-gray-900 p-4">
        <h1 className="text-3xl font-bold mb-6">🎨 텔레파시 드로잉</h1>
        <input className="border p-2 rounded mb-2 w-64 text-center" placeholder="닉네임" value={name} onChange={e => setName(e.target.value)} />
        <button onClick={joinGame} className="bg-blue-600 text-white px-6 py-2 rounded font-bold">입장하기</button>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center py-6 bg-slate-50">
      <div className="w-full max-w-md bg-white p-3 rounded-xl shadow mb-4 flex justify-between items-center text-sm">
        <div>순서: <span className="font-bold">{room?.current_turn_order || 1}/9</span></div>
        <div className={`font-black text-xl ${timeLeft < 30 ? 'text-red-500' : 'text-blue-500'}`}>
          {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
        </div>
        <div className="text-green-600 font-bold">+{currentScore}점</div>
      </div>

      <div className="mb-4 text-center">
        {isMyTurn ? (
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-lg font-bold border border-blue-200">
            제시어: <span className="text-xl text-black ml-2">{room?.current_word || "대기 중"}</span>
            {!room?.current_word && <button onClick={nextWord} className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded">단어 받기</button>}
          </div>
        ) : (
          <div className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold">
            그리는 사람: {currentPlayer?.name} <span className="ml-2 text-orange-600">힌트: {hint}</span>
          </div>
        )}
      </div>

      <DrawingCanvas roomId={roomId} isDrawer={isMyTurn} />
      
      <GameChat 
        roomId={roomId} playerId={playerId} isDrawer={isMyTurn} 
        currentWord={room?.current_word} currentScore={currentScore} 
      />

      {room?.status === 'WAITING' && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <h2 className="text-xl font-bold mb-4">대기 중... ({players.length}명)</h2>
            <button onClick={startGame} className="bg-green-500 text-white px-6 py-3 rounded-lg font-bold">게임 시작</button>
          </div>
        </div>
      )}
    </main>
  );
}