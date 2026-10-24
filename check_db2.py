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
        lines = content.split('\n')
        
        print('=== Key options from wp_options ===')
        key_opts = ['siteurl', 'home', 'blogname', 'admin_email', 'template', 'stylesheet', 'active_plugins', 'db_version', 'upload_path']
        for line in lines:
            if 'SERVMASK_PREFIX_options' in line and line.startswith('INSERT'):
                # Extract option_name values using regex
                matches = re.findall(r"VALUES\s*\((.*?)\)", line, re.DOTALL)
                if matches:
                    # Parse the multi-value insert
                    for m in matches:
                        # Split by '),(' to get individual rows
                        rows = re.split(r"\),\s*\(", m)
                        for row in rows:
                            row = row.strip()
                            # Ensure balanced parens
                            if row.startswith('('):
                                row = row[1:]
                            if row.endswith(')'):
                                row = row[:-1]
                            # Extract option_name (second field, normally)
                            parts = row.split("','")
                            if len(parts) >= 2:
                                opt_name = parts[0].strip("'").strip("(")
                                if opt_name in key_opts:
                                    # Get the value (second field)
                                    val = parts[1] if len(parts) > 1 else ''
                                    print(f'  {opt_name} = {val[:200]}')
        
        # Check serialized data
        print('\n=== Serialized data check ===')
        s_serials = re.findall(r"s:(\d+):\"([^\"]+)\"", content)
        if s_serials:
            mismatches = []
            for length, value in s_serials[:5000]:
                if len(value) != int(length):
                    mismatches.append((length, value[:50]))
            if mismatches:
                print(f'  MISMATCHES found: {len(mismatches)}')
                for length, val in mismatches[:10]:
                    print(f'    Declared: {length}, Actual: {len(val)} - {val}')
            else:
                print(f'  No serialization mismatches in first 5000 entries')
        else:
            # Try looking for s: without the regex issue
            print('  No s:N: patterns found (checking differently)')
            ser_count = content.count('s:')
            print(f'  Total "s:" occurrences: {ser_count}')
        
        # Check wp_version
        print('\n=== WordPress version in DB ===')
        for line in lines:
            if line.startswith('INSERT') and 'SERVMASK_PREFIX_options' in line:
                if "'db_version'" in line:
                    print(f'  db_version line: {line[:300]}')
                if "'user_roles'" in line or "'wp_user_roles'" in line:
                    print(f'  user_roles line: {line[:300]}')
        
        # Check for any error_log references or corruption
        print('\n=== Error/issue search ===')
        error_patterns = ['error_log', 'Error:'] 
        for pat in error_patterns:
            count = content.count(pat)
            if count > 0:
                print(f'  "{pat}" found: {count} times')
        
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