#!/usr/bin/env python3
import os, re

path = '/Users/alainbloch/work/wcos/vead-sg-host-com-20260717-212140-46b630uwyn2b.wpress'
with open(path, 'rb') as f:
    data = f.read()

HEADER_SIZE = 4377

pos = 0
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
        
        # Find specific options by simple string search
        key_opts = ['siteurl', 'home', 'blogname', 'admin_email', 'template', 'stylesheet', 'active_plugins', 'db_version', 'upload_path', 'current_theme']
        for opt in key_opts:
            pattern = f"'{opt}','"
            idx = content.find(pattern)
            if idx >= 0:
                # Found the option, extract the value
                start = idx + len(pattern)
                # Find the end of the value (next '',' sequence)
                end = content.find("','", start)
                if end >= 0:
                    val = content[start:end]
                    if len(val) > 300:
                        print(f'{opt} = {val[:300]}...')
                    else:
                        print(f'{opt} = {val}')
        
        # Check serialized data with escaped quotes
        print('\n=== Serialized data check (with escaped quotes) ===')
        # The PHP serialized data in the SQL uses \\\" for quotes
        # Find patterns like s:5:\\\"hello\\\"
        ser_pattern = r's:(\d+):\\\\"([^\\\\]*?)\\\\"'
        serials = re.findall(ser_pattern, content)
        mismatches = 0
        for length_str, value in serials:
            declared_len = int(length_str)
            actual_len = len(value)
            if actual_len != declared_len:
                mismatches += 1
                if mismatches <= 10:
                    print(f'  MISMATCH: declared s:{declared_len}, actual {actual_len} chars')
                    truncated = value[:100] if len(value) > 100 else value
                    print(f'    Value: {truncated}')
        
        if mismatches == 0:
            print(f'  No serialization mismatches found in {len(serials)} serialized strings')
        else:
            print(f'  Total mismatches: {mismatches}')
        
        # Check for any obvious SQL issues
        print('\n=== SQL syntax check ===')
        lines = content.split('\n')
        for i, line in enumerate(lines):
            stripped = line.strip()
            # Check for unclosed parentheses in INSERT statements
            if stripped.startswith('INSERT') and not stripped.endswith(';'):
                print(f'  Line {i+1}: INSERT without semicolon ({len(stripped)} chars)')
            # Check for DROP TABLE that might fail
            if stripped.startswith('DROP TABLE') and not stripped.endswith(';'):
                print(f'  Line {i+1}: DROP without semicolon')
        
        print(f'  Total lines: {len(lines)}')
        semi = sum(1 for l in lines if l.strip().endswith(';'))
        print(f'  Lines ending with semicolon: {semi}')
        
        break
    sz_raw = header[255:269]
    sz_str = sz_raw[:sz_raw.find(b'\x00')].decode('ascii', errors='replace')
    if sz_str:
        try:
            size = int(sz_str)
        except ValueError:
            break
        pos += HEADER_SIZE + size
    else:
        break