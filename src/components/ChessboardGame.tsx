
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
} from '@/components/ui/dialog';
import { useToast } from "@/hooks/use-toast";

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
  id: string; // To ensure useEffect triggers even for same message type
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

  useEffect(() => {
    if (toastMessage) {
      toast({
        title: toastMessage.title,
        description: toastMessage.description,
        variant: toastMessage.variant,
      });
      setToastMessage(null); // Reset after showing
    }
  }, [toastMessage, toast]);


  const CHESS_BOARD_LIGHT_COLOR = 'hsl(var(--chess-board-light))';
  const CHESS_BOARD_DARK_COLOR = 'hsl(var(--chess-board-dark))';
  const HIGHLIGHT_MOVE_COLOR = 'hsl(var(--chess-highlight-move))';
  const HIGHLIGHT_LAST_MOVE_COLOR = 'hsl(var(--chess-highlight-last))';


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
    } catch (e) {
      console.error("Error during chess.js game.move:", e);
      setToastMessage({
        id: `moveError-${Date.now()}`,
        title: "Move Error",
        description: "An unexpected error occurred while processing the move.",
        variant: "destructive"
      });
      return false;
    }

    if (!moveResult) {
      // Illegal move, not necessarily an error to toast about unless desired
      // setToastMessage({ id: `illegalMove-${Date.now()}`, title: "Illegal Move", description: "That move is not allowed.", variant: "default" });
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
      if (moveResult.color === 'w') { // White captured a black piece
        setCapturedByWhite(prev => [...prev, moveResult.captured!]);
      } else { // Black captured a white piece
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
    // setToastMessage is implicitly stable from useState
    // setGame, setFen, etc. are stable
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

    const gameMove: ShortMove = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q', // Default promotion to Queen
    };

    // Check if the move is a promotion
    const foundMove = game.moves({ verbose: true }).find(m => m.from === sourceSquare && m.to === targetSquare);

    if (foundMove?.flags.includes('p')) { // 'p' flag indicates pawn promotion
      setMoveFrom(sourceSquare); // Store for promotion dialog
      setMoveTo(targetSquare);
      setShowPromotionDialog(true);
      return false; // Prevent react-chessboard from making the move; we'll handle it after promotion
    }

    const moveSuccessful = makeMove(gameMove);
    return moveSuccessful;
  };

  const onSquareClick = (square: Square) => {
    if (gameOver) return;

    if (!moveFrom) { // First click (selecting a piece)
      const pieceOnSquare = game.get(square);
      if (pieceOnSquare && pieceOnSquare.color === game.turn()) {
         // Prevent player from moving AI's pieces or if it's not their turn
         if ((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w')) {
          return;
        }
        setMoveFrom(square);
        const moves = game.moves({ square, verbose: true });
        const newOptionSquares: Record<string, React.CSSProperties> = {};
        moves.forEach(move => {
          newOptionSquares[move.to] = {
            background: game.get(move.to) && game.get(move.to)?.color !== game.turn()
              ? `radial-gradient(circle, ${HIGHLIGHT_MOVE_COLOR} 30%, transparent 35%)` // Capture
              : `radial-gradient(circle, ${HIGHLIGHT_MOVE_COLOR} 30%, transparent 35%)`, // Move
            borderRadius: '50%',
          };
        });
        newOptionSquares[square] = { backgroundColor: HIGHLIGHT_MOVE_COLOR }; // Highlight selected square
        setOptionSquares(newOptionSquares);
      }
    } else { // Second click (selecting target square or deselecting)
      if (square === moveFrom) { // Clicked same square again
        setMoveFrom('');
        setOptionSquares({});
        return;
      }
      // Attempt to make the move (same logic as onPieceDrop)
      const pieceToMove = game.get(moveFrom);
      if (pieceToMove) {
        onPieceDrop(moveFrom, square, (pieceToMove.color + pieceToMove.type.toUpperCase()) as Piece);
      } else {
         // Should not happen if moveFrom is set correctly
         setMoveFrom('');
         setOptionSquares({});
      }
    }
  };

  const onPromotionPieceSelect = (piece?: PromotionPieceOption) => {
    // piece is like 'wQ' or 'bN'
    if (piece && moveFrom && moveTo) {
      const promotionSymbol = piece.charAt(1).toLowerCase() as PieceSymbol; // 'q', 'n', etc.
      makeMove({ from: moveFrom, to: moveTo, promotion: promotionSymbol });
    }
    setShowPromotionDialog(false);
    setMoveFrom(''); // Reset moveFrom after promotion
    setMoveTo(null);
    setOptionSquares({}); // Clear highlights
    return true; // Indicate promotion was handled
  };

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setGameOver(false);
    // updateGameStatus will be called by useEffect listening to fen

    setWhiteTime(initialTimeSetting);
    setBlackTime(initialTimeSetting);
    // Timer active state will be set after fen update triggers game status update

    setMoveFrom('');
    setOptionSquares({});
    setLastMoveSquares({});
    setTimerResetKey(prev => prev + 1); // Force TimerDisplay to re-initialize
    setCapturedByWhite([]);
    setCapturedByBlack([]);

    // Set board orientation based on player mode
    if (playerMode === 'pvaBlack') {
      setBoardOrientation('black');
    } else {
      setBoardOrientation('white');
    }
    
    // Set initial timer active state based on whose turn it is
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
    if (gameOver) return; // Prevent multiple time-up calls
    setGameStatus(`${player === 'white' ? 'Black' : 'White'} wins on time!`);
    setGameOver(true);
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
  }, [gameOver]); // Added gameOver to dependencies

  const handleModeChange = (newMode: PlayerMode) => {
    setPlayerMode(newMode);
    // Game will reset via useEffect listening to playerMode
  };

  const handleTimerChange = (value: string) => {
    setInitialTimeSetting(parseInt(value, 10));
    // Game will reset via useEffect listening to initialTimeSetting
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
            key={`black-timer-${timerResetKey}`} // Use resetKey here
          />
        <CapturedPiecesDisplay capturedPieces={capturedByBlack} colorOfCapturedPieces="w" capturerName="Black" />
      </div>

      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl shadow-2xl rounded-lg overflow-hidden">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          onSquareClick={onSquareClick}
          onPromotionPieceSelect={onPromotionPieceSelect} // Pass the handler
          showPromotionDialog={showPromotionDialog} // Control visibility
          boardOrientation={boardOrientation}
          customBoardStyle={{
            borderRadius: '0.5rem', // Consistent with ShadCN
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)', // Tailwind shadow-xl
          }}
          customDarkSquareStyle={{ backgroundColor: CHESS_BOARD_DARK_COLOR }}
          customLightSquareStyle={{ backgroundColor: CHESS_BOARD_LIGHT_COLOR }}
          customSquareStyles={{
            ...optionSquares,
            ...lastMoveSquares,
          }}
          promotionDialogVariant="basic" // Use the built-in basic dialog
          arePiecesDraggable={!gameOver && !((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w'))}
          id="NextChessboard" // For testing/debugging
        />
      </div>

       <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-between items-center space-x-2">
         <TimerDisplay
            initialTime={initialTimeSetting}
            isActive={isWhiteTimerActive && !gameOver}
            onTimeUp={() => handleTimeUp('white')}
            key={`white-timer-${timerResetKey}`} // Use resetKey here
          />
          <CapturedPiecesDisplay capturedPieces={capturedByWhite} colorOfCapturedPieces="b" capturerName="White" />
      </div>

      <div className="text-center text-lg font-medium p-2 rounded-md bg-card text-card-foreground shadow w-full max-w-md md:max-w-lg lg:max-w-xl">
        {gameStatus}
      </div>

      {/* Promotion Dialog (using ShadCN Dialog) */}
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
                  {/* Display common notation (N for Knight) */}
                  {pSymbol === 'n' ? 'N' : pSymbol.toUpperCase()}
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
