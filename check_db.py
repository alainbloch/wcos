#!/usr/bin/env python3
import os, re

path = '/Users/alainbloch/work/wcos/vead-sg-host-com-20260717-212140-46b630uwyn2b.wpress'
with open(path, 'rb') as f:
    data = f.read()

# Find the database.sql entry
pos = 0
HEADER_SIZE = 4377
while pos + HEADER_SIZE <= len(data):
    header = data[pos:pos+HEADER_SIZE]
    if header == b'\x00' * HEADER_SIZE:
        break
    null_pos = header.find(b'\x00')
    name = header[:null_pos].decode('utf-8', errors='replace') if null_pos >= 0 else ''
    if name == 'database.sql':
        sz_raw = header[255:269]
        size = int(sz_raw[:sz_raw.find(b'\x00')].decode('ascii'))
        sql_data = data[pos+HEADER_SIZE:pos+HEADER_SIZE+size]
        content = sql_data.decode('utf-8')
        lines = content.split('\n')
        
        print('=== Tables in database ===')
        tables = []
        for line in lines:
            m = re.search(r'CREATE TABLE.*?`(SERVMASK_PREFIX_\w+)`', line)
            if m:
                tables.append(m.group(1))
                print(f'  {m.group(1)}')
        print(f'\nTotal tables: {len(tables)}')
        
        # Check specific tables that often cause import issues
        print('\n=== Checking specific content ===')
        
        # Check wp_options for serialized data issues
        options_found = False
        for i, line in enumerate(lines):
            if 'SERVMASK_PREFIX_options' in line and line.startswith('INSERT'):
                options_found = True
                # Check if it's a multi-value insert
                if i < 5:  # Just show first few
                    pass
        print(f'  Options table found: {options_found}')
        
        # Check for options table entries count
        options_count = 0
        for line in lines:
            if 'INSERT INTO `SERVMASK_PREFIX_options`' in line:
                # Count the values by counting parens
                options_count += line.count('(')
        print(f'  Options table rows: ~{options_count}')
        
        # Check for very long INSERT lines (potential serialized data truncation)
        print('\n=== Longest INSERT lines ===')
        long_ins = []
        for i, line in enumerate(lines):
            if line.startswith('INSERT') and len(line) > 50000:
                long_ins.append((i+1, len(line)))
        long_ins.sort(key=lambda x: -x[1])
        for ln, llen in long_ins[:10]:
            print(f'  Line {ln}: {llen} chars')
        
        # Check for potential serialized data corruption
        print('\n=== Serialized data check ===')
        # In PHP serialized data, the format is a:N:{...} or s:N:"...", O:N:"..."
        # If the string length doesn't match, PHP will fail to unserialize
        # This is a common issue when find/replace changes URLs but not the string lengths
        import re as re2
        # Count serialized strings
        s_ser = re2.findall(r's:(\d+):"', content)
        if s_ser:
            print(f'  Serialized strings found: {len(s_ser)}')
            # Check for the most common issue - URL replacement without updating serialized lengths
            # Look for site URLs that might have been changed
            urls = set(re2.findall(r'https?://[^"\'\\,; )]+', content))
            wp_urls = [u for u in urls if 'vead.sg-host.com' in u or 'wordpress' in u]
            print(f'  URLs found in SQL: {len(wp_urls)}')
            for u in wp_urls[:10]:
                print(f'    {u}')
        
        # Check for potential timeout issues
        print('\n=== Import safety check ===')
        print(f'  Total SQL size: {size/1024/1024:.1f} MB')
        print(f'  Lines: {len(lines)}')
        print(f'  Average line length: {size/len(lines):.0f} chars')
        
        # Check the max_allowed_packet concern
        max_line = max(len(l) for l in lines)
        print(f'  Longest line: {max_line} chars (~{max_line/1024/1024:.1f} MB)')
        print(f'  Lines > 16MB: {sum(1 for l in lines if len(l) > 16*1024*1024)}')
        print(f'  Lines > 1MB: {sum(1 for l in lines if len(l) > 1024*1024)}')
        print(f'  Lines > 128KB: {sum(1 for l in lines if len(l) > 128*1024)}')
        
        break
    sz_raw = header[255:269]
    sz_str = sz_raw[:sz_raw.find(b'\x00')].decode('ascii', errors='replace')
    if sz_str:
        size = int(sz_str)
        pos += HEADER_SIZE + size
    else:
        break