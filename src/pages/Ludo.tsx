import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Copy, Users, Bot, Trophy } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type LudoColor = 'red' | 'green' | 'yellow' | 'blue';
const COLORS: LudoColor[] = ['red', 'green', 'yellow', 'blue'];

// 52 common path positions on 15x15 grid [row, col]
const COMMON_PATH: [number, number][] = [
  [6,1],[6,2],[6,3],[6,4],[6,5],
  [5,6],[4,6],[3,6],[2,6],[1,6],[0,6],
  [0,7],[0,8],
  [1,8],[2,8],[3,8],[4,8],[5,8],
  [6,9],[6,10],[6,11],[6,12],[6,13],[6,14],
  [7,14],[8,14],
  [8,13],[8,12],[8,11],[8,10],[8,9],
  [9,8],[10,8],[11,8],[12,8],[13,8],[14,8],
  [14,7],[14,6],
  [13,6],[12,6],[11,6],[10,6],[9,6],
  [8,5],[8,4],[8,3],[8,2],[8,1],[8,0],
  [7,0],[6,0],
];

const HOME_STRETCH: Record<LudoColor, [number, number][]> = {
  red: [[7,1],[7,2],[7,3],[7,4],[7,5],[7,6]],
  green: [[1,7],[2,7],[3,7],[4,7],[5,7],[6,7]],
  yellow: [[7,13],[7,12],[7,11],[7,10],[7,9],[7,8]],
  blue: [[13,7],[12,7],[11,7],[10,7],[9,7],[8,7]],
};

const START_OFFSET: Record<LudoColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };

const HOME_PIECE_CELLS: Record<LudoColor, [number, number][]> = {
  red: [[2,2],[2,3],[3,2],[3,3]],
  green: [[2,11],[2,12],[3,11],[3,12]],
  yellow: [[11,11],[11,12],[12,11],[12,12]],
  blue: [[11,2],[11,3],[12,2],[12,3]],
};

const SAFE_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

const COLOR_PIECE: Record<LudoColor, string> = {
  red: 'bg-red-600 border-red-800',
  green: 'bg-green-600 border-green-800',
  yellow: 'bg-yellow-500 border-yellow-700',
  blue: 'bg-blue-600 border-blue-800',
};

interface Player {
  color: LudoColor;
  pieces: number[];
  isBot: boolean;
  name: string;
  userId?: string;
}

function getGridPos(color: LudoColor, pos: number, pieceIdx: number): [number, number] | null {
  if (pos === 0) return HOME_PIECE_CELLS[color][pieceIdx];
  if (pos >= 53 && pos <= 58) return HOME_STRETCH[color][pos - 53];
  if (pos === 59) return null;
  if (pos >= 1 && pos <= 52) {
    const absIdx = (START_OFFSET[color] + pos - 1) % 52;
    return COMMON_PATH[absIdx];
  }
  return null;
}

function getAbsIndex(color: LudoColor, relPos: number): number | null {
  if (relPos >= 1 && relPos <= 52) return (START_OFFSET[color] + relPos - 1) % 52;
  return null;
}

function canMovePiece(pos: number, dice: number): boolean {
  if (pos === 59) return false;
  if (pos === 0) return dice === 6;
  const newPos = pos + dice;
  return newPos <= 59;
}

function getValidMoves(player: Player, dice: number): number[] {
  const moves: number[] = [];
  for (let i = 0; i < 4; i++) {
    if (canMovePiece(player.pieces[i], dice)) moves.push(i);
  }
  return moves;
}

function checkCapture(
  movingColor: LudoColor, newRelPos: number, players: Player[]
): { captured: boolean; playerIdx: number; pieceIdx: number } | null {
  if (newRelPos < 1 || newRelPos > 52) return null;
  const absIdx = getAbsIndex(movingColor, newRelPos);
  if (absIdx === null || SAFE_INDICES.has(absIdx)) return null;

  for (let pi = 0; pi < players.length; pi++) {
    const p = players[pi];
    if (p.color === movingColor) continue;
    for (let j = 0; j < 4; j++) {
      if (p.pieces[j] >= 1 && p.pieces[j] <= 52) {
        const otherAbs = getAbsIndex(p.color, p.pieces[j]);
        if (otherAbs === absIdx) return { captured: true, playerIdx: pi, pieceIdx: j };
      }
    }
  }
  return null;
}

function getBotMove(player: Player, dice: number, allPlayers: Player[]): number | null {
  const valid = getValidMoves(player, dice);
  if (valid.length === 0) return null;
  if (valid.length === 1) return valid[0];

  let best = valid[0];
  let bestPriority = -1;

  for (const idx of valid) {
    const pos = player.pieces[idx];
    let priority = 0;
    const newPos = pos === 0 ? 1 : pos + dice;

    if (newPos === 59) { priority = 10; }
    else if (newPos >= 53) { priority = 7; }
    else if (newPos >= 1 && newPos <= 52) {
      const cap = checkCapture(player.color, newPos, allPlayers);
      if (cap) priority = 9;
      else {
        const absIdx = getAbsIndex(player.color, newPos);
        if (absIdx !== null && SAFE_INDICES.has(absIdx)) priority = 5;
        else priority = Math.min(newPos / 10, 4);
      }
    }
    if (pos === 0 && dice === 6) priority = Math.max(priority, 6);
    if (priority > bestPriority) { bestPriority = priority; best = idx; }
  }
  return best;
}

// Cell background color
function getCellBg(r: number, c: number): string {
  // Home stretches (check before common path)
  for (const color of COLORS) {
    if (HOME_STRETCH[color].some(([hr, hc]) => hr === r && hc === c)) {
      const map: Record<LudoColor, string> = {
        red: 'bg-red-400', green: 'bg-green-400', yellow: 'bg-yellow-300', blue: 'bg-blue-400',
      };
      return map[color];
    }
  }

  // Common path
  const pathIdx = COMMON_PATH.findIndex(([pr, pc]) => pr === r && pc === c);
  if (pathIdx !== -1) {
    if (pathIdx === 0) return 'bg-red-200';
    if (pathIdx === 13) return 'bg-green-200';
    if (pathIdx === 26) return 'bg-yellow-200';
    if (pathIdx === 39) return 'bg-blue-200';
    if (SAFE_INDICES.has(pathIdx)) return 'bg-amber-100';
    return 'bg-white';
  }

  // Center 3x3
  if (r >= 6 && r <= 8 && c >= 6 && c <= 8) {
    if (r === 7 && c === 6) return 'bg-red-500';
    if (r === 6 && c === 7) return 'bg-green-500';
    if (r === 7 && c === 8) return 'bg-yellow-400';
    if (r === 8 && c === 7) return 'bg-blue-500';
    if (r === 7 && c === 7) return 'bg-gray-100';
    if (r === 6 && c === 6) return 'bg-red-400';
    if (r === 6 && c === 8) return 'bg-green-400';
    if (r === 8 && c === 8) return 'bg-yellow-300';
    if (r === 8 && c === 6) return 'bg-blue-400';
  }

  // Quadrants
  if (r < 6 && c < 6) {
    if (r >= 1 && r <= 4 && c >= 1 && c <= 4) return 'bg-red-100';
    return 'bg-red-500';
  }
  if (r < 6 && c > 8) {
    if (r >= 1 && r <= 4 && c >= 10 && c <= 13) return 'bg-green-100';
    return 'bg-green-500';
  }
  if (r > 8 && c > 8) {
    if (r >= 10 && r <= 13 && c >= 10 && c <= 13) return 'bg-yellow-100';
    return 'bg-yellow-400';
  }
  if (r > 8 && c < 6) {
    if (r >= 10 && r <= 13 && c >= 1 && c <= 4) return 'bg-blue-100';
    return 'bg-blue-500';
  }
  return 'bg-white';
}

const DICE_FACES: Record<number, number[][]> = {
  1: [[1,1]],
  2: [[0,2],[2,0]],
  3: [[0,2],[1,1],[2,0]],
  4: [[0,0],[0,2],[2,0],[2,2]],
  5: [[0,0],[0,2],[1,1],[2,0],[2,2]],
  6: [[0,0],[0,2],[1,0],[1,2],[2,0],[2,2]],
};

const DiceVisual = ({ value, rolling, onClick, disabled }: { value: number | null; rolling: boolean; onClick: () => void; disabled: boolean }) => {
  const dots = value ? DICE_FACES[value] : DICE_FACES[1];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-white border-2 border-gray-300 shadow-lg p-2 transition-all ${
        !disabled ? 'hover:scale-110 hover:shadow-xl cursor-pointer active:scale-95' : 'opacity-60 cursor-default'
      } ${rolling ? 'animate-bounce' : ''}`}
    >
      <div className="grid grid-cols-3 grid-rows-3 w-full h-full">
        {Array.from({ length: 9 }, (_, i) => {
          const r = Math.floor(i / 3);
          const c = i % 3;
          const hasDot = dots.some(([dr, dc]) => dr === r && dc === c);
          return (
            <div key={i} className="flex items-center justify-center">
              {hasDot && <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-gray-800" />}
            </div>
          );
        })}
      </div>
    </button>
  );
};

const Ludo = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'menu' | 'playing' | 'online-lobby'>('menu');
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [dice, setDice] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [extraTurn, setExtraTurn] = useState(false);
  const [winner, setWinner] = useState<LudoColor | null>(null);
  const [validMoves, setValidMoves] = useState<number[]>([]);
  const [myColorIndex, setMyColorIndex] = useState(0);
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [channelRef, setChannelRef] = useState<any>(null);
  const [onlineReady, setOnlineReady] = useState(false);
  const botTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [authLoading, user, navigate]);

  useEffect(() => () => {
    if (channelRef) supabase.removeChannel(channelRef);
    if (botTimerRef.current) clearTimeout(botTimerRef.current);
  }, [channelRef]);

  const startBotGame = () => {
    setPlayers([
      { color: 'red', pieces: [0,0,0,0], isBot: false, name: 'You' },
      { color: 'green', pieces: [0,0,0,0], isBot: true, name: 'Bot 1' },
      { color: 'yellow', pieces: [0,0,0,0], isBot: true, name: 'Bot 2' },
      { color: 'blue', pieces: [0,0,0,0], isBot: true, name: 'Bot 3' },
    ]);
    setCurrentTurn(0);
    setDice(null);
    setWinner(null);
    setMyColorIndex(0);
    setMode('playing');
  };

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    const me: Player = { color: 'red', pieces: [0,0,0,0], isBot: false, name: user?.name || 'Player 1', userId: user?.id };
    setPlayers([me]);
    setMyColorIndex(0);
    setMode('online-lobby');
    joinChannel(code, [me], 0);
    toast.success(`Room created: ${code}`);
  };

  const joinRoom = () => {
    if (!joinCode.trim()) { toast.error('Enter a room code'); return; }
    setRoomCode(joinCode.toUpperCase());
    setMode('online-lobby');
    joinChannel(joinCode.toUpperCase(), [], -1);
  };

  const joinChannel = (code: string, initialPlayers: Player[], colorIdx: number) => {
    if (channelRef) supabase.removeChannel(channelRef);
    const channel = supabase.channel(`ludo-${code}`);
    channel
      .on('broadcast', { event: 'state-sync' }, ({ payload }) => {
        setPlayers(payload.players);
        setCurrentTurn(payload.currentTurn);
        setDice(payload.dice);
        setWinner(payload.winner);
        setValidMoves(payload.validMoves || []);
        if (payload.started) { setMode('playing'); setOnlineReady(true); }
        const idx = payload.players.findIndex((p: Player) => p.userId === user?.id);
        if (idx >= 0) setMyColorIndex(idx);
      })
      .on('broadcast', { event: 'request-join' }, ({ payload }) => {
        setPlayers(prev => {
          if (prev.length >= 4 || prev.find(p => p.userId === payload.userId)) return prev;
          const newP: Player = { color: COLORS[prev.length], pieces: [0,0,0,0], isBot: false, name: payload.name, userId: payload.userId };
          const updated = [...prev, newP];
          setTimeout(() => {
            channel.send({ type: 'broadcast', event: 'state-sync', payload: { players: updated, currentTurn: 0, dice: null, winner: null, validMoves: [], started: false } });
          }, 100);
          toast.success(`${payload.name} joined!`);
          return updated;
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && colorIdx === -1) {
          channel.send({ type: 'broadcast', event: 'request-join', payload: { userId: user!.id, name: user?.name || 'Player' } });
        }
      });
    setChannelRef(channel);
  };

  const startOnlineGame = () => {
    if (players.length < 2) { toast.error('Need at least 2 players'); return; }
    // Fill remaining slots with bots
    const updated = [...players];
    while (updated.length < 4) {
      updated.push({ color: COLORS[updated.length], pieces: [0,0,0,0], isBot: true, name: `Bot ${updated.length}` });
    }
    setPlayers(updated);
    setMode('playing');
    setOnlineReady(true);
    channelRef?.send({ type: 'broadcast', event: 'state-sync', payload: { players: updated, currentTurn: 0, dice: null, winner: null, validMoves: [], started: true } });
  };

  const rollDice = useCallback(() => {
    if (rolling || dice !== null || winner) return;
    const currentPlayer = players[currentTurn];
    if (!currentPlayer) return;
    if (!currentPlayer.isBot && currentTurn !== myColorIndex) return;

    setRolling(true);
    setTimeout(() => {
      const value = Math.floor(Math.random() * 6) + 1;
      setDice(value);
      setRolling(false);

      const moves = getValidMoves(currentPlayer, value);
      setValidMoves(moves);

      if (moves.length === 0) {
        // No valid moves - next turn
        setTimeout(() => {
          const next = value === 6 ? currentTurn : (currentTurn + 1) % players.length;
          setCurrentTurn(next);
          setDice(null);
          setValidMoves([]);
          setExtraTurn(value === 6);
          syncState(players, next, null, [], winner);
        }, 800);
      } else if (currentPlayer.isBot) {
        // Bot picks a move
        setTimeout(() => {
          const moveIdx = getBotMove(currentPlayer, value, players);
          if (moveIdx !== null) executeMove(moveIdx, value);
          else {
            const next = (currentTurn + 1) % players.length;
            setCurrentTurn(next);
            setDice(null);
            setValidMoves([]);
            syncState(players, next, null, [], winner);
          }
        }, 600);
      }
    }, 500);
  }, [rolling, dice, winner, players, currentTurn, myColorIndex]);

  const executeMove = useCallback((pieceIdx: number, diceVal?: number) => {
    const d = diceVal ?? dice;
    if (d === null) return;

    const updatedPlayers = players.map(p => ({ ...p, pieces: [...p.pieces] }));
    const player = updatedPlayers[currentTurn];
    const oldPos = player.pieces[pieceIdx];
    const newPos = oldPos === 0 ? 1 : oldPos + d;

    if (newPos > 59) return;
    player.pieces[pieceIdx] = newPos;

    let captured = false;
    // Check capture
    const cap = checkCapture(player.color, newPos, updatedPlayers);
    if (cap) {
      updatedPlayers[cap.playerIdx].pieces[cap.pieceIdx] = 0;
      captured = true;
      toast.success(`${player.name} captured ${updatedPlayers[cap.playerIdx].name}'s piece!`);
    }

    // Check winner
    let newWinner = winner;
    if (player.pieces.every(p => p === 59)) {
      newWinner = player.color;
      setWinner(newWinner);
      toast.success(`🏆 ${player.name} wins!`);
    }

    const getExtraTurn = d === 6 || captured || newPos === 59;
    const next = getExtraTurn ? currentTurn : (currentTurn + 1) % updatedPlayers.length;

    setPlayers(updatedPlayers);
    setCurrentTurn(next);
    setDice(null);
    setValidMoves([]);
    setExtraTurn(getExtraTurn);
    syncState(updatedPlayers, next, null, [], newWinner);
  }, [dice, players, currentTurn, winner]);

  const syncState = (p: Player[], turn: number, d: number | null, moves: number[], w: LudoColor | null) => {
    channelRef?.send({
      type: 'broadcast', event: 'state-sync',
      payload: { players: p, currentTurn: turn, dice: d, winner: w, validMoves: moves, started: true },
    });
  };

  // Bot auto-play
  useEffect(() => {
    if (mode !== 'playing' || winner) return;
    const cp = players[currentTurn];
    if (!cp?.isBot) return;

    botTimerRef.current = setTimeout(() => {
      rollDice();
    }, 1000);
    return () => { if (botTimerRef.current) clearTimeout(botTimerRef.current); };
  }, [currentTurn, mode, winner, players, dice, rollDice]);

  const handlePieceClick = (pieceIdx: number) => {
    if (dice === null || currentTurn !== myColorIndex || winner) return;
    if (!validMoves.includes(pieceIdx)) return;
    executeMove(pieceIdx);
  };

  // Build pieces-on-grid map
  const piecesOnGrid = new Map<string, { color: LudoColor; pieceIdx: number; glow: boolean }[]>();
  players.forEach((p) => {
    p.pieces.forEach((pos, idx) => {
      const gp = getGridPos(p.color, pos, idx);
      if (!gp) return;
      const key = `${gp[0]}-${gp[1]}`;
      if (!piecesOnGrid.has(key)) piecesOnGrid.set(key, []);
      const isClickable = currentTurn === myColorIndex && !p.isBot && p.color === players[myColorIndex]?.color && validMoves.includes(idx);
      piecesOnGrid.get(key)!.push({ color: p.color, pieceIdx: idx, glow: isClickable });
    });
  });

  if (authLoading || !user) return null;

  // --- MENU ---
  if (mode === 'menu') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4 flex flex-col items-center justify-center">
        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="absolute top-4 left-4 text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-4xl font-bold text-white mb-2">🎲 Ludo</h1>
        <p className="text-white/60 text-sm mb-8">Classic board game</p>
        <div className="space-y-3 w-full max-w-xs">
          <Button onClick={startBotGame} className="w-full h-14 text-lg bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
            <Bot className="h-5 w-5 mr-2" /> Play vs Bots
          </Button>
          <Button onClick={createRoom} className="w-full h-14 text-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700">
            <Users className="h-5 w-5 mr-2" /> Create Room
          </Button>
          <div className="flex gap-2">
            <Input placeholder="Room code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} className="uppercase bg-white/10 border-white/20 text-white placeholder:text-white/40" />
            <Button onClick={joinRoom} variant="secondary">Join</Button>
          </div>
        </div>
      </div>
    );
  }

  // --- ONLINE LOBBY ---
  if (mode === 'online-lobby' && !onlineReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
        <div className="max-w-md mx-auto pt-10">
          <Button variant="ghost" size="icon" onClick={() => { if (channelRef) supabase.removeChannel(channelRef); setMode('menu'); setRoomCode(''); }} className="text-white mb-4">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Card className="bg-white/10 border-white/20 text-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Room: <span className="font-mono text-yellow-300">{roomCode}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-white" onClick={() => { navigator.clipboard.writeText(roomCode); toast.success('Copied!'); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-white/60 text-sm">Players ({players.length}/4):</p>
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${COLOR_PIECE[p.color].split(' ')[0]}`} />
                  <span>{p.name} {p.userId === user.id ? '(You)' : ''}</span>
                </div>
              ))}
              {Array(4 - players.length).fill(null).map((_, i) => (
                <div key={`w-${i}`} className="text-white/30 text-sm">Waiting...</div>
              ))}
              {myColorIndex === 0 && (
                <Button onClick={startOnlineGame} className="w-full bg-green-600 hover:bg-green-700 mt-4">
                  Start Game {players.length < 2 ? '(need 2+)' : ''}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // --- GAME BOARD ---
  const currentPlayer = players[currentTurn];
  const isMyTurn = currentTurn === myColorIndex && !currentPlayer?.isBot;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-2 sm:p-4 flex flex-col items-center">
      {/* Header */}
      <div className="w-full max-w-lg flex items-center justify-between mb-2">
        <Button variant="ghost" size="icon" onClick={() => { if (channelRef) supabase.removeChannel(channelRef); setMode('menu'); setWinner(null); setRoomCode(''); setOnlineReady(false); }} className="text-white">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-white font-bold">🎲 Ludo</h1>
        <div className="w-9" />
      </div>

      {/* Player indicators (top) */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-2 mb-2">
        {players.slice(0, 2).map((p, i) => (
          <div key={i} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
            currentTurn === i ? 'ring-2 ring-yellow-400 bg-white/20' : 'bg-white/10'
          }`}>
            <div className={`w-3 h-3 rounded-full ${COLOR_PIECE[p.color].split(' ')[0]}`} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto text-white/50">{p.pieces.filter(x => x === 59).length}/4</span>
          </div>
        ))}
      </div>

      {/* Board */}
      <div className="w-full max-w-lg aspect-square border-2 border-amber-900 rounded-lg overflow-hidden shadow-2xl" style={{ display: 'grid', gridTemplateColumns: 'repeat(15, 1fr)', gridTemplateRows: 'repeat(15, 1fr)' }}>
        {Array.from({ length: 225 }, (_, idx) => {
          const r = Math.floor(idx / 15);
          const c = idx % 15;
          const bg = getCellBg(r, c);
          const key = `${r}-${c}`;
          const cellPieces = piecesOnGrid.get(key) || [];
          const pathIdx = COMMON_PATH.findIndex(([pr, pc]) => pr === r && pc === c);
          const isStar = pathIdx !== -1 && SAFE_INDICES.has(pathIdx) && ![0, 13, 26, 39].includes(pathIdx);

          return (
            <div key={idx} className={`${bg} border border-black/10 flex items-center justify-center relative overflow-hidden`}>
              {isStar && <span className="absolute text-[7px] sm:text-[9px] text-amber-600 opacity-60">★</span>}
              {pathIdx === 0 && <span className="absolute text-[7px] text-red-500 opacity-50">→</span>}
              {pathIdx === 13 && <span className="absolute text-[7px] text-green-600 opacity-50">↓</span>}
              {pathIdx === 26 && <span className="absolute text-[7px] text-yellow-600 opacity-50">←</span>}
              {pathIdx === 39 && <span className="absolute text-[7px] text-blue-500 opacity-50">↑</span>}
              {cellPieces.length > 0 && (
                <div className={`flex flex-wrap gap-[1px] justify-center items-center z-10 ${cellPieces.length > 2 ? 'scale-[0.8]' : ''}`}>
                  {cellPieces.map((p, i) => (
                    <button
                      key={i}
                      onClick={() => p.glow && handlePieceClick(p.pieceIdx)}
                      className={`w-[10px] h-[10px] sm:w-[14px] sm:h-[14px] rounded-full border ${COLOR_PIECE[p.color]} shadow-sm transition-transform ${
                        p.glow ? 'animate-pulse ring-2 ring-yellow-300 cursor-pointer scale-110' : 'cursor-default'
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Player indicators (bottom) */}
      <div className="w-full max-w-lg grid grid-cols-2 gap-2 mt-2">
        {players.slice(2, 4).map((p, i) => (
          <div key={i + 2} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-white ${
            currentTurn === i + 2 ? 'ring-2 ring-yellow-400 bg-white/20' : 'bg-white/10'
          }`}>
            <div className={`w-3 h-3 rounded-full ${COLOR_PIECE[p.color].split(' ')[0]}`} />
            <span className="truncate">{p.name}</span>
            <span className="ml-auto text-white/50">{p.pieces.filter(x => x === 59).length}/4</span>
          </div>
        ))}
      </div>

      {/* Dice & Controls */}
      <div className="flex flex-col items-center gap-3 mt-4">
        {winner ? (
          <div className="flex flex-col items-center gap-3">
            <div className="text-2xl font-bold text-yellow-300 flex items-center gap-2">
              <Trophy className="h-6 w-6" /> {players.find(p => p.color === winner)?.name} Wins!
            </div>
            <Button onClick={() => { setMode('menu'); setWinner(null); }} variant="secondary">Play Again</Button>
          </div>
        ) : (
          <>
            <DiceVisual
              value={dice}
              rolling={rolling}
              onClick={rollDice}
              disabled={!isMyTurn || rolling || dice !== null}
            />
            <p className="text-white/70 text-sm text-center">
              {rolling ? 'Rolling...' :
                isMyTurn && dice === null ? 'Tap dice to roll' :
                isMyTurn && dice !== null && validMoves.length > 0 ? `Rolled ${dice}! Tap a piece to move` :
                isMyTurn && dice !== null && validMoves.length === 0 ? `Rolled ${dice} — no moves` :
                `${currentPlayer?.name}'s turn`}
              {extraTurn && !rolling && ' (Extra turn!)'}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default Ludo;
