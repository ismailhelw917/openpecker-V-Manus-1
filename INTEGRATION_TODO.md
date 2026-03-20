# Research Findings Integration TODO

## Phase 1: Integrate ChessMove tree into puzzle loading
- [ ] Create puzzle loading service that parses moves into ChessMove tree
- [ ] Add variation tree builder to routers.ts
- [ ] Create tRPC procedure to get puzzle with variations
- [ ] Test tree building with sample puzzles

## Phase 2: Connect Stockfish difficulty calculation
- [ ] Create Stockfish analysis service for puzzle evaluation
- [ ] Implement difficulty calculation from position evaluations
- [ ] Add batch analysis for multiple puzzles
- [ ] Create tRPC procedure to analyze puzzle difficulty

## Phase 3: Update Session.tsx UI
- [ ] Import and integrate PuzzleVariationTree component
- [ ] Add variation selection state management
- [ ] Display variations panel in session view
- [ ] Handle variation navigation and move selection
- [ ] Update move validation to work with selected variations

## Phase 4: Populate variations in database
- [ ] Create migration script to parse existing puzzle moves
- [ ] Build variation trees for all puzzles
- [ ] Store variations as JSON in database
- [ ] Update puzzle records with variation data

## Phase 5: Update puzzle queries
- [ ] Add difficulty-based filtering to puzzle queries
- [ ] Create queries to get puzzles by difficulty range
- [ ] Add sorting by difficulty to training set selection
- [ ] Implement variation count filtering

## Phase 6: End-to-end testing
- [ ] Test puzzle loading with variations
- [ ] Test variation navigation in session
- [ ] Test difficulty calculation accuracy
- [ ] Test database queries with filters
- [ ] Manual testing of complete workflow

## Phase 7: Final checkpoint
- [ ] Verify all systems working together
- [ ] Create comprehensive checkpoint
- [ ] Document changes and new features
