'use client';
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  roomId: string;
  playerId: string;
  isDrawer: boolean;
  currentWord: string | null;
  currentScore: number;
}

export default function GameChat({ roomId, playerId, isDrawer, currentWord, currentScore }: Props) {
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const chatBoxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 기존 채팅 불러오기
    supabase.from('chats').select('*, players(name)')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(data || []));

    // 실시간 채팅 구독
    const channel = supabase.channel(`chat:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chats', filter: `room_id=eq.${roomId}` },
        async (payload) => {
          const { data } = await supabase.from('players').select('name').eq('id', payload.new.player_id).single();
          setMessages(prev => [...prev, { ...payload.new, players: data }]);
          setTimeout(() => chatBoxRef.current?.scrollTo(0, 99999), 100);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // 메시지 전송
    await supabase.from('chats').insert({ room_id: roomId, player_id: playerId, message: input });

    // 정답 체크 (출제자가 아니고, 단어가 있을 때)
    if (!isDrawer && currentWord && input.trim() === currentWord) {
      // 1. 점수 및 턴 처리 RPC 호출
      await supabase.rpc('finish_round', {
        p_room_id: roomId,
        p_winner_id: playerId,
        p_score_add: currentScore
      });
      // 2. 정답 알림
      await supabase.from('chats').insert({
        room_id: roomId,
        player_id: playerId,
        message: `🎉 정답입니다! (+${currentScore}점)`
      });
    }
    setInput('');
  };

  return (
    <div className="flex flex-col h-64 border rounded-lg bg-white shadow-sm mt-4 w-[350px]">
      <div ref={chatBoxRef} className="flex-1 overflow-y-auto p-2 space-y-1">
        {messages.map((msg, idx) => (
          <div key={idx} className="text-sm">
            <span className="font-bold text-gray-700 mr-2">{msg.players?.name}:</span>
            <span>{msg.message}</span>
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="p-2 border-t flex gap-2 bg-gray-50">
        <input
          className="flex-1 border rounded px-2 py-1 text-sm outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isDrawer ? "출제자 채팅 금지" : "정답 입력"}
          disabled={isDrawer}
        />
        <button type="submit" disabled={isDrawer} className="bg-blue-500 text-white px-3 py-1 rounded text-sm disabled:bg-gray-300">
          전송
        </button>
      </form>
    </div>
  );
}