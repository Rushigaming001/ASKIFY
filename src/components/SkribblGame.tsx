import { useState, useRef, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Crown, UserX, LogOut, Volume2 } from 'lucide-react';
import { useToast } from './ui/use-toast';

interface Player {
  id: string;
  player_name: string;
  avatar_color: string;
  score: number;
  has_guessed: boolean;
  is_connected: boolean;
  user_id: string;
}

interface DrawEvent {
  x: number;
  y: number;
  type: 'start' | 'draw' | 'end';
  color: string;
  width: number;
  tool: 'pen' | 'fill';
}

const WORD_BANK = [
  'cat', 'dog', 'house', 'tree', 'car', 'sun', 'moon', 'star', 'flower', 'book',
  'phone', 'computer', 'pizza', 'apple', 'banana', 'guitar', 'piano', 'drum',
  'camera', 'mountain', 'ocean', 'beach', 'forest', 'rainbow', 'cloud', 'bird',
  'fish', 'butterfly', 'elephant', 'lion', 'tiger', 'bear', 'rabbit', 'snake',
  'umbrella', 'hat', 'shoe', 'glasses', 'watch', 'key', 'door', 'window', 'chair',
  'table', 'lamp', 'clock', 'bottle', 'cup', 'plate', 'spoon', 'knife', 'fork',
  'rocket', 'spaceship', 'alien', 'robot', 'dinosaur', 'castle', 'princess', 'knight',
  'dragon', 'unicorn', 'mermaid', 'pirate', 'treasure', 'island', 'volcano', 'tornado',
  'lightning', 'snowman', 'penguin', 'polar bear', 'whale', 'dolphin', 'shark', 'octopus'
];

export const SkribblGame = ({ roomId, onLeave }: { roomId: string; onLeave: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [guesses, setGuesses] = useState<any[]>([]);
  const [guessInput, setGuessInput] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(8);
  const [gameState, setGameState] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState(80);
  const [wordChoices, setWordChoices] = useState<string[]>([]);
  const [showWordChoice, setShowWordChoice] = useState(false);
  const [hint, setHint] = useState('');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [revealedWord, setRevealedWord] = useState('');
  const [guessOrder, setGuessOrder] = useState<string[]>([]);
  const [tool, setTool] = useState<'pen' | 'fill'>('pen');
  const [drawHistory, setDrawHistory] = useState<ImageData[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Skribbl.io exact colors
  const colors = [
    ['#FFFFFF', '#C1C1C1', '#EF130B', '#FF7100', '#FFE400', '#00CC00', '#00B2FF', '#231FD3', '#A300BA', '#D37CAA', '#A0522D', '#000000'],
    ['#4C4C4C', '#505050', '#740B07', '#C23800', '#E8A200', '#005510', '#00569E', '#0E0865', '#550069', '#A75574', '#63300D', '#FFFFFF']
  ];

  const brushSizes = [4, 8, 16, 24, 32];

  useEffect(() => {
    loadGameData();
    const unsub = subscribeToRealtime();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      unsub?.();
    };
  }, [roomId]);

  useEffect(() => {
    if (gameState?.status === 'playing' && gameState?.current_drawer_id && !gameState?.current_word) {
      const drawer = players.find(p => p.id === gameState.current_drawer_id);
      if (drawer?.user_id === user?.id) {
        const choices = getRandomWords(3);
        setWordChoices(choices);
        setShowWordChoice(true);
      }
    }
  }, [gameState, players, user]);

  useEffect(() => {
    if (gameState?.current_word && gameState?.status === 'playing') {
      setHint(generateInitialHint(gameState.current_word));
      setGuessOrder([]);
      setTimeLeft(gameState?.round_time || 80);
    }
  }, [gameState?.current_word, gameState?.status]);

  useEffect(() => {
    if (gameState?.status === 'playing' && gameState?.current_word && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          const newTime = prev - 1;
          if (gameState?.current_word) {
            const totalTime = gameState?.round_time || 80;
            const elapsed = totalTime - newTime;
            const wordLen = gameState.current_word.length;
            const revealInterval = Math.floor(totalTime / Math.max(wordLen - 1, 1));
            if (elapsed > 0 && elapsed % revealInterval === 0 && elapsed < totalTime) {
              setHint(h => revealNextLetter(gameState.current_word, h));
            }
          }
          if (newTime <= 0) {
            endRound();
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.status, gameState?.current_word]);

  const getRandomWords = (count: number) => {
    const shuffled = [...WORD_BANK].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  };

  const generateInitialHint = (word: string) => {
    if (!word) return '';
    return word.split('').map(c => c === ' ' ? '  ' : '_').join(' ');
  };

  const revealNextLetter = (word: string, currentHint: string) => {
    const hintArray = currentHint.split(' ');
    const wordArray = word.split('');
    const unrevealedIndices = wordArray
      .map((c, idx) => idx)
      .filter(idx => hintArray[idx] === '_');
    if (unrevealedIndices.length > 0) {
      const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
      hintArray[randomIndex] = wordArray[randomIndex];
    }
    return hintArray.join(' ');
  };

  const selectWord = async (word: string) => {
    await supabase.from('skribbl_rooms').update({ current_word: word }).eq('id', roomId);
    setShowWordChoice(false);
    clearCanvas();
    setDrawHistory([]);
  };

  const startGame = async () => {
    if (gameState?.host_id !== user?.id) return;
    if (players.length < 2) {
      toast({ title: 'Need at least 2 players', variant: 'destructive' });
      return;
    }
    await supabase.from('skribbl_rooms').update({
      status: 'playing',
      current_round: 1,
      current_drawer_id: players[0]?.id
    }).eq('id', roomId);
  };

  const endRound = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setRevealedWord(gameState?.current_word || '');
    
    const pointsMap = [500, 400, 300];
    for (let i = 0; i < guessOrder.length; i++) {
      const playerId = guessOrder[i];
      const { data: player } = await supabase.from('skribbl_players').select('score').eq('id', playerId).single();
      if (player) {
        const points = i < 3 ? pointsMap[i] : 50;
        await supabase.from('skribbl_players').update({ score: player.score + points }).eq('id', playerId);
      }
    }

    if (guessOrder.length > 0 && gameState?.current_drawer_id) {
      const { data: drawer } = await supabase.from('skribbl_players').select('score').eq('id', gameState.current_drawer_id).single();
      if (drawer) {
        await supabase.from('skribbl_players').update({ score: drawer.score + 100 }).eq('id', gameState.current_drawer_id);
      }
    }

    setTimeout(async () => {
      setRevealedWord('');
      const currentDrawerIndex = players.findIndex(p => p.id === gameState?.current_drawer_id);
      const isLastDrawerInRound = currentDrawerIndex === players.length - 1;
      
      if (isLastDrawerInRound && gameState?.current_round >= gameState?.max_rounds) {
        await supabase.from('skribbl_rooms').update({ status: 'finished' }).eq('id', roomId);
      } else {
        const nextDrawerIndex = (currentDrawerIndex + 1) % players.length;
        const nextRound = isLastDrawerInRound ? gameState.current_round + 1 : gameState.current_round;
        await supabase.from('skribbl_rooms').update({
          current_round: nextRound,
          current_drawer_id: players[nextDrawerIndex]?.id,
          current_word: null
        }).eq('id', roomId);
        await supabase.from('skribbl_players').update({ has_guessed: false }).eq('room_id', roomId);
        clearCanvas();
        setDrawHistory([]);
      }
    }, 3000);
  };

  const kickPlayer = async (playerId: string, playerName: string) => {
    if (gameState?.host_id !== user?.id) return;
    if (!confirm(`Kick ${playerName}?`)) return;
    await supabase.from('skribbl_players').delete().eq('id', playerId);
  };

  const loadGameData = async () => {
    const { data: room } = await supabase.from('skribbl_rooms').select('*').eq('id', roomId).single();
    setGameState(room);
    const { data: playerData } = await supabase.from('skribbl_players').select('*').eq('room_id', roomId).order('score', { ascending: false });
    if (playerData) {
      setPlayers(playerData);
      setCurrentPlayer(playerData.find(p => p.user_id === user?.id) || null);
    }
    const { data: guessData } = await supabase.from('skribbl_guesses').select('*, skribbl_players(player_name)').eq('room_id', roomId).order('created_at', { ascending: true }).limit(100);
    if (guessData) setGuesses(guessData);
  };

  const subscribeToRealtime = () => {
    const channel = supabase
      .channel(`skribbl-${roomId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'skribbl_players', filter: `room_id=eq.${roomId}` }, () => loadGameData())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'skribbl_guesses', filter: `room_id=eq.${roomId}` }, () => loadGameData())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'skribbl_rooms', filter: `id=eq.${roomId}` }, () => loadGameData())
      .on('broadcast', { event: 'draw' }, ({ payload }) => drawOnCanvas(payload as DrawEvent))
      .on('broadcast', { event: 'clear' }, () => clearCanvas())
      .on('broadcast', { event: 'undo' }, () => undoCanvas())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const saveToHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setDrawHistory(prev => [...prev.slice(-20), imageData]);
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const drawer = players.find(p => p.id === gameState?.current_drawer_id);
    if (drawer?.user_id !== user?.id || gameState?.status !== 'playing' || !gameState?.current_word) return;
    
    saveToHistory();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);

    if (tool === 'fill') {
      floodFill(Math.floor(x), Math.floor(y), currentColor);
      broadcastDraw({ x, y, type: 'start', color: currentColor, width: brushSize, tool: 'fill' });
      setIsDrawing(false);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y);
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
    broadcastDraw({ x, y, type: 'start', color: currentColor, width: brushSize, tool: 'pen' });
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const drawer = players.find(p => p.id === gameState?.current_drawer_id);
    if (!isDrawing || drawer?.user_id !== user?.id || tool === 'fill') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.strokeStyle = currentColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }
    broadcastDraw({ x, y, type: 'draw', color: currentColor, width: brushSize, tool: 'pen' });
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const drawer = players.find(p => p.id === gameState?.current_drawer_id);
    if (drawer?.user_id === user?.id) {
      broadcastDraw({ x: 0, y: 0, type: 'end', color: currentColor, width: brushSize, tool: 'pen' });
    }
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const hex = fillColor.replace('#', '');
    const fillR = parseInt(hex.substring(0, 2), 16);
    const fillG = parseInt(hex.substring(2, 4), 16);
    const fillB = parseInt(hex.substring(4, 6), 16);
    const startIdx = (startY * canvas.width + startX) * 4;
    const startR = data[startIdx], startG = data[startIdx + 1], startB = data[startIdx + 2];
    if (startR === fillR && startG === fillG && startB === fillB) return;
    const stack = [[startX, startY]];
    const visited = new Set<string>();
    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      if (visited.has(key) || x < 0 || x >= canvas.width || y < 0 || y >= canvas.height) continue;
      const idx = (y * canvas.width + x) * 4;
      if (Math.abs(data[idx] - startR) > 30 || Math.abs(data[idx + 1] - startG) > 30 || Math.abs(data[idx + 2] - startB) > 30) continue;
      visited.add(key);
      data[idx] = fillR; data[idx + 1] = fillG; data[idx + 2] = fillB; data[idx + 3] = 255;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(imageData, 0, 0);
  };

  const drawOnCanvas = (event: DrawEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (event.tool === 'fill' && event.type === 'start') {
      floodFill(Math.floor(event.x), Math.floor(event.y), event.color);
      return;
    }
    if (event.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(event.x, event.y);
      ctx.lineTo(event.x, event.y);
      ctx.strokeStyle = event.color;
      ctx.lineWidth = event.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    } else if (event.type === 'draw') {
      ctx.strokeStyle = event.color;
      ctx.lineWidth = event.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(event.x, event.y);
      ctx.stroke();
    }
  };

  const broadcastDraw = async (event: DrawEvent) => {
    // Security: Validate that user is the current drawer
    const drawer = players.find(p => p.id === gameState?.current_drawer_id);
    if (drawer?.user_id !== user?.id) return;
    
    // Security: Validate game is in playing state with a word
    if (gameState?.status !== 'playing' || !gameState?.current_word) return;
    
    // Security: Validate canvas bounds
    const canvas = canvasRef.current;
    if (!canvas || event.x < 0 || event.x > canvas.width || 
        event.y < 0 || event.y > canvas.height) return;
    
    // Security: Validate color format (hex)
    if (!/^#[0-9A-Fa-f]{6}$/.test(event.color)) return;
    
    // Security: Validate brush size (1-32)
    if (event.width < 1 || event.width > 32) return;
    
    const channel = supabase.channel(`skribbl-${roomId}`);
    await channel.send({ type: 'broadcast', event: 'draw', payload: event });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  };

  const undoCanvas = () => {
    if (drawHistory.length === 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lastState = drawHistory[drawHistory.length - 1];
    ctx.putImageData(lastState, 0, 0);
    setDrawHistory(prev => prev.slice(0, -1));
  };

  const broadcastClear = async () => {
    saveToHistory();
    const channel = supabase.channel(`skribbl-${roomId}`);
    await channel.send({ type: 'broadcast', event: 'clear', payload: {} });
    clearCanvas();
  };

  const broadcastUndo = async () => {
    const channel = supabase.channel(`skribbl-${roomId}`);
    await channel.send({ type: 'broadcast', event: 'undo', payload: {} });
    undoCanvas();
  };

  const handleGuess = async () => {
    if (!guessInput.trim()) return;
    const drawer = players.find(p => p.id === gameState?.current_drawer_id);
    if (drawer?.user_id === user?.id) { setGuessInput(''); return; }
    if (currentPlayer?.has_guessed) { setGuessInput(''); return; }
    const isCorrect = guessInput.toLowerCase().trim() === gameState?.current_word?.toLowerCase();
    await supabase.from('skribbl_guesses').insert({
      room_id: roomId,
      player_id: currentPlayer?.id,
      guess: isCorrect ? '✓ guessed correctly!' : guessInput,
      is_correct: isCorrect,
    });
    if (isCorrect) {
      setGuessOrder(prev => [...prev, currentPlayer?.id || '']);
      await supabase.from('skribbl_players').update({ has_guessed: true }).eq('id', currentPlayer?.id);
      toast({ title: '✓ You guessed the word!' });
    }
    setGuessInput('');
  };

  const isHost = gameState?.host_id === user?.id;
  const drawer = players.find(p => p.id === gameState?.current_drawer_id);
  const isDrawer = drawer?.user_id === user?.id;
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  useEffect(() => {
    clearCanvas();
  }, []);

  return (
    <div className="h-screen w-full flex flex-col" style={{ background: 'linear-gradient(180deg, #6B8DD6 0%, #8E37D7 100%)' }}>
      {/* Word Choice Modal */}
      {showWordChoice && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl max-w-lg w-full mx-4">
            <h2 className="text-2xl font-black text-center mb-6 text-gray-800">Choose a word!</h2>
            <div className="flex gap-3 justify-center flex-wrap">
              {wordChoices.map((word) => (
                <button
                  key={word}
                  onClick={() => selectWord(word)}
                  className="px-8 py-4 bg-green-500 hover:bg-green-600 text-white font-bold text-xl rounded-xl transition-all hover:scale-105 shadow-lg"
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Word Reveal Modal */}
      {revealedWord && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <p className="text-gray-500 text-lg mb-2">The word was</p>
            <p className="text-5xl font-black text-green-600">{revealedWord}</p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <div className="bg-white/95 shadow-lg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <img src="/skribbl/logo.gif" alt="skribbl.io" className="h-10" />
          <div className="bg-yellow-400 px-4 py-1 rounded-full font-bold text-sm">
            Round {gameState?.current_round || 1} of {gameState?.max_rounds || 3}
          </div>
        </div>

        {/* Hint/Word Display */}
        <div className="flex-1 flex justify-center">
          {gameState?.status === 'waiting' ? (
            <span className="text-xl font-bold text-gray-500">Waiting for players...</span>
          ) : !gameState?.current_word ? (
            <span className="text-xl font-bold text-gray-500">{drawer?.player_name} is choosing a word!</span>
          ) : isDrawer ? (
            <div className="bg-green-100 px-6 py-2 rounded-xl">
              <span className="text-2xl font-black text-green-600">{gameState?.current_word}</span>
            </div>
          ) : (
            <div className="bg-blue-100 px-6 py-2 rounded-xl">
              <span className="text-3xl font-black tracking-[0.3em] text-blue-600">{hint}</span>
            </div>
          )}
        </div>

        {/* Timer & Controls */}
        <div className="flex items-center gap-3">
          {gameState?.status === 'playing' && gameState?.current_word && (
            <div className={`w-16 h-16 rounded-full flex items-center justify-center font-black text-2xl ${timeLeft <= 10 ? 'bg-red-500 text-white animate-pulse' : 'bg-green-500 text-white'}`}>
              {timeLeft}
            </div>
          )}
          <button className="p-2 hover:bg-gray-100 rounded-lg"><Volume2 className="w-6 h-6" /></button>
          <button onClick={onLeave} className="p-2 hover:bg-gray-100 rounded-lg text-red-500"><LogOut className="w-6 h-6" /></button>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 flex gap-2 p-2 min-h-0">
        {/* Left - Players List */}
        <div className="w-52 bg-white/95 rounded-xl shadow-lg overflow-hidden flex flex-col">
          {gameState?.status === 'waiting' && isHost && (
            <button onClick={startGame} className="m-2 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-colors">
              Start Game!
            </button>
          )}
          {gameState?.status === 'finished' && (
            <div className="m-2 py-3 bg-yellow-400 text-center font-bold rounded-lg">🏆 Game Over!</div>
          )}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sortedPlayers.map((player, idx) => (
              <div
                key={player.id}
                className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                  player.has_guessed ? 'bg-green-100' : 'bg-gray-50'
                } ${gameState?.current_drawer_id === player.id ? 'ring-2 ring-yellow-400 bg-yellow-50' : ''}`}
              >
                <div className="text-xs font-black text-gray-400 w-4">#{idx + 1}</div>
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs relative"
                  style={{ backgroundColor: player.avatar_color }}
                >
                  {player.player_name.charAt(0).toUpperCase()}
                  {gameState?.current_drawer_id === player.id && (
                    <span className="absolute -top-1 -right-1 text-lg">✏️</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate flex items-center gap-1">
                    {player.player_name}
                    {gameState?.host_id === player.user_id && <Crown className="h-3 w-3 text-yellow-500" />}
                  </div>
                  <div className="text-xs font-bold text-green-600">{player.score} pts</div>
                </div>
                {isHost && player.user_id !== user?.id && (
                  <button onClick={() => kickPlayer(player.id, player.player_name)} className="p-1 hover:bg-red-100 rounded">
                    <UserX className="h-4 w-4 text-red-500" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Center - Canvas Area */}
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          {/* Canvas */}
          <div className="flex-1 bg-white rounded-xl shadow-lg overflow-hidden flex items-center justify-center p-2">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className={`bg-white rounded border-4 border-gray-200 ${isDrawer && gameState?.current_word ? 'cursor-crosshair' : ''}`}
              style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: '800/600' }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
            />
          </div>

          {/* Drawing Tools - Only for drawer */}
          {isDrawer && gameState?.current_word && (
            <div className="bg-white/95 rounded-xl shadow-lg p-3 flex items-center gap-4 flex-wrap justify-center">
              {/* Colors */}
              <div className="flex flex-col gap-1">
                {colors.map((row, rowIdx) => (
                  <div key={rowIdx} className="flex gap-0.5">
                    {row.map(color => (
                      <button
                        key={color}
                        className={`w-6 h-6 rounded transition-transform hover:scale-110 ${currentColor === color ? 'ring-2 ring-black ring-offset-1' : ''}`}
                        style={{ backgroundColor: color, border: color === '#FFFFFF' ? '1px solid #ccc' : 'none' }}
                        onClick={() => setCurrentColor(color)}
                      />
                    ))}
                  </div>
                ))}
              </div>

              {/* Divider */}
              <div className="h-12 w-px bg-gray-300" />

              {/* Brush Sizes */}
              <div className="flex gap-2 items-end">
                {brushSizes.map(size => (
                  <button
                    key={size}
                    onClick={() => setBrushSize(size)}
                    className={`rounded-full bg-black transition-all ${brushSize === size ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                    style={{ width: size, height: size, minWidth: 8, minHeight: 8 }}
                  />
                ))}
              </div>

              {/* Divider */}
              <div className="h-12 w-px bg-gray-300" />

              {/* Tools */}
              <div className="flex gap-2">
                <button
                  onClick={() => setTool('pen')}
                  className={`p-2 rounded-lg transition-colors ${tool === 'pen' ? 'bg-blue-500' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  <img src="/skribbl/pen.gif" alt="Pen" className="w-8 h-8" />
                </button>
                <button
                  onClick={() => setTool('fill')}
                  className={`p-2 rounded-lg transition-colors ${tool === 'fill' ? 'bg-blue-500' : 'bg-gray-200 hover:bg-gray-300'}`}
                >
                  <img src="/skribbl/fill.gif" alt="Fill" className="w-8 h-8" />
                </button>
                <button onClick={broadcastUndo} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors">
                  <img src="/skribbl/undo.gif" alt="Undo" className="w-8 h-8" />
                </button>
                <button onClick={broadcastClear} className="p-2 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors">
                  <img src="/skribbl/clear.gif" alt="Clear" className="w-8 h-8" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right - Chat */}
        <div className="w-64 bg-white/95 rounded-xl shadow-lg flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-2 space-y-1 text-sm">
            {guesses.map((guess) => (
              <div
                key={guess.id}
                className={`px-2 py-1 rounded ${guess.is_correct ? 'bg-green-100 text-green-700 font-bold' : ''}`}
              >
                <span className="font-bold">{guess.skribbl_players?.player_name}: </span>
                <span>{guess.is_correct ? 'guessed the word!' : guess.guess}</span>
              </div>
            ))}
          </div>
          <div className="p-2 border-t">
            <Input
              value={guessInput}
              onChange={(e) => setGuessInput(e.target.value)}
              placeholder={isDrawer ? "You're drawing!" : 'Type your guess here...'}
              onKeyPress={(e) => e.key === 'Enter' && handleGuess()}
              disabled={isDrawer || gameState?.status !== 'playing' || !gameState?.current_word || currentPlayer?.has_guessed}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
