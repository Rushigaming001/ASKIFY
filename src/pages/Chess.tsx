import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Crown, RotateCcw, Copy, Users, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
type PieceColor = 'w' | 'b';
interface Piece { type: PieceType; color: PieceColor; hasMoved?: boolean; }
type Board = (Piece | null)[][];

const PIECE_SYMBOLS: Record<string, string> = {
  'wK': '♔', 'wQ': '♕', 'wR': '♖', 'wB': '♗', 'wN': '♘', 'wP': '♙',
  'bK': '♚', 'bQ': '♛', 'bR': '♜', 'bB': '♝', 'bN': '♞', 'bP': '♟',
};

function createInitialBoard(): Board {
  const board: Board = Array(8).fill(null).map(() => Array(8).fill(null));
  const backRow: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  for (let i = 0; i < 8; i++) {
    board[0][i] = { type: backRow[i], color: 'b' };
    board[1][i] = { type: 'P', color: 'b' };
    board[6][i] = { type: 'P', color: 'w' };
    board[7][i] = { type: backRow[i], color: 'w' };
  }
  return board;
}

// Basic move validation (piece movement rules only, no check validation)
function isValidMoveBasic(board: Board, fromR: number, fromC: number, toR: number, toC: number): boolean {
  const piece = board[fromR][fromC];
  if (!piece) return false;
  const target = board[toR][toC];
  if (target && target.color === piece.color) return false;
  if (fromR === toR && fromC === toC) return false;

  const dr = toR - fromR, dc = toC - fromC;
  const adr = Math.abs(dr), adc = Math.abs(dc);

  const pathClear = (rDir: number, cDir: number, steps: number) => {
    for (let s = 1; s < steps; s++) {
      if (board[fromR + rDir * s][fromC + cDir * s]) return false;
    }
    return true;
  };

  switch (piece.type) {
    case 'P': {
      const dir = piece.color === 'w' ? -1 : 1;
      const startRow = piece.color === 'w' ? 6 : 1;
      if (dc === 0 && !target) {
        if (dr === dir) return true;
        if (dr === 2 * dir && fromR === startRow && !board[fromR + dir][fromC]) return true;
      }
      if (adc === 1 && dr === dir && target) return true;
      return false;
    }
    case 'R': return (dr === 0 || dc === 0) && pathClear(Math.sign(dr), Math.sign(dc), Math.max(adr, adc));
    case 'B': return adr === adc && adr > 0 && pathClear(Math.sign(dr), Math.sign(dc), adr);
    case 'Q': return ((dr === 0 || dc === 0) || (adr === adc)) && (adr + adc > 0) && pathClear(Math.sign(dr), Math.sign(dc), Math.max(adr, adc));
    case 'N': return (adr === 2 && adc === 1) || (adr === 1 && adc === 2);
    case 'K': {
      if (adr <= 1 && adc <= 1) return true;
      // Castling
      if (adr === 0 && adc === 2 && !piece.hasMoved) {
        const row = piece.color === 'w' ? 7 : 0;
        if (fromR !== row) return false;
        if (dc === 2) { // Kingside
          const rook = board[row][7];
          if (!rook || rook.type !== 'R' || rook.hasMoved) return false;
          if (board[row][5] || board[row][6]) return false;
          if (isSquareAttacked(board, row, 4, piece.color === 'w' ? 'b' : 'w')) return false;
          if (isSquareAttacked(board, row, 5, piece.color === 'w' ? 'b' : 'w')) return false;
          if (isSquareAttacked(board, row, 6, piece.color === 'w' ? 'b' : 'w')) return false;
          return true;
        }
        if (dc === -2) { // Queenside
          const rook = board[row][0];
          if (!rook || rook.type !== 'R' || rook.hasMoved) return false;
          if (board[row][1] || board[row][2] || board[row][3]) return false;
          if (isSquareAttacked(board, row, 4, piece.color === 'w' ? 'b' : 'w')) return false;
          if (isSquareAttacked(board, row, 3, piece.color === 'w' ? 'b' : 'w')) return false;
          if (isSquareAttacked(board, row, 2, piece.color === 'w' ? 'b' : 'w')) return false;
          return true;
        }
      }
      return false;
    }
    default: return false;
  }
}

function findKing(board: Board, color: PieceColor): [number, number] | null {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.type === 'K' && board[r][c]?.color === color) return [r, c];
  return null;
}

function isSquareAttacked(board: Board, row: number, col: number, byColor: PieceColor): boolean {
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === byColor) {
        const piece = board[r][c]!;
        // Skip castling check for king to avoid recursion
        if (piece.type === 'K') {
          if (Math.abs(r - row) <= 1 && Math.abs(c - col) <= 1) return true;
          continue;
        }
        if (isValidMoveBasic(board, r, c, row, col)) return true;
      }
  return false;
}

function isInCheck(board: Board, color: PieceColor): boolean {
  const king = findKing(board, color);
  if (!king) return false;
  return isSquareAttacked(board, king[0], king[1], color === 'w' ? 'b' : 'w');
}

function makeMove(board: Board, fromR: number, fromC: number, toR: number, toC: number): Board {
  const newBoard = board.map(row => row.map(cell => cell ? { ...cell } : null));
  const piece = newBoard[fromR][fromC]!;

  // Castling - move rook
  if (piece.type === 'K' && Math.abs(toC - fromC) === 2) {
    const row = fromR;
    if (toC === 6) { newBoard[row][5] = newBoard[row][7]; newBoard[row][7] = null; if (newBoard[row][5]) newBoard[row][5]!.hasMoved = true; }
    if (toC === 2) { newBoard[row][3] = newBoard[row][0]; newBoard[row][0] = null; if (newBoard[row][3]) newBoard[row][3]!.hasMoved = true; }
  }

  newBoard[toR][toC] = { ...piece, hasMoved: true };
  newBoard[fromR][fromC] = null;

  // Pawn promotion
  if (piece.type === 'P' && (toR === 0 || toR === 7)) {
    newBoard[toR][toC] = { type: 'Q', color: piece.color, hasMoved: true };
  }

  return newBoard;
}

function isLegalMove(board: Board, fromR: number, fromC: number, toR: number, toC: number, turn: PieceColor): boolean {
  const piece = board[fromR][fromC];
  if (!piece || piece.color !== turn) return false;
  if (!isValidMoveBasic(board, fromR, fromC, toR, toC)) return false;
  // Ensure move doesn't leave own king in check
  const newBoard = makeMove(board, fromR, fromC, toR, toC);
  return !isInCheck(newBoard, turn);
}

function getGameStatus(board: Board, turn: PieceColor): 'playing' | 'check' | 'checkmate' | 'stalemate' {
  const inCheck = isInCheck(board, turn);
  // Check if any legal move exists
  let hasLegalMove = false;
  outer: for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (board[r][c]?.color === turn)
        for (let tr = 0; tr < 8; tr++)
          for (let tc = 0; tc < 8; tc++)
            if (isLegalMove(board, r, c, tr, tc, turn)) {
              hasLegalMove = true;
              break outer;
            }

  if (!hasLegalMove) return inCheck ? 'checkmate' : 'stalemate';
  return inCheck ? 'check' : 'playing';
}

function getLegalMoves(board: Board, fromR: number, fromC: number, turn: PieceColor): [number, number][] {
  const moves: [number, number][] = [];
  for (let r = 0; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if (isLegalMove(board, fromR, fromC, r, c, turn)) moves.push([r, c]);
  return moves;
}

const Chess = () => {
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [board, setBoard] = useState<Board>(createInitialBoard());
  const [turn, setTurn] = useState<PieceColor>('w');
  const [selected, setSelected] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<[number, number][]>([]);
  const [gameStatus, setGameStatus] = useState<'playing' | 'check' | 'checkmate' | 'stalemate'>('playing');
  const [roomCode, setRoomCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [myColor, setMyColor] = useState<PieceColor | null>(null);
  const [opponentJoined, setOpponentJoined] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [channelRef, setChannelRef] = useState<any>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [authLoading, user, navigate]);

  const createRoom = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    setMyColor('w');
    setGameStarted(false);
    setOpponentJoined(false);
    joinChannel(code, 'w');
    toast.success(`Room created! Code: ${code}`);
  };

  const joinRoom = () => {
    if (!joinCode.trim()) { toast.error('Enter a room code'); return; }
    setRoomCode(joinCode.toUpperCase());
    setMyColor('b');
    joinChannel(joinCode.toUpperCase(), 'b');
  };

  const joinChannel = (code: string, color: PieceColor) => {
    if (channelRef) supabase.removeChannel(channelRef);
    const channel = supabase.channel(`chess-${code}`);
    channel
      .on('broadcast', { event: 'move' }, ({ payload }) => {
        setBoard(payload.board);
        setTurn(payload.turn);
        setGameStatus(payload.gameStatus || 'playing');
        setSelected(null);
        setLegalMoves([]);
      })
      .on('broadcast', { event: 'player-joined' }, () => {
        setOpponentJoined(true);
        setGameStarted(true);
        toast.success('Opponent joined!');
      })
      .on('broadcast', { event: 'reset' }, () => {
        setBoard(createInitialBoard());
        setTurn('w');
        setSelected(null);
        setLegalMoves([]);
        setGameStatus('playing');
        toast.info('Game reset');
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED' && color === 'b') {
          channel.send({ type: 'broadcast', event: 'player-joined', payload: {} });
          setOpponentJoined(true);
          setGameStarted(true);
        }
      });
    setChannelRef(channel);
  };

  useEffect(() => () => { if (channelRef) supabase.removeChannel(channelRef); }, [channelRef]);

  // Update game status whenever board/turn changes
  useEffect(() => {
    if (gameStarted) {
      const status = getGameStatus(board, turn);
      setGameStatus(status);
    }
  }, [board, turn, gameStarted]);

  const handleCellClick = (r: number, c: number) => {
    if (!gameStarted || (gameStatus === 'checkmate' || gameStatus === 'stalemate')) return;
    if (turn !== myColor) return;

    if (selected) {
      const [sr, sc] = selected;
      if (isLegalMove(board, sr, sc, r, c, turn)) {
        const newBoard = makeMove(board, sr, sc, r, c);
        const newTurn: PieceColor = turn === 'w' ? 'b' : 'w';
        const newStatus = getGameStatus(newBoard, newTurn);
        setBoard(newBoard);
        setTurn(newTurn);
        setSelected(null);
        setLegalMoves([]);
        setGameStatus(newStatus);
        channelRef?.send({ type: 'broadcast', event: 'move', payload: { board: newBoard, turn: newTurn, gameStatus: newStatus } });
      } else {
        // Select different piece or deselect
        if (board[r][c]?.color === myColor) {
          setSelected([r, c]);
          setLegalMoves(getLegalMoves(board, r, c, turn));
        } else {
          setSelected(null);
          setLegalMoves([]);
        }
      }
    } else {
      if (board[r][c]?.color === myColor) {
        setSelected([r, c]);
        setLegalMoves(getLegalMoves(board, r, c, turn));
      }
    }
  };

  const resetGame = () => {
    setBoard(createInitialBoard());
    setTurn('w');
    setSelected(null);
    setLegalMoves([]);
    setGameStatus('playing');
    channelRef?.send({ type: 'broadcast', event: 'reset', payload: {} });
  };

  if (authLoading || !user) return null;

  const displayBoard = myColor === 'b' ? [...board].reverse().map(row => [...row].reverse()) : board;

  const statusText = gameStatus === 'checkmate'
    ? `Checkmate! ${turn === 'w' ? 'Black' : 'White'} wins!`
    : gameStatus === 'stalemate'
    ? 'Stalemate! Draw!'
    : gameStatus === 'check'
    ? `${turn === 'w' ? 'White' : 'Black'} is in check!`
    : turn === myColor ? 'Your turn' : "Opponent's turn";

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-100 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Crown className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-bold text-slate-800">Online Chess</h1>
        </div>

        {!roomCode ? (
          <Card>
            <CardHeader><CardTitle>Create or Join a Game</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={createRoom} className="w-full bg-amber-600 hover:bg-amber-700">
                <Users className="h-4 w-4 mr-2" /> Create Room
              </Button>
              <div className="flex gap-2">
                <Input placeholder="Enter room code" value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} className="uppercase" />
                <Button onClick={joinRoom} variant="outline">Join</Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur rounded-xl p-3 border border-amber-200">
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Room:</span>
                <span className="font-mono font-bold text-amber-700">{roomCode}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { navigator.clipboard.writeText(roomCode); toast.success('Copied!'); }}>
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
              <span className={`text-sm font-medium ${opponentJoined ? 'text-green-600' : 'text-orange-500'}`}>
                {opponentJoined ? '● Connected' : '○ Waiting...'}
              </span>
            </div>

            <div className="flex items-center justify-between px-1">
              <span className="text-sm font-medium">
                You: <span className={myColor === 'w' ? 'text-amber-700' : 'text-slate-800'}>{myColor === 'w' ? '♔ White' : '♚ Black'}</span>
              </span>
              <span className={`text-sm font-bold flex items-center gap-1 ${
                gameStatus === 'checkmate' || gameStatus === 'stalemate' ? 'text-red-600' :
                gameStatus === 'check' ? 'text-orange-600' :
                turn === myColor ? 'text-green-600' : 'text-slate-400'
              }`}>
                {(gameStatus === 'check' || gameStatus === 'checkmate') && <AlertTriangle className="h-4 w-4" />}
                {statusText}
              </span>
            </div>

            {/* Chess Board */}
            <div className="aspect-square max-w-lg mx-auto">
              <div className="grid grid-cols-8 border-2 border-amber-800 rounded-lg overflow-hidden shadow-xl">
                {displayBoard.map((row, ri) =>
                  row.map((piece, ci) => {
                    const actualR = myColor === 'b' ? 7 - ri : ri;
                    const actualC = myColor === 'b' ? 7 - ci : ci;
                    const isLight = (ri + ci) % 2 === 0;
                    const isSelected = selected && selected[0] === actualR && selected[1] === actualC;
                    const isLegal = legalMoves.some(([lr, lc]) => lr === actualR && lc === actualC);
                    const isKingInCheck = piece?.type === 'K' && piece?.color === turn && gameStatus === 'check';

                    return (
                      <button
                        key={`${ri}-${ci}`}
                        className={`aspect-square flex items-center justify-center text-2xl sm:text-3xl md:text-4xl font-normal transition-all duration-150 relative
                          ${isLight ? 'bg-amber-100' : 'bg-amber-700'}
                          ${isSelected ? 'ring-4 ring-blue-400 ring-inset z-10' : ''}
                          ${isKingInCheck ? 'bg-red-400' : ''}
                          ${turn === myColor && gameStatus !== 'checkmate' && gameStatus !== 'stalemate' ? 'cursor-pointer hover:brightness-110' : 'cursor-default'}
                        `}
                        onClick={() => handleCellClick(actualR, actualC)}
                      >
                        {isLegal && !piece && (
                          <div className="absolute w-3 h-3 rounded-full bg-blue-400/50" />
                        )}
                        {isLegal && piece && (
                          <div className="absolute inset-0 ring-4 ring-inset ring-blue-400/50 rounded-sm" />
                        )}
                        {piece && PIECE_SYMBOLS[`${piece.color}${piece.type}`]}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={resetGame}>
                <RotateCcw className="h-4 w-4 mr-1" /> Reset
              </Button>
              <Button variant="outline" size="sm" onClick={() => { if (channelRef) supabase.removeChannel(channelRef); setRoomCode(''); setGameStarted(false); setGameStatus('playing'); }}>
                Leave Room
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chess;
