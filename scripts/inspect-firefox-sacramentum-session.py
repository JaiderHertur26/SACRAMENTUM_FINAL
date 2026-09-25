import os, sqlite3, shutil, json, glob
base=os.path.join(os.environ['APPDATA'],'Mozilla','Firefox','Profiles')
for prof in glob.glob(os.path.join(base,'*')):
    src=os.path.join(prof,'webappsstore.sqlite')
    if not os.path.exists(src):
        continue
    dst=os.path.join(os.environ.get('TEMP','C:\\Temp'),'sacramentum_webappsstore.sqlite')
    try:
        shutil.copy2(src,dst)
        con=sqlite3.connect(dst)
        cur=con.cursor()
        rows=cur.execute("select originKey,key,length(value) from webappsstore2 where key like '%foczofcmwampjvlfbsqn%' or key like 'sb-%-auth-token' or originKey like '%127.0.0.1%'").fetchall()
        if rows:
            print('PROFILE',os.path.basename(prof))
            for origin,key,n in rows:
                print('FOUND',origin,key,n)
        con.close()
    except Exception as e:
        print('ERR',os.path.basename(prof),type(e).__name__)
