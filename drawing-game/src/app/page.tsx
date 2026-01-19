'use client';

import { useState } from 'react';
import DrawingCanvas from '@/components/DrawingCanvas';

export default function Home() {
  // 테스트를 위해 '출제자 모드' 토글 버튼을 만듭니다.
  const [isDrawer, setIsDrawer] = useState(true);
  const roomId = 'test-room-1'; // 테스트용 고정 방 ID

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-100">
      <h1 className="text-2xl font-bold mb-4">텔레파시 드로잉 (방: {roomId})</h1>
      
      <div className="mb-4">
        <button
          onClick={() => setIsDrawer(!isDrawer)}
          className={`px-4 py-2 rounded-lg font-bold text-white ${
            isDrawer ? 'bg-blue-600' : 'bg-gray-500'
          }`}
        >
          {isDrawer ? '🖌️ 나는 출제자 (그리기)' : '👀 나는 팀원 (지켜보기)'}
        </button>
      </div>

      <div className="relative">
        {/* 내가 출제자가 아니면 투명 막으로 덮어서 터치 방지 (선택사항) */}
        {!isDrawer && <div className="absolute inset-0 z-10 cursor-not-allowed" />}
        <DrawingCanvas roomId={roomId} isDrawer={isDrawer} />
      </div>

      <p className="mt-4 text-gray-600 text-sm">
        * 크롬 창을 2개 띄우고 하나는 출제자, 하나는 팀원으로 설정해서 테스트해보세요.
      </p>
    </main>
  );
}