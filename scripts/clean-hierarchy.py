#!/usr/bin/env python3
"""
Clean up redundant prefixes in hierarchy.json variation names.
Patterns to fix:
  "Game X" -> "X"
  "Declined OpeningWords Declined X" -> "X (Declined)"
  "Accepted OpeningWords Accepted X" -> "X (Accepted)"
  "Indian Defense OpeningWords X" -> "X"
  "Indian Attack OpeningWords X" -> "X"  
  "Indian OpeningWords Indian X" -> "X"
"""

import json
import re
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
HIERARCHY_PATH = os.path.join(SCRIPT_DIR, '..', 'client', 'public', 'hierarchy.json')

def clean_variation_name(variation_name, opening_name):
    """Remove redundant prefixes from variation names."""
    name = variation_name.strip()
    
    # Pattern 1: "Game X" -> "X"
    if name.startswith('Game '):
        name = name[5:].strip()
        return name if name else variation_name
    
    # Pattern 2: "Accepted ... Accepted X" -> "X (Accepted)"
    # e.g. "Accepted Queens Gambit Accepted Old Variation" -> "Old Variation (Accepted)"
    accepted_match = re.match(r'^Accepted\s+.+?\s+Accepted\s+(.+)$', name)
    if accepted_match:
        clean = accepted_match.group(1).strip()
        return f"{clean} (Accepted)" if clean else variation_name
    
    # Pattern 3: "Declined ... Declined X" -> "X (Declined)"
    # e.g. "Declined Queens Gambit Declined Marshall Defense" -> "Marshall Defense (Declined)"
    declined_match = re.match(r'^Declined\s+.+?\s+Declined\s+(.+)$', name)
    if declined_match:
        clean = declined_match.group(1).strip()
        return f"{clean} (Declined)" if clean else variation_name
    
    # Pattern 4: "Indian Defense ... Defense X" -> "X"
    # e.g. "Indian Defense Kings Indian Defense Normal Variation" -> "Normal Variation"
    indian_def_match = re.match(r'^Indian\s+Defense\s+.+?\s+Defense\s+(.+)$', name)
    if indian_def_match:
        clean = indian_def_match.group(1).strip()
        return clean if clean else variation_name
    
    # Pattern 5: "Indian Attack ... Attack X" -> "X"
    # e.g. "Indian Attack Kings Indian Attack Other variations" -> "Other variations"
    indian_atk_match = re.match(r'^Indian\s+Attack\s+.+?\s+Attack\s+(.+)$', name)
    if indian_atk_match:
        clean = indian_atk_match.group(1).strip()
        return clean if clean else variation_name
    
    # Pattern 6: "Indian ... Indian X" -> "X"
    # e.g. "Indian Slav Indian Other variations" -> "Other variations"
    indian_match = re.match(r'^Indian\s+.+?\s+Indian\s+(.+)$', name)
    if indian_match:
        clean = indian_match.group(1).strip()
        return clean if clean else variation_name
    
    # Pattern 7: Simple "Accepted X" or "Declined X" without repeated opening name
    # e.g. "Accepted Benko Gambit Accepted Fully Accepted Variation"
    # Already handled by patterns 2/3, but catch edge cases
    if name.startswith('Accepted '):
        # Try to find second "Accepted" 
        rest = name[9:]
        idx = rest.find(' Accepted ')
        if idx >= 0:
            clean = rest[idx + 10:].strip()
            return f"{clean} (Accepted)" if clean else variation_name
    
    if name.startswith('Declined '):
        rest = name[9:]
        idx = rest.find(' Declined ')
        if idx >= 0:
            clean = rest[idx + 10:].strip()
            return f"{clean} (Declined)" if clean else variation_name
    
    # Pattern 8: Simple single-word prefix that's a category
    # "Declined Variation" -> keep as is (it's a valid name like for Nimzowitsch Defence)
    # "Indian Variation" -> keep as is
    # "Indian Defense" -> keep as is (for Hungarian Opening)
    
    return name


def main():
    with open(HIERARCHY_PATH) as f:
        data = json.load(f)
    
    total_fixed = 0
    total_variations = 0
    
    for item in data:
        opening = item['opening']
        for v in item['variations']:
            total_variations += 1
            old_name = v['variation']
            new_name = clean_variation_name(old_name, opening)
            if new_name != old_name:
                total_fixed += 1
                v['variation'] = new_name
    
    # Write back
    with open(HIERARCHY_PATH, 'w') as f:
        json.dump(data, f, indent=2)
    
    print(f'[CleanHierarchy] Fixed {total_fixed} of {total_variations} variation names')
    
    # Show samples
    for item in data:
        if item['opening'] in ["Queen's Gambit", "King's Indian Defence", "Benko Gambit"]:
            print(f'\n=== {item["opening"]} ===')
            for v in item['variations'][:10]:
                print(f'  "{v["variation"]}"')


if __name__ == '__main__':
    main()
