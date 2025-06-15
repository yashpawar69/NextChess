
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from "@/hooks/use-toast";
import { Crown, Swords, ThumbsDown, Handshake, Flag } from 'lucide-react';

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

interface MoveHistoryDisplayProps {
  history: string[];
}

const MoveHistoryDisplay: React.FC<MoveHistoryDisplayProps> = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        No moves yet.
      </div>
    );
  }

  const formattedMoves: { number: number; white?: string; black?: string }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    formattedMoves.push({
      number: Math.floor(i / 2) + 1,
      white: history[i],
      black: history[i + 1] || undefined,
    });
  }

  return (
    <ScrollArea className="h-48 w-full rounded-md border bg-card text-card-foreground shadow">
      <div className="p-4 space-y-1">
        {formattedMoves.map((movePair) => (
          <div key={movePair.number} className="flex text-sm items-baseline font-mono">
            <span className="w-7 text-right font-medium text-muted-foreground pr-1.5 tabular-nums">{movePair.number}.</span>
            <span className="w-20 min-w-0 truncate px-1">{movePair.white}</span>
            {movePair.black && <span className="w-20 min-w-0 truncate px-1">{movePair.black}</span>}
            {!movePair.black && <span className="w-20 min-w-0 px-1"></span>}
          </div>
        ))}
      </div>
    </ScrollArea>
  );
};


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
  const [checkSquare, setCheckSquare] = useState<Square | null>(null);


  const [whiteTime, setWhiteTime] = useState(initialTimeSetting);
  const [blackTime, setBlackTime] = useState(initialTimeSetting);
  const [isWhiteTimerActive, setIsWhiteTimerActive] = useState(false);
  const [isBlackTimerActive, setIsBlackTimerActive] = useState(false);
  const [gameStatus, setGameStatus] = useState("White to move. Select a mode to start.");
  const [gameOver, setGameOver] = useState(false);
  const [timerResetKey, setTimerResetKey] = useState(0);

  const [capturedByWhite, setCapturedByWhite] = useState<PieceSymbol[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<PieceSymbol[]>([]);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);

  const [toastMessage, setToastMessage] = useState<ToastMessage | null>(null);

  const [showCheckmateDialog, setShowCheckmateDialog] = useState(false);
  const [winner, setWinner] = useState<'w' | 'b' | null>(null);

  const [drawOffer, setDrawOffer] = useState<'w' | 'b' | null>(null);
  const [showDrawOfferDialog, setShowDrawOfferDialog] = useState(false);
  const [showDrawGameDialog, setShowDrawGameDialog] = useState(false);
  const [drawType, setDrawType] = useState<string | null>(null);

  const CHESS_BOARD_LIGHT_COLOR = 'hsl(var(--chess-board-light))';
  const CHESS_BOARD_DARK_COLOR = 'hsl(var(--chess-board-dark))';
  const HIGHLIGHT_MOVE_COLOR = 'hsl(var(--chess-highlight-move))';
  const HIGHLIGHT_LAST_MOVE_COLOR = 'hsl(var(--chess-highlight-last))';
  const HIGHLIGHT_CHECK_COLOR = 'hsl(var(--chess-highlight-check))';


  const handleTimeUp = useCallback((player: 'white' | 'black') => {
    if (gameOver) return;
    setGameStatus(`${player === 'white' ? 'Black' : 'White'} wins on time!`);
    setGameOver(true);
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
    setWinner(player === 'white' ? 'b' : 'w');
    setShowCheckmateDialog(true);
  }, [gameOver]);

  const handleOfferDraw = useCallback(() => {
    if (gameOver || drawOffer) return;
    const offeringPlayerColor = game.turn();
    setDrawOffer(offeringPlayerColor);
    
    if (offeringPlayerColor === 'w') {
      setIsWhiteTimerActive(false);
      setIsBlackTimerActive(true);
    } else {
      setIsBlackTimerActive(false);
      setIsWhiteTimerActive(true);
    }
  }, [gameOver, drawOffer, game, setIsWhiteTimerActive, setIsBlackTimerActive]);

  const handleAcceptDraw = useCallback(() => {
    setGameOver(true);
    setGameStatus("Game drawn by agreement.");
    setDrawOffer(null);
    setShowDrawOfferDialog(false);
    setDrawType("Agreement");
    setShowDrawGameDialog(true);
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
  }, [setGameOver, setGameStatus, setDrawOffer, setShowDrawOfferDialog, setDrawType, setShowDrawGameDialog, setIsWhiteTimerActive, setIsBlackTimerActive]);
  
  const handleRejectDraw = useCallback(() => {
    const offeringPlayer = drawOffer;
    setDrawOffer(null);
    setShowDrawOfferDialog(false);

    if (offeringPlayer === 'w') { 
      setIsBlackTimerActive(true);
      setIsWhiteTimerActive(false);
    } else { 
      setIsWhiteTimerActive(true);
      setIsBlackTimerActive(false);
    }
  }, [drawOffer, setDrawOffer, setShowDrawOfferDialog, setIsWhiteTimerActive, setIsBlackTimerActive]);

  const handleResign = useCallback(() => {
    if (gameOver || drawOffer) return;
    const resigningPlayer = game.turn();
    const winningPlayer = resigningPlayer === 'w' ? 'b' : 'w';

    setGameOver(true);
    setWinner(winningPlayer);
    setGameStatus(`${resigningPlayer === 'w' ? 'White' : 'Black'} resigned. ${winningPlayer === 'w' ? 'White' : 'Black'} wins.`);
    setShowCheckmateDialog(true); 
    setIsWhiteTimerActive(false);
    setIsBlackTimerActive(false);
  }, [gameOver, drawOffer, game, setGameOver, setWinner, setGameStatus, setShowCheckmateDialog, setIsWhiteTimerActive, setIsBlackTimerActive]);

  const updateGameStatus = useCallback(() => {
    try {
      if (drawOffer) {
        const offeringPlayer = drawOffer === 'w' ? 'White' : 'Black';
        const respondingPlayer = drawOffer === 'w' ? 'Black' : 'White';
        setGameStatus(`${offeringPlayer} offered a draw. ${respondingPlayer} to respond.`);
        
        if ((drawOffer === 'w' && game.turn() === 'b') || (drawOffer === 'b' && game.turn() === 'w')) {
           const humanPlayerIsResponding =
             (playerMode === 'pvp') ||
             (playerMode === 'pvaWhite' && drawOffer === 'b') || 
             (playerMode === 'pvaBlack' && drawOffer === 'w'); 

           if (humanPlayerIsResponding) {
              setShowDrawOfferDialog(true);
           }
        }
        return;
      }

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
        setDrawType("Stalemate");
        setShowDrawGameDialog(true);
      } else if (game.isDraw()) { 
        setGameStatus("Draw!");
        setGameOver(true);
        setIsWhiteTimerActive(false);
        setIsBlackTimerActive(false);
        setWinner(null);
        if (game.isThreefoldRepetition()) setDrawType("Threefold Repetition");
        else if (game.isInsufficientMaterial()) setDrawType("Insufficient Material");
        else setDrawType("Automatic Draw (e.g., 50-move rule)");
        setShowDrawGameDialog(true);
      } else {
        setGameStatus(`${game.turn() === 'w' ? 'White' : 'Black'} to move${game.isCheck() ? ' (Check!)' : ''}.`);
        setGameOver(false);
        setWinner(null);
        setShowCheckmateDialog(false);
        setShowDrawGameDialog(false);
      }
    } catch (e) {
      console.error("Error updating game status:", e instanceof Error ? e.message : String(e));
      setGameStatus("Error evaluating game state. Game over.");
      setGameOver(true);
      setIsWhiteTimerActive(false);
      setIsBlackTimerActive(false);
      setWinner(null);
      setShowCheckmateDialog(false);
      setShowDrawGameDialog(false);
      setToastMessage({
        id: `gameStatusError-${Date.now()}`,
        title: "Game Error",
        description: "An unexpected error occurred while checking the game status.",
        variant: "destructive"
      });
    }
  }, [game, drawOffer, playerMode, setToastMessage]);

  const makeMove = useCallback((move: ShortMove | string) => {
    if (gameOver || drawOffer) {
      if (drawOffer) {
        setToastMessage({
          id: `drawOfferPending-${Date.now()}`,
          title: "Draw Offer Pending",
          description: "Please respond to the draw offer before making a move.",
          variant: "destructive"
        });
      } else {
         setToastMessage({
          id: `gameOverMoveAttempt-${Date.now()}`,
          title: "Game Over",
          description: "Cannot make moves, the game has ended.",
          variant: "destructive"
        });
      }
      return false;
    }

    const validationGame = new Chess(game.fen());
    let preValidationMoveResult;
    try {
        preValidationMoveResult = validationGame.move(move);
    } catch (e: unknown) {
      console.error("Error during chess.js pre-validation game.move:", e instanceof Error ? e.message : String(e));
      setToastMessage({
        id: `moveError-prevalidation-${Date.now()}`,
        title: "Move Error",
        description: "An unexpected error occurred while validating the move format.",
        variant: "destructive"
      });
      return false;
    }

    if (!preValidationMoveResult) {
      setToastMessage({
        id: `illegalMove-${Date.now()}`,
        title: "Illegal Move",
        description: "That move is not allowed.",
        variant: "destructive"
      });
      return false;
    }

    const pgn = game.pgn();
    const nextGameInstance = new Chess();
    if (pgn) {
      nextGameInstance.loadPgn(pgn); 
    }

    let moveResult;
    try {
      moveResult = nextGameInstance.move(move);
    } catch (e: unknown) {
      console.error("Error during chess.js game.move:", e instanceof Error ? e.message : String(e));
      setToastMessage({
        id: `moveError-${Date.now()}`,
        title: "Move Error",
        description: "An unexpected error occurred while making the move.",
        variant: "destructive"
      });
      return false;
    }

    if (!moveResult) {
        console.error("Error: Move was valid on temp instance but failed on PGN-loaded instance. FEN:", game.fen(), "Move:", move, "PGN:", pgn);
        setToastMessage({
            id: `internalMoveError-${Date.now()}`,
            title: "Internal Error",
            description: "Move failed unexpectedly after validation. Please reset or try again.",
            variant: "destructive"
        });
        return false;
    }
    
    setGame(nextGameInstance);
    setFen(nextGameInstance.fen());
    setMoveHistory(nextGameInstance.history());

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

    if (nextGameInstance.turn() === 'w') {
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
    drawOffer,
    HIGHLIGHT_LAST_MOVE_COLOR,
    setToastMessage, 
    setGame, 
    setFen, 
    setMoveHistory, 
    setLastMoveSquares, 
    setOptionSquares, 
    setMoveFrom, 
    setMoveTo, 
    setCapturedByWhite, 
    setCapturedByBlack, 
    setIsWhiteTimerActive, 
    setIsBlackTimerActive
  ]);
  
  const makeRandomMove = useCallback(() => {
    if (game.isGameOver() || gameOver || drawOffer) return;
    const possibleMoves = game.moves({ verbose: true });
    if (possibleMoves.length === 0) return;
    const randomIndex = Math.floor(Math.random() * possibleMoves.length);
    const randomMove = possibleMoves[randomIndex];
    makeMove({ from: randomMove.from, to: randomMove.to, promotion: randomMove.promotion });
  }, [game, makeMove, gameOver, drawOffer]);

  const resetGame = useCallback(() => {
    const newGame = new Chess();
    setGame(newGame);
    setFen(newGame.fen());
    setMoveHistory([]);
    setGameOver(false);

    setWhiteTime(initialTimeSetting);
    setBlackTime(initialTimeSetting);

    setMoveFrom('');
    setOptionSquares({});
    setLastMoveSquares({});
    setCheckSquare(null);
    setTimerResetKey(prev => prev + 1);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setShowCheckmateDialog(false);
    setWinner(null);
    setDrawOffer(null);
    setShowDrawOfferDialog(false);
    setShowDrawGameDialog(false);
    setDrawType(null);

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
  }, [playerMode, initialTimeSetting]);


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

  useEffect(() => {
    updateGameStatus();
  }, [fen, updateGameStatus, drawOffer]); 

  useEffect(() => {
    if (gameOver || drawOffer) return; 
    const isAITurn =
      (playerMode === 'pvaWhite' && game.turn() === 'b') ||
      (playerMode === 'pvaBlack' && game.turn() === 'w');

    if (isAITurn) {
      if (drawOffer && ((playerMode === 'pvaWhite' && drawOffer === 'w') || (playerMode === 'pvaBlack' && drawOffer === 'b'))) {
        const aiRejectTimeout = setTimeout(() => {
          handleRejectDraw(); 
        }, 1000); 
        return () => clearTimeout(aiRejectTimeout);
      } else {
        const timeoutId = setTimeout(() => {
          makeRandomMove();
        }, 500); 
        return () => clearTimeout(timeoutId);
      }
    }
  }, [fen, playerMode, game, makeRandomMove, gameOver, drawOffer, handleRejectDraw]); 
  
  useEffect(() => {
    resetGame();
  }, [playerMode, initialTimeSetting, resetGame]);

  useEffect(() => {
    if (game.isCheck()) {
      const kingColor = game.turn();
      const board = game.board();
      let foundKingSquare: Square | null = null;
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === kingColor) {
            foundKingSquare = (String.fromCharCode('a'.charCodeAt(0) + c) + (8 - r)) as Square;
            break;
          }
        }
        if (foundKingSquare) break;
      }
      setCheckSquare(foundKingSquare);
    } else {
      setCheckSquare(null);
    }
  }, [game]);


  const onPieceDrop = (sourceSquare: Square, targetSquare: Square, piece: Piece) => {
    if (gameOver || drawOffer) return false;

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
    if (gameOver || drawOffer) return;

    if ((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w')) {
      return;
    }

    if (!moveFrom) { 
      const pieceOnSquare = game.get(square);
      if (pieceOnSquare && pieceOnSquare.color === game.turn()) {
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

  const handleModeChange = (newMode: PlayerMode) => {
    setPlayerMode(newMode);
  };

  const handleTimerChange = (value: string) => {
    setInitialTimeSetting(parseInt(value, 10));
  };

  const canOfferDraw = !gameOver && !drawOffer &&
    (playerMode === 'pvp' ||
     (playerMode === 'pvaWhite' && game.turn() === 'w') ||
     (playerMode === 'pvaBlack' && game.turn() === 'b'));

  const canResign = !gameOver && !drawOffer &&
    (playerMode === 'pvp' ||
     (playerMode === 'pvaWhite' && game.turn() === 'w') ||
     (playerMode === 'pvaBlack' && game.turn() === 'b'));


  return (
    <div className="flex flex-col items-center p-4 space-y-4">
      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl flex flex-col sm:flex-row justify-between items-center space-y-2 sm:space-y-0 sm:space-x-2 flex-wrap gap-2">
        <Select value={playerMode} onValueChange={(value) => handleModeChange(value as PlayerMode)}>
          <SelectTrigger className="w-full sm:w-auto flex-grow sm:flex-grow-0 sm:min-w-[150px] bg-card">
            <SelectValue placeholder="Select mode" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pvp">Player vs Player</SelectItem>
            <SelectItem value="pvaWhite">Play as White (vs AI)</SelectItem>
            <SelectItem value="pvaBlack">Play as Black (vs AI)</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(initialTimeSetting)} onValueChange={handleTimerChange}>
          <SelectTrigger className="w-full sm:w-auto flex-grow sm:flex-grow-0 sm:min-w-[120px] bg-card">
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
        <Button onClick={resetGame} variant="outline" className="w-full sm:w-auto flex-grow sm:flex-grow-0">Reset Game</Button>
        {canOfferDraw && (
          <Button onClick={handleOfferDraw} variant="outline" className="w-full sm:w-auto flex-grow sm:flex-grow-0">
            <Handshake className="mr-2 h-4 w-4" /> Offer Draw
          </Button>
        )}
         {canResign && (
          <Button onClick={handleResign} variant="destructive" className="w-full sm:w-auto flex-grow sm:flex-grow-0">
            <Flag className="mr-2 h-4 w-4" /> Resign
          </Button>
        )}
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
            ...(checkSquare && {
              [checkSquare]: { backgroundColor: HIGHLIGHT_CHECK_COLOR },
            }),
          }}
          promotionDialogVariant="basic"
          arePiecesDraggable={!gameOver && !drawOffer && !((playerMode === 'pvaWhite' && game.turn() === 'b') || (playerMode === 'pvaBlack' && game.turn() === 'w'))}
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

      <div className="w-full max-w-md md:max-w-lg lg:max-w-xl mt-4">
        <Card>
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-lg text-center">Move History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <MoveHistoryDisplay history={moveHistory} />
          </CardContent>
        </Card>
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

      {showDrawOfferDialog && drawOffer && (
          <Dialog open={showDrawOfferDialog} onOpenChange={(open) => { if (!open && drawOffer) handleRejectDraw(); setShowDrawOfferDialog(open); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Draw Offer</DialogTitle>
                <DialogDescription>
                  {(drawOffer === 'w' ? 'White' : 'Black')} has offered a draw. Do you want to accept?
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="sm:justify-center pt-4 gap-2">
                <Button onClick={handleAcceptDraw} className="bg-primary hover:bg-primary/90 text-primary-foreground">Accept Draw</Button>
                <Button onClick={handleRejectDraw} variant="outline">Reject Draw</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )
      }

      {showDrawGameDialog && (
        <Dialog open={showDrawGameDialog} onOpenChange={setShowDrawGameDialog}>
          <DialogContent className="sm:max-w-md bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle className="text-3xl text-center font-bold text-primary">Game Drawn!</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center space-y-6 p-6">
              <Handshake className="w-24 h-24 text-muted-foreground mb-4" />
              <p className="text-xl font-semibold text-center">
                The game is a draw by {drawType || "mutual agreement"}.
              </p>
            </div>
            <DialogFooter className="sm:justify-center pt-4 gap-2">
              <Button type="button" onClick={() => { setShowDrawGameDialog(false); resetGame(); }} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                New Game
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowDrawGameDialog(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showCheckmateDialog && winner && (
        <Dialog open={showCheckmateDialog} onOpenChange={setShowCheckmateDialog}>
          <DialogContent className="sm:max-w-md bg-card text-card-foreground">
            <DialogHeader>
              <DialogTitle className="text-3xl text-center font-bold text-primary">
                {game.isCheckmate() ? "Checkmate!" : "Game Over!"}
              </DialogTitle>
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
