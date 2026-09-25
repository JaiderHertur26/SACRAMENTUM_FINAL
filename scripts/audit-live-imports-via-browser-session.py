import os, sqlite3, json, pathlib, urllib.request, urllib.parse, sys
ROOT=pathlib.Path(r'C:\SACRAMENTUM\SACRAMENTUM_FINAL')
profiles=pathlib.Path(os.environ['APPDATA'])/'Mozilla'/'Firefox'/'Profiles'
ref='foczofcmwampjvlfbsqn'
found=None
for db in profiles.glob('*/webappsstore.sqlite'):
    try:
        con=sqlite3.connect(f'file:{db}?mode=ro', uri=True)
        rows=con.execute("select key,value from webappsstore2 where key like ?", (f'%{ref}%auth-token%',)).fetchall()
        con.close()
        if rows:
            found=(db,rows[0][0],rows[0][1]); break
    except Exception:
        pass
if not found:
    print('NO_BROWSER_SESSION'); sys.exit(2)
_, storage_key, raw = found
try:
    token=json.loads(raw)
except Exception:
    print('BAD_BROWSER_SESSION_JSON'); sys.exit(3)
access=token.get('access_token') or token.get('currentSession',{}).get('access_token')
if not access:
    print('NO_ACCESS_TOKEN'); sys.exit(4)
print('BROWSER_SESSION_OK')
env={}
for p in [ROOT/'.env.local', ROOT/'.env']:
    if p.exists():
        for line in p.read_text(encoding='utf-8', errors='ignore').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k,v=line.split('=',1); env[k.strip()]=v.strip().strip('"').strip("'")
url=env.get('VITE_SUPABASE_URL')
apikey=env.get('VITE_SUPABASE_PUBLISHABLE_KEY') or env.get('VITE_SUPABASE_ANON_KEY')
if not url or not apikey:
    print('NO_SUPABASE_ENV'); sys.exit(5)
headers={'apikey':apikey,'Authorization':f'Bearer {access}','Accept':'application/json'}
def rest(table, params=None):
    qs=urllib.parse.urlencode(params or {}, safe='(),.*:')
    req=urllib.request.Request(f"{url}/rest/v1/{table}?{qs}", headers=headers)
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.loads(r.read().decode('utf-8')), dict(r.headers)
def exact_count(table, filters=None):
    params={'select':'id','limit':'1'}; params.update(filters or {})
    h=dict(headers); h['Prefer']='count=exact'; h['Range']='0-0'
    qs=urllib.parse.urlencode(params, safe='(),.*:')
    req=urllib.request.Request(f"{url}/rest/v1/{table}?{qs}", headers=h)
    with urllib.request.urlopen(req, timeout=20) as r:
        cr=r.headers.get('Content-Range','*/0')
        return int(cr.split('/')[-1]) if '/' in cr and cr.split('/')[-1].isdigit() else None
batches,_=rest('legacy_import_batches',{
    'select':'id,profile_key,original_filename,status,row_count,valid_count,review_count,imported_count,skipped_count,error_count,parish_id,sha256,created_at,updated_at,metadata',
    'profile_key':'in.(BAUTIZOS,CONFIRMA,INSBAUTI,INSCONFI)','order':'created_at.desc','limit':'12'})
print('BATCHES_JSON='+json.dumps(batches,ensure_ascii=False))
parish_ids=sorted({b.get('parish_id') for b in batches if b.get('parish_id')})
parishes=[]
if parish_ids:
    parishes,_=rest('parishes',{'select':'id,name,diocese_id,city','id':'in.('+','.join(parish_ids)+')'})
print('PARISHES_JSON='+json.dumps(parishes,ensure_ascii=False))
latest_by_profile={}
for b in batches:
    latest_by_profile.setdefault(b['profile_key'],b)
for prof in ('INSBAUTI','INSCONFI'):
    b=latest_by_profile.get(prof)
    if not b: continue
    rows,_=rest('legacy_import_rows',{
        'select':'id,row_number,status,target_entity,target_table,target_id,issue_codes,issue_details,source_key',
        'batch_id':f"eq.{b['id']}",'order':'row_number.asc','limit':'1000'})
    pre,_=rest('legacy_pre_sacrament_registrations',{
        'select':'id,profile_key,batch_id,row_id,sacrament_type,legacy_entry_number,source_parish_name,reported,reconciliation_status,matched_table,matched_record_id,match_method,match_score,names,last_names,celebration_date',
        'batch_id':f"eq.{b['id']}",'order':'created_at.asc','limit':'1000'})
    print(prof+'_ROWS_JSON='+json.dumps(rows,ensure_ascii=False))
    print(prof+'_PRE_JSON='+json.dumps(pre,ensure_ascii=False))
print('BAPTISMS_COUNT='+str(exact_count('baptisms')))
print('CONFIRMATIONS_COUNT='+str(exact_count('confirmations')))
print('PENDING_BAPTISMS_COUNT='+str(exact_count('pending_baptisms')))
print('PENDING_CONFIRMATIONS_COUNT='+str(exact_count('pending_confirmations')))
