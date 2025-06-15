
"use client";

import { Chess, Square, PieceSymbol } from 'chess.js';
import type { ShortMove } from 'chess.js';
import { useState, useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Piece,PromotionPieceOption } from 'react-chessboard/dist/chessboard/types';
import TimerDisplay from './TimerDisplay';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from "@/hooks/use-toast";
import { Crown, Swords, ThumbsDown } from 'lucide-react';

const DEFAULT_INITIAL_TIME_SECONDS = 5 * 60; // Default 5 minutes

type PlayerMode = 'pvp' | 'pvaWhite' | 'pvaBlack';

const PIECE_UNICODE: Record<'w' | 'b', Record<PieceSymbol, string>> = {
  w: { p: '♙', n: '♘', b: '♗', r: '♖', q: '♕', k: '♔' },
  b: { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' },
};

interface CapturedPiecesDisplayProps {
  capturedPieces: PieceSymbol[];
  colorOfCapturedPieces: 'w' | 'b';
  capturerName: string;
}

const CapturedPiecesDisplay: React.FC<CapturedPiecesDisplayProps> = ({ capturedPieces, colorOfCapturedPieces, capturerName }) => {
  if (capturedPieces.length === 0) {
    return (
      <div className="p-2 bg-card rounded-md shadow flex flex-col items-center justify-center min-h-[60px] flex-1 text-xs text-muted-foreground">
        No pieces captured by {capturerName}
      </div>
    );
  }

  const pieceOrderValue: Record<PieceSymbol, number> = { q: 5, r: 4, b: 3, n: 2, p: 1, k: 0 };
  const sortedPieces = [...capturedPieces].sort((a, b) => {
    return pieceOrderValue[b] - pieceOrderValue[a];
  });

  return (
    <div className="p-2 bg-card rounded-md shadow flex flex-col items-start min-h-[60px] flex-1">
      <div className="text-xs text-muted-foreground mb-1 self-center">Captured by {capturerName}:</div>
      <div className="flex flex-wrap gap-x-1 gap-y-0 leading-none">
        {sortedPieces.map((pieceType, index) => (
          <span
            key={index}
            className="text-xl"
            title={`${colorOfCapturedPieces === 'w' ? 'White' : 'Black'} ${pieceType.toUpperCase()}`}
          >
            {PIECE_UNICODE[colorOfCapturedPieces][pieceType]}
          </span>
        ))}
      </div>
    </div>
  );
};

interface ToastMessage {
  id: string;
  title: string;
  description: string;
  variant: 'default' | 'destructive';
}

const ChessboardGame = () => {
  const { toast } = useToast();
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

  const [playerMode, setPlayerMode] = useState<PlayerMode>('pvp');
  const [initialTimeSetting, setInitialTimeSetting] = useState(DEFAULT_INITIAL_TIME_SECONDS);

  const [moveFrom, setMoveFrom] = useState<Square | ''>('');
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<Record<string, React.CSSProperties>>({});

  const [whiteTime, setWhiteTime] = useState(initialTimeSetting);
  const [blackTime, setBlackTime] = useState(initialTimeSetting);
  const [isWhiteTimerActive, setIsWhiteTimerActive] = useState(false);
  const [isBlackTimerActive, setIsBlackTimerActive] = useState(false);
  const [gameStatus, setGameStatus] = useState("White to move. Select a mode to start.");
  const [gameOver, setGameOver] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);

  const [capturedByWhite, setCapturedByWhite] = useState<PieceSymbol[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<PieceSymbol[]>([]);

  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  const [showCheckmateDialog, setShowCheckmateDialog] = useState(false);
  const [winner, setWinner] = useState<'w' | 'b' | null>(null);


  useEffect(() => {
    if (toastMessage) {
      toast({
        title: toastMessage.title,
        description: toastMessage.description,
        variant: toastMessage.variant,
      });
      setToastMessage(null); 
    }
  }, [toastMessage, toast]);


  const CHESS_BOARD_LIGHT_COLOR = 'hsl(var(--chess-board-light))';
  const CHESS_BOARD_DARK_COLOR = 'hsl(var(--chess-board-dark))';
  const HIGHLIGHT_MOVE_COLOR = 'hsl(var(--chess-highlight-move))';
  const HIGHLIGHT_LAST_MOVE_COLOR = 'hsl(var(--chess-highlight-last))';


  const updateGameStatus = useCallback(() => {
    try {
      if (game.isCheckmate()) {
        setGameStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
        setGameOver(true);
        setIsWhiteTimerActive(false);
        setIsBlackTimerActive(false);
        setWinner(game.turn() === 'w' ? 'b' : 'w'); 
        setShowCheckmateDialog(true);
      } else if (game.isStalemate()) {
        setGameStatus("Stalemate! Game is a draw.");
        setGameOver(true);
        setIsWhiteTimerActive(false);
        setIsBlackTimerActive(false);
        setWinner(null);
        setShowCheckmateDialog(false);
      } else if (game.isDraw()) {
        setGameStatus("Draw!");
        setGameOver(true);
        setIsWhiteTimerActive(false);
        setIsBlackTimerActive(false);
        setWinner(null);
        setShowCheckmateDialog(false);
      } else {
        setGameStatus(`${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' (Check!)' : ''}.`);
        setGameOver(false);
        setWinner(null);
        setShowCheckmateDialog(false);
      }
    } catch (e) {
      console.error("Error updating game status:", e instanceof Error ? e.message : String(e));
      setGameStatus("Error evaluating game state. Game over.");
      setGameOver(true);
      setIsWhiteTimerActive(false);
      setIsBlackTimerActive(false);
      setWinner(null);
      setShowCheckmateDialog(false);
      setToastMessage({
        id: `gameStatusError-${Date.now()}`,
        title: "Game Error",
        description: "An unexpected error occurred while checking the game status.",
        variant: "destructive"
      });
    }
  }, [game, setIsBlackTimerActive, setIsWhiteTimerActive, setGameOver, setGameStatus, setToastMessage, setWinner, setShowCheckmateDialog]);

  useEffect(() => {
    updateGameStatus();
  }, [fen, updateGameStatus]);

 const makeMove = useCallback((move: ShortMove | string) => {
    if (gameOver) {
      setToastMessage({
        id: `gameOver-${Date.now()}`,
        title: "Game Over",
        description: "Cannot make moves, the game has ended.",
        variant: "destructive"
      });
      return false;
    }

    const gameCopy = new Chess(game.fen());
    let moveResult;
    try {
      moveResult = gameCopy.move(move);
    } catch (e: unknown) {
      console.error("Error during chess.js game.move:", e instanceof Error ? e.message : String(e));
      setToastMessage({
        id: `moveError-${Date.now()}`,
        title: "Move Error",
        description: "An unexpected error occurred while processing the move.",
        variant: "destructive"
      });
      return false;
    }

    if (!moveResult) {
      setToastMessage({
        id: `illegalMove-${Date.now()}`,
        title: "Illegal Move",
        description: "That move is not allowed.",
        variant: "destructive"
      });
      return false;
    }

    setGame(gameCopy);
    setFen(gameCopy.fen());

    setLastMoveSquares({
      [moveResult.from]: { backgroundColor: HIGHLIGHT_LAST_MOVE_COLOR },
      [moveResult.to]: { backgroundColor: HIGHLIGHT_LAST_MOVE_COLOR },
    });
    setOptionSquares({});
    setMoveFrom('');
    setMoveTo(null);

    if (moveResult.captured) {
      if (moveResult.color === 'w') { 
        setCapturedByWhite(prev => [...prev, moveResult.captured!]);
      } else { 
        setCapturedByBlack(prev => [...prev, moveResult.captured!]);
      }
    }

    if (gameCopy.turn() === 'w') {
      setIsWhiteTimerActive(true);
      setIsBlackTimerActive(false);
    } else {
      setIsBlackTimerActive(true);
      setIsWhiteTimerActive(false);
    }
    return true;
  }, [
    game,
    gameOver,
    HIGHLIGHT_LAST_MOVE_COLOR,
    setToastMessage, 
    setGame,
    setFen,
    setLastMoveSquares,
    setOptionSquares,
    setMoveFrom,
    setMoveTo,
    setCapturedByWhite,
    setCapturedByBlack,
    setIsWhiteTimerActive,
    setIsBlackTimerActive,
  ]);


  const makeRandomMove = useCallback(() => {
    if (game.isGameOver() || gameOver) return;
    const possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) return;
    const randomIndex = Math.floor(Math.random() * possibleMoves.length);
    const randomMove = possibleMoves[randomIndex];
    makeMove({ from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion });
  }, [game, makeMove, gameOver]);

  useEffect(() => {
    if (gameOver) return;
    const isAITurn =
      (playerMode === 'pvaWhite' && game.turn() === 'b') ||
      (playerMode === 'pvaBlack' && game.turn() === 'w');

    if (isAITurn) {
      const timeoutId = setTimeout(() => {
        makeRandomMove();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [fen, playerMode, game, makeRandomMove, gameOver]);

  const onPieceDrop = (sourceSquare: Square, targetSquare: Square, piece: Piece) => {
    if (gameOver) return false;

    const gameTurn = game.turn();
    const movingPieceColor = piece.charAt(0);
    
    if ((playerMode === 'pvaWhite' && gameTurn === 'b') || (playerMode === 'pvaBlack' && gameTurn === 'w')) {
      return false; 
    }
    
    if (gameTurn !== movingPieceColor) {
        return false;
    }

    const tempGame = new Chess(game.fen());
    const moveDetails = tempGame.moves({ square: sourceSquare, verbose: true })
                         .find(m => m.to === targetSquare);

    if (moveDetails?.flags.includes('p') && (targetSquare.endsWith('8') || targetSquare.endsWith('1'))) { 
      setMoveFrom(sourceSquare); 
      setMoveTo(targetSquare);
      setShowPromotionDialog(true);
      return false; 
    }

    const gameMove: ShortMove = {
      from: sourceSquare,
      to: targetSquare,
    };
    
    const moveSuccessful = makeMove(gameMove);
    return moveSuccessful;
  };

  const onSquareClick = (square: Square) => {
    if (gameOver) return;

    if (!moveFrom) { 
      const pieceOnSquare = game.get(square);
      if (pieceOnSquare && pieceOnSquare.color === game.turn()) {
         if ((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w')) {
          return;
        }
        setMoveFrom(square);
        const moves = game.moves({ square, verbose: true });
        const newOptionSquares: Record<string, React.CSSProperties> = {};
        moves.forEach(move => {
          newOptionSquares[move.to] = {
            background: game.get(move.to) && game.get(move.to)?.color !== game.turn()
              ? `radial-gradient(circle, ${HIGHLIGHT_MOVE_COLOR} 30%, transparent 35%)`
              : `radial-gradient(circle, ${HIGHLIGHT_MOVE_COLOR} 30%, transparent 35%)`, 
            borderRadius: '50%',
          };
        });
        newOptionSquares[square] = { backgroundColor: HIGHLIGHT_MOVE_COLOR }; 
        setOptionSquares(newOptionSquares);
      }
    } else { 
      if (square === moveFrom) { 
        setMoveFrom('');
        setOptionSquares({});
        return;
      }
      
      const pieceToMove = game.get(moveFrom);
      if (pieceToMove) {
        const pieceString = (pieceToMove.color + pieceToMove.type.toUpperCase()) as Piece;
        const moveSuccessful = onPieceDrop(moveFrom, square, pieceString);
        if (!moveSuccessful && !showPromotionDialog) { 
          setMoveFrom('');
          setOptionSquares({});
        }
      } else {
         setMoveFrom(''); 
         setOptionSquares({});
      }
    }
  };

  const onPromotionPieceSelect = (piece?: PromotionPieceOption) => {
    if (piece && moveFrom && moveTo) {
      const promotionSymbol = piece.charAt(1).toLowerCase() as PieceSymbol; 
      makeMove({ from: moveFrom, to: moveTo, promotion: promotionSymbol });
    }
    setShowPromotionDialog(false);
    setMoveFrom(''); 
    setMoveTo(null);
    setOptionSquares({}); 
    return true; 
  };

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setGameOver(false);

    setWhiteTime(initialTimeSetting);
    setBlackTime(initialTimeSetting);
    
    setMoveFrom('');
    setOptionSquares({});
    setLastMoveSquares({});
    setTimerResetKey(prev => prev + 1); 
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setShowCheckmateDialog(false);
    setWinner(null);


    if (playerMode === 'pvaBlack') {
      setBoardOrientation('black');
    } else {
      setBoardOrientation('white');
    }
    
    if (newGame.turn() === 'w') {
      setIsWhiteTimerActive(true);
      setIsBlackTimerActive(false);
    } else { 
      setIsBlackTimerActive(true);
      setIsWhiteTimerActive(false);
    }
  }, [playerMode, initialTimeSetting ]);


  useEffect(() => {
    resetGame();
  }, [playerMode, initialTimeSetting, resetGame]);

  const handleTimeUp = useCallback((player: 'white' | 'black') => {
    if (gameOver) return; 
    setGameStatus(`${player === 'white' ? 'Black' : 'White'} wins on time!`);
    setGameOver(true);
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
    setShowCheckmateDialog(false); 
    setWinner(null);
  }, [gameOver, setGameStatus, setGameOver, setIsWhiteTimerActive, setIsBlackTimerActive]); 

  const handleModeChange = (newMode: PlayerMode) => {
    setPlayerMode(newMode);
  };

  const handleTimerChange = (value: string) => {
    setInitialTimeSetting(parseInt(value, 10));
  };


  return (
    <div className="flex flex-col items-center p-4 space-y-4">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-2">
        <Select value={playerMode} onValueChange={(value) => handleModeChange(value as PlayerMode)}>
          <SelectTrigger className="w-full sm:w-[180px] bg-card">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pvp">Player vs Player</SelectItem>
            <SelectItem value="pvaWhite">Play as White (vs AI)</SelectItem>
            <SelectItem value="pvaBlack">Play as Black (vs AI)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(initialTimeSetting)} onValueChange={handleTimerChange}>
          <SelectTrigger className="w-full sm:w-[150px] bg-card">
            <SelectValue placeholder="Timer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={String(1 * 60)}>1 Minute</SelectItem>
            <SelectItem value={String(3 * 60)}>3 Minutes</SelectItem>
            <SelectItem value={String(5 * 60)}>5 Minutes</SelectItem>
            <SelectItem value={String(10 * 60)}>10 Minutes</SelectItem>
            <SelectItem value={String(15 * 60)}>15 Minutes</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={resetGame} variant="outline" className="w-full sm:w-auto">Reset Game</Button>
      </div>

      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-between items-center space-x-2">
        <TimerDisplay
            initialTime={initialTimeSetting}
            isActive={isBlackTimerActive && !gameOver}
            onTimeUp={() => handleTimeUp('black')}
            key={`black-timer-${timerResetKey}`} 
          />
        <CapturedPiecesDisplay capturedPieces={capturedByBlack} colorOfCapturedPieces="w" capturerName="Black" />
      </div>

      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl shadow-2xl rounded-lg overflow-hidden">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          onPromotionPieceSelect={onPromotionPieceSelect} 
          showPromotionDialog={showPromotionDialog} 
          boardOrientation={boardOrientation}
          customBoardStyle={{
            borderRadius: '0.5rem', 
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', 
          }}
          customDarkSquareStyle={{ backgroundColor: CHESS_BOARD_DARK_COLOR }}
          customLightSquareStyle={{ backgroundColor: CHESS_BOARD_LIGHT_COLOR }}
          customSquareStyles={{
            ...optionSquares,
            ...lastMoveSquares,
          }}
          promotionDialogVariant="basic" 
          arePiecesDraggable={!gameOver && !((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w'))}
          id="NextChessboard" 
        />
      </div>

       <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-between items-center space-x-2">
         <TimerDisplay
            initialTime={initialTimeSetting}
            isActive={isWhiteTimerActive && !gameOver}
            onTimeUp={() => handleTimeUp('white')}
            key={`white-timer-${timerResetKey}`} 
          />
          <CapturedPiecesDisplay capturedPieces={capturedByWhite} colorOfCapturedPieces="b" capturerName="White" />
      </div>

      <div className="text-center text-lg font-medium p-2 rounded-md bg-card text-card-foreground shadow w-full max-w-md md:max-w-lg lg:max-w-xl">
        {gameStatus}
      </div>

      {showPromotionDialog && (
        <Dialog open={showPromotionDialog} onOpenChange={setShowPromotionDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Promote Pawn</DialogTitle>
              <DialogDescription>Choose a piece to promote your pawn to.</DialogDescription>
            </DialogHeader>
            <div className="flex justify-around p-4">
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((pSymbol) => (
                <Button
                  key={pSymbol}
                  variant="outline"
                  onClick={() => onPromotionPieceSelect((game.turn() + pSymbol.toUpperCase()) as PromotionPieceOption)}
                  className="w-16 h-16 text-3xl"
                >
                  {PIECE_UNICODE[game.turn()][pSymbol]}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {showCheckmateDialog && winner && (
        <Dialog open={showCheckmateDialog} onOpenChange={setShowCheckmateDialog}>
          <DialogContent className="sm:max-w-md bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle className="text-3xl text-center font-bold text-primary">Checkmate!</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-6 p-6">
              <div className="flex flex-col items-center text-center">
                <Crown className="w-16 h-16 text-yellow-500 mb-2" />
                <span className="text-7xl">
                  {PIECE_UNICODE[winner]['k']}
                </span>
                <span className="text-xl font-semibold mt-1">{winner === 'w' ? 'White' : 'Black'} Wins!</span>
              </div>

              <Separator className="my-4 bg-border" />

              <div className="flex flex-col items-center text-center">
                <div className="relative mb-2">
                  <span className="text-7xl transform rotate-180 inline-block">
                    {PIECE_UNICODE[winner === 'w' ? 'b' : 'w']['k']}
                  </span>
                  <Swords className="w-12 h-12 text-destructive absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-80" style={{ transform: 'translate(-50%, -50%) rotate(-30deg)' }} />
                </div>
                <ThumbsDown className="w-14 h-14 text-destructive" />
                <span className="text-xl font-semibold mt-1">{winner === 'w' ? 'Black' : 'White'} is Defeated</span>
              </div>
            </div>
            <DialogFooter className="sm:justify-center pt-4 gap-2">
              <Button type="button" onClick={() => {
                setShowCheckmateDialog(false);
                resetGame();
              }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                New Game
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCheckmateDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ChessboardGame;
