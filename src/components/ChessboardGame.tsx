
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
  const [rightClickedSquares, setRightClickedSquares] = useState<Record<string, React.CSSProperties>>({});
  const [optionSquares, setOptionSquares] = useState<Record<string, React.CSSProperties>>({});
  const [lastMoveSquares, setLastMoveSquares] = useState<Record<string, React.CSSProperties>>({});

  const [whiteTime, setWhiteTime] = useState(INITIAL_TIME_SECONDS);
  const [blackTime, setBlackTime] = useState(INITIAL_TIME_SECONDS);
  const [isWhiteTimerActive, setIsWhiteTimerActive] = useState(false);
  const [isBlackTimerActive, setIsBlackTimerActive] = useState(false);
  const [gameStatus, setGameStatus] = useState("White to move. Select a mode to start.");
  const [gameOver, setGameOver] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);

  const CHESS_BOARD_LIGHT_COLOR = '#eeeed2';
  const CHESS_BOARD_DARK_COLOR = '#769656';
  const HIGHLIGHT_MOVE_COLOR = '#f6f669';
  const HIGHLIGHT_LAST_MOVE_COLOR = '#aad751';

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

  const safeGameMutate = useCallback((modify: (g: Chess) => void) => {
    setGame((currentGame) => {
      const update = new Chess(currentGame.fen());
      modify(update);
      setFen(update.fen());
      return update;
    });
  }, []);

  const makeMove = useCallback((move: ShortMove | string) => {
    if (game.isGameOver() && !gameOver) { // Check if game instance is over but state not yet updated
        toast({ title: "Game Over", description: "Cannot make moves, the game has ended.", variant: "destructive" });
        return false;
    }
    if (gameOver) { // Check already updated gameOver state
      toast({ title: "Game Over", description: "Cannot make moves, the game has ended.", variant: "destructive" });
      return false;
    }

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
        return true;
      }
    } catch (e) {
      toast({ title: "Invalid Move", description: "The attempted move is invalid.", variant: "destructive" });
      return false;
    }
    return false;
  }, [game, toast, HIGHLIGHT_LAST_MOVE_COLOR, gameOver]);


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
    
    const gameTurn = game.turn(); // 'w' or 'b'
    const movingPieceColor = piece.charAt(0); // 'w' or 'b'

    // Prevent human interaction if it's AI's turn in Player vs AI modes
    if ((playerMode === 'pvaWhite' && gameTurn === 'b') || (playerMode === 'pvaBlack' && gameTurn === 'w')) {
      return false; 
    }

    // Prevent moving a piece of the wrong color for the current turn.
    // This applies to PvP and the human's turn in PvA.
    if (gameTurn !== movingPieceColor) {
        return false;
    }

    // Check for promotion
    const gameMove: ShortMove = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q', // Default promotion
    };

    const foundMove = game.moves({ verbose: true }).find(m => m.from === sourceSquare && m.to === targetSquare);
    
    if (foundMove?.flags.includes('p')) { 
      setMoveFrom(sourceSquare);
      setMoveTo(targetSquare);
      setShowPromotionDialog(true);
      return false; 
    }

    const moveSuccessful = makeMove(gameMove);
    return moveSuccessful;
  };
  
  const onSquareClick = (square: Square) => {
    if (gameOver) return;
    setRightClickedSquares({});

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
        onPieceDrop(moveFrom, square, (pieceToMove.color + pieceToMove.type.toUpperCase()) as Piece);
      } else {
         setMoveFrom('');
         setOptionSquares({});
      }
    }
  };
  
  const onPromotionPieceSelect = (piece?: PromotionPieceOption) => {
    if (piece && moveFrom && moveTo) {
      // Ensure promotion piece symbol is just the type (q, r, b, n)
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
    setGame(newGame); // Set new game instance
    setFen(newGame.fen()); // Set fen from new game instance
    setGameOver(false);
    
    setWhiteTime(INITIAL_TIME_SECONDS);
    setBlackTime(INITIAL_TIME_SECONDS);
    setMoveFrom('');
    setOptionSquares({});
    setLastMoveSquares({});
    setRightClickedSquares({});
    setTimerResetKey(prev => prev + 1);

    if (playerMode === 'pvp') {
      setBoardOrientation('white');
      setIsWhiteTimerActive(true); // White starts in PvP
      setIsBlackTimerActive(false);
    } else if (playerMode === 'pvaWhite') {
      setBoardOrientation('white');
      setIsWhiteTimerActive(true); // Human (White) starts
      setIsBlackTimerActive(false);
    } else if (playerMode === 'pvaBlack') {
      setBoardOrientation('black');
      setIsWhiteTimerActive(false); 
      setIsBlackTimerActive(true); // Human (Black) effectively starts if AI is white and moves first
                                  // Or, if AI is white and doesn't move first, black timer starts.
                                  // Let's assume AI (white) makes the first move if pvaBlack.
    }
     // updateGameStatus will be called by useEffect listening to fen
  }, [playerMode, safeGameMutate]); // safeGameMutate is stable if its deps are stable

  useEffect(() => {
    resetGame();
  }, [playerMode, resetGame]); 

  const handleTimeUp = useCallback((player: 'white' | 'black') => {
    if (gameOver) return; // Prevent multiple calls if already game over
    setGameStatus(`${player === 'white' ? 'Black' : 'White'} wins on time!`);
    setGameOver(true);
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
  }, [gameOver]);

  const handleModeChange = (newMode: PlayerMode) => {
    setPlayerMode(newMode);
    // resetGame will be called by the useEffect watching playerMode
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
        <Button onClick={() => {
          resetGame(); // Call resetGame directly
          // updateGameStatus will be triggered by fen change in resetGame
        }} variant="outline">Reset Game</Button>
      </div>

      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-center">
        <TimerDisplay
            initialTime={INITIAL_TIME_SECONDS}
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
          promotionDialogVariant="basic"
          arePiecesDraggable={!gameOver && !((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w'))}
          id="NextChessboard"
        />
      </div>

       <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex justify-center">
         <TimerDisplay
            initialTime={INITIAL_TIME_SECONDS}
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
              {(['q', 'r', 'b', 'n'] as PieceSymbol[]).map((pSymbol) => (
                <Button 
                  key={pSymbol} 
                  variant="outline" 
                  onClick={() => onPromotionPieceSelect((game.turn() + pSymbol.toUpperCase()) as PromotionPieceOption)} 
                  className="w-16 h-16 text-3xl" // Increased text size for better visibility of piece symbols
                >
                  {/* Display standard algebraic notation for pieces */}
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

    