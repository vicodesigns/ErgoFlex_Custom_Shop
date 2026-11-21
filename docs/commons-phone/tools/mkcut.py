import json,sys
src,dst=sys.argv[1],sys.argv[2]
d=json.load(open(src))
json.dump({"name":"cphone","shots":[d]},open(dst,'w'))
