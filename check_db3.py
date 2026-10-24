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
        
        # Find the specific options INSERT line
        for i, line in enumerate(lines):
            if 'SERVMASK_PREFIX_options' in line and line.startswith('INSERT'):
                print(f'=== Options INSERT at line {i+1} ({len(line)} chars) ===')
                # Print the first 2000 chars to understand the format
                print(line[:2000])
                print()
                
                # Extract all option_name values
                # Format: VALUES (1,'option_name','option_value','autoload'),(2,...)
                # Let's find all option_name entries
                opt_matches = re.findall(r"\((\d+),'([^']+)'", line)
                key_opts = ['siteurl', 'home', 'blogname', 'admin_email', 'template', 'stylesheet', 'active_plugins', 'db_version', 'upload_path', 'elementor_active_kit', 'current_theme']
                print(f'\n=== Key options found ===')
                for id_val, opt_name in opt_matches:
                    if opt_name in key_opts:
                        # Find the value - it's between commas after the option name
                        # Pattern: (id,'option_name','option_value','autoload')
                        pattern = re.escape(f"({id_val},'{opt_name}','") + r"(.*?)','(?:on|off)"
                        val_match = re.search(pattern, line)
                        if val_match:
                            val = val_match.group(1)
                            # Truncate if very long
                            if len(val) > 200:
                                print(f'  {opt_name} = {val[:200]}...')
                            else:
                                print(f'  {opt_name} = {val}')
                
                # Check for serialized data mismatches
                print(f'\n=== Serialized data integrity check ===')
                # Find all PHP serialized strings
                ser_pattern = r"s:(\d+):\"([^\"]*?)\""
                serials = re.findall(ser_pattern, content)
                mismatches = 0
                for length_str, value in serials:
                    declared_len = int(length_str)
                    actual_len = len(value)
                    if actual_len != declared_len:
                        mismatches += 1
                        if mismatches <= 10:
                            print(f'  MISMATCH: declared s:{declared_len}, actual {actual_len} chars')
                            print(f'    Value: {value[:100]}')
                
                if mismatches == 0:
                    print(f'  No serialization mismatches found in {len(serials)} serialized strings')
                else:
                    print(f'  Total mismatches: {mismatches}')
                
                break
        
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