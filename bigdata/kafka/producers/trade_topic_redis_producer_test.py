import redis
import json

r = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# 1️⃣ 모든 주문 키 확인
keys = r.keys("market:order:*")
print("Order keys:", keys)

for k in keys:
    val = r.get(k)  # JSON 문자열
    try:
        data = json.loads(val)
        print(f"{k} ->", data)
    except Exception as e:
        print(f"{k} -> JSON parse error:", e, "RAW:", val)

# 2️⃣ 호가창 ZSET 확인
item_id = 1  # 확인할 아이템
buy_zset = r.zrange("market:orderbook:{}:buy".format(item_id), 0, -1, withscores=True)
sell_zset = r.zrange("market:orderbook:{}:sell".format(item_id), 0, -1, withscores=True)

print("Buy ZSET:", buy_zset)
print("Sell ZSET:", sell_zset)