'use client';
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Props {
  roomId: string;
  isDrawer: boolean;
}

export default function DrawingCanvas({ roomId, isDrawer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // 그리기 함수
  const draw = (x: number, y: number, type: string) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'start') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else if (type === 'draw') {
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (type === 'clear') {
      ctx.clearRect(0, 0, 350, 400);
    }
  };

  // 실시간 구독 (남이 그리는 것 받기)
  useEffect(() => {
    const channel = supabase.channel(`canvas:${roomId}`)
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (!isDrawer) draw(payload.x, payload.y, payload.type);
      })
      .on('broadcast', { event: 'clear' }, () => {
        if (!isDrawer) draw(0, 0, 'clear');
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [roomId, isDrawer]);

  // 내 터치/마우스 이벤트 처리
  const handleInput = (e: any) => {
    if (!isDrawer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    const type = (e.type === 'mousedown' || e.type === 'touchstart') ? 'start' : 'draw';
    
    draw(x, y, type); // 내 화면에 그리기
    supabase.channel(`canvas:${roomId}`).send({
      type: 'broadcast', event: 'draw', payload: { x, y, type }
    }); // 서버로 보내기
  };

  const clearCanvas = () => {
    draw(0, 0, 'clear');
    supabase.channel(`canvas:${roomId}`).send({ type: 'broadcast', event: 'clear' });
  };

  // 턴이 바뀌면 캔버스 초기화
  useEffect(() => clearCanvas(), [roomId]);

  return (
    <div className="relative">
      <canvas
        ref={canvasRef} width={350} height={400}
        className={`bg-white border-2 rounded-lg touch-none ${isDrawer ? 'cursor-crosshair border-blue-500 shadow-md' : 'cursor-not-allowed border-gray-300'}`}
        onMouseDown={handleInput} onMouseMove={(e) => e.buttons === 1 && handleInput(e)}
        onTouchStart={handleInput} onTouchMove={handleInput}
      />
      {isDrawer && (
        <button onClick={clearCanvas} className="absolute top-2 right-2 bg-red-100 text-red-600 px-2 py-1 text-xs rounded border border-red-200">
          지우기
        </button>
      )}
    </div>
  );
}