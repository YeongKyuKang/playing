'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/utils/supabase';

interface Props {
  roomId: string;
  isDrawer: boolean; // true면 그리는 사람, false면 보는 사람
}

export default function DrawingCanvas({ roomId, isDrawer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [color, setColor] = useState('#000000');

  // 선 그리기 함수 (화면에 그리는 역할)
  const drawLine = (x: number, y: number, type: 'start' | 'draw', strokeColor: string) => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (type === 'start') {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  };

  // 1. 수신부 (남이 그리는 거 받아오기)
  useEffect(() => {
    const channel = supabase.channel(`room:${roomId}`)
      .on('broadcast', { event: 'draw' }, ({ payload }) => {
        if (!isDrawer) {
          // 내가 그리는 사람이 아닐 때만 그림
          drawLine(payload.x, payload.y, payload.type, payload.color);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, isDrawer]);

  // 2. 송신부 (내 터치/마우스 좌표 보내기)
  const handleInput = (e: any) => {
    if (!isDrawer) return; // 출제자가 아니면 입력 무시

    // 마우스/터치 좌표 통일 로직
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    
    // 이벤트 타입 결정 (누르기 시작 vs 움직임)
    const type = (e.type === 'mousedown' || e.type === 'touchstart') ? 'start' : 'draw';

    // 1) 내 화면에 바로 그리기 (반응속도 때문)
    drawLine(x, y, type, color);

    // 2) 서버(Supabase)로 좌표 쏘기
    supabase.channel(`room:${roomId}`).send({
      type: 'broadcast',
      event: 'draw',
      payload: { x, y, type, color }
    });
  };

  return (
    <canvas
      ref={canvasRef}
      width={350}
      height={400}
      className="border-2 border-black bg-white mx-auto touch-none rounded-lg shadow-md"
      onMouseDown={handleInput}
      onMouseMove={(e) => e.buttons === 1 && handleInput(e)} // 마우스 클릭 상태일 때만
      onTouchStart={handleInput}
      onTouchMove={handleInput}
    />
  );
}