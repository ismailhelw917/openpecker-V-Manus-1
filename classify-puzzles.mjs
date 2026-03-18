import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { Chess } from "chess.js";

dotenv.config();

// ============================================================
// ECO Code → Opening Name mapping (comprehensive)
// ============================================================
const ECO_TO_OPENING = {
  // A: Flank Openings & Indian Systems
  A00: "Uncommon Opening",
  A01: "Nimzo-Larsen Attack",
  A02: "Birds Opening",
  A03: "Birds Opening",
  A04: "Reti Opening",
  A05: "Reti Opening",
  A06: "Reti Opening",
  A07: "Kings Indian Attack",
  A08: "Kings Indian Attack",
  A09: "Reti Opening",
  A10: "English Opening",
  A11: "English Opening",
  A12: "English Opening",
  A13: "English Opening",
  A14: "English Opening",
  A15: "English Opening",
  A16: "English Opening",
  A17: "English Opening",
  A18: "English Opening",
  A19: "English Opening",
  A20: "English Opening",
  A21: "English Opening",
  A22: "English Opening",
  A23: "English Opening",
  A24: "English Opening",
  A25: "English Opening",
  A26: "English Opening",
  A27: "English Opening",
  A28: "English Opening",
  A29: "English Opening",
  A30: "English Opening",
  A31: "English Opening",
  A32: "English Opening",
  A33: "English Opening",
  A34: "English Opening",
  A35: "English Opening",
  A36: "English Opening",
  A37: "English Opening",
  A38: "English Opening",
  A39: "English Opening",
  A40: "Queens Pawn Game",
  A41: "Queens Pawn Game",
  A42: "Modern Defense",
  A43: "Old Benoni Defense",
  A44: "Old Benoni Defense",
  A45: "Queens Pawn Game",
  A46: "Queens Pawn Game",
  A47: "Queens Indian Defense",
  A48: "London System",
  A49: "London System",
  A50: "Indian Defense",
  A51: "Budapest Gambit",
  A52: "Budapest Gambit",
  A53: "Old Indian Defense",
  A54: "Old Indian Defense",
  A55: "Old Indian Defense",
  A56: "Benoni Defense",
  A57: "Benko Gambit",
  A58: "Benko Gambit",
  A59: "Benko Gambit",
  A60: "Benoni Defense",
  A61: "Benoni Defense",
  A62: "Benoni Defense",
  A63: "Benoni Defense",
  A64: "Benoni Defense",
  A65: "Benoni Defense",
  A66: "Benoni Defense",
  A67: "Benoni Defense",
  A68: "Benoni Defense",
  A69: "Benoni Defense",
  A70: "Benoni Defense",
  A71: "Benoni Defense",
  A72: "Benoni Defense",
  A73: "Benoni Defense",
  A74: "Benoni Defense",
  A75: "Benoni Defense",
  A76: "Benoni Defense",
  A77: "Benoni Defense",
  A78: "Benoni Defense",
  A79: "Benoni Defense",
  A80: "Dutch Defense",
  A81: "Dutch Defense",
  A82: "Dutch Defense",
  A83: "Dutch Defense",
  A84: "Dutch Defense",
  A85: "Dutch Defense",
  A86: "Dutch Defense",
  A87: "Dutch Defense",
  A88: "Dutch Defense",
  A89: "Dutch Defense",
  A90: "Dutch Defense",
  A91: "Dutch Defense",
  A92: "Dutch Defense",
  A93: "Dutch Defense",
  A94: "Dutch Defense",
  A95: "Dutch Defense",
  A96: "Dutch Defense",
  A97: "Dutch Defense",
  A98: "Dutch Defense",
  A99: "Dutch Defense",

  // B: Semi-Open Games
  B00: "Kings Pawn Opening",
  B01: "Scandinavian Defense",
  B02: "Alekhines Defense",
  B03: "Alekhines Defense",
  B04: "Alekhines Defense",
  B05: "Alekhines Defense",
  B06: "Modern Defense",
  B07: "Pirc Defense",
  B08: "Pirc Defense",
  B09: "Pirc Defense",
  B10: "Caro-Kann Defense",
  B11: "Caro-Kann Defense",
  B12: "Caro-Kann Defense",
  B13: "Caro-Kann Defense",
  B14: "Caro-Kann Defense",
  B15: "Caro-Kann Defense",
  B16: "Caro-Kann Defense",
  B17: "Caro-Kann Defense",
  B18: "Caro-Kann Defense",
  B19: "Caro-Kann Defense",
  B20: "Sicilian Defense",
  B21: "Sicilian Defense",
  B22: "Sicilian Defense",
  B23: "Sicilian Defense",
  B24: "Sicilian Defense",
  B25: "Sicilian Defense",
  B26: "Sicilian Defense",
  B27: "Sicilian Defense",
  B28: "Sicilian Defense",
  B29: "Sicilian Defense",
  B30: "Sicilian Defense",
  B31: "Sicilian Defense",
  B32: "Sicilian Defense",
  B33: "Sicilian Defense",
  B34: "Sicilian Defense",
  B35: "Sicilian Defense",
  B36: "Sicilian Defense",
  B37: "Sicilian Defense",
  B38: "Sicilian Defense",
  B39: "Sicilian Defense",
  B40: "Sicilian Defense",
  B41: "Sicilian Defense",
  B42: "Sicilian Defense",
  B43: "Sicilian Defense",
  B44: "Sicilian Defense",
  B45: "Sicilian Defense",
  B46: "Sicilian Defense",
  B47: "Sicilian Defense",
  B48: "Sicilian Defense",
  B49: "Sicilian Defense",
  B50: "Sicilian Defense",
  B51: "Sicilian Defense",
  B52: "Sicilian Defense",
  B53: "Sicilian Defense",
  B54: "Sicilian Defense",
  B55: "Sicilian Defense",
  B56: "Sicilian Defense",
  B57: "Sicilian Defense",
  B58: "Sicilian Defense",
  B59: "Sicilian Defense",
  B60: "Sicilian Defense",
  B61: "Sicilian Defense",
  B62: "Sicilian Defense",
  B63: "Sicilian Defense",
  B64: "Sicilian Defense",
  B65: "Sicilian Defense",
  B66: "Sicilian Defense",
  B67: "Sicilian Defense",
  B68: "Sicilian Defense",
  B69: "Sicilian Defense",
  B70: "Sicilian Defense",
  B71: "Sicilian Defense",
  B72: "Sicilian Defense",
  B73: "Sicilian Defense",
  B74: "Sicilian Defense",
  B75: "Sicilian Defense",
  B76: "Sicilian Defense",
  B77: "Sicilian Defense",
  B78: "Sicilian Defense",
  B79: "Sicilian Defense",
  B80: "Sicilian Defense",
  B81: "Sicilian Defense",
  B82: "Sicilian Defense",
  B83: "Sicilian Defense",
  B84: "Sicilian Defense",
  B85: "Sicilian Defense",
  B86: "Sicilian Defense",
  B87: "Sicilian Defense",
  B88: "Sicilian Defense",
  B89: "Sicilian Defense",
  B90: "Sicilian Defense",
  B91: "Sicilian Defense",
  B92: "Sicilian Defense",
  B93: "Sicilian Defense",
  B94: "Sicilian Defense",
  B95: "Sicilian Defense",
  B96: "Sicilian Defense",
  B97: "Sicilian Defense",
  B98: "Sicilian Defense",
  B99: "Sicilian Defense",

  // C: Open Games & French
  C00: "French Defense",
  C01: "French Defense",
  C02: "French Defense",
  C03: "French Defense",
  C04: "French Defense",
  C05: "French Defense",
  C06: "French Defense",
  C07: "French Defense",
  C08: "French Defense",
  C09: "French Defense",
  C10: "French Defense",
  C11: "French Defense",
  C12: "French Defense",
  C13: "French Defense",
  C14: "French Defense",
  C15: "French Defense",
  C16: "French Defense",
  C17: "French Defense",
  C18: "French Defense",
  C19: "French Defense",
  C20: "Kings Pawn Opening",
  C21: "Center Game",
  C22: "Center Game",
  C23: "Bishops Opening",
  C24: "Bishops Opening",
  C25: "Vienna Game",
  C26: "Vienna Game",
  C27: "Vienna Game",
  C28: "Vienna Game",
  C29: "Vienna Game",
  C30: "Kings Gambit Declined",
  C31: "Kings Gambit Declined",
  C32: "Kings Gambit Declined",
  C33: "Kings Gambit Accepted",
  C34: "Kings Gambit Accepted",
  C35: "Kings Gambit Accepted",
  C36: "Kings Gambit Accepted",
  C37: "Kings Gambit Accepted",
  C38: "Kings Gambit Accepted",
  C39: "Kings Gambit Accepted",
  C40: "Kings Knight Opening",
  C41: "Philidor Defense",
  C42: "Petrov Defense",
  C43: "Petrov Defense",
  C44: "Scotch Game",
  C45: "Scotch Game",
  C46: "Three Knights Game",
  C47: "Four Knights Game",
  C48: "Four Knights Game",
  C49: "Four Knights Game",
  C50: "Italian Game",
  C51: "Evans Gambit",
  C52: "Evans Gambit",
  C53: "Italian Game",
  C54: "Italian Game",
  C55: "Italian Game",
  C56: "Italian Game",
  C57: "Italian Game",
  C58: "Italian Game",
  C59: "Italian Game",
  C60: "Ruy Lopez",
  C61: "Ruy Lopez",
  C62: "Ruy Lopez",
  C63: "Ruy Lopez",
  C64: "Ruy Lopez",
  C65: "Ruy Lopez",
  C66: "Ruy Lopez",
  C67: "Ruy Lopez",
  C68: "Ruy Lopez",
  C69: "Ruy Lopez",
  C70: "Ruy Lopez",
  C71: "Ruy Lopez",
  C72: "Ruy Lopez",
  C73: "Ruy Lopez",
  C74: "Ruy Lopez",
  C75: "Ruy Lopez",
  C76: "Ruy Lopez",
  C77: "Ruy Lopez",
  C78: "Ruy Lopez",
  C79: "Ruy Lopez",
  C80: "Ruy Lopez",
  C81: "Ruy Lopez",
  C82: "Ruy Lopez",
  C83: "Ruy Lopez",
  C84: "Ruy Lopez",
  C85: "Ruy Lopez",
  C86: "Ruy Lopez",
  C87: "Ruy Lopez",
  C88: "Ruy Lopez",
  C89: "Ruy Lopez",
  C90: "Ruy Lopez",
  C91: "Ruy Lopez",
  C92: "Ruy Lopez",
  C93: "Ruy Lopez",
  C94: "Ruy Lopez",
  C95: "Ruy Lopez",
  C96: "Ruy Lopez",
  C97: "Ruy Lopez",
  C98: "Ruy Lopez",
  C99: "Ruy Lopez",

  // D: Closed Games & Queen's Gambit
  D00: "Queens Pawn Game",
  D01: "Richter-Veresov Attack",
  D02: "Queens Pawn Game",
  D03: "Torre Attack",
  D04: "Queens Pawn Game",
  D05: "Colle System",
  D06: "Queens Gambit",
  D07: "Queens Gambit",
  D08: "Queens Gambit",
  D09: "Queens Gambit",
  D10: "Queens Gambit Declined",
  D11: "Queens Gambit Declined",
  D12: "Queens Gambit Declined",
  D13: "Queens Gambit Declined",
  D14: "Queens Gambit Declined",
  D15: "Queens Gambit Declined",
  D16: "Queens Gambit Declined",
  D17: "Queens Gambit Declined",
  D18: "Queens Gambit Declined",
  D19: "Queens Gambit Declined",
  D20: "Queens Gambit Accepted",
  D21: "Queens Gambit Accepted",
  D22: "Queens Gambit Accepted",
  D23: "Queens Gambit Accepted",
  D24: "Queens Gambit Accepted",
  D25: "Queens Gambit Accepted",
  D26: "Queens Gambit Accepted",
  D27: "Queens Gambit Accepted",
  D28: "Queens Gambit Accepted",
  D29: "Queens Gambit Accepted",
  D30: "Queens Gambit Declined",
  D31: "Queens Gambit Declined",
  D32: "Queens Gambit Declined",
  D33: "Queens Gambit Declined",
  D34: "Queens Gambit Declined",
  D35: "Queens Gambit Declined",
  D36: "Queens Gambit Declined",
  D37: "Queens Gambit Declined",
  D38: "Queens Gambit Declined",
  D39: "Queens Gambit Declined",
  D40: "Queens Gambit Declined",
  D41: "Queens Gambit Declined",
  D42: "Queens Gambit Declined",
  D43: "Queens Gambit Declined",
  D44: "Queens Gambit Declined",
  D45: "Queens Gambit Declined",
  D46: "Queens Gambit Declined",
  D47: "Queens Gambit Declined",
  D48: "Queens Gambit Declined",
  D49: "Queens Gambit Declined",
  D50: "Queens Gambit Declined",
  D51: "Queens Gambit Declined",
  D52: "Queens Gambit Declined",
  D53: "Queens Gambit Declined",
  D54: "Queens Gambit Declined",
  D55: "Queens Gambit Declined",
  D56: "Queens Gambit Declined",
  D57: "Queens Gambit Declined",
  D58: "Queens Gambit Declined",
  D59: "Queens Gambit Declined",
  D60: "Queens Gambit Declined",
  D61: "Queens Gambit Declined",
  D62: "Queens Gambit Declined",
  D63: "Queens Gambit Declined",
  D64: "Queens Gambit Declined",
  D65: "Queens Gambit Declined",
  D66: "Queens Gambit Declined",
  D67: "Queens Gambit Declined",
  D68: "Queens Gambit Declined",
  D69: "Queens Gambit Declined",
  D70: "Grunfeld Defense",
  D71: "Grunfeld Defense",
  D72: "Grunfeld Defense",
  D73: "Grunfeld Defense",
  D74: "Grunfeld Defense",
  D75: "Grunfeld Defense",
  D76: "Grunfeld Defense",
  D77: "Grunfeld Defense",
  D78: "Grunfeld Defense",
  D79: "Grunfeld Defense",
  D80: "Grunfeld Defense",
  D81: "Grunfeld Defense",
  D82: "Grunfeld Defense",
  D83: "Grunfeld Defense",
  D84: "Grunfeld Defense",
  D85: "Grunfeld Defense",
  D86: "Grunfeld Defense",
  D87: "Grunfeld Defense",
  D88: "Grunfeld Defense",
  D89: "Grunfeld Defense",
  D90: "Grunfeld Defense",
  D91: "Grunfeld Defense",
  D92: "Grunfeld Defense",
  D93: "Grunfeld Defense",
  D94: "Grunfeld Defense",
  D95: "Grunfeld Defense",
  D96: "Grunfeld Defense",
  D97: "Grunfeld Defense",
  D98: "Grunfeld Defense",
  D99: "Grunfeld Defense",

  // E: Indian Defenses
  E00: "Catalan Opening",
  E01: "Catalan Opening",
  E02: "Catalan Opening",
  E03: "Catalan Opening",
  E04: "Catalan Opening",
  E05: "Catalan Opening",
  E06: "Catalan Opening",
  E07: "Catalan Opening",
  E08: "Catalan Opening",
  E09: "Catalan Opening",
  E10: "Queens Pawn Game",
  E11: "Bogo-Indian Defense",
  E12: "Queens Indian Defense",
  E13: "Queens Indian Defense",
  E14: "Queens Indian Defense",
  E15: "Queens Indian Defense",
  E16: "Queens Indian Defense",
  E17: "Queens Indian Defense",
  E18: "Queens Indian Defense",
  E19: "Queens Indian Defense",
  E20: "Nimzo-Indian Defense",
  E21: "Nimzo-Indian Defense",
  E22: "Nimzo-Indian Defense",
  E23: "Nimzo-Indian Defense",
  E24: "Nimzo-Indian Defense",
  E25: "Nimzo-Indian Defense",
  E26: "Nimzo-Indian Defense",
  E27: "Nimzo-Indian Defense",
  E28: "Nimzo-Indian Defense",
  E29: "Nimzo-Indian Defense",
  E30: "Nimzo-Indian Defense",
  E31: "Nimzo-Indian Defense",
  E32: "Nimzo-Indian Defense",
  E33: "Nimzo-Indian Defense",
  E34: "Nimzo-Indian Defense",
  E35: "Nimzo-Indian Defense",
  E36: "Nimzo-Indian Defense",
  E37: "Nimzo-Indian Defense",
  E38: "Nimzo-Indian Defense",
  E39: "Nimzo-Indian Defense",
  E40: "Nimzo-Indian Defense",
  E41: "Nimzo-Indian Defense",
  E42: "Nimzo-Indian Defense",
  E43: "Nimzo-Indian Defense",
  E44: "Nimzo-Indian Defense",
  E45: "Nimzo-Indian Defense",
  E46: "Nimzo-Indian Defense",
  E47: "Nimzo-Indian Defense",
  E48: "Nimzo-Indian Defense",
  E49: "Nimzo-Indian Defense",
  E50: "Nimzo-Indian Defense",
  E51: "Nimzo-Indian Defense",
  E52: "Nimzo-Indian Defense",
  E53: "Nimzo-Indian Defense",
  E54: "Nimzo-Indian Defense",
  E55: "Nimzo-Indian Defense",
  E56: "Nimzo-Indian Defense",
  E57: "Nimzo-Indian Defense",
  E58: "Nimzo-Indian Defense",
  E59: "Nimzo-Indian Defense",
  E60: "Kings Indian Defense",
  E61: "Kings Indian Defense",
  E62: "Kings Indian Defense",
  E63: "Kings Indian Defense",
  E64: "Kings Indian Defense",
  E65: "Kings Indian Defense",
  E66: "Kings Indian Defense",
  E67: "Kings Indian Defense",
  E68: "Kings Indian Defense",
  E69: "Kings Indian Defense",
  E70: "Kings Indian Defense",
  E71: "Kings Indian Defense",
  E72: "Kings Indian Defense",
  E73: "Kings Indian Defense",
  E74: "Kings Indian Defense",
  E75: "Kings Indian Defense",
  E76: "Kings Indian Defense",
  E77: "Kings Indian Defense",
  E78: "Kings Indian Defense",
  E79: "Kings Indian Defense",
  E80: "Kings Indian Defense",
  E81: "Kings Indian Defense",
  E82: "Kings Indian Defense",
  E83: "Kings Indian Defense",
  E84: "Kings Indian Defense",
  E85: "Kings Indian Defense",
  E86: "Kings Indian Defense",
  E87: "Kings Indian Defense",
  E88: "Kings Indian Defense",
  E89: "Kings Indian Defense",
  E90: "Kings Indian Defense",
  E91: "Kings Indian Defense",
  E92: "Kings Indian Defense",
  E93: "Kings Indian Defense",
  E94: "Kings Indian Defense",
  E95: "Kings Indian Defense",
  E96: "Kings Indian Defense",
  E97: "Kings Indian Defense",
  E98: "Kings Indian Defense",
  E99: "Kings Indian Defense",
};

// ============================================================
// FEN-based opening detection using move sequence analysis
// We reverse-engineer the opening from the puzzle FEN by checking
// piece placement patterns characteristic of specific openings
// ============================================================

function classifyByFEN(fen) {
  const parts = fen.split(" ");
  const position = parts[0];
  const rows = position.split("/");
  
  // Get piece positions
  const expandRow = (row) => {
    let result = "";
    for (const ch of row) {
      if (ch >= "1" && ch <= "8") {
        result += ".".repeat(parseInt(ch));
      } else {
        result += ch;
      }
    }
    return result;
  };
  
  const board = rows.map(expandRow);
  // board[0] = rank 8, board[7] = rank 1
  
  const getPiece = (file, rank) => {
    // file: 0-7 (a-h), rank: 1-8
    const row = 8 - rank;
    if (row < 0 || row > 7 || file < 0 || file > 7) return ".";
    return board[row][file];
  };
  
  // Check key squares for opening identification
  // e4 = file 4, rank 4
  const e4 = getPiece(4, 4); // white pawn on e4?
  const d4 = getPiece(3, 4); // white pawn on d4?
  const c4 = getPiece(2, 4); // white pawn on c4?
  const e5 = getPiece(4, 5); // black pawn on e5?
  const d5 = getPiece(3, 5); // black pawn on d5?
  const c5 = getPiece(2, 5); // black pawn on c5?
  const e6 = getPiece(4, 6); // black pawn on e6?
  const d6 = getPiece(3, 6); // black pawn on d6?
  const c6 = getPiece(2, 6); // black pawn on c6?
  const f5 = getPiece(5, 5); // black pawn on f5?
  const g6 = getPiece(6, 6); // black pawn on g6?
  const b5 = getPiece(1, 5); // black pawn on b5?
  const f4 = getPiece(5, 4); // white pawn on f4?
  const b4 = getPiece(1, 4); // white pawn on b4?
  const g3 = getPiece(6, 3); // white pawn on g3?
  const nf3 = getPiece(5, 3); // white knight on f3?
  const nf6 = getPiece(5, 6); // black knight on f6?
  const nc3 = getPiece(2, 3); // white knight on c3?
  const nc6 = getPiece(2, 6); // black knight on c6?
  const bb4 = getPiece(1, 4); // black bishop on b4?
  const bg7 = getPiece(6, 7); // black bishop on g7?
  const bf1 = getPiece(5, 1); // white bishop still on f1?
  const bc4_piece = getPiece(2, 4); // piece on c4?
  const bb5_piece = getPiece(1, 5); // piece on b5?
  
  // Count material to gauge game phase
  let whitePawns = 0, blackPawns = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const p = board[r][f];
      if (p === "P") whitePawns++;
      if (p === "p") blackPawns++;
    }
  }
  
  // If very few pawns, it's likely an endgame puzzle - classify as "Endgame"
  if (whitePawns + blackPawns <= 6) {
    return "Endgame Tactics";
  }
  
  // ---- e4 openings ----
  if (e4 === "P") {
    // Sicilian: e4 + c5
    if (c5 === "p") return "Sicilian Defense";
    // French: e4 + e6 (no e5)
    if (e6 === "p" && e5 !== "p" && d5 === "p") return "French Defense";
    if (e6 === "p" && e5 !== "p") return "French Defense";
    // Caro-Kann: e4 + c6
    if (c6 === "p" && d5 === "p") return "Caro-Kann Defense";
    if (c6 === "p" && e5 !== "p") return "Caro-Kann Defense";
    // Scandinavian: e4 + d5 (no c6, no e6)
    if (d5 === "p" && c6 !== "p" && e6 !== "p") return "Scandinavian Defense";
    // Pirc/Modern: e4 + d6 + g6
    if (d6 === "p" && g6 === "p") return "Pirc Defense";
    if (d6 === "p" && e5 !== "p") return "Pirc Defense";
    // Modern: e4 + g6 (no d6, no e5)
    if (g6 === "p" && e5 !== "p" && d6 !== "p") return "Modern Defense";
    // Alekhine: e4 + Nf6 (no e5, no d5)
    if (nf6 === "n" && e5 !== "p" && d5 !== "p" && d6 !== "p" && c5 !== "p" && c6 !== "p" && e6 !== "p") return "Alekhines Defense";
    
    // e4 e5 openings
    if (e5 === "p") {
      // Ruy Lopez: e4 e5 + Bb5
      if (bb5_piece === "B") return "Ruy Lopez";
      // Italian: e4 e5 + Bc4
      if (bc4_piece === "B" && b4 !== "P") return "Italian Game";
      // Evans Gambit: e4 e5 + Bc4 + b4
      if (bc4_piece === "B" && b4 === "P") return "Evans Gambit";
      // Scotch: e4 e5 d4
      if (d4 === "P") return "Scotch Game";
      // Kings Gambit: e4 e5 f4
      if (f4 === "P") return "Kings Gambit Accepted";
      // Petrov: e4 e5 Nf3 Nf6
      if (nf3 === "N" && nf6 === "n" && nc6 !== "n") return "Petrov Defense";
      // Philidor: e4 e5 + d6
      if (d6 === "p") return "Philidor Defense";
      // Four Knights
      if (nf3 === "N" && nf6 === "n" && nc3 === "N" && nc6 === "n") return "Four Knights Game";
      // Vienna: e4 e5 Nc3
      if (nc3 === "N" && nf3 !== "N") return "Vienna Game";
      // Default e4 e5
      return "Kings Pawn Opening";
    }
    
    // Default e4
    return "Kings Pawn Opening";
  }
  
  // ---- d4 openings ----
  if (d4 === "P") {
    // Kings Indian: d4 + Nf6 + g6 + Bg7
    if (nf6 === "n" && g6 === "p" && bg7 === "b") return "Kings Indian Defense";
    if (nf6 === "n" && g6 === "p") return "Kings Indian Defense";
    
    // Grunfeld: d4 + Nf6 + d5 + c4 + g6
    if (nf6 === "n" && d5 === "p" && c4 === "P" && g6 === "p") return "Grunfeld Defense";
    
    // Queens Gambit Declined: d4 + d5 + c4 + e6
    if (d5 === "p" && c4 === "P" && e6 === "p") return "Queens Gambit Declined";
    
    // Queens Gambit Accepted: d4 + c4 taken (no d5)
    if (c4 !== "P" && d5 !== "p" && getPiece(2, 5) === "p") return "Queens Gambit Accepted";
    
    // Slav: d4 + d5 + c4 + c6
    if (d5 === "p" && c4 === "P" && c6 === "p") return "Slav Defense";
    
    // Queens Gambit: d4 + d5 + c4
    if (d5 === "p" && c4 === "P") return "Queens Gambit";
    
    // Nimzo-Indian: d4 + Nf6 + c4 + e6 + Bb4
    if (nf6 === "n" && c4 === "P" && e6 === "p" && bb4 === "b") return "Nimzo-Indian Defense";
    
    // Queens Indian: d4 + Nf6 + c4 + e6 + b6
    if (nf6 === "n" && c4 === "P" && e6 === "p") return "Queens Indian Defense";
    
    // Benoni: d4 + c5 + d5
    if (c5 === "p" && d5 === "P") return "Benoni Defense";
    
    // Dutch: d4 + f5
    if (f5 === "p") return "Dutch Defense";
    
    // London System: d4 + Bf4 pattern
    if (getPiece(5, 4) === "B") return "London System";
    
    // Old Indian: d4 + Nf6 + d6
    if (nf6 === "n" && d6 === "p") return "Old Indian Defense";
    
    // d4 d5
    if (d5 === "p") return "Queens Pawn Game";
    
    // d4 Nf6
    if (nf6 === "n") return "Indian Defense";
    
    return "Queens Pawn Game";
  }
  
  // ---- c4 openings (English) ----
  if (c4 === "P" && e4 !== "P" && d4 !== "P") {
    return "English Opening";
  }
  
  // ---- Nf3 openings (Reti) ----
  if (nf3 === "N" && e4 !== "P" && d4 !== "P" && c4 !== "P") {
    return "Reti Opening";
  }
  
  // ---- f4 (Bird's) ----
  if (f4 === "P" && e4 !== "P" && d4 !== "P") {
    return "Birds Opening";
  }
  
  // ---- b3 (Nimzo-Larsen) ----
  if (getPiece(1, 3) === "P" && e4 !== "P" && d4 !== "P") {
    return "Nimzo-Larsen Attack";
  }
  
  // ---- g3 (Kings Indian Attack) ----
  if (g3 === "P" && e4 !== "P" && d4 !== "P") {
    return "Kings Indian Attack";
  }
  
  // Default: classify by material/position
  return "Miscellaneous Opening";
}

// ============================================================
// Main classification logic
// ============================================================
async function classifyPuzzles() {
  const conn = await mysql.createConnection(process.env.DATABASE_URL);
  
  console.log("=== Puzzle Classification Script ===\n");
  
  // Step 1: ECO-based classification
  console.log("Step 1: ECO-based classification...");
  let ecoUpdated = 0;
  
  for (const [eco, openingName] of Object.entries(ECO_TO_OPENING)) {
    const [result] = await conn.execute(
      `UPDATE puzzles SET openingName = ? WHERE ecoCode = ? AND (openingName IS NULL OR openingName = '' OR openingName IN ('Beginner Openings', 'Intermediate Openings', 'Advanced Openings', 'Expert Openings'))`,
      [openingName, eco]
    );
    if (result.affectedRows > 0) {
      ecoUpdated += result.affectedRows;
      console.log(`  ECO ${eco} → ${openingName}: ${result.affectedRows} puzzles updated`);
    }
  }
  console.log(`\nECO classification complete: ${ecoUpdated} puzzles updated\n`);
  
  // Step 2: FEN-based classification for remaining puzzles
  console.log("Step 2: FEN-based classification...");
  
  const BATCH_SIZE = 5000;
  let totalProcessed = 0;
  let totalUpdated = 0;
  let hasMore = true;
  const stats = {};
  
  while (hasMore) {
    // Fetch a batch of unclassified puzzles
    const [rows] = await conn.execute(
      `SELECT id, fen FROM puzzles WHERE openingName IS NULL OR openingName = '' OR openingName IN ('Beginner Openings', 'Intermediate Openings', 'Advanced Openings', 'Expert Openings') LIMIT ${BATCH_SIZE}`
    );
    
    if (rows.length === 0) {
      hasMore = false;
      break;
    }
    
    // Classify each puzzle
    const updates = {};
    for (const row of rows) {
      const opening = classifyByFEN(row.fen);
      if (!updates[opening]) updates[opening] = [];
      updates[opening].push(row.id);
      stats[opening] = (stats[opening] || 0) + 1;
    }
    
    // Batch update by opening name
    for (const [opening, ids] of Object.entries(updates)) {
      // Update in chunks of 500 IDs to avoid query size limits
      for (let i = 0; i < ids.length; i += 500) {
        const chunk = ids.slice(i, i + 500);
        const placeholders = chunk.map(() => "?").join(",");
        const [result] = await conn.execute(
          `UPDATE puzzles SET openingName = ? WHERE id IN (${placeholders})`,
          [opening, ...chunk]
        );
        totalUpdated += result.affectedRows;
      }
    }
    
    totalProcessed += rows.length;
    
    if (totalProcessed % 50000 === 0 || rows.length < BATCH_SIZE) {
      console.log(`  Processed: ${totalProcessed.toLocaleString()} | Updated: ${totalUpdated.toLocaleString()}`);
    }
    
    if (rows.length < BATCH_SIZE) {
      hasMore = false;
    }
  }
  
  console.log(`\nFEN classification complete: ${totalUpdated} puzzles updated\n`);
  
  // Print stats
  console.log("=== Classification Results ===");
  const sortedStats = Object.entries(stats).sort((a, b) => b[1] - a[1]);
  for (const [opening, count] of sortedStats) {
    console.log(`  ${opening}: ${count.toLocaleString()}`);
  }
  
  // Final verification
  const [remaining] = await conn.execute(
    `SELECT COUNT(*) as cnt FROM puzzles WHERE openingName IS NULL OR openingName = ''`
  );
  console.log(`\nRemaining unclassified: ${remaining[0].cnt}`);
  
  const [total] = await conn.execute(
    `SELECT openingName, COUNT(*) as cnt FROM puzzles GROUP BY openingName ORDER BY cnt DESC LIMIT 20`
  );
  console.log("\n=== Top 20 Opening Categories ===");
  for (const row of total) {
    console.log(`  ${row.openingName || "(NULL)"}: ${parseInt(row.cnt).toLocaleString()}`);
  }
  
  await conn.end();
  console.log("\nDone!");
}

classifyPuzzles().catch((error) => {
  console.error("Classification failed:", error);
  process.exit(1);
});
