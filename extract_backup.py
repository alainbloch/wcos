#!/usr/bin/env python3
"""Extract database and files from .wpress backup for manual migration to Local WP."""
import os, re, sys

WPRESS = '/Users/alainbloch/work/wcos/vead-sg-host-com-20260717-212140-46b630uwyn2b.wpress'
PUBLIC = '/Users/alainbloch/Local Sites/western-circle/app/public'
SQL_OUT = '/Users/alainbloch/work/wcos/import.sql'

with open(WPRESS, 'rb') as f:
    data = f.read()

HEADER_SIZE = 4377

def read_field(buf, start, end):
    raw = buf[start:end]
    null_pos = raw.find(b'\x00')
    if null_pos >= 0:
        return raw[:null_pos].decode('utf-8', errors='replace')
    return raw.decode('utf-8', errors='replace')

# Step 1: Extract the database SQL
print("=== Step 1: Extracting database SQL ===")
pos = 0
db_sql = None
while pos + HEADER_SIZE <= len(data):
    header = data[pos:pos+HEADER_SIZE]
    if header == b'\x00' * HEADER_SIZE:
        break
    name = read_field(header, 0, 255)
    if not name:
        break
    size = int(read_field(header, 255, 269))
    if name == 'database.sql':
        db_sql = data[pos+HEADER_SIZE:pos+HEADER_SIZE+size].decode('utf-8')
        print(f"  Found database.sql: {len(db_sql)} bytes")
        break
    pos += HEADER_SIZE + size

if not db_sql:
    print("  ERROR: database.sql not found!")
    sys.exit(1)

# Step 2: Replace table prefix placeholder
print("=== Step 2: Replacing SERVMASK_PREFIX_ with wp_ ===")
sql_fixed = db_sql.replace('SERVMASK_PREFIX_', 'wp_')
prefix_count = sql_fixed.count('wp_')
print(f"  Prefix replacements applied (wp_ count: {prefix_count})")

# Step 3: Replace site URL (vead.sg-host.com → western-circle.local)
# For serialized data, we need to handle string length updates
# The URLs appear in serialized PHP data and plain SQL
print("=== Step 3: Replacing site URL ===")

# Simple count first
old_url = 'https://vead.sg-host.com'
new_url = 'http://western-circle.local'
old_url_count = sql_fixed.count(old_url)
print(f"  Found {old_url_count} occurrences of {old_url}")

# For serialized data: s:N:"https://vead.sg-host.com/..." → s:M:"http://western-circle.local/..."
# Where M = N - 1 (since https:// is 8 chars vs http:// is 7, minus 1)
# Actually, https://vead.sg-host.com is 24 chars, http://western-circle.local is 28 chars
# So we need to INCREASE length by 4. But only in serialized data.
# For plain SQL (siteurl, home), we can do direct replacement.

# Let's handle serialized data properly
# Pattern: s:(\d+):"<URL>..."
# The URL appears in different lengths in different contexts
# Best approach: use WP-CLI search-replace after import, which handles serialization.
# For now, let's do a direct replacement for the siteurl/home options, 
# and leave the serialized data for WP-CLI

# Actually, let me just do the direct replacement in the SQL for the options table
# and handle serialized data via WP-CLI later

# Let's do a simple replacement for the non-serialized parts
# (siteurl, home, and any other plain text references)
# The serialized data will be handled by WP-CLI

# Direct replacement for option values in the SQL
# This handles the siteurl and home option values
sql_fixed = sql_fixed.replace(
    "'siteurl','https://vead.sg-host.com'",
    "'siteurl','http://western-circle.local'"
)
sql_fixed = sql_fixed.replace(
    "'home','https://vead.sg-host.com'",
    "'home','http://western-circle.local'"
)

# Also replace in wp_options serialized data for upload_path etc.
# But we'll handle the bulk of serialized URL replacement with WP-CLI

# Write the SQL file
with open(SQL_OUT, 'w') as f:
    f.write(sql_fixed)
print(f"  SQL written to {SQL_OUT}")

# Step 4: Extract all files
print("\n=== Step 4: Extracting files ===")
pos = 0
file_count = 0
while pos + HEADER_SIZE <= len(data):
    header = data[pos:pos+HEADER_SIZE]
    if header == b'\x00' * HEADER_SIZE:
        break
    name = read_field(header, 0, 255)
    if not name:
        break
    size = int(read_field(header, 255, 269))
    prefix = read_field(header, 281, HEADER_SIZE)
    
    # Build the target path
    if prefix:
        rel_path = os.path.join(prefix, name)
    else:
        rel_path = name
    
    # Skip database.sql - we already handled it
    if name == 'database.sql':
        pos += HEADER_SIZE + size
        continue
    
    # Skip package.json
    if name == 'package.json':
        pos += HEADER_SIZE + size
        continue
    
    # Build the full path
    full_path = os.path.join(PUBLIC, rel_path)
    
    # Create directory if needed
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    
    # Write the file
    content = data[pos+HEADER_SIZE:pos+HEADER_SIZE+size]
    with open(full_path, 'wb') as f:
        f.write(content)
    
    file_count += 1
    if file_count % 1000 == 0:
        print(f"  Extracted {file_count} files...")
    
    pos += HEADER_SIZE + size

print(f"  Total files extracted: {file_count}")
print(f"\nDone! Next: import the SQL and run WP-CLI search-replace.")