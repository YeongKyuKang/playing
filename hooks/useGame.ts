import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useGame(roomId: string, userId: string) {
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [timeLeft, setTimeLeft] = useState(120); // 2분 제한
  const [hint, setHint] = useState('');
  const [currentScore, setCurrentScore] = useState(20);

  // 1. 방 & 플레이어 정보 실시간 구독
  useEffect(() => {
    const fetchInitialData = async () => {
      const { data: r } = await supabase.from('rooms').select('*').eq('id', roomId).single();
      const { data: p } = await supabase.from('players').select('*').eq('room_id', roomId).order('turn_order');
      if (r) setRoom(r);
      if (p) setPlayers(p || []);
    };
    fetchInitialData();

    const channel = supabase.channel(`game_logic:${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` }, 
        (payload) => setRoom(payload.new)
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
        async () => {
          const { data } = await supabase.from('players').select('*').eq('room_id', roomId).order('turn_order');
          setPlayers(data || []);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  // 2. 타이머 & 힌트 & 점수 계산 시스템
  useEffect(() => {
    // 게임 중이 아니거나 시작 시간이 없으면 중단
    if (room?.status !== 'PLAYING' || !room?.round_start_at || !room?.current_word) {
      setHint('');
      return;
    }

    const interval = setInterval(() => {
      const start = new Date(room.round_start_at).getTime();
      const now = new Date().getTime();
      const elapsedSec = Math.floor((now - start) / 1000); // 경과 시간(초)
      const remaining = 120 - elapsedSec; // 남은 시간

      if (remaining <= 0) {
        // [시간 초과] 현재 턴인 플레이어가 대표로 종료 요청
        // 주의: 여기서 currentPlayer 계산 로직은 아래와 동일하게 맞춰야 함
        const totalP = players.length || 1;
        const currentTurn = room.current_turn_order || 1;
        const effectiveOrder = ((currentTurn - 1) % totalP) + 1;
        
        const isMyTurn = players.find(p => p.id === userId)?.turn_order === effectiveOrder;

        if (isMyTurn) {
          supabase.rpc('finish_round', { p_room_id: roomId, p_winner_id: null, p_score_add: 0 });
        }
        clearInterval(interval);
        setTimeLeft(0);
      } else {
        setTimeLeft(remaining);

        // [힌트 & 점수 로직]
        const hintCount = Math.floor(elapsedSec / 30);
        setCurrentScore(Math.max(0, 20 - (hintCount * 5)));

        const word = room.current_word;
        let maskedWord = '';
        for (let i = 0; i < word.length; i++) {
          if (i < hintCount) {
            maskedWord += word[i];
          } else {
            maskedWord += 'O';
          }
          maskedWord += ' '; 
        }
        setHint(maskedWord.trim());
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [room, players, userId, roomId]);

  // [수정됨] 턴 계산 로직 (순환 구조)
  const totalPlayers = players.length || 1;
  const currentTurnIndex = room?.current_turn_order || 1;
  
  // 예: 9명일 때 10번째 턴 -> (9 % 9) + 1 = 1번 플레이어
  const effectiveTurnOrder = ((currentTurnIndex - 1) % totalPlayers) + 1;

  const currentPlayer = players.find(p => p.turn_order === effectiveTurnOrder);
  const isMyTurn = currentPlayer?.id === userId;

  // 현재 몇 바퀴째인지 계산 (화면 표시용)
  const currentRound = Math.ceil(currentTurnIndex / totalPlayers);

  return { room, players, timeLeft, hint, currentScore, isMyTurn, currentPlayer, currentRound };
}