#!/usr/bin/env python3
"""
Fetch puzzles from database and convert to Chessground format
"""

import json
import sys
import os
from typing import List, Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def fetch_puzzles_by_opening(opening_name: str, variation: str = None, limit: int = 50) -> List[Dict[str, Any]]:
    """
    Fetch puzzles from database by opening name and optional variation
    
    Args:
        opening_name: The opening name (e.g., "Sicilian")
        variation: Optional variation name (e.g., "Old Sicilian")
        limit: Maximum number of puzzles to fetch
    
    Returns:
        List of puzzle dictionaries in Chessground format
    """
    try:
        import mysql.connector
        from mysql.connector import Error
    except ImportError:
        print("Error: mysql-connector-python not installed", file=sys.stderr)
        return []
    
    puzzles = []
    
    try:
        # Get database connection from environment
        db_url = os.getenv('DATABASE_URL')
        if not db_url:
            print("Error: DATABASE_URL not set", file=sys.stderr)
            return []
        
        # Parse connection string: mysql://user:password@host:port/database
        from urllib.parse import urlparse
        parsed = urlparse(db_url)
        
        connection = mysql.connector.connect(
            host=parsed.hostname,
            user=parsed.username,
            password=parsed.password,
            database=parsed.path.lstrip('/'),
            port=parsed.port or 3306
        )
        
        cursor = connection.cursor(dictionary=True)
        
        # Build query
        query = "SELECT id, fen, moves, rating, opening_name, variation FROM puzzles WHERE opening_name = %s"
        params = [opening_name]
        
        if variation:
            query += " AND variation LIKE %s"
            params.append(f"%{variation}%")
        
        query += f" ORDER BY RAND() LIMIT {limit}"
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Convert to Chessground format
        for row in rows:
            puzzle = {
                'id': row['id'],
                'fen': row['fen'],
                'moves': row['moves'].split() if isinstance(row['moves'], str) else row['moves'],
                'rating': row['rating'],
                'opening': row['opening_name'],
                'variation': row['variation'],
            }
            puzzles.append(puzzle)
        
        cursor.close()
        connection.close()
        
        return puzzles
        
    except Error as e:
        print(f"Error: {e}", file=sys.stderr)
        return []

def format_for_chessground(puzzle: Dict[str, Any]) -> Dict[str, Any]:
    """
    Format puzzle data for Chessground component
    
    Args:
        puzzle: Puzzle dictionary from database
    
    Returns:
        Formatted puzzle for Chessground
    """
    return {
        'id': puzzle['id'],
        'fen': puzzle['fen'],
        'moves': puzzle['moves'],
        'rating': puzzle['rating'],
        'opening': puzzle['opening'],
        'variation': puzzle['variation'],
    }

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python fetch-puzzles.py <opening_name> [variation] [limit]", file=sys.stderr)
        sys.exit(1)
    
    opening = sys.argv[1]
    variation = sys.argv[2] if len(sys.argv) > 2 else None
    limit = int(sys.argv[3]) if len(sys.argv) > 3 else 50
    
    puzzles = fetch_puzzles_by_opening(opening, variation, limit)
    formatted = [format_for_chessground(p) for p in puzzles]
    
    print(json.dumps(formatted, indent=2))
