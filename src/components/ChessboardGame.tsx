"use client";

import { Chess, Square, PieceSymbol, SQUARES } from 'chess.js';
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
} from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";

const INITIAL_TIME_SECONDS = 5 * 60; // 5 minutes

type PlayerMode = 'pvp' | 'pvaWhite' | 'pvaBlack';

const ChessboardGame = () => {
  const { toast } = useToast();
  const [game, setGame] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');
  
  const [playerMode, setPlayerMode] = useState<PlayerMode>('pvp');

  const [moveFrom, setMoveFrom] = useState<Square | ''>('');
  const [moveTo, setMoveTo] = useState<Square | null>(null);
  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [promotionTo, setPromotionTo] = useState<PieceSymbol | null>(null);
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<Record<string, React.CSSProperties>>({});

  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME_SECONDS);
  const [blackTime, setBlackTime] = useState(INITIAL_TIME_SECONDS);
  const [isWhiteTimerActive, setIsWhiteTimerActive] = useState(false);
  const [isBlackTimerActive, setIsBlackTimerActive] = useState(false);
  const [gameStatus, setGameStatus] = useState("White to move. Select a mode to start.");
  const [gameOver, setGameOver] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0); // Used to force timer reset

  const CHESS_BOARD_LIGHT_COLOR = '#eeeed2';
  const CHESS_BOARD_DARK_COLOR = '#769656';
  const HIGHLIGHT_MOVE_COLOR = '#f6f669'; // Yellowish
  const HIGHLIGHT_LAST_MOVE_COLOR = '#aad751'; // Greenish

  const updateGameStatus = useCallback(() => {
    if (game.isCheckmate()) {
      setGameStatus(`Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins.`);
      setGameOver(true);
      setIsWhiteTimerActive(false);
      setIsBlackTimerActive(false);
    } else if (game.isStalemate()) {
      setGameStatus("Stalemate! Game is a draw.");
      setGameOver(true);
      setIsWhiteTimerActive(false);
      setIsBlackTimerActive(false);
    } else if (game.isDraw()) {
      setGameStatus("Draw!");
      setGameOver(true);
      setIsWhiteTimerActive(false);
      setIsBlackTimerActive(false);
    } else {
      setGameStatus(`${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' (Check!)' : ''}.`);
      setGameOver(false);
    }
  }, [game]);

  useEffect(() => {
    updateGameStatus();
  }, [fen, updateGameStatus]);

  const safeGameMutate = (modify: (g: Chess) => void) => {
    setGame((g) => {
      const update = new Chess(g.fen());
      modify(update);
      setFen(update.fen());
      return update;
    });
  };

  const makeMove = (move: ShortMove | string) => {
    try {
      const result = game.move(move);
      if (result) {
        setFen(game.fen());
        setLastMoveSquares({
          [result.from]: { backgroundColor: HIGHLIGHT_LAST_MOVE_COLOR },
          [result.to]: { backgroundColor: HIGHLIGHT_LAST_MOVE_COLOR },
        });
        setOptionSquares({});
        setMoveFrom('');
        setMoveTo(null);
        
        if (game.turn() === 'w') {
          setIsWhiteTimerActive(true);
          setIsBlackTimerActive(false);
        } else {
          setIsBlackTimerActive(true);
          setIsWhiteTimerActive(false);
        }
        updateGameStatus();
        return true;
      }
    } catch (e) {
      // Catches invalid moves like trying to move opponent's piece if not handled by onPieceDrop logic
      toast({ title: "Invalid Move", description: "The attempted move is invalid.", variant: "destructive" });
      return false;
    }
    return false;
  };

  const makeRandomMove = useCallback(() => {
    if (game.isGameOver()) return;
    const possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) return;
    const randomIndex = Math.floor(Math.random() * possibleMoves.length);
    const randomMove = possibleMoves[randomIndex];
    makeMove({ from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion });
  }, [game]);

  useEffect(() => {
    if (gameOver) return;
    const isAITurn = 
      (playerMode === 'pvaWhite' && game.turn() === 'b') || 
      (playerMode === 'pvaBlack' && game.turn() === 'w');

    if (isAITurn) {
      // Simple delay for AI move for better UX
      const timeoutId = setTimeout(() => {
        makeRandomMove();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [fen, playerMode, game, makeRandomMove, gameOver]);


  const onPieceDrop = (sourceSquare: Square, targetSquare: Square, piece: Piece) => {
    if (gameOver) return false;
    
    const currentTurn = game.turn();
    if ((playerMode === 'pvaWhite' && currentTurn === 'b') || (playerMode === 'pvaBlack' && currentTurn === 'w')) {
      return false; // AI's turn
    }
    if ((boardOrientation === 'black' && piece.startsWith('w')) || (boardOrientation === 'white' && piece.startsWith('b'))){
        // if player is playing pvp as black, they shouldn't be able to move white pieces & vice versa
        if (playerMode === 'pvp') return false;
    }


    const gameMove = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q' as PieceSymbol, // Default to queen, will be updated if needed
    };

    const foundMove = game.moves({ verbose: true }).find(m => m.from === sourceSquare && m.to === targetSquare);
    
    if (foundMove?.flags.includes('p')) { // Promotion move
      setMoveFrom(sourceSquare);
      setMoveTo(targetSquare);
      setShowPromotionDialog(true);
      return false; // Prevent react-chessboard from auto-making the move
    }

    const moveSuccessful = makeMove(gameMove);
    return moveSuccessful;
  };

  const onSquareClick = (square: Square) => {
    if (gameOver) return;
    setRightClickedSquares({}); // Clear right-click highlights

    if (!moveFrom) { // First click (selecting a piece)
      const pieceOnSquare = game.get(square);
      if (pieceOnSquare && pieceOnSquare.color === game.turn()) {
         if ((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w')) {
          return; // AI's turn
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
    } else { // Second click (making a move or deselecting)
      if (square === moveFrom) { // Deselecting
        setMoveFrom('');
        setOptionSquares({});
        return;
      }
      onPieceDrop(moveFrom, square, game.get(moveFrom)?.type as Piece); // Cast as Piece, though it might be null
      // onPieceDrop handles move logic and resetting highlights
    }
  };
  
  const onPromotionPieceSelect = (piece?: PromotionPieceOption) => {
    if (piece && moveFrom && moveTo) {
      makeMove({ from: moveFrom, to: moveTo, promotion: piece.charAt(1).toLowerCase() as PieceSymbol });
    }
    setShowPromotionDialog(false);
    setMoveFrom('');
    setMoveTo(null);
    setOptionSquares({});
    return true; // Indicate promotion handled
  };

  const resetGame = useCallback(() => {
    safeGameMutate(g => g.reset());
    setFen(new Chess().fen()); // Ensure FEN is reset to initial
    setGameOver(false);
    setIsWhiteTimerActive(playerMode !== 'pvaBlack'); // White starts unless AI is white
    setIsBlackTimerActive(playerMode === 'pvaBlack');
    setWhiteTime(INITIAL_TIME_SECONDS);
    setBlackTime(INITIAL_TIME_SECONDS);
    setMoveFrom('');
    setOptionSquares({});
    setLastMoveSquares({});
    setRightClickedSquares({});
    setTimerResetKey(prev => prev + 1); // Force timer components to re-initialize
    if (playerMode === 'pvp') setBoardOrientation('white');
    else if (playerMode === 'pvaWhite') setBoardOrientation('white');
    else if (playerMode === 'pvaBlack') setBoardOrientation('black');
    updateGameStatus();
  }, [playerMode, safeGameMutate, updateGameStatus]);

  useEffect(() => {
    resetGame(); // Reset game when mode changes
  }, [playerMode, resetGame]);

  const handleTimeUp = (player: 'white' | 'black') => {
    if (gameOver) return;
    setGameStatus(`${player === 'white' ? 'Black' : 'White'} wins on time!`);
    setGameOver(true);
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
  };

  const handleModeChange = (newMode: PlayerMode) => {
    setPlayerMode(newMode);
    // ResetGame is called by useEffect on playerMode change
  };
  
  return (
    <div className="flex flex-col items-center p-4 space-y-4">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-between items-center">
        <Select value={playerMode} onValueChange={(value) => handleModeChange(value as PlayerMode)}>
          <SelectTrigger className="w-[180px] bg-card">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pvp">Player vs Player</SelectItem>
            <SelectItem value="pvaWhite">Play as White (vs AI)</SelectItem>
            <SelectItem value="pvaBlack">Play as Black (vs AI)</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={resetGame} variant="outline">Reset Game</Button>
      </div>

      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-center">
        <TimerDisplay
            initialTime={blackTime}
            isActive={isBlackTimerActive && !gameOver}
            onTimeUp={() => handleTimeUp('black')}
            key={`black-timer-${timerResetKey}`}
          />
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
            ...rightClickedSquares,
          }}
          promotionDialogVariant="basic" // Use react-chessboard's basic promotion or implement custom with ShadCN
          arePiecesDraggable={!gameOver && !((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w'))}
          id="NextChessboard"
        />
      </div>

       <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-center">
         <TimerDisplay
            initialTime={whiteTime}
            isActive={isWhiteTimerActive && !gameOver}
            onTimeUp={() => handleTimeUp('white')}
            key={`white-timer-${timerResetKey}`}
          />
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
              {['q', 'r', 'b', 'n'].map((p) => (
                <Button key={p} variant="outline" onClick={() => onPromotionPieceSelect(game.turn() + p as PromotionPieceOption)} className="w-16 h-16 text-2xl">
                  {p.toUpperCase()}
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default ChessboardGame;
